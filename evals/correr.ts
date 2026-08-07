/**
 * Evals de ruteo de herramientas.
 *   npx tsx evals/correr.ts
 *
 * Verifica que cada pregunta dispare las herramientas correctas.
 * Córrelos cada vez que toques el system prompt o una descripción.
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { HERRAMIENTAS } from '../src/lib/herramientas';

const claude = new Anthropic();
const MODELO = 'claude-sonnet-5';

const SISTEMA = `Eres el analista de datos de una distribuidora de vinos en México.
Periodo de datos: 2026-01-01 a 2026-07-17. No existe información fuera de ese rango.
Canales: CDMX, CANCUN, QUERETARO, CABOS.
Nunca inventes cifras: todo número sale de una herramienta.
Cuando el usuario pida ver, mostrar o filtrar, llama también a actualizar_tablero.`;

interface Caso { pregunta: string; espera: string[]; nota?: string }

async function correr(c: Caso) {
  const r = await claude.messages.create({
    model: MODELO,
    max_tokens: 1024,
    system: SISTEMA,
    tools: HERRAMIENTAS,
    messages: [{ role: 'user', content: c.pregunta }],
  });

  const llamadas = r.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    .map(b => b.name);

  const faltantes = c.espera.filter(e => !llamadas.includes(e));
  const ok = c.espera.length === 0
    ? llamadas.length === 0
    : faltantes.length === 0;

  return { ok, llamadas, faltantes };
}

async function main() {
  const casos: Caso[] = JSON.parse(readFileSync('./evals/casos.json', 'utf8'));
  let pasan = 0;

  console.log(`Corriendo ${casos.length} casos contra ${MODELO}\n`);

  for (const c of casos) {
    try {
      const r = await correr(c);
      if (r.ok) { pasan++; console.log(`  PASA  ${c.pregunta}`); }
      else {
        console.log(`  FALLA ${c.pregunta}`);
        console.log(`        esperaba [${c.espera.join(', ')}] · llamó [${r.llamadas.join(', ') || 'ninguna'}]`);
        if (c.nota) console.log(`        nota: ${c.nota}`);
      }
    } catch (e) {
      console.log(`  ERROR ${c.pregunta} — ${(e as Error).message}`);
    }
  }

  const pct = ((pasan / casos.length) * 100).toFixed(0);
  console.log(`\n${pasan}/${casos.length} (${pct}%)`);
  if (pasan < casos.length) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
