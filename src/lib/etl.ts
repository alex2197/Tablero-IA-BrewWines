/**
 * ETL compartido.
 *
 * Lo usan tanto `scripts/cargar.ts` (línea de comandos) como
 * `/api/cargar` (el cliente subiendo sus Excel desde el navegador).
 *
 * Trabaja siempre en dos fases:
 *   1. analizar()  — parsea, valida y devuelve un reporte. No escribe nada.
 *   2. escribir()  — inserta en la base dentro de una transacción.
 */
import * as XLSX from 'xlsx';
import type { Pool } from 'pg';

export interface ArchivoEntrada {
  nombre: string;
  buffer: Buffer | ArrayBuffer;
}

export interface ReporteTabla {
  tabla: string;
  archivo: string;
  filasLeidas: number;
  filasValidas: number;
  descartadas: number;
  avisos: string[];
}

export interface Reporte {
  ok: boolean;
  tablas: ReporteTabla[];
  errores: string[];
  resumen: {
    periodoDesde: string | null;
    periodoHasta: string | null;
    ventaTotal: number;
  };
}

/* ------------------------- normalizadores ------------------------- */

/** Excel guarda fechas como días desde 1899-12-30. El 0 significa "vacío". */
export function fecha(v: unknown): string | null {
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

export const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const txt = (v: unknown): string | null =>
  v == null || String(v).trim() === '' ? null : String(v).trim();

/** Ventas trae BR0013269 y CxC trae BR-0005117. Sin normalizar, no cruzan. */
export const factura = (v: unknown): string =>
  String(v ?? '').replace(/[-\s]/g, '').toUpperCase();

/* ------------------------- definición de archivos ------------------------- */

interface DefArchivo {
  archivo: string;
  hoja?: string;
  tabla: string;
  columnas: string[];
  /** Devuelve la fila normalizada, o null si debe descartarse */
  mapear: (r: Record<string, unknown>) => unknown[] | null;
  requerido: boolean;
}

export const ARCHIVOS: DefArchivo[] = [
  {
    archivo: 'Vendedores.xlsx', tabla: 'vendedores', requerido: true,
    columnas: ['clave', 'nombre', 'canal', 'estatus'],
    mapear: r => {
      const clave = num(r['Clave de vendedor']);
      const nombre = txt(r['Nombre del vendedor']);
      if (clave == null || !nombre) return null;
      return [clave, nombre, txt(r['Canal / Zona asignada']), txt(r['Estatus del Vendedor'])];
    },
  },
  {
    archivo: 'Clientes.xlsx', tabla: 'clientes', requerido: true,
    columnas: ['clave', 'razon_social', 'nombre_comercial', 'canal', 'vendedor_clave', 'primera_compra', 'estatus'],
    mapear: r => {
      const clave = num(r['Clave de cliente']);
      const razon = txt(r['Nombre / Razon social']);
      if (clave == null || !razon) return null;
      return [clave, razon, txt(r['Nombre comercial']), txt(r['Canal asignado']),
        num(r['Vendedor asignado']), fecha(r['Fecha de primera compra']), txt(r['Estatus'])];
    },
  },
  {
    archivo: 'Productos.xlsx', tabla: 'productos', requerido: true,
    columnas: ['clave', 'descripcion', 'categoria', 'linea', 'costo_estandar', 'precio_lista'],
    mapear: r => {
      const clave = txt(r['Clave de producto']);
      const desc = txt(r['Descripcion']);
      if (!clave || !desc) return null;
      return [clave, desc, txt(r['Descripcion Categoria']), txt(r['Categoria / Linea']),
        num(r['Costo estandar']), num(r['Precio de lista'])];
    },
  },
  {
    archivo: 'Inventario.xlsx', hoja: 'INVENTARIO', tabla: 'inventario', requerido: true,
    columnas: ['producto_clave', 'existencias', 'costo', 'linea', 'lugar'],
    mapear: r => {
      const clave = txt(r['Clave de producto']);
      if (!clave) return null;
      return [clave, num(r['Existencias']) ?? 0, num(r['COSTO']), txt(r['LINEA']), txt(r['LUGAR'])];
    },
  },
  {
    archivo: 'Ventas.xlsx', hoja: 'Ventas', tabla: 'ventas', requerido: true,
    columnas: ['fecha', 'factura', 'cliente_clave', 'vendedor_clave', 'canal', 'producto_clave',
      'unidades', 'precio_unitario', 'monto_total', 'costo_unitario', 'bodega', 'impuestos'],
    mapear: r => {
      const f = fecha(r['Fecha de factura']);
      if (!f) return null;
      return [f, factura(r['Numero de factura']), num(r['Clave de cliente']),
        num(r['Clave de vendedor']), txt(r['Canal']), txt(r['Clave de producto']),
        num(r['Unidades vendidas']), num(r['Precio unitario de venta']),
        num(r['Monto total de venta']), num(r['Costo unitario']),
        num(r['Bodega de salida']), num(r['Total Impuestos'])];
    },
  },
  {
    archivo: 'CuentasPorCobrar.xlsx', hoja: 'Cuentas por Cobrar', tabla: 'cuentas_por_cobrar', requerido: true,
    columnas: ['factura', 'fecha_factura', 'fecha_vence', 'monto_facturado', 'monto_cobrado',
      'saldo_pendiente', 'fecha_pago', 'cliente_clave'],
    mapear: r => {
      const f = factura(r['Numero de factura']);
      if (!f) return null;
      return [f, fecha(r['Fecha de factura']), fecha(r['Fecha de vencimiento']),
        num(r['Monto facturado']), num(r['Monto cobrado']), num(r['Saldo pendiente']),
        fecha(r['Fecha de pago']), num(r['Clave cliente'])];
    },
  },
];

/* ------------------------- fase 1: analizar ------------------------- */

function leerHoja(buf: Buffer | ArrayBuffer, hoja?: string) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const nombre = hoja && wb.Sheets[hoja] ? hoja : wb.SheetNames[0];
  if (!wb.Sheets[nombre]) throw new Error(`No encontré la hoja "${hoja ?? nombre}"`);
  return {
    filas: XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nombre], { defval: null }),
    hojaUsada: nombre,
    hojas: wb.SheetNames,
  };
}

export interface Analisis {
  reporte: Reporte;
  datos: Map<string, { columnas: string[]; filas: unknown[][] }>;
}

export function analizar(archivos: ArchivoEntrada[]): Analisis {
  const porNombre = new Map(archivos.map(a => [a.nombre.toLowerCase(), a]));
  const tablas: ReporteTabla[] = [];
  const errores: string[] = [];
  const datos = new Map<string, { columnas: string[]; filas: unknown[][] }>();

  for (const def of ARCHIVOS) {
    const entrada = porNombre.get(def.archivo.toLowerCase());
    if (!entrada) {
      if (def.requerido) errores.push(`Falta el archivo ${def.archivo}`);
      continue;
    }

    const avisos: string[] = [];
    let leidas = 0;
    const validas: unknown[][] = [];

    try {
      const { filas, hojaUsada, hojas } = leerHoja(entrada.buffer, def.hoja);
      leidas = filas.length;

      if (def.hoja && hojaUsada !== def.hoja) {
        avisos.push(`Usé la hoja "${hojaUsada}" porque no encontré "${def.hoja}". Hojas: ${hojas.join(', ')}`);
      }
      if (!filas.length) {
        errores.push(`${def.archivo} está vacío`);
        continue;
      }

      for (const f of filas) {
        const m = def.mapear(f);
        if (m) validas.push(m);
      }

      // Si falla más de la mitad, casi siempre son encabezados distintos.
      if (validas.length < leidas * 0.5) {
        avisos.push(
          `Solo ${validas.length} de ${leidas} filas pasaron la validación. ` +
          `Encabezados detectados: ${Object.keys(filas[0]).slice(0, 8).join(', ')}…`
        );
      }
    } catch (e) {
      errores.push(`${def.archivo}: ${(e as Error).message}`);
      continue;
    }

    const descartadas = leidas - validas.length;
    if (descartadas > 0) {
      avisos.push(`${descartadas} fila${descartadas === 1 ? '' : 's'} sin datos clave, se omitirá${descartadas === 1 ? '' : 'n'}`);
    }
    if (validas.length === 0) {
      errores.push(`${def.archivo}: ninguna fila pasó la validación. Revisa los encabezados.`);
    }

    tablas.push({
      tabla: def.tabla, archivo: def.archivo,
      filasLeidas: leidas, filasValidas: validas.length, descartadas, avisos,
    });
    datos.set(def.tabla, { columnas: def.columnas, filas: validas });
  }

  // Resumen de ventas para que el usuario confirme que son sus datos
  const ventas = datos.get('ventas')?.filas ?? [];
  const fechas = ventas.map(f => String(f[0])).filter(Boolean).sort();
  const ventaTotal = ventas.reduce((a, f) => a + (Number(f[8]) || 0), 0);

  return {
    reporte: {
      ok: errores.length === 0,
      tablas, errores,
      resumen: {
        periodoDesde: fechas[0] ?? null,
        periodoHasta: fechas[fechas.length - 1] ?? null,
        ventaTotal,
      },
    },
    datos,
  };
}

/* ------------------------- fase 2: escribir ------------------------- */

/** Orden de escritura: catálogos antes que transaccionales. */
const ORDEN = ['vendedores', 'clientes', 'productos', 'inventario', 'ventas', 'cuentas_por_cobrar'];

export async function escribir(
  pool: Pool,
  tenant: string,
  nombreEmpresa: string,
  datos: Analisis['datos'],
  log: (m: string) => void = () => {}
) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    await cli.query(
      `INSERT INTO tenants (id, nombre, giro) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`,
      [tenant, nombreEmpresa, 'Distribución']
    );

    // Se borra en orden inverso por las llaves foráneas
    for (const t of [...ORDEN].reverse()) {
      await cli.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [tenant]);
    }

    for (const tabla of ORDEN) {
      const d = datos.get(tabla);
      if (!d) continue;
      const cols = ['tenant_id', ...d.columnas];
      const LOTE = 400;
      for (let i = 0; i < d.filas.length; i += LOTE) {
        const lote = d.filas.slice(i, i + LOTE).map(f => [tenant, ...f]);
        const vals = lote
          .map((_, r) => `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',')})`)
          .join(',');
        await cli.query(
          `INSERT INTO ${tabla} (${cols.join(',')}) VALUES ${vals} ON CONFLICT DO NOTHING`,
          lote.flat()
        );
      }
      log(`${tabla}: ${d.filas.length} filas`);
    }

    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK');
    throw e;
  } finally {
    cli.release();
  }
}
