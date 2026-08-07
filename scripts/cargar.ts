/**
 * ETL: Excel -> Postgres.
 *   npx tsx scripts/cargar.ts [rutaDatos] [tenantId] [nombreEmpresa]
 * Idempotente: borra las filas del tenant antes de insertar.
 */
import 'dotenv/config';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const RUTA = process.argv[2] ?? './datos/';
const TENANT = process.argv[3] ?? 'teravino';
const NOMBRE = process.argv[4] ?? 'Teravino';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Excel guarda fechas como días desde 1899-12-30. El 0 significa "vacío". */
function fecha(v: unknown): string | null {
  if (v == null || v === '' || v === 0) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) || v.getFullYear() < 1901 ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    if (v < 1) return null;
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) || d.getFullYear() < 1901 ? null : d.toISOString().slice(0, 10);
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const txt = (v: unknown): string | null =>
  v == null || String(v).trim() === '' ? null : String(v).trim();

/** Ventas trae BR0013269 y CxC trae BR-0005117. Sin normalizar, no cruzan. */
const factura = (v: unknown): string => String(v ?? '').replace(/[-\s]/g, '').toUpperCase();

function leer(archivo: string, hoja?: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(RUTA + archivo, { cellDates: true });
  const nombre = hoja && wb.Sheets[hoja] ? hoja : wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[nombre], { defval: null });
}

async function cargar(tabla: string, cols: string[], filas: unknown[][]) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    await cli.query(`DELETE FROM ${tabla} WHERE tenant_id = $1`, [TENANT]);
    const todas = ['tenant_id', ...cols];
    const LOTE = 400;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE).map(f => [TENANT, ...f]);
      const vals = lote
        .map((_, r) => `(${todas.map((_, c) => `$${r * todas.length + c + 1}`).join(',')})`)
        .join(',');
      await cli.query(
        `INSERT INTO ${tabla} (${todas.join(',')}) VALUES ${vals} ON CONFLICT DO NOTHING`,
        lote.flat()
      );
    }
    await cli.query('COMMIT');
    console.log(`  ${tabla.padEnd(20)} ${filas.length} filas`);
  } catch (e) {
    await cli.query('ROLLBACK');
    throw new Error(`Falló ${tabla}: ${(e as Error).message}`);
  } finally {
    cli.release();
  }
}

async function main() {
  console.log(`Cargando "${NOMBRE}" (${TENANT}) desde ${RUTA}\n`);

  await pool.query(
    `INSERT INTO tenants (id, nombre, giro) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`,
    [TENANT, NOMBRE, 'Distribución de vinos']
  );

  await cargar('vendedores', ['clave', 'nombre', 'canal', 'estatus'],
    leer('Vendedores.xlsx').map(r => [
      num(r['Clave de vendedor']), txt(r['Nombre del vendedor']),
      txt(r['Canal / Zona asignada']), txt(r['Estatus del Vendedor']),
    ]).filter(f => f[0] != null && f[1] != null));

  await cargar('clientes',
    ['clave', 'razon_social', 'nombre_comercial', 'canal', 'vendedor_clave', 'primera_compra', 'estatus'],
    leer('Clientes.xlsx').map(r => [
      num(r['Clave de cliente']), txt(r['Nombre / Razon social']), txt(r['Nombre comercial']),
      txt(r['Canal asignado']), num(r['Vendedor asignado']),
      fecha(r['Fecha de primera compra']), txt(r['Estatus']),
    ]).filter(f => f[0] != null && f[1] != null));

  await cargar('productos',
    ['clave', 'descripcion', 'categoria', 'linea', 'costo_estandar', 'precio_lista'],
    leer('Productos.xlsx').map(r => [
      txt(r['Clave de producto']), txt(r['Descripcion']), txt(r['Descripcion Categoria']),
      txt(r['Categoria / Linea']), num(r['Costo estandar']), num(r['Precio de lista']),
    ]).filter(f => f[0] != null && f[1] != null));

  await cargar('inventario', ['producto_clave', 'existencias', 'costo', 'linea', 'lugar'],
    leer('Inventario.xlsx', 'INVENTARIO').map(r => [
      txt(r['Clave de producto']), num(r['Existencias']) ?? 0,
      num(r['COSTO']), txt(r['LINEA']), txt(r['LUGAR']),
    ]).filter(f => f[0] != null));

  await cargar('ventas',
    ['fecha', 'factura', 'cliente_clave', 'vendedor_clave', 'canal', 'producto_clave',
      'unidades', 'precio_unitario', 'monto_total', 'costo_unitario', 'bodega', 'impuestos'],
    leer('Ventas.xlsx', 'Ventas').map(r => [
      fecha(r['Fecha de factura']), factura(r['Numero de factura']),
      num(r['Clave de cliente']), num(r['Clave de vendedor']), txt(r['Canal']),
      txt(r['Clave de producto']), num(r['Unidades vendidas']),
      num(r['Precio unitario de venta']), num(r['Monto total de venta']),
      num(r['Costo unitario']), num(r['Bodega de salida']), num(r['Total Impuestos']),
    ]).filter(f => f[0] != null));

  await cargar('cuentas_por_cobrar',
    ['factura', 'fecha_factura', 'fecha_vence', 'monto_facturado', 'monto_cobrado',
      'saldo_pendiente', 'fecha_pago', 'cliente_clave'],
    leer('CuentasPorCobrar.xlsx', 'Cuentas por Cobrar').map(r => [
      factura(r['Numero de factura']), fecha(r['Fecha de factura']), fecha(r['Fecha de vencimiento']),
      num(r['Monto facturado']), num(r['Monto cobrado']), num(r['Saldo pendiente']),
      fecha(r['Fecha de pago']), num(r['Clave cliente']),
    ]).filter(f => f[0] !== ''));

  const { rows } = await pool.query(
    `SELECT MIN(fecha)::text AS desde, MAX(fecha)::text AS hasta,
            SUM(monto_total)::numeric(16,2) AS venta
     FROM ventas WHERE tenant_id = $1`, [TENANT]);
  console.log(`\nPeriodo: ${rows[0].desde} a ${rows[0].hasta}`);
  console.log(`Venta total: $${Number(rows[0].venta).toLocaleString('es-MX')}`);

  await pool.end();
}

main().catch(e => { console.error('\n' + e.message); process.exit(1); });
