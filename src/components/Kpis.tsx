'use client';
import { mxn, entero } from '@/lib/formato';

export interface Kpi {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: 'neutro' | 'bueno' | 'malo';
}

export function construirKpisVenta(k: Record<string, number>, parcial: boolean): Kpi[] {
  return [
    { etiqueta: 'Venta neta', valor: mxn(k.venta_neta ?? 0),
      nota: parcial ? 'periodo parcial' : `${entero(k.facturas ?? 0)} facturas` },
    { etiqueta: 'Margen bruto', valor: mxn(k.margen_bruto ?? 0),
      nota: `${(k.margen_pct ?? 0).toFixed(1)}% sobre venta`,
      tono: (k.margen_pct ?? 0) >= 40 ? 'bueno' : 'malo' },
    { etiqueta: 'Ticket promedio', valor: mxn(k.ticket_promedio ?? 0),
      nota: `${entero(k.facturas ?? 0)} facturas` },
    { etiqueta: 'Clientes activos', valor: entero(k.clientes_activos ?? 0),
      nota: `${entero(k.unidades ?? 0)} botellas` },
  ];
}

export default function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-linea border border-linea mb-4">
      {items.map((k) => (
        <div key={k.etiqueta} className="bg-white px-4 pt-4 pb-4">
          <span className="etiqueta block mb-2">{k.etiqueta}</span>
          <span
            className="block font-display text-[27px] font-semibold tracking-tight leading-none num"
            style={{ color: k.tono === 'malo' ? 'var(--color-rojo)' : undefined }}
          >
            {k.valor}
          </span>
          {k.nota && (
            <span
              className="block font-mono text-[11px] mt-1.5"
              style={{
                color:
                  k.tono === 'bueno' ? 'var(--color-jade)'
                  : k.tono === 'malo' ? 'var(--color-rojo)'
                  : 'var(--color-humo)',
              }}
            >
              {k.nota}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
