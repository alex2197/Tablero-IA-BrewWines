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
}

/** Costo en "operaciones" de cada acción. El reporte pesa más porque manda más contexto. */
export const COSTO = { chat: 1, reporte: 3 } as const;

const hoyMx = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

async function limiteDe(tenant: string): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COALESCE(limite_ia_diario, 50) AS l FROM tenants WHERE id = $1', [tenant]
  );
  return rows[0]?.l ?? 50;
}

/** Consulta el estado sin consumir nada. */
export async function estadoLimite(tenant = TENANT): Promise<EstadoLimite> {
  const [limite, uso] = await Promise.all([
    limiteDe(tenant),
    pool.query('SELECT consultas FROM uso_ia WHERE tenant_id = $1 AND fecha = $2::date',
      [tenant, hoyMx()]),
  ]);
  const usadas = uso.rows[0]?.consultas ?? 0;
  return { permitido: usadas < limite, usadas, limite, restantes: Math.max(0, limite - usadas) };
}

/**
 * Reserva cupo de forma atómica y devuelve el estado resultante.
 * Si no alcanza, no incrementa y devuelve permitido: false.
 */
export async function consumir(costo = 1, tenant = TENANT): Promise<EstadoLimite> {
  const limite = await limiteDe(tenant);

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

  const usadas = rows[0].consultas;
  return { permitido: true, usadas, limite, restantes: Math.max(0, limite - usadas) };
}
