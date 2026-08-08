/**
 * Control de acceso por cliente.
 *
 * Estados:
 *   activo      — acceso completo, sin vencimiento
 *   prueba      — acceso completo hasta la fecha `vence`
 *   suspendido  — sin acceso, con pantalla explicativa
 *
 * Se verifica en el login y en cada endpoint, por si alguien conserva
 * una sesión abierta cuando vence la prueba.
 */
import { pool, TENANT } from './db';

export type EstadoAcceso = 'activo' | 'prueba' | 'suspendido' | 'vencido';

export interface Acceso {
  permitido: boolean;
  estado: EstadoAcceso;
  vence: string | null;
  diasRestantes: number | null;
  contacto: string | null;
  mensaje: string | null;
}

/** Fecha de hoy en hora de Ciudad de México. */
const hoyMx = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

const diasEntre = (desde: string, hasta: string) =>
  Math.ceil((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);

export async function verificarAcceso(tenant = TENANT): Promise<Acceso> {
  const { rows } = await pool.query(
    `SELECT estado, vence::text AS vence, contacto, nombre
     FROM tenants WHERE id = $1`, [tenant]
  );

  // Si el tenant no existe todavía, no bloqueamos: es una instalación nueva.
  if (!rows.length) {
    return { permitido: true, estado: 'activo', vence: null, diasRestantes: null,
             contacto: null, mensaje: null };
  }

  const { estado, vence, contacto } = rows[0];
  const contactoTxt = contacto ?? null;

  if (estado === 'suspendido') {
    return {
      permitido: false, estado: 'suspendido', vence, diasRestantes: null,
      contacto: contactoTxt,
      mensaje: 'Tu acceso al tablero está suspendido.',
    };
  }

  if (estado === 'prueba') {
    if (!vence) {
      return { permitido: true, estado: 'prueba', vence: null, diasRestantes: null,
               contacto: contactoTxt, mensaje: null };
    }
    const dias = diasEntre(hoyMx(), vence);
    if (dias < 0) {
      return {
        permitido: false, estado: 'vencido', vence, diasRestantes: 0,
        contacto: contactoTxt,
        mensaje: 'Tu periodo de prueba terminó.',
      };
    }
    return { permitido: true, estado: 'prueba', vence, diasRestantes: dias,
             contacto: contactoTxt, mensaje: null };
  }

  return { permitido: true, estado: 'activo', vence: null, diasRestantes: null,
           contacto: contactoTxt, mensaje: null };
}

/** Respuesta estándar para endpoints cuando no hay acceso. */
export function respuestaSinAcceso(a: Acceso) {
  return Response.json({
    error: 'sin_acceso', estado: a.estado,
    mensaje: a.mensaje, contacto: a.contacto, vence: a.vence,
  }, { status: 403 });
}
