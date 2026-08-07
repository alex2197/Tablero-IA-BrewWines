'use client';
import { useEstado } from '@/store/estado';

export default function Tarjeta({
  id, titulo, sub, children,
}: {
  id?: string; titulo: string; sub?: string; children: React.ReactNode;
}) {
  const destacar = useEstado((s) => s.destacar);
  const activo = id !== undefined && destacar === id;
  return (
    <section
      className="bg-white border border-linea px-5 pt-4 pb-5 mb-4 transition-shadow"
      style={activo ? { boxShadow: '0 0 0 2px var(--color-jade)' } : undefined}
    >
      <div className="flex items-baseline gap-3 mb-3.5">
        <h2 className="font-display text-[14.5px] font-semibold tracking-tight">{titulo}</h2>
        {sub && <span className="font-mono text-[10.5px] text-humo ml-auto">{sub}</span>}
      </div>
      {children}
    </section>
  );
}
