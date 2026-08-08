import { NextRequest } from 'next/server';
import { pool, TENANT } from '@/lib/db';
import { analizar, escribir, type ArchivoEntrada } from '@/lib/etl';
import { verificarAcceso, respuestaSinAcceso } from '@/lib/acceso';

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * Dos modos:
 *   modo=validar  -> devuelve el reporte, no toca la base
 *   modo=cargar   -> valida y, si pasa, escribe en una transacción
 */
export async function POST(req: NextRequest) {
  try {
    const acceso = await verificarAcceso();
    if (!acceso.permitido) return respuestaSinAcceso(acceso);

    const form = await req.formData();
    const modo = String(form.get('modo') ?? 'validar');
    const empresa = String(form.get('empresa') ?? process.env.NEXT_PUBLIC_EMPRESA ?? 'Empresa');

    const archivos: ArchivoEntrada[] = [];
    for (const [, v] of form.entries()) {
      if (v instanceof File && v.name.toLowerCase().endsWith('.xlsx')) {
        archivos.push({ nombre: v.name, buffer: Buffer.from(await v.arrayBuffer()) });
      }
    }
    if (!archivos.length) {
      return Response.json({ error: 'No recibí ningún archivo .xlsx' }, { status: 400 });
    }

    const { reporte, datos } = analizar(archivos);
    if (modo === 'validar' || !reporte.ok) return Response.json({ reporte });

    const log: string[] = [];
    await escribir(pool, TENANT, empresa, datos, m => log.push(m));
    return Response.json({ reporte, cargado: true, log });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
