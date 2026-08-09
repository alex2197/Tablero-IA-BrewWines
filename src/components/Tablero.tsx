'use client';
import { useEffect, useState } from 'react';
import { useEstado, VISTAS, type Vista } from '@/store/estado';
import Chat from './Chat';
import VistaAlertas from './VistaAlertas';
import VistaCriterios from './VistaCriterios';
import { T } from '@/lib/tema';
import { nombreMes } from '@/lib/formato';
import {
  VistaVentas, VistaCanales, VistaProductos, VistaProductividad,
  VistaRetencion, VistaOperativos, VistaForecast,
} from './Vistas';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function Tablero() {
  const {
    vista, canal, categoria, vendedor, cliente, meses,
    trazas, setVista, quitarTraza, toggleMes, aplicar,
  } = useEstado();

  const [datos, setDatos] = useState<any>(null);
  const [ctx, setCtx] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceso, setAcceso] = useState<{
    permitido: boolean; estado: string; diasRestantes: number | null;
    mensaje: string | null; contacto: string | null;
  } | null>(null);

  useEffect(() => {
    fetch('/api/acceso').then(r => r.json())
      .then(j => { if (!j.error) setAcceso(j); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Estas vistas traen sus propios datos
    if (vista === 'alertas' || vista === 'criterios') { setCargando(false); return; }
    const ac = new AbortController();
    setCargando(true); setError(null);

    const p = new URLSearchParams({ vista });
    if (canal) p.set('canal', canal);
    if (categoria) p.set('categoria', categoria);
    if (vendedor) p.set('vendedor', vendedor);
    if (cliente) p.set('cliente', cliente);
    if (meses.length) p.set('meses', meses.join(','));

    fetch(`/api/datos?${p}`, { signal: ac.signal })
      .then(r => r.json())
      .then(j => {
        if (j.error) setError(j.error);
        else { setDatos(j); if (j.ctx) setCtx(j.ctx); }
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => setCargando(false));

    return () => ac.abort();
  }, [vista, canal, categoria, vendedor, cliente, meses]);

  const empresa = process.env.NEXT_PUBLIC_EMPRESA ?? ctx?.empresa ?? 'Tablero';

  // Si la prueba venció con la sesión abierta, se corta aquí.
  if (acceso && !acceso.permitido) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="w-full max-w-[400px]">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{empresa}</h1>
          <p className="etiqueta mt-1 mb-6">Tablero de negocio</p>
          <div className="border px-4 py-4"
            style={{ borderColor: T.linea2, borderLeft: `3px solid ${T.ambar}`, background: '#fff' }}>
            <p className="text-[14px] font-medium">{acceso.mensaje}</p>
            <p className="text-[13px] mt-2" style={{ color: T.humo }}>
              Tus datos siguen guardados. En cuanto se reactive el acceso, el tablero
              vuelve exactamente como lo dejaste.
            </p>
            {acceso.contacto && (
              <p className="text-[13px] mt-3 pt-3 border-t" style={{ borderColor: T.linea }}>
                Para reactivarlo: <strong>{acceso.contacto}</strong>
              </p>
            )}
          </div>
          <button onClick={async () => {
            await fetch('/api/login', { method: 'DELETE' });
            location.href = '/login';
          }} className="etiqueta mt-4 hover:underline">cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] h-screen max-lg:h-auto">
      <main className="overflow-y-auto scroll-suave px-4 md:px-6 pb-10">

        {acceso?.estado === 'prueba' && acceso.diasRestantes !== null && (
          <div className="mt-3 px-3 py-2 font-mono text-[10.5px] border"
            style={{
              borderColor: acceso.diasRestantes <= 3 ? T.ambar : T.linea2,
              background: acceso.diasRestantes <= 3 ? '#f7ecdc' : '#fff',
              color: acceso.diasRestantes <= 3 ? '#9A5600' : T.humo,
            }}>
            PERIODO DE PRUEBA · {acceso.diasRestantes === 0
              ? 'último día'
              : `quedan ${acceso.diasRestantes} día${acceso.diasRestantes === 1 ? '' : 's'}`}
          </div>
        )}

        <header className="sticky top-0 z-30 pt-5 border-b mb-5"
          style={{ background: T.papel, borderColor: T.linea }}>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-xl font-extrabold tracking-tight">{empresa}</h1>
            <span className="etiqueta">Distribución de vinos</span>
            <span className="etiqueta ml-auto">{ctx?.hasta ? `corte ${ctx.hasta}` : ''}</span>
            <a href={`/reporte?${new URLSearchParams({
              ...(canal ? { canal } : {}), ...(categoria ? { categoria } : {}),
              ...(vendedor ? { vendedor } : {}), ...(cliente ? { cliente } : {}),
              ...(meses.length ? { meses: meses.join(',') } : {}),
            })}`} className="etiqueta hover:underline">exportar pdf</a>
            <a href="/cargar" className="etiqueta hover:underline">actualizar datos</a>
            <button className="etiqueta hover:underline"
              onClick={async () => { await fetch('/api/login', { method: 'DELETE' }); location.href = '/login'; }}>
              salir
            </button>
          </div>

          {/* Slicers: mes y categoría, como en el Power BI */}
          <div className="flex gap-2 items-center mt-3 flex-wrap">
            <span className="etiqueta">Mes</span>
            {(ctx?.meses ?? []).map((m: string) => (
              <button key={m} onClick={() => toggleMes(m)}
                className="font-mono text-[10.5px] px-2 py-1 border transition-colors"
                style={{
                  borderColor: meses.includes(m) ? T.vino : T.linea2,
                  background: meses.includes(m) ? T.vino : '#fff',
                  color: meses.includes(m) ? '#fff' : T.humo,
                }}>
                {nombreMes(m)}
              </button>
            ))}
            {meses.length > 0 && (
              <button onClick={() => aplicar({ meses: [] })} className="etiqueta hover:underline">todos</button>
            )}

            <select value={categoria ?? ''}
              onChange={e => aplicar(e.target.value ? { categoria: e.target.value } : { limpiar: false, categoria: undefined })}
              className="ml-2 font-mono text-[10.5px] px-2 py-1 border bg-white"
              style={{ borderColor: T.linea2, color: T.humo }}>
              <option value="">Todas las categorías</option>
              {(ctx?.categorias ?? []).map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Rastro: cada acción deja huella reversible */}
          <div className="flex gap-1.5 flex-wrap items-center mt-2.5 min-h-[26px]">
            {datos?.rg?.umbralMarketing != null && (
              <span className="inline-flex items-center gap-1.5 bg-white border px-2 py-0.5 font-mono text-[10.5px]"
                style={{ borderColor: T.linea2, borderLeft: `3px solid ${T.ambar}`, color: T.humo }}
                title={`Regla del negocio: las líneas con precio unitario menor a $${datos.rg.umbralMarketing} se registran como marketing y no cuentan como ingreso.`}>
                <span style={{ borderBottom: `1px dotted ${T.linea2}`, cursor: 'help' }}>
                  ventas &lt; ${datos.rg.umbralMarketing} → marketing
                </span>
              </span>
            )}
            {trazas.length === 0 ? (
              <span className="etiqueta">sin filtros · periodo completo</span>
            ) : trazas.map(t => (
              <span key={t.id}
                className="animar-chip inline-flex items-center gap-1.5 bg-white border px-2 py-0.5 font-mono text-[10.5px]"
                style={{ borderColor: T.linea2, borderLeft: `3px solid ${T.vino}` }}>
                <span title={t.sql ?? 'Filtro aplicado'} className="cursor-help"
                  style={{ color: T.humo, borderBottom: `1px dotted ${T.linea2}` }}>{t.texto}</span>
                <button onClick={() => quitarTraza(t.id)} aria-label="Quitar filtro"
                  className="text-[13px] leading-none" style={{ color: T.humo }}>×</button>
              </span>
            ))}
          </div>

          {/* Pestañas */}
          <nav className="flex gap-0.5 mt-3 overflow-x-auto scroll-suave">
            {VISTAS.map(([k, n]) => (
              <button key={k} onClick={() => setVista(k as Vista)}
                className="font-mono text-[10.5px] uppercase tracking-wider px-3 py-2 border-b-2 whitespace-nowrap transition-colors"
                style={{
                  color: vista === k ? T.vino : T.humo,
                  borderBottomColor: vista === k ? T.vino : 'transparent',
                  fontWeight: vista === k ? 600 : 400,
                }}>
                {n}
              </button>
            ))}
          </nav>
        </header>

        {error ? (
          <div className="bg-white border px-5 py-6" style={{ borderColor: T.linea }}>
            <p className="text-[13px]" style={{ color: T.rojo }}>No pude cargar los datos: {error}</p>
            <p className="text-[12.5px] mt-2" style={{ color: T.humo }}>
              Revisa DATABASE_URL y que hayas corrido <code className="font-mono">npm run db:cargar</code>.
            </p>
          </div>
        ) : vista === 'alertas' ? (
          <VistaAlertas />
        ) : vista === 'criterios' ? (
          <VistaCriterios />
        ) : cargando && !datos ? (
          <p className="etiqueta py-8">Cargando…</p>
        ) : datos ? (
          <div style={{ opacity: cargando ? 0.55 : 1, transition: 'opacity .2s' }}>
            {vista === 'ventas' && <VistaVentas d={datos} />}
            {vista === 'canales' && <VistaCanales d={datos} />}
            {vista === 'productos' && <VistaProductos d={datos} />}
            {vista === 'productividad' && <VistaProductividad d={datos} />}
            {vista === 'retencion' && <VistaRetencion d={datos} />}
            {vista === 'operativos' && <VistaOperativos d={datos} />}
            {vista === 'forecast' && <VistaForecast d={datos} />}
          </div>
        ) : null}
      </main>

      <div className="max-lg:h-[540px] max-lg:border-t min-h-0" style={{ borderColor: T.linea }}>
        <Chat />
      </div>
    </div>
  );
}
