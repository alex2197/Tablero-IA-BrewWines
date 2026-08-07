'use client';
import Kpis from './Kpis';
import Tarjeta from './Tarjeta';
import TablaRanking from './TablaRanking';
import { mxn, entero } from '@/lib/formato';

export default function VistaInventario({ d }: { d: any }) {
  const inv = d.inv ?? {};
  const cli = d.cli ?? {};
  const dormidos = (cli.total ?? 0) - (cli.con_compra ?? 0);
  const pctMuerto = inv.valor ? ((inv.valor_muerto / inv.valor) * 100).toFixed(0) : '0';

  return (
    <>
      <Kpis items={[
        { etiqueta: 'Valor inventario', valor: mxn(inv.valor ?? 0), nota: `${entero(inv.skus ?? 0)} SKUs` },
        { etiqueta: 'Sin movimiento', valor: mxn(inv.valor_muerto ?? 0),
          nota: `${pctMuerto}% del inventario`, tono: 'malo' },
        { etiqueta: 'SKUs muertos', valor: entero(inv.sin_movimiento ?? 0),
          nota: `de ${entero(inv.skus ?? 0)} sin venta` },
        { etiqueta: 'Clientes dormidos', valor: entero(dormidos),
          nota: `de ${entero(cli.total ?? 0)} en catálogo`, tono: 'malo' },
      ]} />

      <div className="grid md:grid-cols-2 gap-4">
        <Tarjeta id="muerto" titulo="Inventario sin movimiento" sub="valor al costo">
          <TablaRanking color="var(--color-ambar)"
            filas={(d.muertos ?? []).map((x: any) => ({
              etiqueta: x.producto,
              valor: x.valor,
              sub: `${entero(x.existencias)} botellas · línea ${x.linea ?? '—'}`,
            }))} />
        </Tarjeta>

        <Tarjeta id="dormidos" titulo="Clientes sin compra" sub="con saldo pendiente">
          <TablaRanking color="var(--color-humo)"
            filas={(d.dormidos ?? []).map((x: any) => ({
              etiqueta: x.cliente,
              valor: x.saldo_pendiente,
              sub: `${x.canal ?? 'sin canal'} · ${x.estatus ?? 'sin estatus'}`,
            }))} />
          <p className="text-[12.5px] text-humo mt-3 leading-relaxed">
            Solo <strong>{entero(cli.con_compra ?? 0)}</strong> de {entero(cli.total ?? 0)} clientes
            del catálogo registraron compra en el periodo.
          </p>
        </Tarjeta>
      </div>
    </>
  );
}
