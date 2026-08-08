import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, firmar, MAX_EDAD } from '@/lib/sesion';
import { verificarAcceso } from '@/lib/acceso';

export const runtime = 'nodejs';

/** Comparación en tiempo constante para no filtrar la contraseña por timing. */
function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const esperada = process.env.APP_PASSWORD;
  const secreto = process.env.SESSION_SECRET;

  if (!esperada || !secreto) {
    return NextResponse.json(
      { error: 'Falta configurar APP_PASSWORD y SESSION_SECRET en el servidor.' },
      { status: 500 }
    );
  }

  // Retardo fijo para desalentar fuerza bruta
  await new Promise(r => setTimeout(r, 400));

  if (!iguales(String(password ?? ''), esperada)) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  // La contraseña es correcta, pero el acceso puede estar vencido o suspendido.
  const acceso = await verificarAcceso();
  if (!acceso.permitido) {
    return NextResponse.json({
      error: acceso.mensaje ?? 'Acceso no disponible',
      estado: acceso.estado, contacto: acceso.contacto, sinAcceso: true,
    }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await firmar(secreto), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_EDAD,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
