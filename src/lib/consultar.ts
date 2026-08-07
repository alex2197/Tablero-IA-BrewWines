/**
 * MOTOR DE CONSULTAS
 *
 * Regla inviolable: la IA nunca escribe SQL. Elige métricas y dimensiones
 * de una lista cerrada, y este archivo arma la consulta con parámetros.
 * Así es imposible inyectar SQL o inventar un número.
 */
import { pool, TENANT } from './db';
import {
  METRICAS, DIMENSIONES, esMetrica, esDimension,
  type Metrica, type Dimension,
} from './metricas';
import { fmt } from './formato';

export interface Filtros {
  desde?: string | null;
  hasta?: string | null;
  canal?: string | null;
  vendedor?: string | null;
  cliente?: string | null;
  categoria?: string | null;
  producto?: string | null;
}

export interface Fila {
  etiqueta?: string;
  [metrica: string]: string | number | undefined;
}

export interface Resultado {
  filas: Fila[];
  /** valores ya formateados, para que el modelo no reformatee */
  formateado: Record<string, string>[];
  sql: string;
  parametros: unknown[];
  metricas: Metrica[];
  dimension?: Dimension;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(v: string | null | undefined, campo: string): string | null {
  if (!v) return null;
  if (!ISO.test(v)) throw new Error(`${campo} debe tener formato YYYY-MM-DD, se recibió "${v}"`);
  return v;
}

export async function consultar(opts: {
  metricas: string[];
  agrupar?: string | null;
  filtros?: Filtros;
  orden?: 'desc' | 'asc';
  limite?: number;
}): Promise<Resultado> {
  const { agrupar, filtros = {}, orden = 'desc' } = opts;
  const limite = Math.min(Math.max(opts.limite ?? 10, 1), 100);

  const ms = (opts.metricas ?? []).filter(esMetrica);
  if (!ms.length) {
    throw new Error(
      `Métrica no reconocida. Disponibles: ${Object.keys(METRICAS).join(', ')}`
    );
  }
  if (agrupar && !esDimension(agrupar)) {
    throw new Error(
      `Dimensión no reconocida. Disponibles: ${Object.keys(DIMENSIONES).join(', ')}`
    );
  }
  const dim = agrupar as Dimension | undefined;

  const sel = ms.map(m => `${METRICAS[m].sql} AS "${m}"`);
  if (dim) sel.unshift(`${DIMENSIONES[dim].sql} AS etiqueta`);

  const params: unknown[] = [TENANT];
  const where = ['v.tenant_id = $1'];
  const add = (plantilla: string, valor: unknown) => {
    params.push(valor);
    where.push(plantilla.replace('?', `$${params.length}`));
  };

  const desde = validarFecha(filtros.desde, 'desde');
  const hasta = validarFecha(filtros.hasta, 'hasta');
  if (desde) add('v.fecha >= ?::date', desde);
  if (hasta) add('v.fecha <= ?::date', hasta);
  if (filtros.canal) add('UPPER(v.canal) = UPPER(?)', filtros.canal);
  if (filtros.vendedor) add('ven.nombre ILIKE ?', `%${filtros.vendedor}%`);
  if (filtros.cliente) add('c.razon_social ILIKE ?', `%${filtros.cliente}%`);
  if (filtros.categoria) add('p.categoria ILIKE ?', `%${filtros.categoria}%`);
  if (filtros.producto) add('p.descripcion ILIKE ?', `%${filtros.producto}%`);

  // Ordenar por la primera métrica aditiva; si todas son promedios, por la primera.
  const idxOrden = ms.findIndex(m => !('noAditiva' in METRICAS[m]));
  const colOrden = dim ? (idxOrden >= 0 ? idxOrden : 0) + 2 : 1;

  const sql = `
    SELECT ${sel.join(', ')}
    FROM ventas v
    LEFT JOIN clientes   c   ON c.tenant_id = v.tenant_id AND c.clave   = v.cliente_clave
    LEFT JOIN vendedores ven ON ven.tenant_id = v.tenant_id AND ven.clave = v.vendedor_clave
    LEFT JOIN productos  p   ON p.tenant_id = v.tenant_id AND p.clave   = v.producto_clave
    WHERE ${where.join(' AND ')}
    ${dim ? `GROUP BY ${DIMENSIONES[dim].sql}` : ''}
    ${dim
      ? dim === 'mes' || dim === 'dia'
        ? 'ORDER BY 1 ASC'
        : `ORDER BY ${colOrden} ${orden === 'asc' ? 'ASC' : 'DESC'}`
      : ''}
    ${dim ? `LIMIT ${limite}` : ''}
  `.trim();

  const { rows } = await pool.query(sql, params);

  const filas: Fila[] = rows.map(r => {
    const f: Fila = {};
    if (dim) f.etiqueta = r.etiqueta == null ? 'Sin asignar' : String(r.etiqueta);
    for (const m of ms) f[m] = Number(r[m]);
    return f;
  });

  const formateado = filas.map(f => {
    const o: Record<string, string> = {};
    if (f.etiqueta !== undefined) o.etiqueta = String(f.etiqueta);
    for (const m of ms) o[m] = fmt(Number(f[m]), METRICAS[m].formato);
    return o;
  });

  return {
    filas,
    formateado,
    sql: sql.replace(/\s+/g, ' '),
    parametros: params,
    metricas: ms,
    dimension: dim,
  };
}

/* ------------------------------------------------------------------ */
/* Cartera                                                             */
/* ------------------------------------------------------------------ */

export async function cartera(opts: { diasMinimos?: number; limite?: number } = {}) {
  const dias = Math.max(opts.diasMinimos ?? 0, -3650);
  const limite = Math.min(opts.limite ?? 10, 50);

  const { rows } = await pool.query(
    `SELECT COALESCE(c.razon_social, 'Cliente ' || x.cliente_clave) AS cliente,
            SUM(x.saldo_pendiente)::float8 AS saldo,
            COUNT(*)::int                  AS facturas,
            MAX((SELECT MAX(fecha) FROM ventas WHERE tenant_id = x.tenant_id)
                - x.fecha_vence)::int      AS dias_max
     FROM cuentas_por_cobrar x
     LEFT JOIN clientes c ON c.tenant_id = x.tenant_id AND c.clave = x.cliente_clave
     WHERE x.tenant_id = $1
       AND x.saldo_pendiente > 0.01
       AND ((SELECT MAX(fecha) FROM ventas WHERE tenant_id = x.tenant_id) - x.fecha_vence) >= $2
     GROUP BY 1
     ORDER BY saldo DESC
     LIMIT $3`,
    [TENANT, dias, limite]
  );

  return rows.map(r => ({
    cliente: r.cliente,
    saldo: r.saldo,
    saldo_fmt: fmt(r.saldo, 'moneda'),
    facturas: r.facturas,
    dias_max: r.dias_max,
  }));
}

export async function carteraAntiguedad() {
  const { rows } = await pool.query(
    `WITH corte AS (SELECT MAX(fecha) AS d FROM ventas WHERE tenant_id = $1),
     b AS (
       SELECT x.saldo_pendiente,
              ((SELECT d FROM corte) - x.fecha_vence) AS dias
       FROM cuentas_por_cobrar x
       WHERE x.tenant_id = $1 AND x.saldo_pendiente > 0.01
     )
     SELECT CASE
              WHEN dias IS NULL THEN 'Sin vencimiento'
              WHEN dias <= 0 THEN 'Por vencer'
              WHEN dias <= 30 THEN '1-30 días'
              WHEN dias <= 60 THEN '31-60 días'
              WHEN dias <= 90 THEN '61-90 días'
              ELSE 'Más de 90'
            END AS rango,
            SUM(saldo_pendiente)::float8 AS saldo,
            COUNT(*)::int AS facturas
     FROM b GROUP BY 1`,
    [TENANT]
  );

  const orden = ['Por vencer', '1-30 días', '31-60 días', '61-90 días', 'Más de 90', 'Sin vencimiento'];
  return rows
    .sort((a, b) => orden.indexOf(a.rango) - orden.indexOf(b.rango))
    .map(r => ({ ...r, saldo_fmt: fmt(r.saldo, 'moneda') }));
}

/* ------------------------------------------------------------------ */
/* Inventario                                                          */
/* ------------------------------------------------------------------ */

export async function inventarioSinMovimiento(limite = 15) {
  const { rows } = await pool.query(
    `SELECT p.descripcion AS producto,
            i.existencias::int,
            (i.existencias * i.costo)::float8 AS valor,
            i.linea
     FROM inventario i
     JOIN productos p ON p.tenant_id = i.tenant_id AND p.clave = i.producto_clave
     WHERE i.tenant_id = $1
       AND i.existencias > 0
       AND NOT EXISTS (
         SELECT 1 FROM ventas v
         WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave
       )
     ORDER BY valor DESC
     LIMIT $2`,
    [TENANT, Math.min(limite, 50)]
  );
  return rows.map(r => ({ ...r, valor_fmt: fmt(r.valor, 'moneda') }));
}

export async function resumenInventario() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS skus,
            COALESCE(SUM(i.existencias * i.costo), 0)::float8 AS valor,
            COUNT(*) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM ventas v
              WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave
            ))::int AS sin_movimiento,
            COALESCE(SUM(i.existencias * i.costo) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM ventas v
              WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave
            )), 0)::float8 AS valor_muerto
     FROM inventario i WHERE i.tenant_id = $1`,
    [TENANT]
  );
  return rows[0];
}

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

export async function clientesDormidos(limite = 20) {
  const { rows } = await pool.query(
    `SELECT c.razon_social AS cliente, c.canal, c.estatus,
            c.primera_compra::text AS primera_compra,
            COALESCE(x.saldo, 0)::float8 AS saldo_pendiente
     FROM clientes c
     LEFT JOIN (
       SELECT cliente_clave, SUM(saldo_pendiente) AS saldo
       FROM cuentas_por_cobrar WHERE tenant_id = $1 AND saldo_pendiente > 0.01
       GROUP BY cliente_clave
     ) x ON x.cliente_clave = c.clave
     WHERE c.tenant_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM ventas v
         WHERE v.tenant_id = c.tenant_id AND v.cliente_clave = c.clave
       )
     ORDER BY saldo_pendiente DESC, c.razon_social
     LIMIT $2`,
    [TENANT, Math.min(limite, 100)]
  );
  return rows;
}

export async function resumenClientes() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM ventas v
              WHERE v.tenant_id = c.tenant_id AND v.cliente_clave = c.clave
            ))::int AS con_compra,
            COUNT(*) FILTER (WHERE c.estatus ILIKE 'moroso')::int    AS morosos,
            COUNT(*) FILTER (WHERE c.estatus ILIKE 'suspendido')::int AS suspendidos,
            COUNT(*) FILTER (WHERE c.estatus ILIKE 'activo')::int     AS activos
     FROM clientes c WHERE c.tenant_id = $1`,
    [TENANT]
  );
  return rows[0];
}

/* ------------------------------------------------------------------ */
/* Metadatos del dataset                                               */
/* ------------------------------------------------------------------ */

export interface Contexto {
  desde: string;
  hasta: string;
  canales: string[];
  empresa: string;
}

let cacheCtx: { v: Contexto; t: number } | null = null;

export async function contexto(): Promise<Contexto> {
  if (cacheCtx && Date.now() - cacheCtx.t < 300_000) return cacheCtx.v;

  const { rows } = await pool.query(
    `SELECT MIN(fecha)::text AS desde, MAX(fecha)::text AS hasta,
            ARRAY_AGG(DISTINCT canal) FILTER (WHERE canal IS NOT NULL) AS canales
     FROM ventas WHERE tenant_id = $1`,
    [TENANT]
  );
  const { rows: t } = await pool.query(
    'SELECT nombre FROM tenants WHERE id = $1', [TENANT]
  );

  const v: Contexto = {
    desde: rows[0]?.desde ?? '',
    hasta: rows[0]?.hasta ?? '',
    canales: rows[0]?.canales ?? [],
    empresa: t[0]?.nombre ?? 'Empresa',
  };
  cacheCtx = { v, t: Date.now() };
  return v;
}

/* ------------------------------------------------------------------ */
/* Detección de anomalías                                              */
/* ------------------------------------------------------------------ */

export interface Alerta {
  severidad: 'alta' | 'media' | 'baja';
  titulo: string;
  detalle: string;
  accion: string;
}

export async function alertas(): Promise<Alerta[]> {
  const out: Alerta[] = [];

  // 1. Facturas grandes con margen anormalmente bajo
  const { rows: anom } = await pool.query(
    `SELECT v.factura,
            MAX(v.fecha)::text AS fecha,
            MAX(c.razon_social) AS cliente,
            MAX(ven.nombre) AS vendedor,
            SUM(v.monto_total)::float8 AS venta,
            SUM(v.unidades)::int AS unidades,
            (SUM(v.monto_total - v.costo_unitario * v.unidades)
             / NULLIF(SUM(v.monto_total), 0) * 100)::float8 AS margen_pct
     FROM ventas v
     LEFT JOIN clientes   c   ON c.tenant_id = v.tenant_id AND c.clave = v.cliente_clave
     LEFT JOIN vendedores ven ON ven.tenant_id = v.tenant_id AND ven.clave = v.vendedor_clave
     WHERE v.tenant_id = $1
     GROUP BY v.factura
     HAVING SUM(v.monto_total) > 100000
        AND (SUM(v.monto_total - v.costo_unitario * v.unidades)
             / NULLIF(SUM(v.monto_total), 0) * 100) < 15
     ORDER BY venta DESC LIMIT 3`,
    [TENANT]
  );
  for (const a of anom) {
    out.push({
      severidad: 'alta',
      titulo: `Venta de ${fmt(a.venta, 'moneda')} facturada casi al costo`,
      detalle: `Factura ${a.factura} del ${a.fecha} a ${a.cliente}: ${a.unidades.toLocaleString('es-MX')} unidades por ${fmt(a.venta, 'moneda')} con margen de ${a.margen_pct.toFixed(1)}%. Registrada por ${a.vendedor ?? 'sin vendedor'}.`,
      accion: 'Confirmar si fue liquidación autorizada o error de precios',
    });
  }

  // 2. Cartera crítica
  const cri = await pool.query(
    `SELECT COALESCE(SUM(saldo_pendiente), 0)::float8 AS monto,
            COUNT(*)::int AS n,
            MAX((SELECT MAX(fecha) FROM ventas WHERE tenant_id = $1) - fecha_vence)::int AS dias
     FROM cuentas_por_cobrar
     WHERE tenant_id = $1 AND saldo_pendiente > 0.01
       AND ((SELECT MAX(fecha) FROM ventas WHERE tenant_id = $1) - fecha_vence) > 90`,
    [TENANT]
  );
  if (cri.rows[0]?.monto > 0) {
    const r = cri.rows[0];
    out.push({
      severidad: 'alta',
      titulo: `${fmt(r.monto, 'moneda')} vencidos a más de 90 días`,
      detalle: `${r.n} facturas en rango crítico. La más antigua lleva ${r.dias} días sin cobrarse.`,
      accion: 'Priorizar cobranza en los deudores principales',
    });
  }

  // 3. Inventario muerto
  const inv = await resumenInventario();
  if (inv.valor_muerto > 0) {
    out.push({
      severidad: 'media',
      titulo: `${fmt(inv.valor_muerto, 'moneda')} en inventario sin movimiento`,
      detalle: `${inv.sin_movimiento} de ${inv.skus} SKUs no registran ninguna venta en el periodo cargado.`,
      accion: 'Evaluar promoción o liquidación de líneas muertas',
    });
  }

  // 4. Clientes dormidos
  const cl = await resumenClientes();
  const dormidos = cl.total - cl.con_compra;
  if (dormidos > 0) {
    out.push({
      severidad: 'media',
      titulo: `${dormidos} clientes sin comprar en el periodo`,
      detalle: `Solo ${cl.con_compra} de ${cl.total} clientes del catálogo registraron compra. Hay ${cl.morosos} marcados como morosos y ${cl.suspendidos} suspendidos.`,
      accion: 'Campaña de reactivación con el equipo de ventas',
    });
  }

  // 5. Ventas bajo costo
  const neg = await pool.query(
    `SELECT COUNT(*)::int AS n,
            SUM(monto_total - costo_unitario * unidades)::float8 AS perdida
     FROM ventas
     WHERE tenant_id = $1 AND (monto_total - costo_unitario * unidades) < 0`,
    [TENANT]
  );
  if (neg.rows[0]?.n > 0) {
    const r = neg.rows[0];
    out.push({
      severidad: 'baja',
      titulo: `${r.n} líneas vendidas por debajo del costo`,
      detalle: `Pérdida acumulada de ${fmt(Math.abs(r.perdida), 'moneda')}. Revisa si son bonificaciones o muestras mal capturadas.`,
      accion: 'Revisar captura de bonificaciones y descuentos',
    });
  }

  return out;
}
