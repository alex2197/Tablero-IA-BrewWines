'use client';
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, PieChart, Treemap,
  Bar, Line, Area, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { T, SERIE, ejeTick, tooltipEstilo } from '@/lib/tema';
import { mxn, compacto, entero, fechaCorta } from '@/lib/formato';

type Fila = Record<string, string | number | null | undefined>;

const fmtValor = (v: number, tipo: 'moneda' | 'entero' | 'pct') =>
  tipo === 'moneda' ? mxn(v) : tipo === 'pct' ? v.toFixed(1) + '%' : entero(v);

/* ---------- Columnas agrupadas (clusteredColumnChart) ---------- */
export function Columnas({
  datos, series, alto = 240, tipo = 'moneda', apilado = false, fechas = true,
}: {
  datos: Fila[];
  series: { key: string; nombre: string; color?: string }[];
  alto?: number; tipo?: 'moneda' | 'entero' | 'pct'; apilado?: boolean; fechas?: boolean;
}) {
  if (!datos.length) return <Vacio />;
  const data = datos.map(d => ({ ...d, _x: fechas ? fechaCorta(String(d.etiqueta)) : String(d.etiqueta) }));
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={T.linea} vertical={false} />
        <XAxis dataKey="_x" tickLine={false} axisLine={false} tick={ejeTick} interval={0} />
        <YAxis tickFormatter={v => (tipo === 'moneda' ? compacto(v) : String(v))}
          tickLine={false} axisLine={false} width={52} tick={ejeTick} />
        <Tooltip contentStyle={tooltipEstilo}
          formatter={(v: number, n: string) => [fmtValor(v, tipo), series.find(s => s.key === n)?.nombre ?? n]} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: T.humo }}
            formatter={(n: string) => series.find(s => s.key === n)?.nombre ?? n} />
        )}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color ?? SERIE[i % SERIE.length]}
            stackId={apilado ? 'a' : undefined} radius={[2, 2, 0, 0]} maxBarSize={apilado ? 40 : 26} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------- Barras horizontales (barChart) ---------- */
export function Barras({
  datos, campo = 'valor', alto, tipo = 'moneda', color = T.vino, ancho = 150,
}: {
  datos: { etiqueta: string; valor: number; extra?: string }[];
  campo?: string; alto?: number; tipo?: 'moneda' | 'entero' | 'pct'; color?: string; ancho?: number;
}) {
  if (!datos.length) return <Vacio />;
  const h = alto ?? Math.max(160, datos.length * 26 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={T.linea} horizontal={false} />
        <XAxis type="number" tickFormatter={v => (tipo === 'moneda' ? compacto(v) : String(v))}
          tickLine={false} axisLine={false} tick={ejeTick} />
        <YAxis type="category" dataKey="etiqueta" width={ancho} tickLine={false} axisLine={false}
          tick={{ ...ejeTick, fontFamily: 'var(--font-sans)', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipEstilo} formatter={(v: number) => [fmtValor(v, tipo), '']} />
        <Bar dataKey={campo} fill={color} radius={[0, 2, 2, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- Líneas (lineChart) ---------- */
export function Lineas({
  datos, series, alto = 240, tipo = 'moneda', area = false,
}: {
  datos: Fila[];
  series: { key: string; nombre: string; color?: string; punteada?: boolean }[];
  alto?: number; tipo?: 'moneda' | 'entero' | 'pct'; area?: boolean;
}) {
  if (!datos.length) return <Vacio />;
  const data = datos.map(d => ({ ...d, _x: fechaCorta(String(d.etiqueta ?? d.mes)) }));
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <ComposedChart data={data} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.vino} stopOpacity={0.16} />
            <stop offset="100%" stopColor={T.vino} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={T.linea} vertical={false} />
        <XAxis dataKey="_x" tickLine={false} axisLine={false} tick={ejeTick} />
        <YAxis tickFormatter={v => (tipo === 'moneda' ? compacto(v) : String(v))}
          tickLine={false} axisLine={false} width={52} tick={ejeTick} />
        <Tooltip contentStyle={tooltipEstilo}
          formatter={(v: number, n: string) => [fmtValor(v, tipo), series.find(s => s.key === n)?.nombre ?? n]} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
            formatter={(n: string) => series.find(s => s.key === n)?.nombre ?? n} />
        )}
        {area && <Area dataKey={series[0].key} stroke="none" fill="url(#gArea)" />}
        {series.map((s, i) => (
          <Line key={s.key} dataKey={s.key} stroke={s.color ?? SERIE[i % SERIE.length]}
            strokeWidth={s.punteada ? 1.8 : 2.2} strokeDasharray={s.punteada ? '4 3' : undefined}
            dot={false} activeDot={{ r: 3.5 }} connectNulls />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---------- Dona (donutChart) ---------- */
export function Dona({
  datos, alto = 232, tipo = 'moneda',
}: {
  datos: { etiqueta: string; valor: number }[]; alto?: number; tipo?: 'moneda' | 'entero' | 'pct';
}) {
  if (!datos.length) return <Vacio />;
  const total = datos.reduce((a, d) => a + d.valor, 0) || 1;
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={alto}>
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius="56%" outerRadius="88%"
            paddingAngle={1.5} stroke="none">
            {datos.map((_, i) => <Cell key={i} fill={SERIE[i % SERIE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipEstilo}
            formatter={(v: number, n: string) => [`${fmtValor(v, tipo)} · ${((v / total) * 100).toFixed(1)}%`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 min-w-0 space-y-1.5">
        {datos.map((d, i) => (
          <li key={d.etiqueta} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 shrink-0" style={{ background: SERIE[i % SERIE.length] }} />
            <span className="truncate flex-1">{d.etiqueta}</span>
            <span className="font-mono text-[11px] num">{((d.valor / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Treemap ---------- */
interface NodoTreemap { etiqueta?: string; valor?: number; x?: number; y?: number; width?: number; height?: number; index?: number }

function CeldaTreemap(props: NodoTreemap) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, etiqueta = '', valor = 0 } = props;
  const color = SERIE[index % SERIE.length];
  const cabe = width > 62 && height > 30;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke={T.papel} strokeWidth={2} />
      {cabe && (
        <>
          <text x={x + 7} y={y + 17} fill="#fff" fontSize={11} fontFamily="var(--font-sans)">
            {etiqueta.length > width / 7 ? etiqueta.slice(0, Math.floor(width / 7)) + '…' : etiqueta}
          </text>
          <text x={x + 7} y={y + 31} fill="#fff" fontSize={10} fontFamily="var(--font-mono)" opacity={0.85}>
            {compacto(valor)}
          </text>
        </>
      )}
    </g>
  );
}

export function Mapa({ datos, alto = 250 }: { datos: { etiqueta: string; valor: number }[]; alto?: number }) {
  if (!datos.length) return <Vacio />;
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <Treemap data={datos} dataKey="valor" nameKey="etiqueta" stroke={T.papel}
        content={<CeldaTreemap />} isAnimationActive={false}>
        <Tooltip contentStyle={tooltipEstilo} formatter={(v: number) => [mxn(v), '']} />
      </Treemap>
    </ResponsiveContainer>
  );
}

/* ---------- Matriz (pivotTable) ---------- */
export function Matriz({
  filas, columnas, valores, tipo = 'moneda',
}: {
  filas: string[]; columnas: string[];
  valores: Record<string, Record<string, number>>;
  tipo?: 'moneda' | 'entero' | 'pct';
}) {
  if (!filas.length) return <Vacio />;
  const totalCol = (c: string) => filas.reduce((a, f) => a + (valores[f]?.[c] ?? 0), 0);
  const totalFila = (f: string) => columnas.reduce((a, c) => a + (valores[f]?.[c] ?? 0), 0);
  const max = Math.max(...filas.flatMap(f => columnas.map(c => valores[f]?.[c] ?? 0))) || 1;

  return (
    <div className="overflow-x-auto scroll-suave">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr>
            <th className="text-left etiqueta pb-2 pr-3 sticky left-0 bg-white">Vendedor</th>
            {columnas.map(c => (
              <th key={c} className="etiqueta pb-2 px-2 text-right whitespace-nowrap">{fechaCorta(c)}</th>
            ))}
            <th className="etiqueta pb-2 pl-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f} className="border-t" style={{ borderColor: T.linea }}>
              <td className="py-1.5 pr-3 truncate max-w-[180px] sticky left-0 bg-white">{f}</td>
              {columnas.map(c => {
                const v = valores[f]?.[c] ?? 0;
                return (
                  <td key={c} className="py-1.5 px-2 text-right font-mono num"
                    style={{ background: v ? `rgba(58,0,6,${(v / max) * 0.14})` : undefined }}>
                    {v ? fmtValor(v, tipo) : '—'}
                  </td>
                );
              })}
              <td className="py-1.5 pl-3 text-right font-mono num font-semibold">
                {fmtValor(totalFila(f), tipo)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2" style={{ borderColor: T.linea2 }}>
            <td className="py-1.5 pr-3 etiqueta sticky left-0 bg-white">Total</td>
            {columnas.map(c => (
              <td key={c} className="py-1.5 px-2 text-right font-mono num font-semibold">
                {fmtValor(totalCol(c), tipo)}
              </td>
            ))}
            <td className="py-1.5 pl-3 text-right font-mono num font-semibold">
              {fmtValor(columnas.reduce((a, c) => a + totalCol(c), 0), tipo)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tabla simple ---------- */
export function Tabla({
  columnas, filas,
}: {
  columnas: { key: string; titulo: string; tipo?: 'texto' | 'moneda' | 'entero' | 'pct' }[];
  filas: Record<string, string | number | null>[];
}) {
  if (!filas.length) return <Vacio />;
  return (
    <div className="overflow-x-auto scroll-suave max-h-[380px]">
      <table className="w-full text-[12.5px] border-collapse">
        <thead className="sticky top-0 bg-white">
          <tr>
            {columnas.map(c => (
              <th key={c.key}
                className={`etiqueta pb-2 ${c.tipo && c.tipo !== 'texto' ? 'text-right pl-3' : 'text-left pr-3'}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t" style={{ borderColor: T.linea }}>
              {columnas.map(c => {
                const v = f[c.key];
                const num = c.tipo && c.tipo !== 'texto';
                return (
                  <td key={c.key} className={num ? 'py-1.5 pl-3 text-right font-mono num' : 'py-1.5 pr-3'}>
                    {v == null ? '—' : num ? fmtValor(Number(v), c.tipo as 'moneda') : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vacio() {
  return <p className="text-[13px] py-8 text-center" style={{ color: T.humo }}>Sin datos para este filtro.</p>;
}
