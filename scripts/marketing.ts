/**
 * Siembra la tabla de ventas reclasificadas con los valores extraídos del
 * modelo de Power BI (donde la tabla se llamaba "Marketing").
 *
 * IMPORTANTE: estos montos NO son gasto publicitario. Son ventas menores a
 * $190 que el cliente pidió agrupar aparte. Confirmar el criterio antes de
 * usarlos para cualquier conclusión de negocio.
 *   npx tsx scripts/marketing.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TENANT = process.argv[2] ?? 'brewwines';

const FILAS: [string, number][] = [
  ['2026-01', 17522.58],
  ['2026-02', 54140.92],
  ['2026-03', 64151.22],
  ['2026-04', 25111.45],
  ['2026-05', 25481.63],
  ['2026-06', 105200.30],
  ['2026-07', 359758.60],
];

async function main() {
  await pool.query('DELETE FROM ventas_reclasificadas WHERE tenant_id = $1', [TENANT]);
  for (const [periodo, monto] of FILAS) {
    await pool.query(
      `INSERT INTO ventas_reclasificadas (tenant_id, periodo, monto, concepto)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [TENANT, periodo, monto, 'Ventas menores a $190']
    );
  }
  console.log(`ventas_reclasificadas: ${FILAS.length} periodos`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
