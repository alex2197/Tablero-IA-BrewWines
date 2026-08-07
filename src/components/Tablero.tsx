'use client';
import { useEffect, useState } from 'react';
import { useEstado, type Vista } from '@/store/estado';
import Chat from './Chat';
import VistaVentas from './VistaVentas';
import VistaCobranza from './VistaCobranza';
import VistaInventario from './VistaInventario';
import VistaAlertas from './VistaAlertas';

const TABS: [Vista, string][] = [
  ['ventas', 'Ventas'],
  ['cobranza', 'Cobranza'],
  ['inventario', 'Inventario'],
  ['alertas', 'Alertas'],
];

export default function Tablero() {
  const { vista, canal, desde, hasta, trazas, setVista, quitarTraza } = useEstado();
  const [datos, setDatos] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Un solo efecto: cualquier cambio de estado (del usuario o de la IA) recarga.
  useEffect(() => {
    if (vista === 'alertas') { setCargando(false); return; }

    const ctrl = new AbortController();
    setCargando(true);
    setError(null);

    const p = new URLSearchParams({ vista });
    if (canal) p.set('canal', canal);
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);

    fetch(`/api/datos?${p}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => {
        if (j.error) setError(j.error);
        else setDatos(j);
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => setCargando(false));

    return () => ctrl.abort();
  }, [vista, canal, desde, hasta]);

  const empresa = process.env.NEXT_PUBLIC_EMPRESA ?? datos?.ctx?.empresa ?? 'Tablero';

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_366px] h-screen max-lg:h-auto">
      <main className="overflow-y-auto px-4 md:px-6 pb-10">
        {/* Encabezado */}
        <div className="sticky top-0 z-30 bg-papel pt-5 border-b border-linea mb-5">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-xl font-extrabold tracking-tight">{empresa}</h1>
            <span className="etiqueta">
              {datos?.ctx?.canales?.length ?? 0} canales · distribución
            </span>
            <span className="etiqueta ml-auto">
              {datos?.ctx?.hasta ? `corte ${datos.ctx.hasta}` : ''}
            </span>
          </div>

          {/* Rastro: cada acción de la IA deja huella visible y reversible */}
          <div className="flex gap-1.5 flex-wrap items-center mt-3 min-h-[26px]">
            {trazas.length === 0 ? (
              <span className="etiqueta">sin filtros · periodo completo</span>
            ) : trazas.map(t => (
              <span key={t.id}
                className="animar-chip inline-flex items-center gap-1.5 bg-white border border-linea2 px-2 py-0.5 font-mono text-[10.5px]"
                style={{ borderLeft: `3px solid ${t.tipo === 'canal' ? 'var(--color-jade)' : 'var(--color-vino)'}` }}>
                <span title={t.sql ?? 'Filtro aplicado'}
                  className="text-humo border-b border-dotted border-linea2 cursor-help">
                  {t.texto}
                </span>
                <button onClick={() => quitarTraza(t.id)} aria-label="Quitar filtro"
                  className="text-humo hover:text-rojo text-[13px] leading-none">×</button>
              </span>
            ))}
          </div>

          {/* Pestañas */}
          <div className="flex gap-0.5 mt-3.5">
            {TABS.map(([k, n]) => (
              <button key={k} onClick={() => setVista(k)}
                className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 border-b-2 transition-colors"
                style={{
                  color: vista === k ? 'var(--color-tinta)' : 'var(--color-humo)',
                  borderBottomColor: vista === k ? 'var(--color-jade)' : 'transparent',
                  fontWeight: vista === k ? 600 : 400,
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        {error ? (
          <div className="bg-white border border-linea px-5 py-6">
            <p className="text-[13px]" style={{ color: 'var(--color-rojo)' }}>
              No pude cargar los datos: {error}
            </p>
            <p className="text-[12.5px] text-humo mt-2">
              Revisa que DATABASE_URL esté configurado y que hayas corrido{' '}
              <code className="font-mono">npm run db:cargar</code>.
            </p>
          </div>
        ) : vista === 'alertas' ? (
          <VistaAlertas />
        ) : cargando && !datos ? (
          <p className="etiqueta py-8">Cargando…</p>
        ) : datos ? (
          <div style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity .2s' }}>
            {vista === 'ventas' && <VistaVentas d={datos} canal={canal} />}
            {vista === 'cobranza' && <VistaCobranza d={datos} />}
            {vista === 'inventario' && <VistaInventario d={datos} />}
          </div>
        ) : null}
      </main>

      <div className="max-lg:h-[540px] max-lg:border-t max-lg:border-linea min-h-0">
        <Chat />
      </div>
    </div>
  );
}
