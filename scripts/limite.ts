/**
 * Ajusta el límite diario de operaciones con IA de un cliente.
 *   npm run limite 20              -> 20 consultas por día
 *   npm run limite pesos 25        -> presupuesto de $25 MXN por día
 *   npm run limite tokens 400000   -> tope directo en tokens
 *   npm run limite tokens 0        -> quitar el tope de consumo
 *   npm run limite                 -> solo mostrar el uso actual
 *
 * "pesos" convierte el presupuesto a tokens usando los precios de .env y la
 * mezcla real de entrada/salida/caché que ha tenido este cliente. Si todavía
 * no hay histórico, usa una mezcla típica y lo advierte.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const modo = ['tokens', 'pesos'].includes(process.argv[2] ?? '') ? process.argv[2] : null;
const nuevo = modo
  ? (process.argv[3] ? Number(process.argv[3]) : null)
  : (process.argv[2] ? Number(process.argv[2]) : null);
const TENANT = (modo ? process.argv[4] : process.argv[3])
  ?? process.env.TENANT_ID ?? 'brewwines';

const PRECIO = {
  entrada: Number(process.env.PRECIO_ENTRADA_MTOK ?? 0),
  salida: Number(process.env.PRECIO_SALIDA_MTOK ?? 0),
  cacheEscritura: Number(process.env.PRECIO_CACHE_ESCRITURA_MTOK ?? 0),
  cacheLectura: Number(process.env.PRECIO_CACHE_LECTURA_MTOK ?? 0),
};
const TC = Number(process.env.TIPO_CAMBIO_USD ?? 20);

/**
 * Precio promedio de un token para este cliente, en dólares.
 * Se calcula con su mezcla real de entrada/salida/caché. Si no hay histórico,
 * se asume una mezcla típica de este tipo de uso.
 */
async function precioPorToken(pool: Pool, tenant: string) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(tok_entrada),0)::float8         AS ent,
            COALESCE(SUM(tok_salida),0)::float8          AS sal,
            COALESCE(SUM(tok_cache_escritura),0)::float8 AS ce,
            COALESCE(SUM(tok_cache_lectura),0)::float8   AS cl
     FROM uso_ia WHERE tenant_id = $1`, [tenant]
  );
  const r = rows[0];
  const total = r.ent + r.sal + r.ce + r.cl;

  // Mezcla típica cuando aún no hay datos: mucha entrada cacheada, poca salida.
  const mezcla = total > 1000
    ? { ent: r.ent / total, sal: r.sal / total, ce: r.ce / total, cl: r.cl / total }
    : { ent: 0.25, sal: 0.08, ce: 0.07, cl: 0.60 };

  const usdPorMillon =
    mezcla.ent * PRECIO.entrada + mezcla.sal * PRECIO.salida +
    mezcla.ce * PRECIO.cacheEscritura + mezcla.cl * PRECIO.cacheLectura;

  return { usdPorMillon, conHistorico: total > 1000, mezcla };
}

async function main() {
  if (nuevo != null && modo === 'pesos') {
    if (!(nuevo >= 0)) throw new Error('Indica el presupuesto: npm run limite pesos 25');
    if (nuevo === 0) {
      await pool.query('UPDATE tenants SET tokens_dia_max = NULL WHERE id = $1', [TENANT]);
      console.log(`Presupuesto de "${TENANT}" eliminado.\n`);
    } else {
      const sumaPrecios = Object.values(PRECIO).reduce((a, b) => a + b, 0);
      if (sumaPrecios === 0) {
        throw new Error(
          'Faltan los precios en .env para convertir pesos a tokens.\n' +
          'Agrega PRECIO_ENTRADA_MTOK, PRECIO_SALIDA_MTOK, PRECIO_CACHE_ESCRITURA_MTOK\n' +
          'y PRECIO_CACHE_LECTURA_MTOK con los valores de\n' +
          'https://platform.claude.com/docs/en/about-claude/models/overview'
        );
      }
      const { usdPorMillon, conHistorico } = await precioPorToken(pool, TENANT);
      const usd = nuevo / TC;
      const tokens = Math.round((usd / usdPorMillon) * 1e6);

      await pool.query('UPDATE tenants SET tokens_dia_max = $1 WHERE id = $2', [tokens, TENANT]);
      console.log(`Presupuesto de "${TENANT}": $${nuevo} MXN por día`);
      console.log(`  equivale a ${tokens.toLocaleString('es-MX')} tokens diarios`);
      console.log(`  ≈ $${(nuevo * 30).toLocaleString('es-MX')} MXN al mes si lo agota todos los días`);
      if (!conHistorico) {
        console.log('  (calculado con una mezcla típica; se afina cuando haya uso real)');
      }
      console.log('');
    }
  } else if (nuevo != null && modo === 'tokens') {
    if (!Number.isInteger(nuevo) || nuevo < 0) throw new Error('Indica un entero: npm run limite tokens 400000');
    await pool.query('UPDATE tenants SET tokens_dia_max = $1 WHERE id = $2',
      [nuevo === 0 ? null : nuevo, TENANT]);
    console.log(nuevo === 0
      ? `Tope de tokens de "${TENANT}" eliminado.\n`
      : `Tope de "${TENANT}" ajustado a ${nuevo.toLocaleString('es-MX')} tokens por día.\n`);
  } else if (nuevo != null) {
    if (!Number.isInteger(nuevo) || nuevo < 1) throw new Error('El límite debe ser un entero mayor a 0');
    await pool.query('UPDATE tenants SET limite_ia_diario = $1 WHERE id = $2', [nuevo, TENANT]);
    console.log(`Límite de "${TENANT}" ajustado a ${nuevo} operaciones por día.\n`);
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.nombre, t.limite_ia_diario AS limite, t.tokens_dia_max AS tokmax,
            COALESCE(u.consultas, 0) AS hoy,
            COALESCE(u.tok_entrada + u.tok_salida + u.tok_cache_escritura + u.tok_cache_lectura, 0) AS tokhoy
     FROM tenants t
     LEFT JOIN uso_ia u ON u.tenant_id = t.id
       AND u.fecha = (now() AT TIME ZONE 'America/Mexico_City')::date
     ORDER BY t.id`
  );
  const sumaPrecios = Object.values(PRECIO).reduce((a, b) => a + b, 0);
  const { usdPorMillon } = sumaPrecios > 0
    ? await precioPorToken(pool, TENANT)
    : { usdPorMillon: 0 };
  const aPesos = (tok: number) => (tok / 1e6) * usdPorMillon * TC;

  console.log(
    'Cliente'.padEnd(16) + 'Consultas'.padStart(11) + 'Tokens hoy'.padStart(13) +
    'Tope'.padStart(13) + (usdPorMillon ? 'Gasto hoy'.padStart(11) + 'Presup.'.padStart(10) : '')
  );
  console.log('-'.repeat(usdPorMillon ? 74 : 53));
  for (const r of rows) {
    const tokhoy = Number(r.tokhoy);
    console.log(
      String(r.nombre).slice(0, 15).padEnd(16) +
      `${r.hoy}/${r.limite}`.padStart(11) +
      tokhoy.toLocaleString('es-MX').padStart(13) +
      (r.tokmax ? Number(r.tokmax).toLocaleString('es-MX') : '—').padStart(13) +
      (usdPorMillon
        ? ('$' + aPesos(tokhoy).toFixed(2)).padStart(11) +
          (r.tokmax ? '$' + aPesos(Number(r.tokmax)).toFixed(0) : '—').padStart(10)
        : '')
    );
  }
  if (!usdPorMillon) {
    console.log('\n  Agrega los precios a .env para ver el gasto en pesos.');
  }

  const hist = await pool.query(
    `SELECT fecha::text, consultas FROM uso_ia
     WHERE tenant_id = $1 ORDER BY fecha DESC LIMIT 7`, [TENANT]);
  if (hist.rows.length) {
    console.log('\nÚltimos días:');
    for (const h of hist.rows) console.log(`  ${h.fecha}  ${h.consultas}`);
  }
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
