'use client';
import { useEffect, useState } from 'react';

interface Alerta {
  severidad: 'alta' | 'media' | 'baja';
  titulo: string;
  detalle: string;
  accion: string;
}

const COLOR = {
  alta:  { borde: 'var(--color-rojo)',  fondo: 'var(--color-rojo-s)',  texto: 'var(--color-rojo)' },
  media: { borde: 'var(--color-ambar)', fondo: 'var(--color-ambar-s)', texto: '#9A5600' },
  baja:  { borde: 'var(--color-humo)',  fondo: 'var(--color-papel)',   texto: 'var(--color-humo)' },
};

export default function VistaAlertas() {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);

  useEffect(() => {
    fetch('/api/alertas')
      .then(r => r.json())
      .then(j => setAlertas(j.alertas ?? []))
      .catch(() => setAlertas([]));
  }, []);

  if (!alertas) return <p className="etiqueta">Analizando…</p>;

  return (
    <>
      <p className="etiqueta mb-3.5">{alertas.length} hallazgos detectados en el periodo</p>
      {alertas.map((a, i) => (
        <div key={i} className="bg-white border border-linea px-5 py-3.5 mb-2.5"
          style={{ borderLeft: `3px solid ${COLOR[a.severidad].borde}` }}>
          <h3 className="font-display text-[14px] font-semibold flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5"
              style={{ background: COLOR[a.severidad].fondo, color: COLOR[a.severidad].texto }}>
              {a.severidad}
            </span>
            {a.titulo}
          </h3>
          <p className="text-[13px] mt-1.5" style={{ color: '#3A4150' }}>{a.detalle}</p>
          <span className="font-mono text-[10.5px] text-jade mt-2 block">→ {a.accion}</span>
        </div>
      ))}
    </>
  );
}
