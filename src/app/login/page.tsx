'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { T } from '@/lib/tema';

function Formulario() {
  const router = useRouter();
  const destino = useSearchParams().get('destino') ?? '/';
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true); setError(null);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'No pude iniciar sesión'); return; }
      router.push(destino);
      router.refresh();
    } catch {
      setError('No pude conectarme al servidor');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-[330px]">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        {process.env.NEXT_PUBLIC_EMPRESA ?? 'Tablero'}
      </h1>
      <p className="etiqueta mt-1 mb-6">Tablero de negocio</p>

      <label className="etiqueta block mb-1.5">Contraseña</label>
      <input
        type="password" value={pass} autoFocus autoComplete="current-password"
        onChange={e => setPass(e.target.value)}
        className="w-full border px-3 py-2 text-[14px] bg-white focus:outline-none"
        style={{ borderColor: error ? T.rojo : T.linea2 }}
      />

      {error && <p className="text-[12.5px] mt-2" style={{ color: T.rojo }}>{error}</p>}

      <button type="submit" disabled={ocupado || !pass}
        className="w-full mt-4 py-2.5 text-[13.5px] text-white disabled:opacity-40 transition-opacity"
        style={{ background: T.vino }}>
        {ocupado ? 'Verificando…' : 'Entrar'}
      </button>
    </form>
  );
}

export default function Login() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <Suspense fallback={<p className="etiqueta">Cargando…</p>}>
        <Formulario />
      </Suspense>
    </div>
  );
}
