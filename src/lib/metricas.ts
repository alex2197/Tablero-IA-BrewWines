/**
 * CAPA SEMÁNTICA
 *
 * Definición única de qué significa cada métrica del negocio.
 * Todo cálculo del sistema —tablero, chat, reportes— pasa por aquí,
 * así "venta neta" significa exactamente lo mismo en todas partes.
 *
 * Para un cliente nuevo, este es el archivo que se adapta.
 */

export type Formato = 'moneda' | 'porcentaje' | 'entero';

export interface DefMetrica {
  sql: string;
  nombre: string;
  formato: Formato;
  sinonimos: string[];
  /** true si no se puede sumar entre grupos (promedios, porcentajes) */
  noAditiva?: boolean;
}

export const METRICAS = {
  venta_neta: {
    sql: 'COALESCE(SUM(v.monto_total), 0)',
    nombre: 'Venta neta',
    formato: 'moneda',
    sinonimos: ['ventas', 'facturación', 'ingresos', 'venta', 'facturado'],
  },
  margen_bruto: {
    sql: 'COALESCE(SUM(v.monto_total - v.costo_unitario * v.unidades), 0)',
    nombre: 'Margen bruto',
    formato: 'moneda',
    sinonimos: ['margen', 'utilidad', 'ganancia', 'utilidad bruta'],
  },
  margen_pct: {
    sql: `CASE WHEN SUM(v.monto_total) > 0
            THEN ROUND(SUM(v.monto_total - v.costo_unitario * v.unidades)
                       / SUM(v.monto_total) * 100, 1)
            ELSE 0 END`,
    nombre: 'Margen %',
    formato: 'porcentaje',
    sinonimos: ['porcentaje de margen', 'rentabilidad', 'margen porcentual'],
    noAditiva: true,
  },
  unidades: {
    sql: 'COALESCE(SUM(v.unidades), 0)',
    nombre: 'Botellas',
    formato: 'entero',
    sinonimos: ['botellas', 'piezas', 'cajas', 'volumen'],
  },
  facturas: {
    sql: 'COUNT(DISTINCT v.factura)',
    nombre: 'Facturas',
    formato: 'entero',
    sinonimos: ['pedidos', 'órdenes', 'notas', 'remisiones'],
  },
  clientes_activos: {
    sql: 'COUNT(DISTINCT v.cliente_clave)',
    nombre: 'Clientes activos',
    formato: 'entero',
    sinonimos: ['clientes', 'compradores'],
  },
  ticket_promedio: {
    sql: `CASE WHEN COUNT(DISTINCT v.factura) > 0
            THEN ROUND(SUM(v.monto_total) / COUNT(DISTINCT v.factura), 2)
            ELSE 0 END`,
    nombre: 'Ticket promedio',
    formato: 'moneda',
    sinonimos: ['ticket', 'venta promedio', 'promedio por factura'],
    noAditiva: true,
  },
  precio_promedio: {
    sql: `CASE WHEN SUM(v.unidades) > 0
            THEN ROUND(SUM(v.monto_total) / SUM(v.unidades), 2)
            ELSE 0 END`,
    nombre: 'Precio promedio por botella',
    formato: 'moneda',
    sinonimos: ['precio promedio', 'precio por botella'],
    noAditiva: true,
  },
} as const satisfies Record<string, DefMetrica>;

export interface DefDimension {
  sql: string;
  nombre: string;
  /** columna de filtrado, si difiere de la de agrupación */
  filtro?: string;
}

/**
 * Lista blanca de columnas agrupables y filtrables.
 * Nada fuera de este objeto puede llegar a una consulta.
 */
export const DIMENSIONES = {
  canal: { sql: 'v.canal', nombre: 'Canal' },
  vendedor: { sql: 'ven.nombre', nombre: 'Vendedor' },
  cliente: { sql: 'c.razon_social', nombre: 'Cliente' },
  producto: { sql: 'p.descripcion', nombre: 'Producto' },
  categoria: { sql: 'p.categoria', nombre: 'Categoría' },
  linea: { sql: 'p.linea', nombre: 'Línea' },
  mes: { sql: `TO_CHAR(v.fecha, 'YYYY-MM')`, nombre: 'Mes' },
  dia: { sql: `TO_CHAR(v.fecha, 'YYYY-MM-DD')`, nombre: 'Día' },
} as const satisfies Record<string, DefDimension>;

export type Metrica = keyof typeof METRICAS;
export type Dimension = keyof typeof DIMENSIONES;

export const LISTA_METRICAS = Object.keys(METRICAS) as Metrica[];
export const LISTA_DIMENSIONES = Object.keys(DIMENSIONES) as Dimension[];

export const esMetrica = (v: string): v is Metrica => v in METRICAS;
export const esDimension = (v: string): v is Dimension => v in DIMENSIONES;
