/**
 * Ajusta el límite diario de operaciones con IA de un cliente.
 *   npx tsx scripts/limite.ts 80            -> cambia el tenant por defecto
 *   npx tsx scripts/limite.ts 80 cliente2   -> cambia otro tenant
 *   npx tsx scripts/limite.ts               -> solo muestra el uso actual
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const nuevo = process.argv[2] ? Number(process.argv[2]) : null;
const TENANT = process.argv[3] ?? process.env.TENANT_ID ?? 'brewwines';

async function main() {
  if (nuevo != null) {
    if (!Number.isInteger(nuevo) || nuevo < 1) throw new Error('El límite debe ser un entero mayor a 0');
    await pool.query('UPDATE tenants SET limite_ia_diario = $1 WHERE id = $2', [nuevo, TENANT]);
    console.log(`Límite de "${TENANT}" ajustado a ${nuevo} operaciones por día.\n`);
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.nombre, t.limite_ia_diario AS limite,
            COALESCE(u.consultas, 0) AS hoy
     FROM tenants t
     LEFT JOIN uso_ia u ON u.tenant_id = t.id
       AND u.fecha = (now() AT TIME ZONE 'America/Mexico_City')::date
     ORDER BY t.id`
  );
  console.log('Cliente'.padEnd(18) + 'Límite'.padStart(8) + 'Hoy'.padStart(8) + 'Restan'.padStart(8));
  for (const r of rows) {
    console.log(
      String(r.nombre).slice(0, 17).padEnd(18) +
      String(r.limite).padStart(8) +
      String(r.hoy).padStart(8) +
      String(Math.max(0, r.limite - r.hoy)).padStart(8)
    );
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
