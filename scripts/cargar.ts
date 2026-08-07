/**
 * ETL desde línea de comandos. Usa la misma lógica que /api/cargar.
 *   npx tsx scripts/cargar.ts [rutaDatos] [tenantId] [nombreEmpresa]
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { analizar, escribir, type ArchivoEntrada } from '../src/lib/etl';

const RUTA = process.argv[2] ?? './datos/';
const TENANT = process.argv[3] ?? process.env.TENANT_ID ?? 'teravino';
const NOMBRE = process.argv[4] ?? process.env.NEXT_PUBLIC_EMPRESA ?? 'Teravino';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`Cargando "${NOMBRE}" (${TENANT}) desde ${RUTA}\n`);

  const archivos: ArchivoEntrada[] = readdirSync(RUTA)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .map(f => ({ nombre: f, buffer: readFileSync(join(RUTA, f)) }));

  const { reporte, datos } = analizar(archivos);

  for (const t of reporte.tablas) {
    console.log(`  ${t.tabla.padEnd(20)} ${String(t.filasValidas).padStart(6)} filas` +
      (t.descartadas ? `  (${t.descartadas} descartadas)` : ''));
    for (const a of t.avisos) console.log(`      aviso: ${a}`);
  }

  if (!reporte.ok) {
    console.error('\nNo se cargó nada. Errores:');
    for (const e of reporte.errores) console.error('  - ' + e);
    process.exit(1);
  }

  await escribir(pool, TENANT, NOMBRE, datos);

  const r = reporte.resumen;
  console.log(`\nPeriodo: ${r.periodoDesde} a ${r.periodoHasta}`);
  console.log(`Venta total: $${r.ventaTotal.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`);
  await pool.end();
}

main().catch(e => { console.error('\n' + e.message); process.exit(1); });
