import { estadoLimite } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // estadoLimite ya calcula el porcentaje: no se recalcula aquí para que
    // todos los caminos muestren exactamente el mismo número.
    return Response.json(await estadoLimite());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
