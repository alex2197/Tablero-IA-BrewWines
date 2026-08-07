'use client';
import { compacto } from '@/lib/formato';

export interface FilaRanking {
  etiqueta: string;
  valor: number;
  sub?: string;
  extra?: string;
}

export default function TablaRanking({
  filas, color = 'var(--color-jade)',
}: { filas: FilaRanking[]; color?: string }) {
  if (!filas.length) {
    return <p className="text-[13px] text-humo">Sin datos para este filtro.</p>;
  }
  const max = Math.max(...filas.map((f) => Math.abs(f.valor))) || 1;

  return (
    <div>
      {filas.map((f, i) => (
        <div
          key={f.etiqueta + i}
          className="grid grid-cols-[1fr_78px_52px] items-center gap-2.5 py-1.5 border-b border-papel last:border-0"
        >
          <span className="min-w-0">
            <span className="block text-[12.5px] truncate">{f.etiqueta}</span>
            {f.sub && <span className="block font-mono text-[9.5px] text-humo mt-px">{f.sub}</span>}
            <span className="block h-1 bg-papel mt-1">
              <span
                className="block h-1 transition-[width] duration-500"
                style={{ width: `${(Math.abs(f.valor) / max) * 100}%`, background: color }}
              />
            </span>
          </span>
          <span className="font-mono text-[12px] text-right num">{compacto(f.valor)}</span>
          <span className="font-mono text-[10.5px] text-right text-humo">{f.extra ?? ''}</span>
        </div>
      ))}
    </div>
  );
}
