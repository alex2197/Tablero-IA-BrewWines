'use client';
import { useEffect, useState } from 'react';
import { T } from '@/lib/tema';

interface Criterio {
  estado: 'activa' | 'corregido' | 'abierto';
  titulo: string;
  regla?: string;
  detalle: string;
  nota?: string;
  cifras?: { etq: string; val: string }[];
}
interface Datos { activas: Criterio[]; correcciones: Criterio[]; abiertos: Criterio[] }

const SELLO = {
  activa:    { texto: 'regla del negocio', color: T.jade,  fondo: '#e2efea' },
  corregido: { texto: 'corregido',         color: T.vino2, fondo: '#f3e9e6' },
  abierto:   { texto: 'por definir',       color: '#9A5600', fondo: '#f7ecdc' },
};

function Tarjeta({ c }: { c: Criterio }) {
  const s = SELLO[c.estado];
  return (
    <article className="bg-white border px-5 py-4 mb-2.5"
      style={{ borderColor: T.linea, borderLeft: `3px solid ${s.color}` }}>

      <h3 className="font-display text-[14px] font-semibold flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5"
          style={{ background: s.fondo, color: s.color }}>
          {s.texto}
        </span>
        {c.titulo}
      </h3>

      {c.regla && (
        <p className="text-[12.5px] mt-2 pl-3 border-l italic"
          style={{ borderColor: T.linea2, color: T.humo }}>
          &ldquo;{c.regla}&rdquo;
        </p>
      )}

      <p className="text-[13px] mt-2" style={{ color: '#4A3B38' }}>{c.detalle}</p>

      {c.cifras && c.cifras.length > 0 && (
        <div className="mt-3 grid gap-px border" style={{ background: T.linea, borderColor: T.linea }}>
          {c.cifras.map((f, i) => (
            <div key={i} className="bg-white px-3 py-1.5 flex justify-between items-baseline gap-3">
              <span className="text-[12px] truncate" style={{ color: T.humo }}>{f.etq}</span>
              <span className="font-mono text-[12px] num whitespace-nowrap"
                style={{ color: T.vino }}>{f.val}</span>
            </div>
          ))}
        </div>
      )}

      {c.nota && (
        <p className="text-[12px] mt-2.5 pt-2.5 border-t leading-relaxed"
          style={{ borderColor: T.linea, color: T.humo }}>
          {c.nota}
        </p>
      )}
    </article>
  );
}

function Bloque({ titulo, sub, items }: { titulo: string; sub: string; items: Criterio[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-7">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="font-display text-[15px] font-semibold">{titulo}</h2>
        <span className="font-mono text-[10.5px]" style={{ color: T.humo }}>{items.length}</span>
      </div>
      <p className="text-[12.5px] mb-3" style={{ color: T.humo }}>{sub}</p>
      {items.map((c, i) => <Tarjeta key={i} c={c} />)}
    </section>
  );
}

export default function VistaCriterios() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/criterios').then(r => r.json())
      .then(j => (j.error ? setError(j.error) : setD(j)))
      .catch(e => setError(e.message));
  }, []);

  if (error) return <p className="text-[13px]" style={{ color: T.rojo }}>{error}</p>;
  if (!d) return <p className="etiqueta py-8">Cargando…</p>;

  return (
    <>
      <p className="text-[13px] mb-6 max-w-[680px]" style={{ color: T.humo }}>
        Bitácora de cómo se calculan las cosas en este tablero: las reglas que
        definió el negocio, lo que se corrigió respecto al reporte anterior y lo
        que sigue sin definirse. Las cifras se actualizan con cada carga de datos.
      </p>

      <Bloque titulo="Reglas del negocio"
        sub="Criterios que ustedes definieron y así están aplicados."
        items={d.activas} />

      <Bloque titulo="Correcciones"
        sub="Diferencias con el reporte anterior, por si alguna cifra no coincide."
        items={d.correcciones} />

      <Bloque titulo="Por definir"
        sub="Puntos abiertos. Mientras tanto se muestra el dato completo, sin filtrar."
        items={d.abiertos} />
    </>
  );
}
