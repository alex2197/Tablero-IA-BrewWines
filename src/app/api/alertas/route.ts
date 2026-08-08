import { alertas } from '@/lib/consultar';
import { verificarAcceso, respuestaSinAcceso } from '@/lib/acceso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const acceso = await verificarAcceso();
    if (!acceso.permitido) return respuestaSinAcceso(acceso);

    return Response.json({ alertas: await alertas() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
