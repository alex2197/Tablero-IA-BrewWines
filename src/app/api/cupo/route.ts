import { estadoLimite } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(await estadoLimite());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
