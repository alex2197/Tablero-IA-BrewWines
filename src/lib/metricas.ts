/**
 * CAPA SEMÁNTICA
 *
 * Réplica de las 34 medidas DAX del Power BI original, más correcciones.
 * Todo cálculo del sistema —tablero, chat, reportes— pasa por aquí.
 */

export type Formato = 'moneda' | 'porcentaje' | 'entero' | 'dias';

export interface DefMetrica {
  sql: string;
  nombre: string;
  formato: Formato;
  sinonimos: string[];
  noAditiva?: boolean;
  /** Nombre de la medida equivalente en el Power BI, para trazabilidad */
  dax?: string;
}

export const METRICAS = {
  venta_neta: {
    sql: 'COALESCE(SUM(v.monto_total), 0)',
    nombre: 'Ingresos totales', formato: 'moneda',
    sinonimos: ['ventas', 'facturación', 'ingresos', 'venta', 'facturado'],
    dax: 'Ingresos Totales',
  },
  costo_total: {
    sql: 'COALESCE(SUM(v.costo_unitario * v.unidades), 0)',
    nombre: 'Costo total', formato: 'moneda',
    sinonimos: ['costo', 'costos', 'costo de ventas'],
    dax: 'Costo Total',
  },
  margen_bruto: {
    sql: 'COALESCE(SUM(v.monto_total - v.costo_unitario * v.unidades), 0)',
    nombre: 'Margen bruto', formato: 'moneda',
    sinonimos: ['margen', 'utilidad', 'ganancia', 'utilidad bruta'],
    dax: 'Margen Bruto',
  },
  margen_pct: {
    sql: `CASE WHEN SUM(v.monto_total) > 0
            THEN ROUND(SUM(v.monto_total - v.costo_unitario * v.unidades)
                       / SUM(v.monto_total) * 100, 1) ELSE 0 END`,
    nombre: '% Margen bruto', formato: 'porcentaje',
    sinonimos: ['porcentaje de margen', 'rentabilidad', 'margen porcentual'],
    noAditiva: true, dax: '% Margen Bruto',
  },
  unidades: {
    sql: 'COALESCE(SUM(v.unidades), 0)',
    nombre: 'Unidades vendidas', formato: 'entero',
    sinonimos: ['botellas', 'piezas', 'cajas', 'volumen', 'unidades'],
    dax: 'Unidades_Vendidas',
  },
  facturas: {
    sql: 'COUNT(DISTINCT v.factura)',
    nombre: 'Núm. facturas', formato: 'entero',
    sinonimos: ['pedidos', 'órdenes', 'notas', 'remisiones', 'facturas'],
    dax: 'Num Facturas',
  },
  clientes_activos: {
    sql: 'COUNT(DISTINCT v.cliente_clave)',
    nombre: 'Clientes activos', formato: 'entero',
    sinonimos: ['clientes', 'compradores', 'clientes activos'],
    dax: 'Clientes Activos',
  },
  ticket_promedio: {
    sql: `CASE WHEN COUNT(DISTINCT v.factura) > 0
            THEN ROUND(SUM(v.monto_total) / COUNT(DISTINCT v.factura), 2) ELSE 0 END`,
    nombre: 'Ticket promedio', formato: 'moneda',
    sinonimos: ['ticket', 'venta promedio', 'promedio por factura'],
    noAditiva: true,
  },
  precio_promedio: {
    sql: `CASE WHEN SUM(v.unidades) > 0
            THEN ROUND(SUM(v.monto_total) / SUM(v.unidades), 2) ELSE 0 END`,
    nombre: 'Precio promedio venta', formato: 'moneda',
    sinonimos: ['precio promedio', 'precio por botella'],
    noAditiva: true, dax: 'Precio Promedio Venta',
  },
  ingreso_por_cliente: {
    sql: `CASE WHEN COUNT(DISTINCT v.cliente_clave) > 0
            THEN ROUND(SUM(v.monto_total) / COUNT(DISTINCT v.cliente_clave), 2) ELSE 0 END`,
    nombre: 'Ingreso por cliente', formato: 'moneda',
    sinonimos: ['ingreso por cliente', 'venta por cliente'],
    noAditiva: true, dax: 'Ingreso por Cliente',
  },
} as const satisfies Record<string, DefMetrica>;

export interface DefDimension { sql: string; nombre: string }

/** Lista blanca de columnas agrupables y filtrables. */
export const DIMENSIONES = {
  canal:     { sql: 'v.canal', nombre: 'Canal' },
  vendedor:  { sql: 'ven.nombre', nombre: 'Vendedor' },
  cliente:   { sql: 'COALESCE(c.nombre_comercial, c.razon_social)', nombre: 'Cliente' },
  producto:  { sql: 'p.descripcion', nombre: 'Producto' },
  categoria: { sql: 'p.categoria', nombre: 'Categoría' },
  linea:     { sql: 'p.linea', nombre: 'Línea' },
  bodega:    { sql: `'Bodega ' || COALESCE(v.bodega::text, 's/d')`, nombre: 'Bodega' },
  mes:       { sql: `TO_CHAR(v.fecha, 'YYYY-MM')`, nombre: 'Mes' },
  dia:       { sql: `TO_CHAR(v.fecha, 'YYYY-MM-DD')`, nombre: 'Día' },
  trimestre: { sql: `TO_CHAR(v.fecha, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM v.fecha)::text`, nombre: 'Trimestre' },
} as const satisfies Record<string, DefDimension>;

export type Metrica = keyof typeof METRICAS;
export type Dimension = keyof typeof DIMENSIONES;

export const LISTA_METRICAS = Object.keys(METRICAS) as Metrica[];
export const LISTA_DIMENSIONES = Object.keys(DIMENSIONES) as Dimension[];

export const esMetrica = (v: string): v is Metrica => v in METRICAS;
export const esDimension = (v: string): v is Dimension => v in DIMENSIONES;

/** Paleta "Brew Wines - Tema Claro", extraída del .pbix original. */
export const PALETA = [
  '#3a0006', '#5e2010', '#a0705a', '#c49070',
  '#d8a790', '#5e5f64', '#37383e', '#7a4a3a',
];
