import { NextRequest } from 'next/server';
import { verificarAcceso, respuestaSinAcceso } from '@/lib/acceso';
import {
  consultar, cartera, carteraAntiguedad, metricasCxC,
  inventarioSinMovimiento, inventarioPorBodega, resumenInventario,
  resumenClientes, clientesDormidos, retencionMensual,
  ventasReclasificadas, forecast, contexto, type Filtros,
} from '@/lib/consultar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const vista = q.get('vista') ?? 'ventas';
  const meses = q.get('meses')?.split(',').filter(Boolean) ?? [];
  const f: Filtros = {
    canal: q.get('canal'),
    categoria: q.get('categoria'),
    vendedor: q.get('vendedor'),
    cliente: q.get('cliente'),
    meses: meses.length ? meses : null,
  };

  try {
    const acceso = await verificarAcceso();
    if (!acceso.permitido) return respuestaSinAcceso(acceso);

    const ctx = await contexto();
    const M = ['venta_neta','costo_total','margen_bruto','margen_pct','unidades',
               'facturas','clientes_activos','ticket_promedio','precio_promedio','ingreso_por_cliente'];

    switch (vista) {
      /* ---------- 1. VENTAS GENERAL ---------- */
      case 'ventas': {
        const [kpis, mensual, topProd, porVend] = await Promise.all([
          consultar({ metricas: M, filtros: f }),
          consultar({ metricas: ['venta_neta','costo_total','margen_bruto'], agrupar: 'mes', filtros: f, limite: 60 }),
          consultar({ metricas: ['unidades','venta_neta'], agrupar: 'producto', filtros: f, limite: 5 }),
          consultar({ metricas: ['venta_neta'], agrupar: 'vendedor', filtros: f, limite: 10 }),
        ]);
        const matriz = await consultar({
          metricas: ['venta_neta'], agrupar: 'mes', filtros: f, limite: 60,
        });
        return Response.json({ ctx, kpis: kpis.filas[0] ?? {}, mensual: mensual.filas,
          topProd: topProd.filas, porVend: porVend.filas, meses: matriz.filas.map(r => r.etiqueta), sql: kpis.sql });
      }

      /* ---------- 2. CANALES ---------- */
      case 'canales': {
        const [porCanal, tendencia, kpis] = await Promise.all([
          consultar({ metricas: ['venta_neta','margen_pct','facturas'], agrupar: 'canal', filtros: f, limite: 20 }),
          consultar({ metricas: ['venta_neta'], agrupar: 'mes', filtros: f, limite: 60 }),
          consultar({ metricas: M, filtros: f }),
        ]);
        // Serie por canal y mes para la línea múltiple
        const detalle = await Promise.all(
          porCanal.filas.map(async c => ({
            canal: String(c.etiqueta),
            serie: (await consultar({ metricas: ['venta_neta'], agrupar: 'mes',
              filtros: { ...f, canal: String(c.etiqueta) }, limite: 60 })).filas,
          }))
        );
        return Response.json({ ctx, porCanal: porCanal.filas, tendencia: tendencia.filas,
          detalle, kpis: kpis.filas[0] ?? {} });
      }

      /* ---------- 3. PRODUCTOS ---------- */
      case 'productos': {
        const [kpis, top10, peores, porCat, porBodega, todos] = await Promise.all([
          consultar({ metricas: M, filtros: f }),
          consultar({ metricas: ['venta_neta','unidades','margen_pct'], agrupar: 'producto', filtros: f, limite: 10 }),
          consultar({ metricas: ['venta_neta','unidades'], agrupar: 'producto', filtros: f, orden: 'asc', limite: 5 }),
          consultar({ metricas: ['venta_neta'], agrupar: 'linea', filtros: f, limite: 14 }),
          consultar({ metricas: ['venta_neta'], agrupar: 'bodega', filtros: f, limite: 14 }),
          consultar({ metricas: ['venta_neta','unidades','margen_pct','precio_promedio'], agrupar: 'producto', filtros: f, limite: 300 }),
        ]);
        return Response.json({ ctx, kpis: kpis.filas[0] ?? {}, top10: top10.filas,
          peores: peores.filas, porCat: porCat.filas, porBodega: porBodega.filas, todos: todos.filas });
      }

      /* ---------- 4. PRODUCTIVIDAD ---------- */
      case 'productividad': {
        const [kpis, topCli, porVend, mensualVend] = await Promise.all([
          consultar({ metricas: M, filtros: f }),
          consultar({ metricas: ['venta_neta','facturas','margen_pct'], agrupar: 'cliente', filtros: f, limite: 10 }),
          consultar({ metricas: ['venta_neta','margen_pct','clientes_activos'], agrupar: 'vendedor', filtros: f, limite: 30 }),
          consultar({ metricas: ['venta_neta'], agrupar: 'mes', filtros: f, limite: 60 }),
        ]);
        // Matriz vendedor × mes
        const celdas: Record<string, Record<string, number>> = {};
        for (const v of porVend.filas.slice(0, 12)) {
          const r = await consultar({ metricas: ['venta_neta'], agrupar: 'mes',
            filtros: { ...f, vendedor: String(v.etiqueta) }, limite: 60 });
          celdas[String(v.etiqueta)] = Object.fromEntries(
            r.filas.map(x => [String(x.etiqueta), Number(x.venta_neta)])
          );
        }
        return Response.json({ ctx, kpis: kpis.filas[0] ?? {}, topCli: topCli.filas,
          porVend: porVend.filas, columnas: mensualVend.filas.map(r => String(r.etiqueta)), celdas });
      }

      /* ---------- 5. RETENCIÓN ---------- */
      case 'retencion': {
        const [res, ret, kpis, topCli, dormidos] = await Promise.all([
          resumenClientes(f), retencionMensual(),
          consultar({ metricas: M, filtros: f }),
          consultar({ metricas: ['venta_neta','facturas'], agrupar: 'cliente', filtros: f, limite: 15 }),
          clientesDormidos(10),
        ]);
        const ult = ret.filter(r => r.retencion_pct != null).slice(-1)[0];
        return Response.json({ ctx, resumen: res, retencion: ret, kpis: kpis.filas[0] ?? {},
          topCli: topCli.filas, dormidos, ultima: ult ?? null });
      }

      /* ---------- 6. OPERATIVOS ---------- */
      case 'operativos': {
        const [cxc, antig, deudores, inv, bodegas, muertos, margenCanal, margenProd] = await Promise.all([
          metricasCxC(f), carteraAntiguedad(), cartera({ diasMinimos: 90, limite: 10 }),
          resumenInventario(), inventarioPorBodega(), inventarioSinMovimiento(10),
          consultar({ metricas: ['margen_pct','venta_neta'], agrupar: 'canal', filtros: f, limite: 20 }),
          consultar({ metricas: ['margen_pct','venta_neta'], agrupar: 'producto', filtros: f, limite: 10 }),
        ]);
        return Response.json({ ctx, cxc, antig, deudores, inv, bodegas, muertos,
          margenCanal: margenCanal.filas, margenProd: margenProd.filas });
      }

      /* ---------- 7. FORECAST ---------- */
      case 'forecast': {
        const [fc, recla, kpis] = await Promise.all([
          forecast(3), ventasReclasificadas(f), consultar({ metricas: M, filtros: f }),
        ]);
        return Response.json({ ctx, fc, recla, kpis: kpis.filas[0] ?? {} });
      }

      default:
        return Response.json({ error: `Vista desconocida: ${vista}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
