/**
 * Límite diario de operaciones con IA.
 *
 * El contador vive en la base, no en memoria: en Vercel cada invocación
 * corre en un proceso distinto, así que un contador en RAM no serviría.
 *
 * El día se calcula en hora de Ciudad de México, no UTC, para que el
 * reinicio ocurra a medianoche local y no a las 6 de la tarde.
 */
import { pool, TENANT } from './db';

export interface EstadoLimite {
  permitido: boolean;
  usadas: number;
  limite: number;
  restantes: number;
  /** Motivo del bloqueo, cuando permitido = false */
  motivo?: 'consultas' | 'tokens';
  tokensHoy?: number;
  tokensMax?: number | null;
  /** Porcentaje consumido del día: el mayor de los dos topes. 0 a 100. */
  pct: number;
  /**
   * Consultas que le quedan al usuario, ya considerando ambos topes.
   * Es la única cifra que se le muestra: si el presupuesto de tokens alcanza
   * para menos consultas de las que restan por conteo, manda el presupuesto.
   */
  disponibles: number;
  /** Consultas equivalentes que caben en el presupuesto del día. */
  totalEquivalente: number;
}

/** Tokens reportados por la API en cada respuesta. */
export interface Consumo {
  entrada: number;
  salida: number;
  cacheEscritura: number;
  cacheLectura: number;
}

export const CONSUMO_CERO: Consumo = {
  entrada: 0, salida: 0, cacheEscritura: 0, cacheLectura: 0,
};

/** Suma el bloque `usage` de una respuesta de la API a un acumulador. */
export function acumular(c: Consumo, usage: {
  input_tokens?: number; output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
} | undefined): Consumo {
  if (!usage) return c;
  return {
    entrada: c.entrada + (usage.input_tokens ?? 0),
    salida: c.salida + (usage.output_tokens ?? 0),
    cacheEscritura: c.cacheEscritura + (usage.cache_creation_input_tokens ?? 0),
    cacheLectura: c.cacheLectura + (usage.cache_read_input_tokens ?? 0),
  };
}

/** Costo en "operaciones" de cada acción. El reporte pesa más porque manda más contexto. */
export const COSTO = { chat: 1, reporte: 3 } as const;

const hoyMx = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

async function topesDe(tenant: string): Promise<{ consultas: number; tokens: number | null }> {
  const { rows } = await pool.query(
    `SELECT COALESCE(limite_ia_diario, 50) AS l, tokens_dia_max AS t
     FROM tenants WHERE id = $1`, [tenant]
  );
  return { consultas: rows[0]?.l ?? 50, tokens: rows[0]?.t ?? null };
}

/**
 * Tokens que cuesta en promedio una consulta de este cliente.
 * Se calcula sobre su histórico real; si aún no hay suficiente, se asume un
 * valor conservador para no prometer más consultas de las que caben.
 */
const TOKENS_POR_CONSULTA_DEFECTO = 25_000;

async function tokensPorConsultaDe(tenant: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(consultas),0)::float8 AS c,
            COALESCE(SUM(tok_entrada + tok_salida + tok_cache_escritura + tok_cache_lectura),0)::float8 AS t
     FROM uso_ia WHERE tenant_id = $1`, [tenant]
  );
  const { c, t } = rows[0];
  if (c < 5 || t <= 0) return TOKENS_POR_CONSULTA_DEFECTO;
  return Math.max(1000, t / c);
}

/** Tokens facturables del día (el caché de lectura cuesta bastante menos, pero cuenta). */
async function tokensHoyDe(tenant: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(tok_entrada + tok_salida + tok_cache_escritura + tok_cache_lectura, 0) AS t
     FROM uso_ia WHERE tenant_id = $1 AND fecha = $2::date`, [tenant, hoyMx()]
  );
  return Number(rows[0]?.t ?? 0);
}

/** Consulta el estado sin consumir nada. */
export async function estadoLimite(tenant = TENANT): Promise<EstadoLimite> {
  const [topes, uso, tokensHoy, tokPorConsulta] = await Promise.all([
    topesDe(tenant),
    pool.query('SELECT consultas FROM uso_ia WHERE tenant_id = $1 AND fecha = $2::date',
      [tenant, hoyMx()]),
    tokensHoyDe(tenant),
    tokensPorConsultaDe(tenant),
  ]);

  const usadas = uso.rows[0]?.consultas ?? 0;
  const porConsultas = usadas < topes.consultas;
  const porTokens = topes.tokens == null || tokensHoy < topes.tokens;

  // El presupuesto de tokens se traduce a "cuántas consultas más caben".
  const restanConteo = Math.max(0, topes.consultas - usadas);
  const restanPresupuesto = topes.tokens == null
    ? Infinity
    : Math.max(0, Math.floor((topes.tokens - tokensHoy) / tokPorConsulta));

  const disponibles = Math.min(restanConteo, restanPresupuesto);

  // Total equivalente del día, para que el porcentaje sea coherente.
  const totalPresupuesto = topes.tokens == null
    ? Infinity
    : Math.max(1, Math.floor(topes.tokens / tokPorConsulta));
  const totalEquivalente = Math.min(topes.consultas, totalPresupuesto);

  const permitido = porConsultas && porTokens && disponibles > 0;

  return {
    permitido,
    usadas, limite: topes.consultas,
    restantes: restanConteo,
    motivo: !porConsultas ? 'consultas' : !porTokens ? 'tokens' : undefined,
    tokensHoy, tokensMax: topes.tokens,
    disponibles: permitido ? disponibles : 0,
    totalEquivalente,
    pct: totalEquivalente > 0
      ? Math.min(100, Math.round(((totalEquivalente - disponibles) / totalEquivalente) * 100))
      : 100,
  };
}

/**
 * Reserva cupo de forma atómica y devuelve el estado resultante.
 * Si no alcanza, no incrementa y devuelve permitido: false.
 */
export async function consumir(costo = 1, tenant = TENANT): Promise<EstadoLimite> {
  const topes = await topesDe(tenant);
  const limite = topes.consultas;

  // El tope de tokens se revisa antes: es el que protege el gasto real.
  if (topes.tokens != null) {
    const tokensHoy = await tokensHoyDe(tenant);
    if (tokensHoy >= topes.tokens) {
      const actual = await estadoLimite(tenant);
      return { ...actual, permitido: false, motivo: 'tokens' };
    }
  }

  // El UPDATE condicional evita que dos peticiones simultáneas pasen el tope.
  const { rows } = await pool.query(
    `INSERT INTO uso_ia (tenant_id, fecha, consultas)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (tenant_id, fecha) DO UPDATE
       SET consultas = uso_ia.consultas + $3
       WHERE uso_ia.consultas + $3 <= $4
     RETURNING consultas`,
    [tenant, hoyMx(), costo, limite]
  );

  if (!rows.length) {
    const actual = await estadoLimite(tenant);
    return { ...actual, permitido: false };
  }

  // Se recalcula el estado completo para que todos los caminos devuelvan
  // exactamente la misma cifra de consultas disponibles.
  return await estadoLimite(tenant);
}


/**
 * Registra los tokens realmente consumidos. Se llama al terminar la operación,
 * cuando la API ya reportó el uso. No bloquea nada: solo contabiliza.
 */
export async function registrarTokens(c: Consumo, llamadas = 1, tenant = TENANT) {
  if (!c.entrada && !c.salida && !c.cacheLectura && !c.cacheEscritura) return;
  await pool.query(
    `INSERT INTO uso_ia (tenant_id, fecha, consultas, llamadas,
                         tok_entrada, tok_salida, tok_cache_escritura, tok_cache_lectura)
     VALUES ($1, $2::date, 0, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, fecha) DO UPDATE SET
       llamadas            = uso_ia.llamadas + EXCLUDED.llamadas,
       tok_entrada         = uso_ia.tok_entrada + EXCLUDED.tok_entrada,
       tok_salida          = uso_ia.tok_salida + EXCLUDED.tok_salida,
       tok_cache_escritura = uso_ia.tok_cache_escritura + EXCLUDED.tok_cache_escritura,
       tok_cache_lectura   = uso_ia.tok_cache_lectura + EXCLUDED.tok_cache_lectura`,
    [tenant, hoyMx(), llamadas, c.entrada, c.salida, c.cacheEscritura, c.cacheLectura]
  );
}

/**
 * Devuelve cupo de operaciones. Se usa cuando el usuario cancela antes de que
 * la API haya respondido: no se consumió nada, así que no debe cobrarse.
 * Los tokens ya gastados nunca se devuelven, porque ya se pagaron.
 */
export async function devolver(costo = 1, tenant = TENANT) {
  await pool.query(
    `UPDATE uso_ia SET consultas = GREATEST(0, consultas - $1)
     WHERE tenant_id = $2 AND fecha = $3::date`,
    [costo, tenant, hoyMx()]
  );
}
