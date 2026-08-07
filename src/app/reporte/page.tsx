'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { T } from '@/lib/tema';
import { mxn, entero, pct, fechaCorta, nombreMes } from '@/lib/formato';
import { Columnas, Barras, Lineas, Dona, Tabla } from '@/components/Graficas';

/* eslint-disable @typescript-eslint/no-explicit-any */
type D = any;
const n = (v: unknown) => Number(v ?? 0);
const rank = (f: D[], c = 'venta_neta') =>
  (f ?? []).map((x: D) => ({ etiqueta: String(x.etiqueta), valor: n(x[c]) }));

/** Convierte el markdown ligero del resumen en bloques renderizables. */
function Resumen({ texto }: { texto: string }) {
  const bloques = texto.split('\n').filter(l => l.trim());
  return (
    <div className="space-y-1.5">
      {bloques.map((l, i) => {
        const t = l.trim();
        if (t.startsWith('## ')) {
          return (
            <h3 key={i} className="font-display text-[13px] font-semibold mt-3.5 first:mt-0"
              style={{ color: T.vino2 }}>
              {t.slice(3)}
            </h3>
          );
        }
        const vineta = t.startsWith('-') || t.startsWith('·') || t.startsWith('*');
        const limpio = vineta ? t.replace(/^[-·*]\s*/, '') : t;
        const html = limpio
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return (
          <p key={i} className={`text-[12.5px] leading-relaxed ${vineta ? 'pl-3.5 relative' : ''}`}>
            {vineta && <span className="absolute left-0" style={{ color: T.tierra }}>·</span>}
            <span dangerouslySetInnerHTML={{ __html: html }} />
          </p>
        );
      })}
    </div>
  );
}

function Seccion({ titulo, children, salto }: { titulo: string; children: React.ReactNode; salto?: boolean }) {
  return (
    <section className={`mb-7 ${salto ? 'salto-pagina' : ''}`}>
      <h2 className="font-display text-[15px] font-semibold mb-3 pb-1.5 border-b"
        style={{ borderColor: T.linea2 }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 evitar-corte">
      <p className="etiqueta mb-2">{titulo}</p>
      {children}
    </div>
  );
}

function Cifras({ items }: { items: { e: string; v: string; n?: string }[] }) {
  return (
    <div className="grid grid-cols-4 gap-px mb-4 border evitar-corte"
      style={{ background: T.linea, borderColor: T.linea }}>
      {items.map(k => (
        <div key={k.e} className="bg-white px-3 py-2.5">
          <span className="etiqueta block mb-1">{k.e}</span>
          <span className="block font-display text-[17px] font-semibold num leading-none"
            style={{ color: T.vino }}>{k.v}</span>
          {k.n && <span className="block font-mono text-[9.5px] mt-1" style={{ color: T.humo }}>{k.n}</span>}
        </div>
      ))}
    </div>
  );
}

function Contenido() {
  const q = useSearchParams();
  const filtros = {
    canal: q.get('canal'), categoria: q.get('categoria'),
    vendedor: q.get('vendedor'), cliente: q.get('cliente'),
    meses: q.get('meses')?.split(',').filter(Boolean) ?? [],
  };

  const [d, setD] = useState<Record<string, D>>({});
  const [resumen, setResumen] = useState<string | null>(null);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    if (filtros.canal) p.set('canal', filtros.canal);
    if (filtros.categoria) p.set('categoria', filtros.categoria);
    if (filtros.vendedor) p.set('vendedor', filtros.vendedor);
    if (filtros.meses.length) p.set('meses', filtros.meses.join(','));

    const vistas = ['ventas', 'canales', 'productos', 'productividad', 'retencion', 'operativos', 'forecast'];

    Promise.all(vistas.map(v =>
      fetch(`/api/datos?vista=${v}&${p}`).then(r => r.json()).catch(() => ({}))
    )).then(res => {
      setD(Object.fromEntries(vistas.map((v, i) => [v, res[i]])));
      setListo(true);
    });

    fetch('/api/resumen', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...filtros, meses: filtros.meses.length ? filtros.meses : null }),
    })
      .then(r => r.json())
      .then(j => (j.error ? setErrorIA(j.error) : setResumen(j.texto)))
      .catch(e => setErrorIA(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctx = d.ventas?.ctx ?? {};
  const k = d.ventas?.kpis ?? {};
  const cxc = d.operativos?.cxc ?? {};
  const inv = d.operativos?.inv ?? {};
  const res = d.retencion?.resumen ?? {};
  const ultRet = d.retencion?.ultima;
  const fc = d.forecast?.fc ?? { puntos: [], r2: 0, pendiente: 0, metodo: '' };

  const activos = [
    filtros.canal && `Canal: ${filtros.canal}`,
    filtros.categoria && `Categoría: ${filtros.categoria}`,
    filtros.vendedor && `Vendedor: ${filtros.vendedor}`,
    filtros.meses.length && `Meses: ${filtros.meses.map(nombreMes).join(', ')}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto bg-white" style={{ width: 760, padding: '28px 34px 40px' }}>

      {/* Barra de acciones — no se imprime */}
      <div className="no-imprimir flex gap-2 items-center mb-6 pb-4 border-b" style={{ borderColor: T.linea }}>
        <button onClick={() => window.print()}
          className="px-4 py-2 text-[13px] text-white" style={{ background: T.vino }}>
          Descargar PDF
        </button>
        <a href="/" className="px-4 py-2 text-[13px] border" style={{ borderColor: T.linea2, color: T.humo }}>
          Volver al tablero
        </a>
        <span className="etiqueta ml-auto">
          {listo ? 'listo para imprimir' : 'preparando…'}
        </span>
      </div>

      {/* Portada */}
      <header className="mb-7">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          {process.env.NEXT_PUBLIC_EMPRESA ?? ctx.empresa ?? 'Reporte'}
        </h1>
        <p className="etiqueta mt-1">Reporte ejecutivo · Distribución de vinos</p>
        <p className="text-[12.5px] mt-2.5" style={{ color: T.humo }}>
          Periodo de datos: <strong style={{ color: T.vino }}>{ctx.desde} al {ctx.hasta}</strong>
          {' · '}Generado el {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        {activos.length > 0 && (
          <p className="text-[12px] mt-1.5" style={{ color: T.humo }}>
            Filtros aplicados: {activos.join(' · ')}
          </p>
        )}
      </header>

      {/* Resumen ejecutivo */}
      <Seccion titulo="Resumen ejecutivo">
        <div className="border px-4 py-3.5" style={{ borderColor: T.linea, borderLeft: `3px solid ${T.vino}` }}>
          {resumen ? <Resumen texto={resumen} />
            : errorIA ? (
              <p className="text-[12.5px]" style={{ color: T.humo }}>
                No pude generar el resumen automático ({errorIA}). El resto del reporte está completo.
              </p>
            ) : (
              <p className="text-[12.5px]" style={{ color: T.humo }}>Redactando resumen…</p>
            )}
        </div>
        <p className="text-[10.5px] mt-2 font-mono" style={{ color: T.humo }}>
          Redactado automáticamente a partir de las cifras de este reporte.
        </p>
      </Seccion>

      {/* 1. Ventas */}
      <Seccion titulo="1 · Ventas generales">
        <Cifras items={[
          { e: 'Ingresos', v: mxn(n(k.venta_neta)), n: `${entero(n(k.facturas))} facturas` },
          { e: 'Margen bruto', v: pct(n(k.margen_pct)), n: mxn(n(k.margen_bruto)) },
          { e: 'Unidades', v: entero(n(k.unidades)), n: 'botellas' },
          { e: 'Precio prom.', v: mxn(n(k.precio_promedio)), n: 'por botella' },
        ]} />
        <Bloque titulo="Costo vs ventas vs utilidad">
          <Columnas datos={d.ventas?.mensual ?? []} alto={200} series={[
            { key: 'venta_neta', nombre: 'Ingresos', color: T.vino },
            { key: 'costo_total', nombre: 'Costo', color: T.tierra },
            { key: 'margen_bruto', nombre: 'Utilidad', color: T.arena },
          ]} />
        </Bloque>
        <div className="grid grid-cols-2 gap-4">
          <Bloque titulo="Top 5 productos por unidades">
            <Barras datos={rank(d.ventas?.topProd, 'unidades')} tipo="entero" color={T.vino2} ancho={118} alto={150} />
          </Bloque>
          <Bloque titulo="Ingresos por vendedor">
            <Barras datos={rank(d.ventas?.porVend).slice(0, 5)} color={T.tierra} ancho={118} alto={150} />
          </Bloque>
        </div>
      </Seccion>

      {/* 2. Canales */}
      <Seccion titulo="2 · Canales" salto>
        <div className="grid grid-cols-2 gap-4">
          <Bloque titulo="Participación por canal">
            <Dona datos={rank(d.canales?.porCanal)} alto={185} />
          </Bloque>
          <Bloque titulo="Detalle por canal">
            <Tabla columnas={[
              { key: 'etiqueta', titulo: 'Canal' },
              { key: 'venta_neta', titulo: 'Ingresos', tipo: 'moneda' },
              { key: 'margen_pct', titulo: 'Margen', tipo: 'pct' },
            ]} filas={d.canales?.porCanal ?? []} />
          </Bloque>
        </div>
      </Seccion>

      {/* 3. Productos */}
      <Seccion titulo="3 · Productos">
        <div className="grid grid-cols-2 gap-4">
          <Bloque titulo="Top 10 por ingreso">
            <Barras datos={rank(d.productos?.top10)} color={T.vino} ancho={126} alto={250} />
          </Bloque>
          <Bloque titulo="Menor ingreso con venta">
            <Barras datos={rank(d.productos?.peores)} color={T.rosa} ancho={126} alto={150} />
          </Bloque>
        </div>
      </Seccion>

      {/* 4. Productividad */}
      <Seccion titulo="4 · Clientes y vendedores" salto>
        <Cifras items={[
          { e: 'Clientes activos', v: entero(n(k.clientes_activos)), n: 'con compra' },
          { e: 'Ingreso/cliente', v: mxn(n(d.productividad?.kpis?.ingreso_por_cliente)), n: 'promedio' },
          { e: 'Ticket promedio', v: mxn(n(k.ticket_promedio)), n: 'por factura' },
          { e: 'Vendedores', v: entero((d.productividad?.porVend ?? []).length), n: 'con venta' },
        ]} />
        <div className="grid grid-cols-2 gap-4">
          <Bloque titulo="Top 10 clientes">
            <Barras datos={rank(d.productividad?.topCli)} color={T.vino} ancho={126} alto={250} />
          </Bloque>
          <Bloque titulo="Desempeño por vendedor">
            <Tabla columnas={[
              { key: 'etiqueta', titulo: 'Vendedor' },
              { key: 'venta_neta', titulo: 'Ingresos', tipo: 'moneda' },
              { key: 'margen_pct', titulo: 'Margen', tipo: 'pct' },
            ]} filas={(d.productividad?.porVend ?? []).slice(0, 10)} />
          </Bloque>
        </div>
      </Seccion>

      {/* 5. Retención */}
      <Seccion titulo="5 · Retención de clientes" salto>
        <Cifras items={[
          { e: 'Retención', v: ultRet?.retencion_pct != null ? pct(ultRet.retencion_pct) : '—',
            n: ultRet ? `${ultRet.retenidos} de ${ultRet.base_prev}` : '' },
          { e: 'Churn', v: ultRet?.churn_pct != null ? pct(ultRet.churn_pct) : '—', n: 'no recompraron' },
          { e: 'Clientes nuevos', v: entero(n(res.nuevos)), n: 'primera compra' },
          { e: 'Sin compra', v: entero(n(res.dormidos)), n: `de ${entero(n(res.total))}` },
        ]} />
        <p className="text-[11.5px] mb-3 px-3 py-2 border" style={{ borderColor: T.linea, borderLeft: `3px solid ${T.ambar}`, color: T.humo }}>
          La retención mide, de los clientes que compraron el mes anterior, cuántos volvieron a
          comprar. Difiere del reporte anterior, que dividía clientes activos entre el catálogo
          completo (penetración, no retención).
        </p>
        <Bloque titulo="Nuevos vs recurrentes por mes">
          <Columnas apilado tipo="entero" alto={180}
            datos={(d.retencion?.retencion ?? []).map((x: D) => ({
              etiqueta: x.mes, nuevos: x.nuevos, recurrentes: x.recurrentes,
            }))}
            series={[
              { key: 'recurrentes', nombre: 'Recurrentes', color: T.vino },
              { key: 'nuevos', nombre: 'Nuevos', color: T.arena },
            ]} />
        </Bloque>
      </Seccion>

      {/* 6. Operativos */}
      <Seccion titulo="6 · Cobranza e inventario" salto>
        <Cifras items={[
          { e: 'DSO', v: `${Math.round(n(cxc.dso))} días`, n: 'días de cobro' },
          { e: 'Saldo pendiente', v: mxn(n(cxc.saldo)), n: `${entero(n(cxc.facturas))} facturas` },
          { e: '% Cobrado', v: pct(n(cxc.cobrado_pct)), n: mxn(n(cxc.cobrado)) },
          { e: 'Inventario', v: mxn(n(inv.valor)), n: `${entero(n(inv.skus))} SKUs` },
        ]} />
        <Bloque titulo="Antigüedad de saldos">
          <Tabla columnas={[
            { key: 'rango', titulo: 'Rango' },
            { key: 'saldo', titulo: 'Saldo', tipo: 'moneda' },
            { key: 'facturas', titulo: 'Facturas', tipo: 'entero' },
          ]} filas={d.operativos?.antig ?? []} />
        </Bloque>
        <div className="grid grid-cols-2 gap-4">
          <Bloque titulo="Deudores con más de 90 días">
            <Tabla columnas={[
              { key: 'cliente', titulo: 'Cliente' },
              { key: 'saldo', titulo: 'Saldo', tipo: 'moneda' },
              { key: 'dias_max', titulo: 'Días', tipo: 'entero' },
            ]} filas={(d.operativos?.deudores ?? []).slice(0, 8)} />
          </Bloque>
          <Bloque titulo={`Inventario sin movimiento · ${mxn(n(inv.valor_muerto))}`}>
            <Tabla columnas={[
              { key: 'producto', titulo: 'Producto' },
              { key: 'valor', titulo: 'Valor', tipo: 'moneda' },
            ]} filas={(d.operativos?.muertos ?? []).slice(0, 8)} />
          </Bloque>
        </div>
      </Seccion>

      {/* 7. Proyección */}
      <Seccion titulo="7 · Proyección" salto>
        <Cifras items={[
          { e: 'Tendencia mensual', v: (n(fc.pendiente) >= 0 ? '+' : '') + mxn(n(fc.pendiente)), n: 'por mes' },
          { e: 'Confianza', v: `R² ${n(fc.r2).toFixed(2)}`, n: 'del modelo' },
          { e: 'Próximos 3 meses', v: mxn((fc.puntos ?? []).filter((p: D) => p.proyectado).reduce((a: number, p: D) => a + n(p.tendencia), 0)), n: 'estimado' },
          { e: 'Margen bruto', v: mxn(n(k.margen_bruto)), n: pct(n(k.margen_pct)) },
        ]} />
        <Bloque titulo={fc.metodo}>
          <Lineas alto={210}
            datos={(fc.puntos ?? []).map((p: D) => ({
              etiqueta: p.mes, real: p.real, tendencia: p.tendencia,
              conservador: p.conservador, optimista: p.optimista,
            }))}
            series={[
              { key: 'real', nombre: 'Real', color: T.vino },
              { key: 'tendencia', nombre: 'Tendencia', color: T.tierra, punteada: true },
              { key: 'optimista', nombre: 'Alto', color: T.jade, punteada: true },
              { key: 'conservador', nombre: 'Bajo', color: T.rojo, punteada: true },
            ]} />
        </Bloque>
        <Bloque titulo="Detalle de la proyección">
          <Tabla columnas={[
            { key: 'mes', titulo: 'Mes' },
            { key: 'real', titulo: 'Real', tipo: 'moneda' },
            { key: 'tendencia', titulo: 'Tendencia', tipo: 'moneda' },
            { key: 'conservador', titulo: 'Bajo', tipo: 'moneda' },
            { key: 'optimista', titulo: 'Alto', tipo: 'moneda' },
          ]} filas={(fc.puntos ?? []).map((p: D) => ({
            mes: fechaCorta(p.mes) + (p.proyectado ? ' (proy.)' : ''),
            real: p.real, tendencia: Math.round(n(p.tendencia)),
            conservador: p.conservador ? Math.round(p.conservador) : null,
            optimista: p.optimista ? Math.round(p.optimista) : null,
          }))} />
        </Bloque>
      </Seccion>

      <footer className="pt-4 mt-6 border-t text-[10.5px] font-mono flex justify-between"
        style={{ borderColor: T.linea, color: T.humo }}>
        <span>{process.env.NEXT_PUBLIC_EMPRESA ?? 'Reporte'} · datos al {ctx.hasta}</span>
        <span>Página generada el {new Date().toLocaleDateString('es-MX')}</span>
      </footer>
    </div>
  );
}

export default function Reporte() {
  return (
    <Suspense fallback={<p className="etiqueta p-10">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
