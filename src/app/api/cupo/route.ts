import { estadoLimite } from '@/lib/limite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const e = await estadoLimite();

    // Porcentaje de consumo del día: el mayor de los dos topes.
    const pctConsultas = e.limite ? (e.usadas / e.limite) * 100 : 0;
    const pctTokens = e.tokensMax ? ((e.tokensHoy ?? 0) / e.tokensMax) * 100 : 0;
    const pct = Math.min(100, Math.round(Math.max(pctConsultas, pctTokens)));

    return Response.json({ ...e, pct });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
