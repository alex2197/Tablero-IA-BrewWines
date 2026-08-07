/**
 * HERRAMIENTAS
 *
 * Estas descripciones son el verdadero prompt del sistema: el modelo decide
 * qué llamar leyéndolas. Vas a iterar más aquí que en el system prompt.
 * Incluye los sinónimos que usa el negocio real.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { LISTA_METRICAS, LISTA_DIMENSIONES } from './metricas';

export const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: 'consultar_metricas',
    description:
      'Consulta métricas de venta, opcionalmente agrupadas por una dimensión. ' +
      'Úsala para totales, rankings ("los que más venden"), tendencias ' +
      '("cómo va el año", agrupar por mes) y comparaciones. ' +
      'Si el usuario no especifica métrica, usa venta_neta y margen_pct juntas. ' +
      'Para rankings de "mejores" pregunta si se refiere a venta o a margen cuando sea ambiguo.',
    input_schema: {
      type: 'object',
      properties: {
        metricas: {
          type: 'array',
          items: { type: 'string', enum: LISTA_METRICAS },
          description: 'Una o más métricas a calcular',
        },
        agrupar: {
          type: 'string',
          enum: LISTA_DIMENSIONES,
          description: 'Dimensión de agrupación. Omitir para obtener un total general.',
        },
        desde: { type: 'string', description: 'Fecha inicial YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha final YYYY-MM-DD' },
        canal: { type: 'string', description: 'Filtrar por canal exacto' },
        vendedor: { type: 'string', description: 'Filtrar por nombre de vendedor (parcial)' },
        cliente: { type: 'string', description: 'Filtrar por nombre de cliente (parcial)' },
        categoria: { type: 'string', description: 'Filtrar por categoría de producto' },
        orden: { type: 'string', enum: ['desc', 'asc'], description: 'desc por defecto' },
        limite: { type: 'integer', description: 'Máximo de filas, default 10, tope 100' },
      },
      required: ['metricas'],
    },
  },
  {
    name: 'consultar_cartera',
    description:
      'Cuentas por cobrar pendientes agrupadas por cliente, ordenadas por saldo. ' +
      'Úsala para: cartera, cobranza, "quién me debe", saldos vencidos, morosos, ' +
      'adeudos, "lo que me deben". Usa dias_minimos=90 para cartera crítica.',
    input_schema: {
      type: 'object',
      properties: {
        dias_minimos: {
          type: 'integer',
          description: 'Días vencidos mínimos. 0 = toda la cartera abierta. 90 = crítica.',
        },
        limite: { type: 'integer', description: 'Default 10, tope 50' },
      },
    },
  },
  {
    name: 'consultar_antiguedad_cartera',
    description:
      'Distribución de la cartera por rangos de antigüedad (por vencer, 1-30, 31-60, 61-90, +90). ' +
      'Úsala cuando pregunten por la salud general de la cobranza, no por deudores específicos.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_inventario_muerto',
    description:
      'Productos con existencias que no registran ninguna venta en el periodo. ' +
      'Úsala para: inventario parado, stock muerto, "qué no se vende", rotación, ' +
      'producto estancado, capital inmovilizado.',
    input_schema: {
      type: 'object',
      properties: { limite: { type: 'integer', description: 'Default 15, tope 50' } },
    },
  },
  {
    name: 'consultar_clientes_dormidos',
    description:
      'Clientes del catálogo que no compraron en el periodo cargado. ' +
      'Úsala para: clientes inactivos, dormidos, perdidos, "quién dejó de comprar", reactivación.',
    input_schema: {
      type: 'object',
      properties: { limite: { type: 'integer', description: 'Default 20' } },
    },
  },
  {
    name: 'consultar_alertas',
    description:
      'Anomalías detectadas automáticamente: facturas grandes con margen anormal, cartera crítica, ' +
      'inventario muerto, clientes inactivos, ventas bajo costo. ' +
      'Úsala cuando pregunten "qué debo revisar", "hay algo raro", "por qué bajó X", ' +
      'o cuando una cifra se vea fuera de lo normal y necesites explicarla.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'actualizar_tablero',
    description:
      'Cambia lo que el usuario ve en pantalla. Llámala SIEMPRE que pida ver, mostrar, ' +
      'filtrar, ir a, o cuando tu respuesta se entienda mejor con el tablero en otra vista. ' +
      'Puedes llamarla junto con una consulta en el mismo turno.',
    input_schema: {
      type: 'object',
      properties: {
        vista: {
          type: 'string',
          enum: ['ventas', 'cobranza', 'inventario', 'alertas'],
          description: 'Pestaña a mostrar',
        },
        canal: { type: 'string', description: 'Filtro de canal a aplicar' },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
        etiqueta_periodo: {
          type: 'string',
          description: 'Nombre legible del periodo para el chip, ej. "Junio 2026"',
        },
        limpiar: { type: 'boolean', description: 'true para quitar todos los filtros' },
      },
    },
  },
];
