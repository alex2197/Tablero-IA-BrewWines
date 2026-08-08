import Anthropic from '@anthropic-ai/sdk';
import { consumir, COSTO, registrarTokens, acumular, CONSUMO_CERO } from '@/lib/limite';
import { verificarAcceso, respuestaSinAcceso } from '@/lib/acceso';
import {
  consultar, metricasCxC, resumenInventario, resumenClientes,
  retencionMensual, forecast, alertas, contexto, cartera, type Filtros,
} from '@/lib/consultar';

export const runtime = 'nodejs';
export const maxDuration = 10;

const claude = new Anthropic();

/**
 * Resumen ejecutivo escrito por el modelo a partir de datos ya consultados.
 * No usa tool loop: se le entrega todo de una vez para que quepa en el
 * tiempo de ejecución y no encadene llamadas.
 */
export async function POST(req: Request) {
  const f = (await req.json().catch(() => ({}))) as Filtros;

  try {
    const acceso = await verificarAcceso();
    if (!acceso.permitido) return respuestaSinAcceso(acceso);

    const cupo = await consumir(COSTO.reporte);
    if (!cupo.permitido) {
      return Response.json({
        error: `Llegaste al límite de ${cupo.limite} operaciones de IA de hoy. ` +
               `El reporte se genera igual, solo sin el resumen escrito.`,
        limite_alcanzado: true, ...cupo,
      }, { status: 429 });
    }

    const ctx = await contexto();
    const M = ['venta_neta', 'costo_total', 'margen_bruto', 'margen_pct',
      'unidades', 'facturas', 'clientes_activos', 'ticket_promedio'];

    const [kpis, porCanal, porMes, topProd, topVend, cxc, inv, cli, ret, fc, alr, deudores] =
      await Promise.all([
        consultar({ metricas: M, filtros: f }),
        consultar({ metricas: ['venta_neta', 'margen_pct'], agrupar: 'canal', filtros: f, limite: 8 }),
        consultar({ metricas: ['venta_neta', 'margen_pct'], agrupar: 'mes', filtros: f, limite: 24 }),
        consultar({ metricas: ['venta_neta', 'margen_pct'], agrupar: 'producto', filtros: f, limite: 5 }),
        consultar({ metricas: ['venta_neta', 'margen_pct'], agrupar: 'vendedor', filtros: f, limite: 5 }),
        metricasCxC(f), resumenInventario(), resumenClientes(f),
        retencionMensual(), forecast(3), alertas(), cartera({ diasMinimos: 90, limite: 5 }),
      ]);

    const ultRet = ret.filter(r => r.retencion_pct != null).slice(-1)[0];

    const datos = {
      periodo: { desde: ctx.desde, hasta: ctx.hasta },
      totales: kpis.formateado[0],
      por_canal: porCanal.formateado,
      por_mes: porMes.formateado,
      top_productos: topProd.formateado,
      top_vendedores: topVend.formateado,
      cobranza: {
        saldo: Math.round(cxc.saldo), dso: Math.round(cxc.dso),
        cobrado_pct: Number(cxc.cobrado_pct.toFixed(1)),
        principales_deudores: deudores.map(d => ({ cliente: d.cliente, saldo: d.saldo_fmt, dias: d.dias_max })),
      },
      inventario: {
        valor: Math.round(inv.valor), skus: inv.skus,
        sin_movimiento: inv.sin_movimiento, valor_muerto: Math.round(inv.valor_muerto),
      },
      clientes: { total: cli.total, activos: cli.activos, nuevos: cli.nuevos, dormidos: cli.dormidos },
      retencion: ultRet ? {
        mes: ultRet.mes,
        retencion_pct: Number(ultRet.retencion_pct!.toFixed(1)),
        churn_pct: Number(ultRet.churn_pct!.toFixed(1)),
      } : null,
      proyeccion: {
        tendencia_mensual: Math.round(fc.pendiente), r2: Number(fc.r2.toFixed(2)),
        siguientes_3_meses: fc.puntos.filter(p => p.proyectado)
          .map(p => ({ mes: p.mes, estimado: Math.round(p.tendencia) })),
      },
      alertas: alr.map(a => ({ severidad: a.severidad, titulo: a.titulo })),
    };

    const r = await claude.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 900,
      system: `Escribes el resumen ejecutivo mensual de ${ctx.empresa}, una distribuidora de vinos en México.
Lo lee el dueño, que no es técnico y tiene poco tiempo.

REGLAS
- Usa SOLO los números que te doy. No estimes, no inventes, no redondees a ojo.
- Español mexicano, directo, sin relleno ni frases de cortesía.
- Cifras en pesos con formato $1,234,567.
- El último mes del periodo puede estar incompleto: si lo mencionas, acláralo.
- Si algo requiere una decisión, dilo con un verbo de acción, no con sugerencias vagas.

FORMATO exacto, sin desviarte:
## Situación
Dos o tres frases con el estado general del periodo.

## Lo que va bien
Tres viñetas, cada una con su cifra.

## Lo que requiere atención
Tres viñetas, cada una con su cifra y por qué importa.

## Qué hacer
Tres acciones concretas, en orden de urgencia. Una línea cada una.`,
      messages: [{ role: 'user', content: JSON.stringify(datos) }],
    });

    await registrarTokens(acumular(CONSUMO_CERO, r.usage), 1);

    const texto = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return Response.json({ texto, ctx });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
