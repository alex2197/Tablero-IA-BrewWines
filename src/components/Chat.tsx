'use client';
import { useEffect, useRef, useState } from 'react';
import { useEstado, type Vista } from '@/store/estado';

interface Mensaje {
  rol: 'user' | 'assistant';
  texto: string;
  trazas?: { herramienta: string; sql?: string }[];
}

const SUGERENCIAS = [
  '¿Cómo van las ventas?',
  '¿Cuál es mi retención real?',
  '¿Cuánto voy a vender en 3 meses?',
  '¿Quién me debe más?',
  'Llévame a Canales',
  '¿Qué debo revisar?',
  'Genera el reporte para la junta',
];

/** Convierte **negritas** en <strong>, escapando el resto. */
function formatear(t: string) {
  const esc = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export default function Chat() {
  const aplicar = useEstado((s) => s.aplicar);
  const destacarPanel = useEstado((s) => s.destacarPanel);

  const [mensajes, setMensajes] = useState<Mensaje[]>([{
    rol: 'assistant',
    texto: 'Tengo cargadas tus ventas, cartera, inventario y catálogo de clientes. Pregúntame lo que quieras o toca una sugerencia.',
  }]);
  const [entrada, setEntrada] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [herramienta, setHerramienta] = useState<string | null>(null);
  const [cupo, setCupo] = useState<{ restantes: number; limite: number } | null>(null);
  const [sinCupo, setSinCupo] = useState(false);

  useEffect(() => {
    fetch('/api/cupo').then(r => r.json())
      .then(j => { if (!j.error) { setCupo(j); setSinCupo(j.restantes <= 0); } })
      .catch(() => {});
  }, []);

  const finRef = useRef<HTMLDivElement>(null);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, herramienta]);

  async function enviar(texto: string) {
    if (!texto.trim() || ocupado) return;

    const nuevos: Mensaje[] = [...mensajes, { rol: 'user', texto }];
    setMensajes([...nuevos, { rol: 'assistant', texto: '' }]);
    setEntrada('');
    setOcupado(true);

    // El historial que ve la API solo lleva rol + contenido plano.
    const historial = nuevos.map((m) => ({ role: m.rol, content: m.texto }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajes: historial }),
      });
      if (res.status === 429) {
        const j = await res.json();
        setSinCupo(true);
        setCupo({ restantes: 0, limite: j.limite ?? 0 });
        setMensajes(m => {
          const c = [...m];
          c[c.length - 1] = { rol: 'assistant', texto: j.mensaje ?? 'Límite diario alcanzado.' };
          return c;
        });
        return;
      }
      if (!res.body) throw new Error('Sin respuesta del servidor');

      const lector = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      let acumulado = '';

      while (true) {
        const { done, value } = await lector.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });

        const partes = buffer.split('\n\n');
        buffer = partes.pop() ?? '';

        for (const parte of partes) {
          if (!parte.startsWith('data: ')) continue;
          const evt = JSON.parse(parte.slice(6));

          if (evt.t === 'texto') {
            acumulado += evt.delta;
            setHerramienta(null);
            setMensajes((m) => {
              const c = [...m];
              c[c.length - 1] = { rol: 'assistant', texto: acumulado };
              return c;
            });
          } else if (evt.t === 'herramienta') {
            setHerramienta(evt.nombre);
          } else if (evt.t === 'accion') {
            // Aquí es donde la IA mueve el tablero.
            aplicar(evt.estado as { vista?: Vista });
            if (evt.estado?.vista) destacarPanel(null);
          } else if (evt.t === 'abrir') {
            // El reporte se abre en otra pestaña para no perder la conversación
            window.open(evt.url as string, '_blank', 'noopener');
          } else if (evt.t === 'fin') {
            if (evt.cupo) {
              setCupo(evt.cupo);
              setSinCupo(evt.cupo.restantes <= 0);
            }
            setMensajes((m) => {
              const c = [...m];
              c[c.length - 1] = { rol: 'assistant', texto: acumulado, trazas: evt.trazas };
              return c;
            });
          } else if (evt.t === 'error') {
            setMensajes((m) => {
              const c = [...m];
              c[c.length - 1] = { rol: 'assistant', texto: `Hubo un problema: ${evt.mensaje}` };
              return c;
            });
          }
        }
      }
    } catch (e) {
      setMensajes((m) => {
        const c = [...m];
        c[c.length - 1] = { rol: 'assistant', texto: `No pude conectarme: ${(e as Error).message}` };
        return c;
      });
    } finally {
      setOcupado(false);
      setHerramienta(null);
    }
  }

  return (
    <aside className="border-l border-linea bg-white flex flex-col min-h-0">
      <div className="px-5 pt-4 pb-3.5 border-b border-linea">
        <h2 className="font-display text-[14.5px] font-semibold flex items-center gap-2">
          <span className="w-[7px] h-[7px] rounded-full bg-jade" />
          Asistente
        </h2>
        <p className="text-[11.5px] text-humo mt-0.5">
          Pregunta en español. Puede cambiar el tablero.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">
        {mensajes.map((m, i) => m.rol === 'user' ? (
          <div key={i} className="self-end bg-tinta text-white px-3 py-2 rounded-[12px_12px_3px_12px] max-w-[87%] text-[13.5px] leading-relaxed">
            {m.texto}
          </div>
        ) : (
          <div key={i} className="self-start max-w-full text-[13.5px] leading-relaxed">
            <div className="etiqueta mb-1.5">Asistente</div>
            {m.texto
              ? <div dangerouslySetInnerHTML={{ __html: formatear(m.texto) }} />
              : herramienta === null && i === mensajes.length - 1 && (
                  <div className="flex gap-1 py-1">
                    {[0, 1, 2].map((k) => (
                      <span key={k} className="punto w-[5px] h-[5px] rounded-full bg-linea2"
                        style={{ animationDelay: `${k * 0.16}s` }} />
                    ))}
                  </div>
                )}
            {m.trazas?.filter((t) => t.herramienta !== 'actualizar_tablero').map((t, k) => (
              <div key={k}
                title={t.sql ?? 'Consulta ejecutada en la base de datos'}
                className="font-mono text-[10.5px] text-jade bg-jade-s px-2 py-1 mt-2 inline-block cursor-help"
              >
                ⚡ {t.herramienta}
              </div>
            ))}
          </div>
        ))}

        {herramienta && (
          <div className="self-start font-mono text-[10.5px] text-humo flex items-center gap-2">
            <span className="punto w-[5px] h-[5px] rounded-full bg-jade" />
            consultando {herramienta.replace('consultar_', '').replace(/_/g, ' ')}…
          </div>
        )}
        <div ref={finRef} />
      </div>

      {!ocupado && !sinCupo && mensajes.length <= 3 && (
        <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
          {SUGERENCIAS.map((s) => (
            <button key={s} onClick={() => enviar(s)}
              className="text-[11.5px] border border-linea2 px-2.5 py-1 rounded-full text-humo hover:border-jade hover:text-jade hover:bg-jade-s transition-colors"
            >{s}</button>
          ))}
        </div>
      )}

      <div className="border-t border-linea px-3.5 py-3 flex gap-2 items-end">
        <textarea
          rows={1} value={entrada} disabled={ocupado || sinCupo}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(entrada); }
          }}
          placeholder={
            sinCupo ? 'Límite diario alcanzado'
            : ocupado ? 'Consultando…'
            : 'Escribe tu pregunta…'
          }
          aria-label="Pregunta"
          className="flex-1 resize-none border border-linea2 rounded-lg px-2.5 py-2 text-[13.5px] max-h-24 focus:outline-none focus:border-jade disabled:bg-papel"
        />
        <button
          onClick={() => enviar(entrada)} disabled={ocupado || sinCupo || !entrada.trim()}
          aria-label="Enviar"
          className="bg-tinta text-white w-[33px] h-[33px] rounded-lg grid place-items-center shrink-0 hover:bg-jade disabled:opacity-40 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <p className="font-mono text-[10px] text-center px-5 pb-3 leading-relaxed"
        style={{ color: sinCupo ? 'var(--color-rojo)' : cupo && cupo.restantes <= 5 ? 'var(--color-ambar)' : 'var(--color-humo)' }}>
        {sinCupo
          ? `Límite de ${cupo?.limite ?? ''} consultas diarias alcanzado · se reinicia a medianoche`
          : cupo && cupo.restantes <= 10
            ? `Te quedan ${cupo.restantes} de ${cupo.limite} consultas hoy`
            : 'Las cifras salen de consultas reales a la base de datos'}
      </p>
    </aside>
  );
}
