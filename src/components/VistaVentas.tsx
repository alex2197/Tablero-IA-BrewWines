'use client';
import Kpis, { construirKpisVenta } from './Kpis';
import Tarjeta from './Tarjeta';
import TablaRanking from './TablaRanking';
import GraficaTendencia from './GraficaTendencia';
import { entero } from '@/lib/formato';

type Fila = Record<string, number | string>;

export default function VistaVentas({ d, canal }: { d: any; canal: string | null }) {
  const parcial = !!(d.ctx?.hasta && !d.ctx.hasta.endsWith('-31') && !d.ctx.hasta.endsWith('-30'));

  return (
    <>
      <Kpis items={construirKpisVenta(d.kpis ?? {}, parcial)} />

      <Tarjeta id="tendencia" titulo="Venta y margen"
        sub={`${canal ?? 'todos los canales'} · ${d.ctx?.desde} a ${d.ctx?.hasta}`}>
        <GraficaTendencia datos={d.serie ?? []} />
      </Tarjeta>

      <div className="grid md:grid-cols-2 gap-4">
        <Tarjeta id="productos" titulo="Productos" sub="venta · margen%">
          <TablaRanking filas={(d.productos ?? []).map((f: Fila) => ({
            etiqueta: String(f.etiqueta),
            valor: Number(f.venta_neta),
            sub: `${entero(Number(f.unidades))} botellas`,
            extra: `${Number(f.margen_pct).toFixed(0)}%`,
          }))} />
        </Tarjeta>

        <Tarjeta id="clientes" titulo="Clientes" sub="venta · margen%">
          <TablaRanking filas={(d.clientes ?? []).map((f: Fila) => ({
            etiqueta: String(f.etiqueta),
            valor: Number(f.venta_neta),
            extra: `${Number(f.margen_pct).toFixed(0)}%`,
          }))} />
        </Tarjeta>
      </div>

      <Tarjeta id="vendedores" titulo="Vendedores" sub="venta · margen%">
        <TablaRanking filas={(d.vendedores ?? []).map((f: Fila) => ({
          etiqueta: String(f.etiqueta),
          valor: Number(f.venta_neta),
          extra: `${Number(f.margen_pct).toFixed(0)}%`,
        }))} />
      </Tarjeta>
    </>
  );
}
