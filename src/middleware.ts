import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verificar } from '@/lib/sesion';

const PUBLICO = ['/login', '/api/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICO.some(p => pathname.startsWith(p))) return NextResponse.next();

  const secreto = process.env.SESSION_SECRET;
  // Sin secreto configurado no se bloquea nada: evita dejar fuera al dueño en local.
  if (!secreto) return NextResponse.next();

  const ok = await verificar(req.cookies.get(COOKIE)?.value, secreto);
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('destino', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
