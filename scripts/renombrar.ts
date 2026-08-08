/**
 * Renombra un cliente: cambia su identificador interno y su nombre visible,
 * moviendo todas sus filas sin perder datos.
 *
 *   npx tsx scripts/renombrar.ts teravino brewwines "Brew Wines"
 *
 * Es seguro correrlo dos veces: si el origen ya no existe, solo actualiza
 * el nombre del destino.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const [origen, destino, nombre] = process.argv.slice(2);
if (!origen || !destino || !nombre) {
  console.error('Uso: npx tsx scripts/renombrar.ts <idViejo> <idNuevo> "<Nombre visible>"');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TABLAS = [
  'vendedores', 'clientes', 'productos', 'inventario',
  'ventas', 'cuentas_por_cobrar', 'ventas_reclasificadas', 'uso_ia',
];

async function main() {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    const existe = await cli.query('SELECT 1 FROM tenants WHERE id = $1', [origen]);

    if (!existe.rowCount) {
      await cli.query('UPDATE tenants SET nombre = $1 WHERE id = $2', [nombre, destino]);
      await cli.query('COMMIT');
      console.log(`"${origen}" no existe. Actualicé el nombre de "${destino}" a "${nombre}".`);
      return;
    }

    // Se crea el destino copiando la configuración del origen
    await cli.query(
      `INSERT INTO tenants (id, nombre, giro, limite_ia_diario, estado, vence, contacto)
       SELECT $1, $2, giro, limite_ia_diario, estado, vence, contacto
       FROM tenants WHERE id = $3
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`,
      [destino, nombre, origen]
    );

    for (const t of TABLAS) {
      const existeTabla = await cli.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [t]
      );
      if (!existeTabla.rowCount) continue;
      const { rowCount } = await cli.query(
        `UPDATE ${t} SET tenant_id = $1 WHERE tenant_id = $2`, [destino, origen]
      );
      if (rowCount) console.log(`  ${t.padEnd(24)} ${rowCount} filas`);
    }

    await cli.query('DELETE FROM tenants WHERE id = $1', [origen]);
    await cli.query('COMMIT');
    console.log(`\nListo: "${origen}" ahora es "${destino}" ("${nombre}").`);
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
    await pool.end();
  }
}

main().catch(e => { console.error('\n' + e.message); process.exit(1); });
