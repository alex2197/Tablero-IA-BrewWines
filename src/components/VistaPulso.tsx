'use client';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useEstado, type Vista } from '@/store/estado';
import { T, ejeTick, tooltipEstilo } from '@/lib/tema';
import { mxn, compacto, fechaCorta } from '@/lib/formato';

interface Kpi {
  clave: string; etiqueta: string; valor: string; contexto: string;
  avance: number; estado: 'bien' | 'atencion' | 'critico' | 'neutro';
}
interface Fila { nombre: string; dato: string; extra?: string }
interface Hallazgo {
  clave: string; impacto: number; titulo: string; detalle: string;
  destino?: { vista: string; etiqueta: string };
  filas?: Fila[];
}
interface Punto { mes: string; venta: number | null; margenPct: number | null; proyeccion: number | null }
interface Datos {
  kpis: Kpi[]; hallazgos: Hallazgo[]; tendencia: Punto[];
  corte: string; mesActual: string;
  diasDelMes: { transcurridos: number; total: number };
}

const COLOR = {
  bien:     T.jade,
  atencion: T.ambar,
  critico:  T.rojo,
  neutro:   T.tierra,
};

/* ---------------- KPI ---------------- */

function TarjetaKpi({ k }: { k: Kpi }) {
  const c = COLOR[k.estado];
  return (
    <div className="bg-white px-4 py-4 flex flex-col">
      <span className="etiqueta mb-2">{k.etiqueta}</span>
      <span className="font-display text-[27px] font-semibold tracking-tight leading-none num"
        style={{ color: k.estado === 'critico' ? T.rojo : T.vino }}>
        {k.valor}
      </span>
      <span className="font-mono text-[11px] mt-1.5 mb-3 leading-relaxed" style={{ color: T.humo }}>
        {k.contexto}
      </span>
      <span className="mt-auto h-1 w-full block" style={{ background: T.linea }}>
        <span className="h-1 block transition-[width] duration-700"
          style={{ width: `${Math.max(3, Math.min(100, k.avance))}%`, background: c }} />
      </span>
    </div>
  );
}

/* ---------------- Hallazgo ---------------- */

function TarjetaHallazgo({ h, i }: { h: Hallazgo; i: number }) {
  const [abierto, setAbierto] = useState(i === 0);
  const setVista = useEstado(s => s.setVista);
  const color = i === 0 ? T.rojo : i === 1 ? T.ambar : T.tierra;

  return (
    <article className="bg-white border mb-2.5"
      style={{ borderColor: T.linea, borderLeft: `3px solid ${color}` }}>

      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-[15px] font-semibold leading-snug">{h.titulo}</h3>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: '#4A3B38' }}>
              {h.detalle}
            </p>
          </div>
          {h.destino && (
            <button
              onClick={() => setVista(h.destino!.vista as Vista)}
              className="etiqueta whitespace-nowrap hover:underline shrink-0 mt-0.5">
              {h.destino.etiqueta} →
            </button>
          )}
        </div>

        {h.filas && h.filas.length > 0 && (
          <>
            <button onClick={() => setAbierto(!abierto)}
              className="etiqueta mt-3 hover:underline">
              {abierto ? '− ocultar detalle' : `+ ver ${h.filas.length} casos`}
            </button>

            {abierto && (
              <div className="mt-2.5 border" style={{ borderColor: T.linea }}>
                {h.filas.map((f, k) => (
                  <div key={k}
                    className="px-3 py-2 flex items-baseline justify-between gap-3 border-b last:border-0"
                    style={{ borderColor: T.linea }}>
                    <div className="min-w-0 flex-1">
                      <span className="text-[12.5px] block truncate">{f.nombre}</span>
                      {f.extra && (
                        <span className="font-mono text-[10.5px] block mt-0.5" style={{ color: T.humo }}>
                          {f.extra}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[12.5px] num whitespace-nowrap"
                      style={{ color: T.vino }}>
                      {f.dato}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/* ---------------- Tendencia ---------------- */

function Tendencia({ datos }: { datos: Punto[] }) {
  if (!datos.length) return null;
  const data = datos.map(d => ({ ...d, x: fechaCorta(d.mes) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gPulso" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.vino} stopOpacity={0.15} />
            <stop offset="100%" stopColor={T.vino} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={T.linea} vertical={false} />
        <XAxis dataKey="x" tickLine={false} axisLine={false} tick={ejeTick} />
        <YAxis tickFormatter={compacto} tickLine={false} axisLine={false} width={52} tick={ejeTick} />
        <Tooltip contentStyle={tooltipEstilo}
          formatter={(v: number, n: string) => [
            mxn(v), n === 'venta' ? 'Venta' : 'Proyección',
          ]} />
        <Area dataKey="venta" stroke="none" fill="url(#gPulso)" />
        <Line dataKey="venta" stroke={T.vino} strokeWidth={2.4} dot={false}
          activeDot={{ r: 3.5 }} connectNulls={false} />
        <Line dataKey="proyeccion" stroke={T.tierra} strokeWidth={1.8}
          strokeDasharray="4 3" dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Vista ---------------- */

export default function VistaPulso() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pulso').then(r => r.json())
      .then(j => (j.error ? setError(j.error) : setD(j)))
      .catch(e => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="bg-white border px-5 py-6" style={{ borderColor: T.linea }}>
        <p className="text-[13px]" style={{ color: T.rojo }}>No pude calcular el pulso: {error}</p>
      </div>
    );
  }
  if (!d) return <p className="etiqueta py-8">Analizando…</p>;

  const parcial = d.diasDelMes.transcurridos < d.diasDelMes.total;

  return (
    <>
      {/* Cuatro números */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border mb-5"
        style={{ background: T.linea, borderColor: T.linea }}>
        {d.kpis.map(k => <TarjetaKpi key={k.clave} k={k} />)}
      </div>

      {/* Hallazgos */}
      <section className="mb-5">
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="font-display text-[15px] font-semibold">Requiere tu atención</h2>
          <span className="font-mono text-[10.5px]" style={{ color: T.humo }}>
            {d.hallazgos.length ? `${d.hallazgos.length} hallazgos` : ''}
          </span>
        </div>

        {d.hallazgos.length === 0 ? (
          <div className="bg-white border px-5 py-6 text-center"
            style={{ borderColor: T.linea, borderLeft: `3px solid ${T.jade}` }}>
            <p className="text-[13.5px]">Sin desviaciones relevantes en el periodo.</p>
            <p className="text-[12.5px] mt-1" style={{ color: T.humo }}>
              Las cifras se mantienen dentro de rango.
            </p>
          </div>
        ) : (
          d.hallazgos.map((h, i) => <TarjetaHallazgo key={h.clave} h={h} i={i} />)
        )}
      </section>

      {/* Trayectoria */}
      <section className="bg-white border px-5 pt-4 pb-5" style={{ borderColor: T.linea }}>
        <div className="flex items-baseline gap-3 mb-3.5">
          <h2 className="font-display text-[14.5px] font-semibold tracking-tight">Trayectoria</h2>
          <span className="font-mono text-[10.5px] ml-auto" style={{ color: T.humo }}>
            venta mensual · proyección punteada
          </span>
        </div>
        <Tendencia datos={d.tendencia} />
        <div className="flex gap-4 font-mono text-[10.5px] mt-2.5" style={{ color: T.humo }}>
          <span><i className="inline-block w-2.5 h-2.5 mr-1.5 -mb-px" style={{ background: T.vino }} />Venta real</span>
          <span><i className="inline-block w-2.5 h-2.5 mr-1.5 -mb-px" style={{ background: T.tierra }} />Proyección</span>
          {parcial && (
            <span className="ml-auto" style={{ color: T.ambar }}>
              el mes en curso lleva {d.diasDelMes.transcurridos} de {d.diasDelMes.total} días
            </span>
          )}
        </div>
      </section>
    </>
  );
}
