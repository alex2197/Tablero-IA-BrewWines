'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { T } from '@/lib/tema';
import { mxn, entero } from '@/lib/formato';

const ESPERADOS = [
  'Ventas.xlsx', 'Clientes.xlsx', 'Productos.xlsx',
  'Vendedores.xlsx', 'Inventario.xlsx', 'CuentasPorCobrar.xlsx',
];

interface ReporteTabla {
  tabla: string; archivo: string;
  filasLeidas: number; filasValidas: number; descartadas: number; avisos: string[];
}
interface Reporte {
  ok: boolean; tablas: ReporteTabla[]; errores: string[];
  resumen: { periodoDesde: string | null; periodoHasta: string | null; ventaTotal: number };
}

export default function Cargar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [estado, setEstado] = useState<'inicio' | 'validando' | 'revisar' | 'cargando' | 'listo'>('inicio');
  const [error, setError] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);

  function agregar(lista: FileList | null) {
    if (!lista) return;
    const xlsx = Array.from(lista).filter(f => f.name.toLowerCase().endsWith('.xlsx'));
    setArchivos(prev => {
      const mapa = new Map(prev.map(f => [f.name.toLowerCase(), f]));
      for (const f of xlsx) mapa.set(f.name.toLowerCase(), f);
      return [...mapa.values()];
    });
    setReporte(null);
    setEstado('inicio');
    setError(null);
  }

  async function enviar(modo: 'validar' | 'cargar') {
    setEstado(modo === 'validar' ? 'validando' : 'cargando');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('modo', modo);
      archivos.forEach((f, i) => fd.append(`archivo_${i}`, f));

      const r = await fetch('/api/cargar', { method: 'POST', body: fd });
      const j = await r.json();

      if (j.error) { setError(j.error); setEstado('inicio'); return; }
      setReporte(j.reporte);

      if (modo === 'cargar' && j.cargado) {
        setEstado('listo');
        setTimeout(() => { router.push('/'); router.refresh(); }, 1800);
      } else {
        setEstado('revisar');
      }
    } catch (e) {
      setError((e as Error).message);
      setEstado('inicio');
    }
  }

  const faltantes = ESPERADOS.filter(
    e => !archivos.some(a => a.name.toLowerCase() === e.toLowerCase())
  );

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="font-display text-xl font-extrabold tracking-tight">Actualizar datos</h1>
        <button onClick={() => router.push('/')} className="etiqueta ml-auto hover:underline">
          volver al tablero
        </button>
      </div>
      <p className="text-[13px] mb-6" style={{ color: T.humo }}>
        Sube los Excel del sistema. Se revisan antes de guardar nada.
      </p>

      {/* Zona de arrastre */}
      <div
        onDragOver={e => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); agregar(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors"
        style={{
          borderColor: sobre ? T.vino : T.linea2,
          background: sobre ? '#fff' : 'transparent',
        }}
      >
        <p className="text-[14px] font-medium">Arrastra aquí tus archivos .xlsx</p>
        <p className="text-[12.5px] mt-1" style={{ color: T.humo }}>o haz clic para elegirlos</p>
        <input ref={inputRef} type="file" multiple accept=".xlsx" className="hidden"
          onChange={e => agregar(e.target.files)} />
      </div>

      {/* Lista de esperados */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-5">
        {ESPERADOS.map(e => {
          const puesto = archivos.find(a => a.name.toLowerCase() === e.toLowerCase());
          return (
            <div key={e} className="flex items-center gap-2 text-[12.5px] py-1">
              <span className="w-4 shrink-0 text-center" style={{ color: puesto ? T.jade : T.linea2 }}>
                {puesto ? '✓' : '○'}
              </span>
              <span style={{ color: puesto ? T.vino : T.humo }}>{e}</span>
              {puesto && (
                <span className="font-mono text-[10.5px] ml-auto" style={{ color: T.humo }}>
                  {(puesto.size / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          );
        })}
      </div>

      {archivos.length > 0 && faltantes.length > 0 && estado === 'inicio' && (
        <p className="text-[12.5px] mt-4" style={{ color: T.ambar }}>
          Faltan {faltantes.length}: {faltantes.join(', ')}
        </p>
      )}

      {error && (
        <div className="border px-4 py-3 mt-5 text-[13px]"
          style={{ borderColor: T.linea, borderLeft: `3px solid ${T.rojo}`, background: '#fff', color: T.rojo }}>
          {error}
        </div>
      )}

      {/* Botón de validar */}
      {archivos.length > 0 && estado === 'inicio' && (
        <button onClick={() => enviar('validar')}
          className="mt-5 px-5 py-2.5 text-[13.5px] text-white" style={{ background: T.vino }}>
          Revisar archivos
        </button>
      )}

      {estado === 'validando' && <p className="etiqueta mt-5">Revisando…</p>}

      {/* Reporte de validación */}
      {reporte && estado !== 'listo' && (
        <div className="mt-7">
          <h2 className="font-display text-[15px] font-semibold mb-3">Resultado de la revisión</h2>

          <div className="border" style={{ borderColor: T.linea, background: '#fff' }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr>
                  <th className="etiqueta text-left px-4 pt-3 pb-2">Archivo</th>
                  <th className="etiqueta text-right px-4 pt-3 pb-2">Filas</th>
                  <th className="etiqueta text-right px-4 pt-3 pb-2">Omitidas</th>
                </tr>
              </thead>
              <tbody>
                {reporte.tablas.map(t => (
                  <tr key={t.tabla} className="border-t" style={{ borderColor: T.linea }}>
                    <td className="px-4 py-2">
                      {t.archivo}
                      {t.avisos.map((a, i) => (
                        <span key={i} className="block text-[11.5px] mt-0.5" style={{ color: T.ambar }}>
                          {a}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono num">{entero(t.filasValidas)}</td>
                    <td className="px-4 py-2 text-right font-mono num"
                      style={{ color: t.descartadas ? T.ambar : T.humo }}>
                      {t.descartadas || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reporte.errores.length > 0 && (
            <div className="border px-4 py-3 mt-4 text-[13px]"
              style={{ borderColor: T.linea, borderLeft: `3px solid ${T.rojo}`, background: '#fff' }}>
              <strong style={{ color: T.rojo }}>No puedo cargar todavía:</strong>
              <ul className="mt-1.5 space-y-1" style={{ color: T.rojo }}>
                {reporte.errores.map((e, i) => <li key={i}>· {e}</li>)}
              </ul>
            </div>
          )}

          {reporte.ok && (
            <>
              <div className="border px-4 py-3 mt-4 text-[13px]"
                style={{ borderColor: T.linea, borderLeft: `3px solid ${T.jade}`, background: '#fff' }}>
                <strong>Confirma que son tus datos:</strong> el periodo va del{' '}
                <strong>{reporte.resumen.periodoDesde}</strong> al{' '}
                <strong>{reporte.resumen.periodoHasta}</strong>, con una venta total de{' '}
                <strong>{mxn(reporte.resumen.ventaTotal)}</strong>.
              </div>

              <p className="text-[12.5px] mt-4" style={{ color: T.humo }}>
                Al confirmar se reemplazan todos los datos actuales del tablero.
                Si algo sale mal, no se guarda nada a medias.
              </p>

              <div className="flex gap-2 mt-4">
                <button onClick={() => enviar('cargar')} disabled={estado === 'cargando'}
                  className="px-5 py-2.5 text-[13.5px] text-white disabled:opacity-40"
                  style={{ background: T.vino }}>
                  {estado === 'cargando' ? 'Cargando…' : 'Confirmar y cargar'}
                </button>
                <button onClick={() => { setArchivos([]); setReporte(null); setEstado('inicio'); }}
                  className="px-5 py-2.5 text-[13.5px] border"
                  style={{ borderColor: T.linea2, color: T.humo }}>
                  Empezar de nuevo
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {estado === 'listo' && (
        <div className="border px-4 py-4 mt-6 text-[13.5px]"
          style={{ borderColor: T.linea, borderLeft: `3px solid ${T.jade}`, background: '#fff' }}>
          <strong>Datos actualizados.</strong> Llevándote al tablero…
        </div>
      )}
    </div>
  );
}
