/**
 * Sesión por cookie firmada con HMAC-SHA256.
 * Usa Web Crypto para funcionar igual en Node y en el middleware (edge).
 */
export const COOKIE = 'tablero_sesion';
const DURACION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

const enc = new TextEncoder();

async function clave(secreto: string) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');

export async function firmar(secreto: string): Promise<string> {
  const expira = String(Date.now() + DURACION_MS);
  const mac = await crypto.subtle.sign('HMAC', await clave(secreto), enc.encode(expira));
  return `${expira}.${hex(mac)}`;
}

export async function verificar(token: string | undefined, secreto: string): Promise<boolean> {
  if (!token) return false;
  const [expira, mac] = token.split('.');
  if (!expira || !mac) return false;
  if (Number(expira) < Date.now()) return false;
  const esperado = await crypto.subtle.sign('HMAC', await clave(secreto), enc.encode(expira));
  const a = hex(esperado);
  // Comparación en tiempo constante
  if (a.length !== mac.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ mac.charCodeAt(i);
  return dif === 0;
}

export const MAX_EDAD = DURACION_MS / 1000;
