/**
 * Ajusta el umbral de la regla de marketing.
 *
 *   npm run regla            ver el estado y el impacto
 *   npm run regla 190        líneas bajo $190 cuentan como marketing
 *   npm run regla 5          solo las cortesías a precio simbólico
 *   npm run regla off        desactivar: todo cuenta como ingreso
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const arg = process.argv[2];
const TENANT = process.argv[3] ?? process.env.TENANT_ID ?? 'brewwines';

const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

async function main() {
  if (arg) {
    const valor = arg.toLowerCase() === 'off' ? null : Number(arg);
    if (valor !== null && !(valor >= 0)) {
      throw new Error('Indica un número o "off": npm run regla 190');
    }
    await pool.query('UPDATE tenants SET umbral_marketing = $1 WHERE id = $2', [valor, TENANT]);
    console.log(valor === null
      ? `Regla desactivada para "${TENANT}": todas las ventas cuentan como ingreso.\n`
      : `Umbral de "${TENANT}" ajustado a $${valor}.\n`);
  }

  const { rows: cfg } = await pool.query(
    'SELECT nombre, umbral_marketing AS u FROM tenants WHERE id = $1', [TENANT]);
  const u = cfg[0]?.u == null ? null : Number(cfg[0].u);

  console.log(`Cliente: ${cfg[0]?.nombre ?? TENANT}`);
  console.log(`Regla:   ${u == null ? 'desactivada' : `ventas con precio unitario < $${u} → marketing`}\n`);

  const { rows } = await pool.query(
    `SELECT
       SUM(monto_total)::float8 AS total,
       SUM(monto_total) FILTER (WHERE precio_unitario < COALESCE($2::numeric, 0))::float8 AS fuera,
       COUNT(*) FILTER (WHERE precio_unitario < COALESCE($2::numeric, 0))::int AS lineas_fuera,
       SUM(unidades) FILTER (WHERE precio_unitario < COALESCE($2::numeric, 0))::int AS botellas_fuera
     FROM ventas WHERE tenant_id = $1`,
    [TENANT, u]
  );
  const r = rows[0];
  const fuera = Number(r.fuera ?? 0);

  console.log(`Venta bruta del periodo   ${mxn(Number(r.total))}`);
  console.log(`Clasificado como marketing ${mxn(fuera)}  (${r.lineas_fuera ?? 0} líneas, ${(r.botellas_fuera ?? 0).toLocaleString('es-MX')} botellas)`);
  console.log(`Ingresos que muestra       ${mxn(Number(r.total) - fuera)}\n`);

  // Cómo se ve la partida con distintos umbrales
  console.log('Con otros umbrales:');
  for (const t of [0, 5, 50, 100, 190]) {
    const { rows: x } = await pool.query(
      `SELECT SUM(monto_total)::float8 AS m, COUNT(*)::int AS n
       FROM ventas WHERE tenant_id = $1 AND precio_unitario < $2`, [TENANT, t]);
    const etq = t === 0 ? 'desactivada' : `< $${t}`;
    console.log(`  ${etq.padEnd(14)} ${mxn(Number(x[0].m ?? 0)).padStart(12)}  ${String(x[0].n).padStart(4)} líneas`);
  }
  console.log('');
  await pool.end();
}

main().catch(e => { console.error('\n' + e.message); process.exit(1); });
