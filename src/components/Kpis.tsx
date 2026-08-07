'use client';
import { T } from '@/lib/tema';

export interface Kpi {
  etiqueta: string;
  valor: string;
  nota?: string;
  tono?: 'neutro' | 'bueno' | 'malo';
}

export default function Kpis({ items, cols }: { items: Kpi[]; cols?: number }) {
  const n = cols ?? Math.min(items.length, 4);
  return (
    <div className="grid grid-cols-2 gap-px mb-4 border"
      style={{ background: T.linea, borderColor: T.linea, gridTemplateColumns: `repeat(2,1fr)` }}>
      <style>{`@media(min-width:768px){.kpigrid{grid-template-columns:repeat(${n},1fr)!important}}`}</style>
      <div className="contents kpigrid" />
      {items.map(k => (
        <div key={k.etiqueta} className="bg-white px-4 py-4">
          <span className="etiqueta block mb-2">{k.etiqueta}</span>
          <span className="block font-display text-[26px] font-semibold tracking-tight leading-none num"
            style={{ color: k.tono === 'malo' ? T.rojo : T.vino }}>
            {k.valor}
          </span>
          {k.nota && (
            <span className="block font-mono text-[11px] mt-1.5"
              style={{ color: k.tono === 'bueno' ? T.jade : k.tono === 'malo' ? T.rojo : T.humo }}>
              {k.nota}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
