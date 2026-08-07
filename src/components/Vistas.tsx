'use client';
import Kpis from './Kpis';
import Tarjeta from './Tarjeta';
import { Columnas, Barras, Lineas, Dona, Mapa, Matriz, Tabla } from './Graficas';
import { mxn, compacto, entero, pct, fechaCorta } from '@/lib/formato';
import { T, SERIE } from '@/lib/tema';
import { useEstado } from '@/store/estado';

/* eslint-disable @typescript-eslint/no-explicit-any */
type D = any;

const num = (v: unknown) => Number(v ?? 0);
const rank = (filas: D[], campo = 'venta_neta') =>
  filas.map(f => ({ etiqueta: String(f.etiqueta), valor: num(f[campo]) }));

/* ================= 1. VENTAS GENERAL ================= */
export function VistaVentas({ d }: { d: D }) {
  const k = d.kpis ?? {};
  return (
    <>
      <Kpis items={[
        { etiqueta: 'Ingresos totales', valor: mxn(num(k.venta_neta)), nota: `${entero(num(k.facturas))} facturas` },
        { etiqueta: '% Margen bruto', valor: pct(num(k.margen_pct)),
          nota: mxn(num(k.margen_bruto)), tono: num(k.margen_pct) >= 40 ? 'bueno' : 'malo' },
        { etiqueta: 'Unidades vendidas', valor: entero(num(k.unidades)), nota: 'botellas' },
        { etiqueta: 'Precio promedio', valor: mxn(num(k.precio_promedio)), nota: 'por botella' },
      ]} />

      <Tarjeta id="tendencia" titulo="Costo vs Ventas vs Utilidad" sub="por mes">
        <Columnas datos={d.mensual ?? []} series={[
          { key: 'venta_neta', nombre: 'Ingresos', color: T.vino },
          { key: 'costo_total', nombre: 'Costo', color: T.tierra },
          { key: 'margen_bruto', nombre: 'Utilidad', color: T.arena },
        ]} alto={266} />
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="productos" titulo="Top 5 productos" sub="unidades vendidas">
          <Barras datos={rank(d.topProd ?? [], 'unidades')} tipo="entero" color={T.vino2} ancho={158} />
        </Tarjeta>
        <Tarjeta id="vendedores" titulo="Ingresos por vendedor" sub="periodo seleccionado">
          <Barras datos={rank(d.porVend ?? [])} color={T.tierra} ancho={158} />
        </Tarjeta>
      </div>
    </>
  );
}

/* ================= 2. CANALES ================= */
export function VistaCanales({ d }: { d: D }) {
  const canales: D[] = d.porCanal ?? [];
  const total = canales.reduce((a, c) => a + num(c.venta_neta), 0) || 1;

  // Serie combinada: un campo por canal
  const meses = Array.from(new Set(
    (d.detalle ?? []).flatMap((x: D) => x.serie.map((s: D) => String(s.etiqueta)))
  )).sort() as string[];
  const serieCombinada = meses.map(m => {
    const fila: Record<string, string | number> = { etiqueta: m };
    for (const x of d.detalle ?? []) {
      fila[x.canal] = num(x.serie.find((s: D) => String(s.etiqueta) === m)?.venta_neta);
    }
    return fila;
  });

  return (
    <>
      <Kpis cols={Math.min(canales.length, 4)} items={canales.slice(0, 4).map(c => ({
        etiqueta: `Ingresos ${c.etiqueta}`,
        valor: mxn(num(c.venta_neta)),
        nota: `${((num(c.venta_neta) / total) * 100).toFixed(1)}% del total · ${pct(num(c.margen_pct))} margen`,
      }))} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="dona" titulo="Participación por canal" sub="sobre ingresos">
          <Dona datos={rank(canales)} />
        </Tarjeta>
        <Tarjeta id="tendencia" titulo="Tendencia por canal" sub="ingresos mensuales">
          <Lineas datos={serieCombinada}
            series={canales.map((c, i) => ({
              key: String(c.etiqueta), nombre: String(c.etiqueta), color: SERIE[i % SERIE.length],
            }))} alto={232} />
        </Tarjeta>
      </div>

      <Tarjeta id="barras" titulo="Ingresos por canal y mes" sub="comparativo apilado">
        <Columnas datos={serieCombinada} apilado
          series={canales.map((c, i) => ({
            key: String(c.etiqueta), nombre: String(c.etiqueta), color: SERIE[i % SERIE.length],
          }))} alto={260} />
      </Tarjeta>
    </>
  );
}

/* ================= 3. PRODUCTOS ================= */
export function VistaProductos({ d }: { d: D }) {
  const k = d.kpis ?? {};
  return (
    <>
      <Kpis cols={4} items={[
        { etiqueta: 'Unidades vendidas', valor: entero(num(k.unidades)), nota: 'botellas' },
        { etiqueta: 'Precio promedio', valor: mxn(num(k.precio_promedio)), nota: 'por botella' },
        { etiqueta: 'Núm. facturas', valor: entero(num(k.facturas)), nota: `ticket ${mxn(num(k.ticket_promedio))}` },
        { etiqueta: 'SKUs con venta', valor: entero((d.todos ?? []).length), nota: 'productos distintos' },
      ]} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="top10" titulo="Top 10 productos" sub="por ingreso">
          <Barras datos={rank(d.top10 ?? [])} color={T.vino} ancho={168} />
        </Tarjeta>
        <Tarjeta id="peores" titulo="Peores 5 productos" sub="menor ingreso con venta">
          <Barras datos={rank(d.peores ?? [])} color={T.rosa} ancho={168} alto={190} />
        </Tarjeta>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="categoria" titulo="Ventas por línea" sub="participación">
          <Mapa datos={rank(d.porCat ?? [])} />
        </Tarjeta>
        <Tarjeta id="bodega" titulo="Ventas por bodega de salida" sub="distribución">
          <Dona datos={rank(d.porBodega ?? [])} />
        </Tarjeta>
      </div>

      <Tarjeta id="todos" titulo="Todos los productos" sub={`${(d.todos ?? []).length} SKUs`}>
        <Tabla
          columnas={[
            { key: 'etiqueta', titulo: 'Producto' },
            { key: 'venta_neta', titulo: 'Ingresos', tipo: 'moneda' },
            { key: 'unidades', titulo: 'Unidades', tipo: 'entero' },
            { key: 'precio_promedio', titulo: 'Precio prom.', tipo: 'moneda' },
            { key: 'margen_pct', titulo: 'Margen', tipo: 'pct' },
          ]}
          filas={d.todos ?? []} />
      </Tarjeta>
    </>
  );
}

/* ================= 4. PRODUCTIVIDAD ================= */
export function VistaProductividad({ d }: { d: D }) {
  const k = d.kpis ?? {};
  const aplicar = useEstado(s => s.aplicar);

  return (
    <>
      <Kpis cols={4} items={[
        { etiqueta: 'Clientes activos', valor: entero(num(k.clientes_activos)), nota: 'con al menos una compra' },
        { etiqueta: 'Ingreso por cliente', valor: mxn(num(k.ingreso_por_cliente)), nota: 'promedio' },
        { etiqueta: 'Núm. facturas', valor: entero(num(k.facturas)), nota: `ticket ${mxn(num(k.ticket_promedio))}` },
        { etiqueta: 'Vendedores activos', valor: entero((d.porVend ?? []).length), nota: 'con venta registrada' },
      ]} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="clientes" titulo="Top 10 clientes" sub="por ingreso">
          <Barras datos={rank(d.topCli ?? [])} color={T.vino} ancho={172} />
        </Tarjeta>
        <Tarjeta id="vendedores" titulo="Ventas por vendedor" sub="clic para filtrar">
          <div className="cursor-pointer" onClick={() => { /* drill-through desde la tabla */ }}>
            <Barras datos={rank((d.porVend ?? []).slice(0, 10))} color={T.tierra} ancho={172} />
          </div>
        </Tarjeta>
      </div>

      <Tarjeta id="matriz" titulo="Ingresos por vendedor y mes" sub="matriz con mapa de calor">
        <Matriz filas={Object.keys(d.celdas ?? {})} columnas={d.columnas ?? []} valores={d.celdas ?? {}} />
      </Tarjeta>

      <Tarjeta id="detalle" titulo="Detalle por vendedor" sub="clic en una fila para filtrar todo el tablero">
        <div className="[&_tr]:cursor-pointer">
          <Tabla
            columnas={[
              { key: 'etiqueta', titulo: 'Vendedor' },
              { key: 'venta_neta', titulo: 'Ingresos', tipo: 'moneda' },
              { key: 'margen_pct', titulo: 'Margen', tipo: 'pct' },
              { key: 'clientes_activos', titulo: 'Clientes', tipo: 'entero' },
            ]}
            filas={(d.porVend ?? []).map((v: D) => ({ ...v, _click: v.etiqueta }))} />
        </div>
        <button onClick={() => aplicar({ limpiar: true })}
          className="etiqueta mt-3 hover:underline">quitar filtros</button>
      </Tarjeta>
    </>
  );
}

/* ================= 5. RETENCIÓN ================= */
export function VistaRetencion({ d }: { d: D }) {
  const r = d.resumen ?? {};
  const u = d.ultima;
  const ret: D[] = d.retencion ?? [];

  return (
    <>
      <Kpis cols={4} items={[
        { etiqueta: 'Retención mensual', valor: u?.retencion_pct != null ? pct(u.retencion_pct) : '—',
          nota: u ? `${u.retenidos} de ${u.base_prev} volvieron a comprar` : 'sin mes previo',
          tono: (u?.retencion_pct ?? 0) >= 50 ? 'bueno' : 'malo' },
        { etiqueta: 'Churn mensual', valor: u?.churn_pct != null ? pct(u.churn_pct) : '—',
          nota: 'clientes que no recompraron', tono: (u?.churn_pct ?? 0) > 50 ? 'malo' : 'neutro' },
        { etiqueta: 'Ingreso por cliente', valor: mxn(num(d.kpis?.ingreso_por_cliente)), nota: 'promedio del periodo' },
        { etiqueta: 'Penetración catálogo', valor: pct(num(r.penetracion_pct)),
          nota: `${r.activos} de ${r.total} clientes` },
      ]} />

      <div className="bg-white border px-5 py-3 mb-4 text-[12.5px]"
        style={{ borderColor: T.linea, borderLeft: `3px solid ${T.ambar}` }}>
        <strong>Nota sobre el cálculo.</strong> El Power BI original definía la retención como
        clientes activos ÷ clientes totales, que en realidad es <em>penetración de catálogo</em>.
        Aquí la retención mide, de los clientes que compraron el mes anterior, cuántos volvieron a
        comprar. Ambas cifras se muestran para que puedas comparar.
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="activos" titulo="Clientes activos por mes" sub="tendencia">
          <Lineas datos={ret.map(x => ({ etiqueta: x.mes, activos: x.activos }))}
            series={[{ key: 'activos', nombre: 'Activos', color: T.vino }]} tipo="entero" area />
        </Tarjeta>
        <Tarjeta id="nuevos" titulo="Nuevos vs recurrentes" sub="composición mensual">
          <Columnas apilado tipo="entero"
            datos={ret.map(x => ({ etiqueta: x.mes, nuevos: x.nuevos, recurrentes: x.recurrentes }))}
            series={[
              { key: 'recurrentes', nombre: 'Recurrentes', color: T.vino },
              { key: 'nuevos', nombre: 'Nuevos', color: T.arena },
            ]} />
        </Tarjeta>
      </div>

      <Tarjeta id="curva" titulo="Curva de retención mensual" sub="% que recompra respecto al mes anterior">
        <Lineas tipo="pct"
          datos={ret.filter(x => x.retencion_pct != null)
            .map(x => ({ etiqueta: x.mes, retencion: x.retencion_pct, churn: x.churn_pct }))}
          series={[
            { key: 'retencion', nombre: 'Retención', color: T.jade },
            { key: 'churn', nombre: 'Churn', color: T.rojo, punteada: true },
          ]} />
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="topcli" titulo="Clientes con más facturas" sub="frecuencia de compra">
          <Tabla columnas={[
            { key: 'etiqueta', titulo: 'Cliente' },
            { key: 'venta_neta', titulo: 'Ingresos', tipo: 'moneda' },
            { key: 'facturas', titulo: 'Facturas', tipo: 'entero' },
          ]} filas={d.topCli ?? []} />
        </Tarjeta>
        <Tarjeta id="dormidos" titulo="Clientes sin compra en el periodo" sub="candidatos a reactivación">
          <Tabla columnas={[
            { key: 'cliente', titulo: 'Cliente' },
            { key: 'canal', titulo: 'Canal' },
            { key: 'saldo_pendiente', titulo: 'Saldo', tipo: 'moneda' },
          ]} filas={d.dormidos ?? []} />
        </Tarjeta>
      </div>
    </>
  );
}

/* ================= 6. OPERATIVOS ================= */
export function VistaOperativos({ d }: { d: D }) {
  const c = d.cxc ?? {};
  const inv = d.inv ?? {};
  return (
    <>
      <Kpis cols={4} items={[
        { etiqueta: 'DSO', valor: `${Math.round(num(c.dso))} días`,
          nota: `sobre ${c.dias_periodo ?? 0} días del periodo`, tono: num(c.dso) > 90 ? 'malo' : 'neutro' },
        { etiqueta: 'Saldo pendiente', valor: mxn(num(c.saldo)), nota: `${entero(num(c.facturas))} facturas` },
        { etiqueta: '% Cobrado', valor: pct(num(c.cobrado_pct)),
          nota: `${mxn(num(c.cobrado))} de ${mxn(num(c.facturado))}`,
          tono: num(c.cobrado_pct) >= 70 ? 'bueno' : 'malo' },
        { etiqueta: 'Stock total', valor: entero(num(inv.botellas)),
          nota: `${mxn(num(inv.valor))} al costo` },
      ]} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="margencanal" titulo="Margen bruto por canal" sub="% sobre ingresos">
          <Barras datos={(d.margenCanal ?? []).map((x: D) => ({ etiqueta: String(x.etiqueta), valor: num(x.margen_pct) }))}
            tipo="pct" color={T.vino2} ancho={120} />
        </Tarjeta>
        <Tarjeta id="estadocobro" titulo="Estado de cobro" sub="cobrado vs pendiente">
          <Dona datos={[
            { etiqueta: 'Cobrado', valor: num(c.cobrado) },
            { etiqueta: 'Saldo pendiente', valor: num(c.saldo) },
          ]} />
        </Tarjeta>
      </div>

      <Tarjeta id="antiguedad" titulo="Antigüedad de saldos" sub="al corte de datos">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px border" style={{ background: T.linea, borderColor: T.linea }}>
          {(d.antig ?? []).map((a: D) => {
            const crit = a.rango === 'Más de 90';
            return (
              <div key={a.rango} className="px-3 py-3" style={{ background: crit ? '#f6e5e4' : '#fff' }}>
                <span className="etiqueta block">{a.rango}</span>
                <span className="block font-display text-[19px] font-semibold mt-1.5 num"
                  style={{ color: crit ? T.rojo : T.vino }}>{compacto(a.saldo)}</span>
                <span className="font-mono text-[10px]" style={{ color: T.humo }}>{a.facturas} facturas</span>
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="deudores" titulo="Deudores con más de 90 días" sub="riesgo de incobrable">
          <Barras datos={(d.deudores ?? []).map((x: D) => ({ etiqueta: x.cliente, valor: x.saldo }))}
            color={T.rojo} ancho={168} />
        </Tarjeta>
        <Tarjeta id="bodegas" titulo="Unidades disponibles por bodega" sub="inventario">
          <Barras datos={(d.bodegas ?? []).map((x: D) => ({ etiqueta: x.bodega, valor: x.unidades }))}
            tipo="entero" color={T.tierra} ancho={130} />
        </Tarjeta>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="margenprod" titulo="Margen bruto por producto" sub="top 10 por ingreso">
          <Barras datos={(d.margenProd ?? []).map((x: D) => ({ etiqueta: String(x.etiqueta), valor: num(x.margen_pct) }))}
            tipo="pct" color={T.cobre} ancho={168} />
        </Tarjeta>
        <Tarjeta id="muertos" titulo="Inventario sin movimiento" sub={`${inv.sin_movimiento ?? 0} SKUs · ${mxn(num(inv.valor_muerto))}`}>
          <Tabla columnas={[
            { key: 'producto', titulo: 'Producto' },
            { key: 'existencias', titulo: 'Botellas', tipo: 'entero' },
            { key: 'valor', titulo: 'Valor', tipo: 'moneda' },
          ]} filas={d.muertos ?? []} />
        </Tarjeta>
      </div>
    </>
  );
}

/* ================= 7. FORECAST ================= */
export function VistaForecast({ d }: { d: D }) {
  const fc = d.fc ?? { puntos: [], r2: 0, metodo: '' };
  const puntos: D[] = fc.puntos ?? [];
  const proy = puntos.filter(p => p.proyectado);
  const gasto = num(d.mkt?.gasto);
  const ingresos = num(d.kpis?.venta_neta);
  const margenBruto = num(d.kpis?.margen_bruto);

  return (
    <>
      <Kpis cols={4} items={[
        { etiqueta: 'Ingresos reales', valor: mxn(ingresos), nota: 'periodo cargado' },
        { etiqueta: 'Proyección 3 meses', valor: mxn(proy.reduce((a, p) => a + num(p.tendencia), 0)),
          nota: `R² = ${fc.r2.toFixed(2)}`, tono: fc.r2 >= 0.5 ? 'bueno' : 'malo' },
        { etiqueta: 'Margen neto', valor: mxn(margenBruto - gasto),
          nota: `bruto ${mxn(margenBruto)} − marketing ${mxn(gasto)}` },
        { etiqueta: 'ROI marketing', valor: gasto ? (ingresos / gasto).toFixed(1) + 'x' : '—',
          nota: `gasto ${mxn(gasto)}` },
      ]} />

      <div className="bg-white border px-5 py-3 mb-4 text-[12.5px]"
        style={{ borderColor: T.linea, borderLeft: `3px solid ${T.ambar}` }}>
        <strong>Cambio respecto al Power BI.</strong> El original calculaba
        <code className="font-mono mx-1">Proy Conservadora = Ingresos × 0.85</code> y
        <code className="font-mono mx-1">Proy Optimista = Ingresos × 1.20</code>, que es la misma
        curva histórica escalada y no proyecta ningún mes futuro. Aquí se usa {fc.metodo.toLowerCase()},
        con banda de confianza sobre el error histórico y proyección a 3 meses reales.
      </div>

      <Tarjeta id="forecast" titulo="Ingresos reales y proyección" sub={fc.metodo}>
        <Lineas alto={286}
          datos={puntos.map(p => ({
            etiqueta: p.mes, real: p.real, tendencia: p.tendencia,
            conservador: p.conservador, optimista: p.optimista,
          }))}
          series={[
            { key: 'real', nombre: 'Ingresos reales', color: T.vino },
            { key: 'tendencia', nombre: 'Tendencia', color: T.tierra, punteada: true },
            { key: 'optimista', nombre: 'Escenario alto', color: T.jade, punteada: true },
            { key: 'conservador', nombre: 'Escenario bajo', color: T.rojo, punteada: true },
          ]} />
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta id="tablafc" titulo="Detalle de la proyección" sub="meses proyectados en gris">
          <Tabla columnas={[
            { key: 'mes', titulo: 'Mes' },
            { key: 'real', titulo: 'Real', tipo: 'moneda' },
            { key: 'tendencia', titulo: 'Tendencia', tipo: 'moneda' },
            { key: 'conservador', titulo: 'Bajo', tipo: 'moneda' },
            { key: 'optimista', titulo: 'Alto', tipo: 'moneda' },
          ]} filas={puntos.map(p => ({
            mes: fechaCorta(p.mes) + (p.proyectado ? ' (proy.)' : ''),
            real: p.real, tendencia: Math.round(p.tendencia),
            conservador: p.conservador ? Math.round(p.conservador) : null,
            optimista: p.optimista ? Math.round(p.optimista) : null,
          }))} />
        </Tarjeta>

        <Tarjeta id="marketing" titulo="Gasto de marketing" sub="capturado manualmente">
          <Columnas alto={220}
            datos={(d.mkt?.filas ?? []).map((m: D) => ({ etiqueta: m.periodo, monto: m.monto }))}
            series={[{ key: 'monto', nombre: 'Gasto', color: T.arena }]} />
          <p className="text-[12px] mt-3" style={{ color: T.humo }}>
            Esta tabla no viene de los Excel: se capturó dentro del Power BI. Se siembra con
            <code className="font-mono mx-1">npm run db:marketing</code> y el cliente la actualiza cada mes.
          </p>
        </Tarjeta>
      </div>
    </>
  );
}
