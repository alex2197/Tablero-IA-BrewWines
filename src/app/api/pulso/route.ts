import { pulso } from '@/lib/pulso';
import { verificarAcceso, respuestaSinAcceso } from '@/lib/acceso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const acceso = await verificarAcceso();
    if (!acceso.permitido) return respuestaSinAcceso(acceso);
    return Response.json(await pulso());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
