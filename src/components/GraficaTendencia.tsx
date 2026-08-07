'use client';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { mxn, compacto, fechaCorta } from '@/lib/formato';

export interface PuntoSerie {
  etiqueta: string;
  venta_neta: number;
  margen_bruto: number;
}

export default function GraficaTendencia({ datos }: { datos: PuntoSerie[] }) {
  if (!datos.length) {
    return <p className="text-[13px] text-humo py-8">Sin datos para este filtro.</p>;
  }

  const data = datos.map((d) => ({ ...d, x: fechaCorta(d.etiqueta) }));
  const paso = Math.max(0, Math.ceil(data.length / 12) - 1);

  return (
    <>
      <ResponsiveContainer width="100%" height={236}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-jade)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-jade)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-linea)" vertical={false} />
          <XAxis
            dataKey="x" interval={paso} tickLine={false} axisLine={false}
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fill: 'var(--color-humo)' }}
          />
          <YAxis
            tickFormatter={compacto} tickLine={false} axisLine={false} width={54}
            tick={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fill: 'var(--color-humo)' }}
          />
          <Tooltip
            formatter={(v: number, n: string) => [
              mxn(v), n === 'venta_neta' ? 'Venta' : 'Margen',
            ]}
            contentStyle={{
              border: '1px solid var(--color-linea2)', borderRadius: 2,
              fontFamily: 'var(--font-mono)', fontSize: 11,
            }}
          />
          <Area
            dataKey="venta_neta" stroke="var(--color-jade)" strokeWidth={2.2}
            fill="url(#gv)" dot={false} activeDot={{ r: 3.5 }}
          />
          <Line
            dataKey="margen_bruto" stroke="var(--color-vino)" strokeWidth={1.8}
            strokeDasharray="4 3" dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 font-mono text-[10.5px] text-humo mt-2.5">
        <span><i className="inline-block w-2.5 h-2.5 mr-1.5 -mb-px bg-jade" />Venta</span>
        <span><i className="inline-block w-2.5 h-2.5 mr-1.5 -mb-px bg-vino" />Margen</span>
      </div>
    </>
  );
}
