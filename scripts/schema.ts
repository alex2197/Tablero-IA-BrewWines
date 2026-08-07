import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(readFileSync('./db/schema.sql', 'utf8'));
  console.log('Esquema creado.');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
