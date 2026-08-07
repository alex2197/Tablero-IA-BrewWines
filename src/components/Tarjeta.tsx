'use client';
import { useEstado } from '@/store/estado';
import { T } from '@/lib/tema';

export default function Tarjeta({
  id, titulo, sub, children, alto,
}: { id?: string; titulo: string; sub?: string; children: React.ReactNode; alto?: string }) {
  const destacar = useEstado(s => s.destacar);
  const activo = id !== undefined && destacar === id;
  return (
    <section className="bg-white border px-5 pt-4 pb-5 mb-4 transition-shadow"
      style={{ borderColor: T.linea, boxShadow: activo ? `0 0 0 2px ${T.vino}` : undefined, minHeight: alto }}>
      <div className="flex items-baseline gap-3 mb-3.5">
        <h2 className="font-display text-[14.5px] font-semibold tracking-tight">{titulo}</h2>
        {sub && <span className="font-mono text-[10.5px] ml-auto" style={{ color: T.humo }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}
