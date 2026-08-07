/**
 * Siembra la tabla Marketing con los valores extraídos del modelo de Power BI.
 * El cliente los actualiza mensualmente.
 *   npx tsx scripts/marketing.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TENANT = process.argv[2] ?? 'teravino';

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
  await pool.query('DELETE FROM marketing WHERE tenant_id = $1', [TENANT]);
  for (const [periodo, monto] of FILAS) {
    await pool.query(
      `INSERT INTO marketing (tenant_id, periodo, monto, campana)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [TENANT, periodo, monto, 'General']
    );
  }
  console.log(`marketing: ${FILAS.length} periodos`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
