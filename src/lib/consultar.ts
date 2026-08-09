/**
 * MOTOR DE CONSULTAS
 *
 * Regla inviolable: la IA nunca escribe SQL. Elige métricas y dimensiones
 * de una lista cerrada y este archivo arma la consulta con parámetros.
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
  /** Meses seleccionados en el slicer, formato 'YYYY-MM' */
  meses?: string[] | null;
}

export interface Fila { etiqueta?: string; [m: string]: string | number | undefined }

export interface Resultado {
  filas: Fila[];
  formateado: Record<string, string>[];
  sql: string;
  parametros: unknown[];
  metricas: Metrica[];
  dimension?: Dimension;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

/* ------------------------------------------------------------------ */
/* Reglas de negocio configurables por cliente                         */
/* ------------------------------------------------------------------ */

export interface Reglas {
  /** Precio unitario mínimo para que una línea cuente como ingreso. */
  umbralMarketing: number | null;
}

let cacheReglas: { v: Reglas; t: number } | null = null;

export async function reglas(): Promise<Reglas> {
  if (cacheReglas && Date.now() - cacheReglas.t < 60_000) return cacheReglas.v;
  const { rows } = await pool.query(
    'SELECT umbral_marketing FROM tenants WHERE id = $1', [TENANT]
  );
  const u = rows[0]?.umbral_marketing;
  const v: Reglas = { umbralMarketing: u == null ? null : Number(u) };
  cacheReglas = { v, t: Date.now() };
  return v;
}

function validarFecha(v: string | null | undefined, campo: string) {
  if (!v) return null;
  if (!ISO.test(v)) throw new Error(`${campo} debe ser YYYY-MM-DD, se recibió "${v}"`);
  return v;
}

/**
 * Construye el WHERE compartido por todas las consultas sobre ventas.
 *
 * `umbral` es la regla de negocio del cliente: las líneas por debajo de ese
 * precio unitario no cuentan como ingreso, se clasifican como marketing.
 */
function armar(f: Filtros, params: unknown[], umbral: number | null = null) {
  const where = ['v.tenant_id = $1'];
  if (umbral != null) {
    params.push(umbral);
    where.push(`v.precio_unitario >= $${params.length}`);
  }
  const add = (tpl: string, val: unknown) => {
    params.push(val);
    where.push(tpl.replace(/\?/g, `$${params.length}`));
  };
  const desde = validarFecha(f.desde, 'desde');
  const hasta = validarFecha(f.hasta, 'hasta');
  if (desde) add('v.fecha >= ?::date', desde);
  if (hasta) add('v.fecha <= ?::date', hasta);
  if (f.meses?.length) {
    const ok = f.meses.filter(m => MES.test(m));
    if (ok.length) add(`TO_CHAR(v.fecha,'YYYY-MM') = ANY(?)`, ok);
  }
  if (f.canal) add('UPPER(v.canal) = UPPER(?)', f.canal);
  if (f.vendedor) add('ven.nombre ILIKE ?', `%${f.vendedor}%`);
  if (f.cliente) add('(c.razon_social ILIKE ? OR c.nombre_comercial ILIKE ?)', `%${f.cliente}%`);
  if (f.categoria) add('p.categoria ILIKE ?', `%${f.categoria}%`);
  if (f.producto) add('p.descripcion ILIKE ?', `%${f.producto}%`);
  return where;
}

const JOINS = `
  FROM ventas v
  LEFT JOIN clientes   c   ON c.tenant_id = v.tenant_id AND c.clave = v.cliente_clave
  LEFT JOIN vendedores ven ON ven.tenant_id = v.tenant_id AND ven.clave = v.vendedor_clave
  LEFT JOIN productos  p   ON p.tenant_id = v.tenant_id AND p.clave = v.producto_clave
  LEFT JOIN almacenes  alm ON alm.tenant_id = v.tenant_id
                          AND alm.codigo = 'ALM-' || LPAD(v.bodega::text, 2, '0')`;

export async function consultar(opts: {
  metricas: string[];
  agrupar?: string | null;
  filtros?: Filtros;
  orden?: 'desc' | 'asc';
  limite?: number;
}): Promise<Resultado> {
  const { agrupar, filtros = {}, orden = 'desc' } = opts;
  const limite = Math.min(Math.max(opts.limite ?? 10, 1), 500);

  const ms = (opts.metricas ?? []).filter(esMetrica);
  if (!ms.length) throw new Error(`Métrica no reconocida. Disponibles: ${Object.keys(METRICAS).join(', ')}`);
  if (agrupar && !esDimension(agrupar)) {
    throw new Error(`Dimensión no reconocida. Disponibles: ${Object.keys(DIMENSIONES).join(', ')}`);
  }
  const dim = agrupar as Dimension | undefined;

  const sel = ms.map(m => `${METRICAS[m].sql} AS "${m}"`);
  if (dim) sel.unshift(`${DIMENSIONES[dim].sql} AS etiqueta`);

  const params: unknown[] = [TENANT];
  const where = armar(filtros, params, (await reglas()).umbralMarketing);

  const idxOrden = ms.findIndex(m => !('noAditiva' in METRICAS[m]));
  const colOrden = (idxOrden >= 0 ? idxOrden : 0) + 2;
  const cronologica = dim === 'mes' || dim === 'dia' || dim === 'trimestre';

  const sql = `
    SELECT ${sel.join(', ')}
    ${JOINS}
    WHERE ${where.join(' AND ')}
    ${dim ? `GROUP BY ${DIMENSIONES[dim].sql}` : ''}
    ${dim ? (cronologica ? 'ORDER BY 1 ASC' : `ORDER BY ${colOrden} ${orden === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`) : ''}
    ${dim ? `LIMIT ${limite}` : ''}`.trim();

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

  return { filas, formateado, sql: sql.replace(/\s+/g, ' '), parametros: params, metricas: ms, dimension: dim };
}

/* ================================================================== */
/* CLIENTES · retención y cohortes                                     */
/* ================================================================== */

export async function resumenClientes(f: Filtros = {}) {
  const params: unknown[] = [TENANT];
  const where = armar(f, params, (await reglas()).umbralMarketing);

  // Clientes totales del catálogo (excluye suspendidos, como el DAX original)
  const tot = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE estatus ILIKE 'moroso')::int     AS morosos,
            COUNT(*) FILTER (WHERE estatus ILIKE 'suspendido')::int AS suspendidos,
            COUNT(*) FILTER (WHERE estatus ILIKE 'activo')::int     AS activos_catalogo
     FROM clientes WHERE tenant_id = $1 AND COALESCE(estatus,'') NOT ILIKE 'suspendido'`,
    [TENANT]
  );

  const act = await pool.query(
    `SELECT COUNT(DISTINCT v.cliente_clave)::int AS activos,
            COUNT(DISTINCT v.cliente_clave) FILTER (
              WHERE c.primera_compra IS NOT NULL
                AND c.primera_compra >= (SELECT MIN(fecha) FROM ventas v2 WHERE v2.tenant_id = $1)
            )::int AS nuevos
     ${JOINS} WHERE ${where.join(' AND ')}`,
    params
  );

  const total = tot.rows[0].total;
  const activos = act.rows[0].activos;
  const nuevos = act.rows[0].nuevos;

  return {
    total,
    activos,
    nuevos,
    recurrentes: activos - nuevos,
    morosos: tot.rows[0].morosos,
    suspendidos: tot.rows[0].suspendidos,
    /** Definición del Power BI original: penetración de catálogo */
    penetracion_pct: total ? (activos / total) * 100 : 0,
    dormidos: total - activos,
  };
}

/**
 * Retención real mes a mes: de los clientes que compraron el mes anterior,
 * qué porcentaje volvió a comprar este mes.
 * (El Power BI usaba activos/totales, que es penetración, no retención.)
 */
export async function retencionMensual() {
  const { rows } = await pool.query(
    `WITH cm AS (
       SELECT DISTINCT TO_CHAR(fecha,'YYYY-MM') AS mes, cliente_clave
       FROM ventas WHERE tenant_id = $1 AND cliente_clave IS NOT NULL
     ),
     meses AS (SELECT DISTINCT mes FROM cm ORDER BY mes),
     pares AS (
       SELECT m.mes,
              LAG(m.mes) OVER (ORDER BY m.mes) AS mes_prev
       FROM meses m
     )
     SELECT p.mes,
            (SELECT COUNT(*) FROM cm WHERE mes = p.mes)::int AS activos,
            (SELECT COUNT(*) FROM cm WHERE mes = p.mes_prev)::int AS base_prev,
            (SELECT COUNT(*) FROM cm a
              WHERE a.mes = p.mes
                AND EXISTS (SELECT 1 FROM cm b WHERE b.mes = p.mes_prev AND b.cliente_clave = a.cliente_clave)
            )::int AS retenidos,
            (SELECT COUNT(*) FROM cm a
              WHERE a.mes = p.mes
                AND NOT EXISTS (SELECT 1 FROM cm b WHERE b.mes < p.mes AND b.cliente_clave = a.cliente_clave)
            )::int AS nuevos
     FROM pares p ORDER BY p.mes`,
    [TENANT]
  );

  return rows.map(r => ({
    mes: r.mes,
    activos: r.activos,
    nuevos: r.nuevos,
    recurrentes: r.activos - r.nuevos,
    retenidos: r.retenidos,
    base_prev: r.base_prev,
    retencion_pct: r.base_prev ? (r.retenidos / r.base_prev) * 100 : null,
    churn_pct: r.base_prev ? (1 - r.retenidos / r.base_prev) * 100 : null,
  }));
}

export async function clientesDormidos(limite = 20) {
  const { rows } = await pool.query(
    `SELECT COALESCE(c.nombre_comercial, c.razon_social) AS cliente,
            c.canal, c.estatus, c.primera_compra::text AS primera_compra,
            COALESCE(x.saldo, 0)::float8 AS saldo_pendiente
     FROM clientes c
     LEFT JOIN (
       SELECT cliente_clave, SUM(saldo_pendiente) AS saldo
       FROM cuentas_por_cobrar WHERE tenant_id = $1 AND saldo_pendiente > 0.01
       GROUP BY cliente_clave
     ) x ON x.cliente_clave = c.clave
     WHERE c.tenant_id = $1
       AND NOT EXISTS (SELECT 1 FROM ventas v WHERE v.tenant_id = c.tenant_id AND v.cliente_clave = c.clave)
     ORDER BY saldo_pendiente DESC, c.razon_social
     LIMIT $2`,
    [TENANT, Math.min(limite, 100)]
  );
  return rows;
}

/* ================================================================== */
/* COBRANZA                                                            */
/* ================================================================== */

export async function metricasCxC(f: Filtros = {}) {
  const desde = validarFecha(f.desde, 'desde');
  const hasta = validarFecha(f.hasta, 'hasta');

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(monto_facturado),0)::float8 AS facturado,
            COALESCE(SUM(monto_cobrado),0)::float8   AS cobrado,
            COALESCE(SUM(saldo_pendiente),0)::float8 AS saldo,
            COUNT(*)::int AS facturas
     FROM cuentas_por_cobrar
     WHERE tenant_id = $1
       AND ($2::date IS NULL OR fecha_factura >= $2::date)
       AND ($3::date IS NULL OR fecha_factura <= $3::date)`,
    [TENANT, desde, hasta]
  );
  const r = rows[0];

  // DSO = saldo del periodo / ingresos del periodo × días del periodo
  const params: unknown[] = [TENANT];
  const where = armar(f, params, (await reglas()).umbralMarketing);
  const ing = await pool.query(
    `SELECT COALESCE(SUM(v.monto_total),0)::float8 AS ingresos,
            (MAX(v.fecha) - MIN(v.fecha) + 1)::int AS dias
     ${JOINS} WHERE ${where.join(' AND ')}`,
    params
  );
  const ingresos = ing.rows[0].ingresos;
  const dias = ing.rows[0].dias ?? 1;

  return {
    ...r,
    cobrado_pct: r.facturado ? (r.cobrado / r.facturado) * 100 : 0,
    dso: ingresos ? (r.saldo / ingresos) * dias : 0,
    dias_periodo: dias,
  };
}

export async function cartera(opts: { diasMinimos?: number; limite?: number } = {}) {
  const dias = opts.diasMinimos ?? 0;
  const limite = Math.min(opts.limite ?? 10, 50);
  const { rows } = await pool.query(
    `SELECT COALESCE(c.nombre_comercial, c.razon_social, 'Cliente ' || x.cliente_clave) AS cliente,
            SUM(x.saldo_pendiente)::float8 AS saldo,
            COUNT(*)::int AS facturas,
            MAX((SELECT MAX(fecha) FROM ventas WHERE tenant_id = x.tenant_id) - x.fecha_vence)::int AS dias_max
     FROM cuentas_por_cobrar x
     LEFT JOIN clientes c ON c.tenant_id = x.tenant_id AND c.clave = x.cliente_clave
     WHERE x.tenant_id = $1 AND x.saldo_pendiente > 0.01
       AND ((SELECT MAX(fecha) FROM ventas WHERE tenant_id = x.tenant_id) - x.fecha_vence) >= $2
     GROUP BY 1 ORDER BY saldo DESC LIMIT $3`,
    [TENANT, dias, limite]
  );
  return rows.map(r => ({ ...r, saldo_fmt: fmt(r.saldo, 'moneda') }));
}

export async function carteraAntiguedad() {
  const { rows } = await pool.query(
    `WITH corte AS (SELECT MAX(fecha) AS d FROM ventas WHERE tenant_id = $1),
     b AS (SELECT saldo_pendiente, ((SELECT d FROM corte) - fecha_vence) AS dias
           FROM cuentas_por_cobrar WHERE tenant_id = $1 AND saldo_pendiente > 0.01)
     SELECT CASE WHEN dias IS NULL THEN 'Sin vencimiento'
                 WHEN dias <= 0 THEN 'Por vencer'
                 WHEN dias <= 30 THEN '1-30 días'
                 WHEN dias <= 60 THEN '31-60 días'
                 WHEN dias <= 90 THEN '61-90 días'
                 ELSE 'Más de 90' END AS rango,
            SUM(saldo_pendiente)::float8 AS saldo, COUNT(*)::int AS facturas
     FROM b GROUP BY 1`,
    [TENANT]
  );
  const orden = ['Por vencer','1-30 días','31-60 días','61-90 días','Más de 90','Sin vencimiento'];
  return rows.sort((a,b) => orden.indexOf(a.rango) - orden.indexOf(b.rango))
             .map(r => ({ ...r, saldo_fmt: fmt(r.saldo,'moneda') }));
}

/* ================================================================== */
/* INVENTARIO                                                          */
/* ================================================================== */

export async function resumenInventario() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS skus,
            COALESCE(SUM(i.existencias),0)::int AS botellas,
            COALESCE(SUM(i.existencias * i.costo),0)::float8 AS valor,
            COUNT(*) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM ventas v WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave
            ))::int AS sin_movimiento,
            COALESCE(SUM(i.existencias * i.costo) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM ventas v WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave
            )),0)::float8 AS valor_muerto
     FROM inventario i WHERE i.tenant_id = $1`,
    [TENANT]
  );
  return rows[0];
}

/**
 * Existencias por almacén. Usa inventario_almacen, que viene de las columnas
 * ALM-01 … ALM-15 del Excel. La columna LUGAR del inventario es la posición
 * en el rack, no el almacén, así que no sirve para esto.
 */
export async function inventarioPorBodega() {
  const { rows } = await pool.query(
    `SELECT COALESCE(al.nombre, a.almacen) AS bodega,
            SUM(a.existencias)::int AS unidades,
            SUM(a.existencias * COALESCE(i.costo, 0))::float8 AS valor
     FROM inventario_almacen a
     LEFT JOIN inventario i
       ON i.tenant_id = a.tenant_id AND i.producto_clave = a.producto_clave
     LEFT JOIN almacenes al
       ON al.tenant_id = a.tenant_id AND al.codigo = a.almacen
     WHERE a.tenant_id = $1
     GROUP BY 1
     HAVING SUM(a.existencias) > 0
     ORDER BY unidades DESC`,
    [TENANT]
  );
  if (rows.length) return rows;

  // Respaldo si aún no se ha recargado el inventario con el desglose
  const alt = await pool.query(
    `SELECT COALESCE(NULLIF(lugar,'0'),'Sin ubicación') AS bodega,
            SUM(existencias)::int AS unidades,
            SUM(existencias * costo)::float8 AS valor
     FROM inventario WHERE tenant_id = $1
     GROUP BY 1 ORDER BY unidades DESC LIMIT 15`,
    [TENANT]
  );
  return alt.rows;
}

export async function inventarioSinMovimiento(limite = 15) {
  const { rows } = await pool.query(
    `SELECT p.descripcion AS producto, i.existencias::int,
            (i.existencias * i.costo)::float8 AS valor, i.linea
     FROM inventario i
     JOIN productos p ON p.tenant_id = i.tenant_id AND p.clave = i.producto_clave
     WHERE i.tenant_id = $1 AND i.existencias > 0
       AND NOT EXISTS (SELECT 1 FROM ventas v WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave)
     ORDER BY valor DESC LIMIT $2`,
    [TENANT, Math.min(limite, 50)]
  );
  return rows.map(r => ({ ...r, valor_fmt: fmt(r.valor,'moneda') }));
}

/* ================================================================== */
/* MARKETING (regla del cliente)                                       */
/* ================================================================== */

/** Precio unitario por debajo del cual una línea es claramente una cortesía. */
export const UMBRAL_BONIFICACION = 5;

/** Umbral que usaba el Power BI para separar "marketing" de ventas. */
export const UMBRAL_POWERBI = 190;

/**
 * Costo real del producto entregado como cortesía.
 *
 * Es el gasto verdadero del muestreo comercial: el costo de las botellas que
 * salieron a precio simbólico, no su precio de lista.
 */
export async function costoMuestreo(f: Filtros = {}) {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(fecha,'YYYY-MM') AS periodo,
            SUM(costo_unitario * unidades)::float8 AS costo,
            SUM(unidades)::int                     AS botellas,
            COUNT(*)::int                          AS lineas
     FROM ventas
     WHERE tenant_id = $1 AND precio_unitario <= $2
     GROUP BY 1 ORDER BY 1`,
    [TENANT, UMBRAL_BONIFICACION]
  );
  const sel = f.meses?.length ? rows.filter(r => f.meses!.includes(r.periodo)) : rows;
  return {
    filas: rows,
    costo: sel.reduce((a, r) => a + r.costo, 0),
    botellas: sel.reduce((a, r) => a + r.botellas, 0),
    umbral: UMBRAL_BONIFICACION,
  };
}

/**
 * Marketing según la regla del cliente: monto de las líneas con precio unitario
 * por debajo del umbral configurado.
 *
 * Devuelve además el desglose que permite entender de qué se compone:
 *   - cortesías reales (precio simbólico), donde el gasto verdadero es el costo
 *   - ventas a precio bajo, que son venta normal de vino económico
 *
 * Ese desglose no cambia la cifra; sirve para que el cliente pueda revisar el
 * criterio con información en la mano.
 */
export async function marketing(f: Filtros = {}) {
  const { umbralMarketing } = await reglas();
  if (umbralMarketing == null) {
    return { activa: false, umbral: null, filas: [], monto: 0, desglose: null };
  }

  const { rows } = await pool.query(
    `SELECT TO_CHAR(fecha,'YYYY-MM')            AS periodo,
            SUM(monto_total)::float8            AS monto,
            SUM(unidades)::int                  AS botellas,
            COUNT(*)::int                       AS lineas
     FROM ventas
     WHERE tenant_id = $1 AND precio_unitario < $2
     GROUP BY 1 ORDER BY 1`,
    [TENANT, umbralMarketing]
  );

  const sel = f.meses?.length ? rows.filter(r => f.meses!.includes(r.periodo)) : rows;

  const d = await pool.query(
    `SELECT
       SUM(monto_total) FILTER (WHERE precio_unitario <= $3)::float8               AS cortesia_monto,
       SUM(costo_unitario*unidades) FILTER (WHERE precio_unitario <= $3)::float8   AS cortesia_costo,
       SUM(unidades) FILTER (WHERE precio_unitario <= $3)::int                     AS cortesia_botellas,
       COUNT(*) FILTER (WHERE precio_unitario <= $3)::int                          AS cortesia_lineas,
       SUM(monto_total) FILTER (WHERE precio_unitario > $3)::float8                AS bajo_monto,
       SUM(unidades) FILTER (WHERE precio_unitario > $3)::int                      AS bajo_botellas,
       COUNT(*) FILTER (WHERE precio_unitario > $3)::int                           AS bajo_lineas,
       AVG(precio_unitario) FILTER (WHERE precio_unitario > $3)::float8            AS bajo_precio_prom
     FROM ventas
     WHERE tenant_id = $1 AND precio_unitario < $2`,
    [TENANT, umbralMarketing, UMBRAL_BONIFICACION]
  );

  return {
    activa: true,
    umbral: umbralMarketing,
    filas: rows,
    monto: sel.reduce((a, r) => a + r.monto, 0),
    desglose: d.rows[0] ?? null,
  };
}

/* ================================================================== */
/* FORECAST — regresión lineal sobre la tendencia mensual              */
/* ================================================================== */

export interface PuntoForecast {
  mes: string;
  real: number | null;
  tendencia: number;
  conservador: number | null;
  optimista: number | null;
  proyectado: boolean;
}

/**
 * Reemplaza el "forecast" del Power BI (que era Ingresos x 0.85 y x 1.20, o sea
 * la misma curva escalada) por una regresión lineal real proyectada a meses
 * futuros, con banda de confianza basada en el error histórico.
 */
export async function forecast(mesesAdelante = 3): Promise<{
  puntos: PuntoForecast[];
  r2: number;
  pendiente: number;
  metodo: string;
}> {
  const { umbralMarketing } = await reglas();
  const { rows } = await pool.query(
    `SELECT TO_CHAR(fecha,'YYYY-MM') AS mes, SUM(monto_total)::float8 AS venta,
            COUNT(DISTINCT fecha)::int AS dias_con_venta
     FROM ventas
     WHERE tenant_id = $1 AND ($2::numeric IS NULL OR precio_unitario >= $2::numeric)
     GROUP BY 1 ORDER BY 1`,
    [TENANT, umbralMarketing]
  );
  if (rows.length < 3) return { puntos: [], r2: 0, pendiente: 0, metodo: 'datos insuficientes' };

  // El último mes puede estar incompleto: se excluye para no sesgar la recta.
  const ultimo = rows[rows.length - 1];
  const diasMes = new Date(+ultimo.mes.slice(0, 4), +ultimo.mes.slice(5, 7), 0).getDate();
  const parcial = ultimo.dias_con_venta < diasMes * 0.6;

  const base = parcial ? rows.slice(0, -1) : rows;
  const n = base.length;
  const xs = base.map((_, i) => i);
  const ys = base.map(r => r.venta);

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const m = num / den;
  const b = my - m * mx;

  const pred = (i: number) => m * i + b;
  const ssTot = ys.reduce((a, y) => a + (y - my) ** 2, 0) || 1;
  const ssRes = ys.reduce((a, y, i) => a + (y - pred(i)) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  const err = Math.sqrt(ssRes / Math.max(n - 2, 1));

  const puntos: PuntoForecast[] = rows.map((r, i) => ({
    mes: r.mes, real: r.venta, tendencia: Math.max(0, pred(i)),
    conservador: null, optimista: null, proyectado: false,
  }));

  const ultIdx = rows.length - 1;
  for (let k = 1; k <= mesesAdelante; k++) {
    const i = ultIdx + k;
    const [y, mo] = rows[ultIdx].mes.split('-').map(Number);
    const d = new Date(y, mo - 1 + k, 1);
    const p = Math.max(0, pred(i));
    puntos.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      real: null, tendencia: p,
      conservador: Math.max(0, p - err), optimista: p + err, proyectado: true,
    });
  }

  return {
    puntos, r2, pendiente: m,
    metodo: `Regresión lineal sobre ${n} meses${parcial ? ' (se excluyó el mes parcial)' : ''}`,
  };
}

/* ================================================================== */
/* CONTEXTO Y ALERTAS                                                  */
/* ================================================================== */

export interface Contexto {
  desde: string; hasta: string; canales: string[];
  categorias: string[]; meses: string[]; empresa: string;
}

let cacheCtx: { v: Contexto; t: number } | null = null;

export async function contexto(): Promise<Contexto> {
  if (cacheCtx && Date.now() - cacheCtx.t < 300_000) return cacheCtx.v;
  const { rows } = await pool.query(
    `SELECT MIN(fecha)::text AS desde, MAX(fecha)::text AS hasta,
            ARRAY_AGG(DISTINCT canal) FILTER (WHERE canal IS NOT NULL) AS canales,
            ARRAY_AGG(DISTINCT TO_CHAR(fecha,'YYYY-MM')) AS meses
     FROM ventas WHERE tenant_id = $1`, [TENANT]);
  const cat = await pool.query(
    `SELECT ARRAY_AGG(DISTINCT categoria) FILTER (WHERE categoria IS NOT NULL) AS c
     FROM productos WHERE tenant_id = $1`, [TENANT]);
  const t = await pool.query('SELECT nombre FROM tenants WHERE id = $1', [TENANT]);

  const v: Contexto = {
    desde: rows[0]?.desde ?? '', hasta: rows[0]?.hasta ?? '',
    canales: (rows[0]?.canales ?? []).sort(),
    categorias: (cat.rows[0]?.c ?? []).sort(),
    meses: (rows[0]?.meses ?? []).sort(),
    empresa: t.rows[0]?.nombre ?? 'Empresa',
  };
  cacheCtx = { v, t: Date.now() };
  return v;
}

export interface Alerta {
  severidad: 'alta' | 'media' | 'baja';
  titulo: string; detalle: string; accion: string;
}

/** Conceptos que no corresponden a venta de vino. */
const NO_COMERCIALES = ['VEHICULO USADO', 'NOTA DE CREDITO', 'DEVOLUCIONES',
                        'SERVICIOS DE FACTURACION'];

export async function alertas(): Promise<Alerta[]> {
  const out: Alerta[] = [];

  const { rows: anom } = await pool.query(
    `SELECT v.factura, MAX(v.fecha)::text AS fecha,
            MAX(COALESCE(c.nombre_comercial, c.razon_social)) AS cliente,
            MAX(ven.nombre) AS vendedor,
            SUM(v.monto_total)::float8 AS venta, SUM(v.unidades)::int AS unidades,
            (SUM(v.monto_total - v.costo_unitario*v.unidades)/NULLIF(SUM(v.monto_total),0)*100)::float8 AS margen_pct
     ${JOINS} WHERE v.tenant_id = $1
     GROUP BY v.factura
     HAVING SUM(v.monto_total) > 100000
        AND (SUM(v.monto_total - v.costo_unitario*v.unidades)/NULLIF(SUM(v.monto_total),0)*100) < 15
     ORDER BY venta DESC LIMIT 3`, [TENANT]);
  for (const a of anom) {
    out.push({
      severidad: 'alta',
      titulo: `Venta de ${fmt(a.venta,'moneda')} facturada casi al costo`,
      detalle: `Factura ${a.factura} del ${a.fecha} a ${a.cliente}: ${a.unidades.toLocaleString('es-MX')} unidades por ${fmt(a.venta,'moneda')} con margen de ${a.margen_pct.toFixed(1)}%. Registrada por ${a.vendedor ?? 'sin vendedor'}.`,
      accion: 'Confirmar si fue liquidación autorizada o error de precios',
    });
  }

  const cri = await pool.query(
    `SELECT COALESCE(SUM(saldo_pendiente),0)::float8 AS monto, COUNT(*)::int AS n,
            MAX((SELECT MAX(fecha) FROM ventas WHERE tenant_id=$1) - fecha_vence)::int AS dias
     FROM cuentas_por_cobrar WHERE tenant_id=$1 AND saldo_pendiente > 0.01
       AND ((SELECT MAX(fecha) FROM ventas WHERE tenant_id=$1) - fecha_vence) > 90`, [TENANT]);
  if (cri.rows[0]?.monto > 0) {
    const r = cri.rows[0];
    out.push({ severidad:'alta',
      titulo: `${fmt(r.monto,'moneda')} vencidos a más de 90 días`,
      detalle: `${r.n} facturas en rango crítico. La más antigua lleva ${r.dias} días sin cobrarse.`,
      accion: 'Priorizar cobranza en los deudores principales' });
  }

  const inv = await resumenInventario();
  if (inv.valor_muerto > 0) {
    out.push({ severidad:'media',
      titulo: `${fmt(inv.valor_muerto,'moneda')} en inventario sin movimiento`,
      detalle: `${inv.sin_movimiento} de ${inv.skus} SKUs no registran ninguna venta en el periodo cargado.`,
      accion: 'Evaluar promoción o liquidación de líneas muertas' });
  }

  const cl = await resumenClientes();
  if (cl.dormidos > 0) {
    out.push({ severidad:'media',
      titulo: `${cl.dormidos} clientes sin comprar en el periodo`,
      detalle: `Solo ${cl.activos} de ${cl.total} clientes del catálogo registraron compra. Hay ${cl.morosos} marcados como morosos.`,
      accion: 'Campaña de reactivación con el equipo de ventas' });
  }

  // Cortesías: el costo real del muestreo comercial
  const bon = await pool.query(
    `SELECT COUNT(*)::int AS n, SUM(unidades)::int AS botellas,
            SUM(costo_unitario * unidades)::float8 AS costo
     FROM ventas WHERE tenant_id = $1 AND precio_unitario <= $2`,
    [TENANT, UMBRAL_BONIFICACION]);
  if (bon.rows[0]?.n > 0) {
    const r = bon.rows[0];
    out.push({ severidad: 'baja',
      titulo: `${fmt(r.costo, 'moneda')} en producto entregado como cortesía`,
      detalle: `${r.botellas.toLocaleString('es-MX')} botellas en ${r.n} líneas con precio unitario de $${UMBRAL_BONIFICACION} o menos. Ese es el costo real del muestreo comercial.`,
      accion: 'Confirmar que son bonificaciones autorizadas y no errores de captura' });
  }

  // Ventas que el reporte anterior dejaba fuera por su filtro de precio
  const { umbralMarketing } = await reglas();
  if (umbralMarketing == null) {
    const excl = await pool.query(
      `SELECT COUNT(*)::int AS n, SUM(unidades)::int AS botellas,
              SUM(monto_total)::float8 AS monto, AVG(precio_unitario)::float8 AS precio
       FROM ventas
       WHERE tenant_id = $1 AND precio_unitario > $2 AND precio_unitario < $3`,
      [TENANT, UMBRAL_BONIFICACION, UMBRAL_POWERBI]);
    if (excl.rows[0]?.n > 0) {
      const r = excl.rows[0];
      out.push({ severidad: 'media',
        titulo: `${fmt(r.monto, 'moneda')} en ventas que el reporte anterior no mostraba`,
        detalle: `${r.n} líneas con precio unitario promedio de ${fmt(r.precio, 'moneda')} y ${r.botellas.toLocaleString('es-MX')} botellas. El reporte anterior las clasificaba como gasto de marketing por estar debajo de $${UMBRAL_POWERBI}.`,
        accion: 'Confirmar el criterio: parecen venta de vino económico, no promoción' });
    }
  }

  // Conceptos que no son venta de vino y distorsionan precios promedio
  const nc = await pool.query(
    `SELECT descripcion_agg AS concepto, monto, lineas FROM (
       SELECT MAX(p.descripcion) AS descripcion_agg,
              SUM(v.monto_total)::float8 AS monto, COUNT(*)::int AS lineas
       FROM ventas v
       LEFT JOIN productos p ON p.tenant_id = v.tenant_id AND p.clave = v.producto_clave
       WHERE v.tenant_id = $1 AND p.descripcion = ANY($2)
       GROUP BY p.descripcion
     ) t WHERE monto <> 0`,
    [TENANT, NO_COMERCIALES]);
  if (nc.rows.length) {
    const total = nc.rows.reduce((a, r) => a + Math.abs(r.monto), 0);
    out.push({ severidad: 'media',
      titulo: `${fmt(total, 'moneda')} en conceptos que no son venta de vino`,
      detalle: `Incluye: ${nc.rows.map((r: { concepto: string; monto: number }) => `${r.concepto} (${fmt(r.monto, 'moneda')})`).join(', ')}. Están sumando a los ingresos y distorsionan el precio promedio por botella.`,
      accion: 'Decidir si deben contarse como ingreso o registrarse aparte' });
  }

  return out;
}
