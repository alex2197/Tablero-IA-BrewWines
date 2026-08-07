/**
 * Aplica migraciones incrementales sin borrar datos.
 *   npx tsx scripts/migrar.ts
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DIR = './db';

async function main() {
  const archivos = readdirSync(DIR).filter(f => f.startsWith('migracion-')).sort();
  for (const f of archivos) {
    await pool.query(readFileSync(join(DIR, f), 'utf8'));
    console.log(`aplicada: ${f}`);
  }
  console.log('Migraciones al día.');
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
