/**
 * PULSO
 *
 * Métricas y hallazgos para dirección. A diferencia del resto del tablero, que
 * responde preguntas específicas, esto decide qué merece la atención del
 * director esta semana y lo pone hasta arriba.
 *
 * Todo se calcula de los mismos datos que ya se cargan.
 */
import { pool, TENANT } from './db';
import { reglas } from './consultar';
import { mxn, entero, pct } from './formato';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface Kpi {
  clave: string;
  etiqueta: string;
  valor: string;
  /** Comparación contra el periodo anterior o contra la referencia */
  contexto: string;
  /** 0 a 100, para la barra de estado */
  avance: number;
  estado: 'bien' | 'atencion' | 'critico' | 'neutro';
}

export interface Hallazgo {
  clave: string;
  /** Impacto en pesos, para ordenar */
  impacto: number;
  titulo: string;
  detalle: string;
  /** A dónde lleva el clic */
  destino?: { vista: string; etiqueta: string };
  filas?: { nombre: string; dato: string; extra?: string }[];
}

export interface PuntoTendencia {
  mes: string;
  venta: number | null;
  margenPct: number | null;
  proyeccion: number | null;
}

export interface Pulso {
  kpis: Kpi[];
  hallazgos: Hallazgo[];
  tendencia: PuntoTendencia[];
  corte: string;
  mesActual: string;
  diasDelMes: { transcurridos: number; total: number };
}

const n = (v: unknown) => Number(v ?? 0);

/** Filtro de la regla de marketing, si está activa. */
async function filtroRegla(): Promise<string> {
  const { umbralMarketing } = await reglas();
  return umbralMarketing == null ? '' : ` AND precio_unitario >= ${Number(umbralMarketing)}`;
}

/* ------------------------------------------------------------------ */
/* Bloques de cálculo                                                  */
/* ------------------------------------------------------------------ */

/** Venta y margen por mes, con proyección lineal a 2 meses. */
async function tendencia(f: string): Promise<PuntoTendencia[]> {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(fecha,'YYYY-MM') AS mes,
            SUM(monto_total)::float8 AS venta,
            (SUM(monto_total - costo_unitario*unidades)/NULLIF(SUM(monto_total),0)*100)::float8 AS margen,
            COUNT(DISTINCT fecha)::int AS dias
     FROM ventas WHERE tenant_id = $1${f}
     GROUP BY 1 ORDER BY 1`, [TENANT]);

  if (rows.length < 3) {
    return rows.map(r => ({ mes: r.mes, venta: n(r.venta), margenPct: n(r.margen), proyeccion: null }));
  }

  // El mes en curso se excluye del ajuste para no sesgar la recta
  const ult = rows[rows.length - 1];
  const diasMes = new Date(+ult.mes.slice(0, 4), +ult.mes.slice(5, 7), 0).getDate();
  const parcial = ult.dias < diasMes * 0.6;
  const base = parcial ? rows.slice(0, -1) : rows;

  const N = base.length;
  const xs = base.map((_, i) => i);
  const ys = base.map(r => n(r.venta));
  const mx = xs.reduce((a, b) => a + b, 0) / N;
  const my = ys.reduce((a, b) => a + b, 0) / N;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const m = num / den;
  const b = my - m * mx;

  const puntos: PuntoTendencia[] = rows.map(r => ({
    mes: r.mes, venta: n(r.venta), margenPct: n(r.margen), proyeccion: null,
  }));

  // La proyección arranca del último punto real para que la línea se vea continua
  const ultIdx = rows.length - 1;
  puntos[ultIdx].proyeccion = n(rows[ultIdx].venta);
  for (let k = 1; k <= 2; k++) {
    const [y, mo] = rows[ultIdx].mes.split('-').map(Number);
    const d = new Date(y, mo - 1 + k, 1);
    puntos.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      venta: null, margenPct: null,
      proyeccion: Math.max(0, m * (ultIdx + k) + b),
    });
  }
  return puntos;
}

/** Los cuatro números de la franja superior. */
async function kpis(f: string, t: PuntoTendencia[]): Promise<{ kpis: Kpi[]; dias: { transcurridos: number; total: number } }> {
  const reales = t.filter(p => p.venta != null);
  const act = reales[reales.length - 1];
  const prev = reales[reales.length - 2];

  const { rows: dr } = await pool.query(
    `SELECT MAX(fecha)::text AS corte,
            EXTRACT(DAY FROM MAX(fecha))::int AS dia
     FROM ventas WHERE tenant_id = $1`, [TENANT]);
  const corte = dr[0]?.corte ?? '';
  const diaActual = dr[0]?.dia ?? 30;
  const totalDias = corte
    ? new Date(+corte.slice(0, 4), +corte.slice(5, 7), 0).getDate()
    : 30;
  const parcial = diaActual < totalDias;

  // Cobranza: días de cartera y % vencido
  const { rows: cb } = await pool.query(
    `WITH c AS (SELECT MAX(fecha) AS d FROM ventas WHERE tenant_id = $1)
     SELECT COALESCE(SUM(saldo_pendiente),0)::float8 AS saldo,
            COALESCE(SUM(saldo_pendiente) FILTER (
              WHERE ((SELECT d FROM c) - fecha_vence) > 0),0)::float8 AS vencido
     FROM cuentas_por_cobrar
     WHERE tenant_id = $1 AND saldo_pendiente > 0.01`, [TENANT]);

  const { rows: vd } = await pool.query(
    `SELECT COALESCE(SUM(monto_total),0)::float8 AS v,
            (MAX(fecha) - MIN(fecha) + 1)::int AS dias
     FROM ventas WHERE tenant_id = $1${f}`, [TENANT]);
  const saldoCartera = n(cb[0]?.saldo);
  const sinCartera = saldoCartera <= 0;
  const diasCartera = n(vd[0]?.v) > 0
    ? (saldoCartera / n(vd[0].v)) * n(vd[0].dias) : 0;
  const pctVencido = saldoCartera > 0 ? (n(cb[0].vencido) / saldoCartera) * 100 : 0;

  // Inventario: meses de cobertura global
  const { rows: iv } = await pool.query(
    `SELECT COALESCE(SUM(i.existencias * i.costo),0)::float8 AS valor,
            COALESCE(SUM(i.existencias * i.costo) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM ventas v WHERE v.tenant_id = i.tenant_id AND v.producto_clave = i.producto_clave
            )),0)::float8 AS muerto
     FROM inventario i WHERE i.tenant_id = $1`, [TENANT]);

  const { rows: cs } = await pool.query(
    `SELECT COALESCE(SUM(costo_unitario * unidades),0)::float8 AS costo,
            (MAX(fecha) - MIN(fecha) + 1)::float8 AS dias
     FROM ventas WHERE tenant_id = $1${f}`, [TENANT]);
  const costoMes = n(cs[0]?.dias) > 0 ? n(cs[0].costo) / (n(cs[0].dias) / 30.4) : 0;
  const valorInv = n(iv[0]?.valor);
  const mesesInv = costoMes > 0 ? valorInv / costoMes : 0;
  // Un cero puede significar "no hay inventario" o "no se ha cargado".
  // Mostrarlo como cifra normal induce a error, así que se distingue.
  const sinInventario = valorInv <= 0;

  const varVenta = act && prev && n(prev.venta) > 0
    ? (n(act.venta) / n(prev.venta) - 1) * 100 : null;
  const varMargen = act && prev ? n(act.margenPct) - n(prev.margenPct) : null;

  const K: Kpi[] = [
    {
      clave: 'venta',
      etiqueta: 'Venta del mes',
      valor: mxn(n(act?.venta)),
      contexto: parcial
        ? `${diaActual} de ${totalDias} días transcurridos`
        : varVenta != null
          ? `${varVenta >= 0 ? '▲' : '▼'} ${Math.abs(varVenta).toFixed(0)}% vs mes anterior`
          : 'sin comparación',
      avance: parcial ? (diaActual / totalDias) * 100 : 100,
      estado: parcial ? 'neutro' : varVenta != null && varVenta >= 0 ? 'bien' : 'atencion',
    },
    {
      clave: 'margen',
      etiqueta: 'Margen bruto',
      valor: pct(n(act?.margenPct)),
      contexto: varMargen != null
        ? `${varMargen >= 0 ? '▲' : '▼'} ${Math.abs(varMargen).toFixed(1)} pts vs mes anterior`
        : 'sin comparación',
      avance: Math.min(100, n(act?.margenPct)),
      estado: n(act?.margenPct) >= 45 ? 'bien' : n(act?.margenPct) >= 35 ? 'atencion' : 'critico',
    },
    {
      clave: 'cobranza',
      etiqueta: 'Días de cartera',
      valor: sinCartera ? '—' : `${Math.round(diasCartera)} días`,
      contexto: sinCartera
        ? 'sin cartera cargada'
        : `${mxn(saldoCartera)} por cobrar · ${pct(pctVencido)} vencido`,
      avance: sinCartera ? 0 : Math.min(100, (diasCartera / 120) * 100),
      estado: sinCartera ? 'neutro'
        : diasCartera <= 45 ? 'bien' : diasCartera <= 75 ? 'atencion' : 'critico',
    },
    {
      clave: 'inventario',
      etiqueta: 'Meses de inventario',
      valor: sinInventario ? '—' : `${mesesInv.toFixed(1)} meses`,
      contexto: sinInventario
        ? 'sin inventario cargado'
        : `${mxn(valorInv)} en stock`,
      avance: sinInventario ? 0 : Math.min(100, (mesesInv / 12) * 100),
      estado: sinInventario ? 'neutro'
        : mesesInv <= 3 ? 'bien' : mesesInv <= 6 ? 'atencion' : 'critico',
    },
  ];

  return { kpis: K, dias: { transcurridos: diaActual, total: totalDias } };
}

/**
 * Clientes que compraban y dejaron de hacerlo, comparando el primer tercio del
 * periodo contra el último. Es de los hallazgos con más valor y no existe en
 * ningún reporte previo.
 */
async function clientesEnCaida(f: string) {
  const { rows } = await pool.query(
    `WITH lim AS (
       SELECT MIN(fecha) AS ini, MAX(fecha) AS fin FROM ventas WHERE tenant_id = $1
     ),
     cortes AS (
       SELECT ini, fin,
              ini + ((fin - ini) / 3) AS c1,
              fin - ((fin - ini) / 3) AS c2
       FROM lim
     ),
     periodos AS (
       SELECT v.cliente_clave,
              SUM(v.monto_total) FILTER (WHERE v.fecha <= (SELECT c1 FROM cortes))::float8 AS antes,
              SUM(v.monto_total) FILTER (WHERE v.fecha >= (SELECT c2 FROM cortes))::float8 AS ahora
       FROM ventas v WHERE v.tenant_id = $1${f}
       GROUP BY v.cliente_clave
     )
     SELECT COALESCE(c.nombre_comercial, c.razon_social) AS cliente,
            COALESCE(p.antes,0)::float8 AS antes,
            COALESCE(p.ahora,0)::float8 AS ahora,
            ven.nombre AS vendedor
     FROM periodos p
     LEFT JOIN clientes c ON c.tenant_id = $1 AND c.clave = p.cliente_clave
     LEFT JOIN vendedores ven ON ven.tenant_id = $1 AND ven.clave = (
       SELECT vendedor_clave FROM ventas
       WHERE tenant_id = $1 AND cliente_clave = p.cliente_clave
       ORDER BY fecha DESC LIMIT 1
     )
     WHERE COALESCE(p.antes,0) > 50000
       AND COALESCE(p.ahora,0) < COALESCE(p.antes,0) * 0.7
     ORDER BY (COALESCE(p.antes,0) - COALESCE(p.ahora,0)) DESC`,
    [TENANT]);

  return rows.map(r => ({
    cliente: r.cliente ?? 'Sin nombre',
    antes: n(r.antes), ahora: n(r.ahora),
    vendedor: r.vendedor,
    caida: n(r.antes) > 0 ? (n(r.ahora) / n(r.antes) - 1) * 100 : -100,
  }));
}

/** Concentración: cuántos clientes generan el 80% de la venta. */
async function concentracion(f: string) {
  const { rows } = await pool.query(
    `SELECT COALESCE(c.nombre_comercial, c.razon_social) AS cliente,
            SUM(v.monto_total)::float8 AS venta
     FROM ventas v
     LEFT JOIN clientes c ON c.tenant_id = v.tenant_id AND c.clave = v.cliente_clave
     WHERE v.tenant_id = $1${f}
     GROUP BY 1 ORDER BY venta DESC`, [TENANT]);

  const total = rows.reduce((a, r) => a + n(r.venta), 0) || 1;
  let acum = 0, cuantos = 0;
  for (const r of rows) {
    acum += n(r.venta); cuantos++;
    if (acum / total >= 0.8) break;
  }
  return {
    total,
    clientes: rows.length,
    para80: cuantos,
    top1: { nombre: rows[0]?.cliente ?? '—', pct: (n(rows[0]?.venta) / total) * 100, venta: n(rows[0]?.venta) },
    top5pct: rows.slice(0, 5).reduce((a, r) => a + n(r.venta), 0) / total * 100,
    lista: rows.slice(0, 5).map(r => ({ cliente: r.cliente, venta: n(r.venta), pct: n(r.venta) / total * 100 })),
  };
}

/** Productos con exceso de cobertura: capital de trabajo atrapado. */
async function inventarioExcedente(f: string) {
  const { rows } = await pool.query(
    `WITH periodo AS (
       SELECT GREATEST((MAX(fecha) - MIN(fecha) + 1) / 30.4, 1) AS meses
       FROM ventas WHERE tenant_id = $1
     ),
     ventas_prod AS (
       SELECT producto_clave, SUM(unidades)::float8 / (SELECT meses FROM periodo) AS mensual
       FROM ventas WHERE tenant_id = $1${f} GROUP BY 1
     )
     SELECT p.descripcion AS producto,
            i.existencias::int,
            (i.existencias * i.costo)::float8 AS valor,
            COALESCE(vp.mensual, 0)::float8 AS mensual,
            CASE WHEN COALESCE(vp.mensual,0) > 0
                 THEN i.existencias / vp.mensual ELSE NULL END::float8 AS meses
     FROM inventario i
     JOIN productos p ON p.tenant_id = i.tenant_id AND p.clave = i.producto_clave
     LEFT JOIN ventas_prod vp ON vp.producto_clave = i.producto_clave
     WHERE i.tenant_id = $1 AND i.existencias > 0
     ORDER BY valor DESC`, [TENANT]);

  const conExceso = rows.filter(r => r.meses == null || n(r.meses) > 12);
  return {
    valorExceso: conExceso.reduce((a, r) => a + n(r.valor), 0),
    skus: conExceso.length,
    valorTotal: rows.reduce((a, r) => a + n(r.valor), 0),
    peores: rows
      .filter(r => n(r.valor) > 0)
      .sort((a, b) => {
        const ma = a.meses == null ? 9999 : n(a.meses);
        const mb = b.meses == null ? 9999 : n(b.meses);
        return (mb * n(b.valor)) - (ma * n(a.valor));
      })
      .filter(r => r.meses == null || n(r.meses) > 12)
      .slice(0, 5)
      .map(r => ({
        producto: r.producto, existencias: r.existencias,
        valor: n(r.valor),
        meses: r.meses == null ? null : n(r.meses),
      })),
  };
}

/** Cumplimiento del plazo de pago pactado. */
async function cumplimientoPago() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE fecha_pago <= fecha_vence)::int AS a_tiempo,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (fecha_pago - fecha_factura))::float8 AS mediana,
            AVG(fecha_pago - fecha_factura)::float8 AS promedio,
            MODE() WITHIN GROUP (ORDER BY (fecha_vence - fecha_factura))::int AS plazo_tipico
     FROM cuentas_por_cobrar
     WHERE tenant_id = $1 AND fecha_pago IS NOT NULL AND fecha_factura IS NOT NULL`,
    [TENANT]);
  const r = rows[0];
  return {
    n: n(r?.n),
    aTiempoPct: n(r?.n) > 0 ? (n(r.a_tiempo) / n(r.n)) * 100 : 0,
    mediana: n(r?.mediana),
    promedio: n(r?.promedio),
    plazoTipico: n(r?.plazo_tipico),
  };
}

/** Mismo producto vendido a precios muy distintos. */
async function dispersionPrecio(f: string) {
  const { rows } = await pool.query(
    `WITH pc AS (
       SELECT v.producto_clave, v.cliente_clave,
              SUM(v.monto_total) / NULLIF(SUM(v.unidades),0) AS precio,
              SUM(v.monto_total) AS monto
       FROM ventas v WHERE v.tenant_id = $1${f} AND v.unidades > 0
       GROUP BY 1,2
     )
     SELECT p.descripcion AS producto,
            MIN(pc.precio)::float8 AS minimo,
            MAX(pc.precio)::float8 AS maximo,
            COUNT(*)::int AS clientes,
            SUM(pc.monto)::float8 AS venta
     FROM pc
     JOIN productos p ON p.tenant_id = $1 AND p.clave = pc.producto_clave
     GROUP BY p.descripcion
     HAVING COUNT(*) >= 4 AND MIN(pc.precio) > 0
        AND MAX(pc.precio) / MIN(pc.precio) > 1.4
     ORDER BY SUM(pc.monto) DESC LIMIT 5`, [TENANT]);

  return rows.map(r => ({
    producto: r.producto, minimo: n(r.minimo), maximo: n(r.maximo),
    clientes: r.clientes, venta: n(r.venta),
    spread: (n(r.maximo) / n(r.minimo) - 1) * 100,
  }));
}

/** Factura grande con margen muy por debajo de lo normal. */
async function facturaAnomala(f: string) {
  const { rows } = await pool.query(
    `SELECT v.factura, MAX(v.fecha)::text AS fecha,
            MAX(COALESCE(c.nombre_comercial, c.razon_social)) AS cliente,
            SUM(v.monto_total)::float8 AS monto,
            SUM(v.unidades)::int AS unidades,
            (SUM(v.monto_total - v.costo_unitario*v.unidades)
             / NULLIF(SUM(v.monto_total),0) * 100)::float8 AS margen
     FROM ventas v
     LEFT JOIN clientes c ON c.tenant_id = v.tenant_id AND c.clave = v.cliente_clave
     WHERE v.tenant_id = $1${f}
     GROUP BY v.factura
     HAVING SUM(v.monto_total) > 300000
        AND (SUM(v.monto_total - v.costo_unitario*v.unidades)
             / NULLIF(SUM(v.monto_total),0) * 100) < 20
     ORDER BY monto DESC LIMIT 1`, [TENANT]);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Ensamblado                                                          */
/* ------------------------------------------------------------------ */

export async function pulso(): Promise<Pulso> {
  const f = await filtroRegla();

  const [t, caida, conc, inv, pago, disp, anom] = await Promise.all([
    tendencia(f), clientesEnCaida(f), concentracion(f),
    inventarioExcedente(f), cumplimientoPago(), dispersionPrecio(f), facturaAnomala(f),
  ]);

  const { kpis: K, dias } = await kpis(f, t);
  const H: Hallazgo[] = [];

  // 1 · Venta que se está yendo
  if (caida.length) {
    const enRiesgo = caida.reduce((a, c) => a + (c.antes - c.ahora), 0);
    const perdidos = caida.filter(c => c.ahora === 0).length;
    H.push({
      clave: 'caida',
      impacto: enRiesgo,
      titulo: `${mxn(enRiesgo)} de venta se está yendo`,
      detalle: `${caida.length} clientes redujeron su compra más de 30% en lo que va del periodo` +
        (perdidos ? `, y ${perdidos} dejaron de comprar por completo` : '') + '.',
      destino: { vista: 'productividad', etiqueta: 'ver clientes' },
      filas: caida.slice(0, 5).map(c => ({
        nombre: c.cliente,
        dato: `${c.caida.toFixed(0)}%`,
        extra: `${mxn(c.antes)} → ${mxn(c.ahora)}${c.vendedor ? ` · ${c.vendedor}` : ''}`,
      })),
    });
  }

  // 2 · Inventario excedente
  if (inv.valorExceso > 0) {
    H.push({
      clave: 'inventario',
      impacto: inv.valorExceso,
      titulo: `${mxn(inv.valorExceso)} en inventario con más de un año de cobertura`,
      detalle: `${inv.skus} productos, el ${((inv.valorExceso / inv.valorTotal) * 100).toFixed(0)}% del inventario total. Es capital de trabajo que no está rotando.`,
      destino: { vista: 'operativos', etiqueta: 'ver inventario' },
      filas: inv.peores.map(p => ({
        nombre: p.producto,
        dato: p.meses == null ? 'sin venta' : `${Math.round(p.meses)} meses`,
        extra: `${entero(p.existencias)} botellas · ${mxn(p.valor)}`,
      })),
    });
  }

  // 3 · Concentración de clientes
  if (conc.para80 > 0 && conc.clientes > 0) {
    const dep = (conc.para80 / conc.clientes) * 100;
    if (dep < 15 || conc.top1.pct > 25) {
      H.push({
        clave: 'concentracion',
        impacto: conc.top1.venta,
        titulo: `${conc.para80} clientes generan el 80% de la venta`,
        detalle: `De ${entero(conc.clientes)} clientes activos. ${conc.top1.nombre} concentra el ${conc.top1.pct.toFixed(1)}% del total, y los primeros cinco el ${conc.top5pct.toFixed(0)}%.`,
        destino: { vista: 'productividad', etiqueta: 'ver clientes' },
        filas: conc.lista.map(c => ({
          nombre: c.cliente, dato: `${c.pct.toFixed(1)}%`, extra: mxn(c.venta),
        })),
      });
    }
  }

  // 4 · Factura con margen anómalo
  if (anom) {
    H.push({
      clave: 'anomalia',
      impacto: n(anom.monto),
      titulo: `Factura de ${mxn(n(anom.monto))} con ${pct(n(anom.margen))} de margen`,
      detalle: `${anom.factura}, del ${anom.fecha}, a ${anom.cliente}. ${entero(n(anom.unidades))} unidades. Por sí sola mueve el margen del mes.`,
      destino: { vista: 'alertas', etiqueta: 'ver alertas' },
    });
  }

  // 5 · Cumplimiento de pago
  if (pago.n >= 10 && pago.aTiempoPct < 70) {
    H.push({
      clave: 'pago',
      impacto: 0,
      titulo: `Solo el ${pago.aTiempoPct.toFixed(0)}% de tus clientes paga a tiempo`,
      detalle: `Plazo pactado más común: ${pago.plazoTipico} días. Pago real: ${Math.round(pago.mediana)} días de mediana, ${Math.round(pago.promedio)} de promedio. La diferencia indica una cola de facturas que tardan mucho más.`,
      destino: { vista: 'operativos', etiqueta: 'ver cobranza' },
    });
  }

  // 6 · Dispersión de precios
  if (disp.length) {
    const peor = disp[0];
    H.push({
      clave: 'precios',
      impacto: 0,
      titulo: `El mismo producto se vende con hasta ${peor.spread.toFixed(0)}% de diferencia de precio`,
      detalle: `${disp.length} productos con variación importante entre clientes. Puede ser política de volumen o falta de control de precio.`,
      destino: { vista: 'productos', etiqueta: 'ver productos' },
      filas: disp.map(d => ({
        nombre: d.producto,
        dato: `${d.spread.toFixed(0)}%`,
        extra: `${mxn(d.minimo)} a ${mxn(d.maximo)} · ${d.clientes} clientes`,
      })),
    });
  }

  H.sort((a, b) => b.impacto - a.impacto);

  const reales = t.filter(p => p.venta != null);
  const mesActual = reales[reales.length - 1]?.mes ?? '';

  const { rows: cr } = await pool.query(
    'SELECT MAX(fecha)::text AS c FROM ventas WHERE tenant_id = $1', [TENANT]);

  return {
    kpis: K,
    hallazgos: H,
    tendencia: t,
    corte: cr[0]?.c ?? '',
    mesActual,
    diasDelMes: dias,
  };
}

/** Versión compacta para el chat y el resumen del PDF. */
export async function pulsoResumen() {
  const p = await pulso();
  return {
    kpis: p.kpis.map(k => ({ etiqueta: k.etiqueta, valor: k.valor, contexto: k.contexto })),
    hallazgos: p.hallazgos.map(h => ({
      titulo: h.titulo, detalle: h.detalle,
      principales: h.filas?.slice(0, 3).map(f => `${f.nombre}: ${f.dato}`),
    })),
    corte: p.corte,
  };
}
