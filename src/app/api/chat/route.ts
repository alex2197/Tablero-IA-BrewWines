import Anthropic from '@anthropic-ai/sdk';
import { HERRAMIENTAS } from '@/lib/herramientas';
import {
  consultar, cartera, carteraAntiguedad, inventarioSinMovimiento,
  inventarioPorBodega, clientesDormidos, retencionMensual, resumenClientes,
  metricasCxC, forecast, alertas, contexto,
} from '@/lib/consultar';

export const runtime = 'nodejs';
export const maxDuration = 60;

const claude = new Anthropic();
const MODELO = 'claude-sonnet-5';
const MAX_VUELTAS = 6;

function sistema(ctx: Awaited<ReturnType<typeof contexto>>) {
  return `Eres el analista de datos de ${ctx.empresa}, una distribuidora de vinos en México.
Hablas con el dueño o un gerente. No son técnicos.

DATOS DISPONIBLES
- Periodo cargado: ${ctx.desde} a ${ctx.hasta}. NO existe información fuera de ese rango.
- Hoy es ${new Date().toISOString().slice(0, 10)}, pero los datos cortan el ${ctx.hasta}.
  Si el usuario dice "este mes", "hoy" o "esta semana", interpreta contra ${ctx.hasta},
  no contra la fecha real, y acláralo en una frase corta.
- El último mes cargado puede estar incompleto. Si lo usas para comparar, adviértelo.
- Canales: ${ctx.canales.join(', ')}.
- Categorías: ${ctx.categorias.slice(0, 12).join(', ')}.
- Pestañas del tablero: Ventas General, Canales, Productos, Productividad,
  Retención, Operativos, Forecast y Alertas.

DIFERENCIAS CON EL POWER BI ANTERIOR (menciónalas si el usuario compara cifras)
- Retención: antes era activos/catálogo (penetración). Ahora es recompra real mes a mes.
- Forecast: antes era ingresos x 0.85 y x 1.20 sobre la misma curva. Ahora es regresión lineal
  proyectada a meses futuros.
- Cuentas por cobrar: antes no estaba relacionada al modelo, así que DSO y saldo ignoraban
  los filtros de categoría y vendedor. Ahora sí responden.
- Margen neto y ROI de marketing: se retiraron. La tabla "Marketing" del Power BI no era
  gasto publicitario, agrupaba ventas menores a $190 por un criterio de clasificación del
  cliente. Si te preguntan por ROI de marketing, gasto en publicidad o margen neto, explica
  esto y ofrece el margen bruto, que sí es correcto. NUNCA calcules un ROI con ese dato.

REGLAS DE EXACTITUD
- NUNCA inventes, estimes ni redondees a ojo una cifra. Todo número sale de una herramienta.
- Si un dato no está disponible, dilo claramente en vez de aproximar.
- Los resultados traen campos "_fmt" o un bloque "formateado" con los montos ya escritos.
  Usa ESE texto tal cual. No reformatees números tú mismo.
- Si la pregunta es ambigua sobre la métrica (por ejemplo "mis mejores clientes" puede ser
  por venta o por margen), pregunta antes de asumir. En esta distribuidora los dos rankings
  son distintos.

ESTILO
- Español mexicano, directo, 2 a 4 frases. Sin viñetas salvo que pidan una lista.
- Resalta la cifra clave con **negritas**.
- Si detectas algo anómalo relacionado con lo que preguntaron, menciónalo en una frase.
- Cuando el usuario pida ver, mostrar o filtrar algo, llama también a actualizar_tablero.`;
}

async function ejecutar(nombre: string, args: Record<string, unknown>) {
  switch (nombre) {
    case 'consultar_metricas': {
      const r = await consultar({
        metricas: (args.metricas as string[]) ?? [],
        agrupar: args.agrupar as string | undefined,
        filtros: {
          desde: args.desde as string, hasta: args.hasta as string,
          canal: args.canal as string, vendedor: args.vendedor as string,
          cliente: args.cliente as string, categoria: args.categoria as string,
        },
        orden: args.orden as 'desc' | 'asc' | undefined,
        limite: args.limite as number | undefined,
      });
      return { formateado: r.formateado, filas_crudas: r.filas, sql_ejecutado: r.sql };
    }
    case 'consultar_cartera':
      return { clientes: await cartera({
        diasMinimos: args.dias_minimos as number, limite: args.limite as number,
      }) };
    case 'consultar_antiguedad_cartera':
      return { rangos: await carteraAntiguedad() };
    case 'consultar_inventario_muerto':
      return { productos: await inventarioSinMovimiento(args.limite as number) };
    case 'consultar_clientes_dormidos':
      return { clientes: await clientesDormidos(args.limite as number) };
    case 'consultar_alertas':
      return { alertas: await alertas() };
    case 'consultar_retencion': {
      const [serie, res] = await Promise.all([retencionMensual(), resumenClientes()]);
      return {
        retencion_mensual: serie,
        resumen: res,
        nota: 'retencion_pct = clientes del mes previo que recompraron / clientes del mes previo. ' +
              'penetracion_pct es la definicion que usaba el Power BI (activos/catalogo).',
      };
    }
    case 'consultar_forecast':
      return await forecast(Math.min((args.meses_adelante as number) ?? 3, 6));
    case 'consultar_cxc':
      return await metricasCxC({ desde: args.desde as string, hasta: args.hasta as string });
    case 'consultar_inventario_bodegas':
      return { bodegas: await inventarioPorBodega() };
    case 'generar_reporte':
      return { ok: true, abrir: '/reporte' };
    case 'actualizar_tablero':
      return { ok: true, estado_aplicado: args };
    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}

export async function POST(req: Request) {
  const { mensajes } = (await req.json()) as {
    mensajes: Anthropic.MessageParam[];
  };

  const ctx = await contexto();
  const codificador = new TextEncoder();

  const stream = new ReadableStream({
    async start(control) {
      const enviar = (evt: unknown) =>
        control.enqueue(codificador.encode(`data: ${JSON.stringify(evt)}\n\n`));

      const historial: Anthropic.MessageParam[] = [...mensajes];
      const trazas: { herramienta: string; argumentos: unknown; sql?: string }[] = [];

      try {
        for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
          const respuesta = await claude.messages.stream({
            model: MODELO,
            max_tokens: 2000,
            // El caché ahorra bastante: system y tools se repiten en cada vuelta.
            system: [{
              type: 'text',
              text: sistema(ctx),
              cache_control: { type: 'ephemeral' },
            }],
            tools: HERRAMIENTAS,
            messages: historial,
          });

          // Solo streameamos texto al usuario; los tool_use se anuncian aparte.
          respuesta.on('text', (delta) => enviar({ t: 'texto', delta }));

          const final = await respuesta.finalMessage();

          if (final.stop_reason !== 'tool_use') {
            enviar({ t: 'fin', trazas });
            control.close();
            return;
          }

          historial.push({ role: 'assistant', content: final.content });

          const resultados: Anthropic.ToolResultBlockParam[] = [];
          for (const bloque of final.content) {
            if (bloque.type !== 'tool_use') continue;

            enviar({ t: 'herramienta', nombre: bloque.name });

            let salida: unknown;
            try {
              salida = await ejecutar(bloque.name, bloque.input as Record<string, unknown>);
            } catch (e) {
              salida = { error: (e as Error).message };
            }

            const sql = (salida as { sql_ejecutado?: string })?.sql_ejecutado;
            trazas.push({ herramienta: bloque.name, argumentos: bloque.input, sql });

            if (bloque.name === 'actualizar_tablero') {
              enviar({ t: 'accion', estado: bloque.input });
            }
            if (bloque.name === 'generar_reporte') {
              enviar({ t: 'abrir', url: '/reporte' });
            }

            resultados.push({
              type: 'tool_result',
              tool_use_id: bloque.id,
              content: JSON.stringify(salida),
              is_error: !!(salida as { error?: string })?.error,
            });
          }
          historial.push({ role: 'user', content: resultados });
        }

        enviar({
          t: 'texto',
          delta: 'La consulta resultó demasiado compleja. ¿Puedes plantearla más específica?',
        });
        enviar({ t: 'fin', trazas });
        control.close();
      } catch (e) {
        enviar({ t: 'error', mensaje: (e as Error).message });
        control.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
