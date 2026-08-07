'use client';
import Kpis from './Kpis';
import Tarjeta from './Tarjeta';
import TablaRanking from './TablaRanking';
import { mxn, compacto } from '@/lib/formato';

export default function VistaCobranza({ d }: { d: any }) {
  const pct = d.total ? ((d.vencido / d.total) * 100).toFixed(0) : '0';

  return (
    <>
      <Kpis items={[
        { etiqueta: 'Cartera total', valor: mxn(d.total ?? 0),
          nota: `${d.antiguedad?.reduce((a: number, r: any) => a + r.facturas, 0) ?? 0} facturas abiertas` },
        { etiqueta: 'Vencido', valor: mxn(d.vencido ?? 0),
          nota: `${pct}% de la cartera`, tono: 'malo' },
        { etiqueta: 'Crítico +90 días', valor: mxn(d.critico ?? 0),
          nota: 'riesgo de incobrable', tono: 'malo' },
        { etiqueta: 'Factura más antigua', valor: `${d.diasMax ?? 0} días`,
          nota: `${((d.diasMax ?? 0) / 365).toFixed(1)} años sin cobrar` },
      ]} />

      <Tarjeta id="antiguedad" titulo="Antigüedad de saldos" sub="al corte de datos">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-linea border border-linea">
          {(d.antiguedad ?? []).map((a: any) => {
            const critico = a.rango === 'Más de 90';
            return (
              <div key={a.rango} className="px-3 py-3"
                style={{ background: critico ? 'var(--color-rojo-s)' : '#fff' }}>
                <span className="etiqueta block">{a.rango}</span>
                <span className="block font-display text-[19px] font-semibold mt-1.5 num"
                  style={{ color: critico ? 'var(--color-rojo)' : undefined }}>
                  {compacto(a.saldo)}
                </span>
                <span className="font-mono text-[10px] text-humo">{a.facturas} facturas</span>
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta id="deudores" titulo="Deudores con más de 90 días" sub="saldo · facturas">
        <TablaRanking color="var(--color-rojo)"
          filas={(d.deudores ?? []).map((x: any) => ({
            etiqueta: x.cliente,
            valor: x.saldo,
            sub: `${x.facturas} facturas · máx ${x.dias_max} días`,
            extra: `${x.facturas}f`,
          }))} />
      </Tarjeta>
    </>
  );
}
