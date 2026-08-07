import { alertas } from '@/lib/consultar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ alertas: await alertas() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
