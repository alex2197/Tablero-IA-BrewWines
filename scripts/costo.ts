/**
 * Reporte de consumo y costo real por cliente.
 *
 *   npm run costo              últimos 30 días
 *   npm run costo 7            últimos 7 días
 *   npm run costo 30 cliente2  otro cliente
 *
 * Los precios NO vienen precargados a propósito: cambian y dependen del
 * modelo que uses. Ponlos en .env con los valores de
 * https://platform.claude.com/docs/en/about-claude/models/overview
 *
 *   PRECIO_ENTRADA_MTOK=3
 *   PRECIO_SALIDA_MTOK=15
 *   PRECIO_CACHE_ESCRITURA_MTOK=3.75
 *   PRECIO_CACHE_LECTURA_MTOK=0.30
 *   TIPO_CAMBIO_USD=20
 *
 * Son dólares por millón de tokens.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DIAS = Number(process.argv[2] ?? 30);
const TENANT = process.argv[3] ?? process.env.TENANT_ID ?? 'brewwines';

const P = {
  entrada: Number(process.env.PRECIO_ENTRADA_MTOK ?? 0),
  salida: Number(process.env.PRECIO_SALIDA_MTOK ?? 0),
  cacheEscritura: Number(process.env.PRECIO_CACHE_ESCRITURA_MTOK ?? 0),
  cacheLectura: Number(process.env.PRECIO_CACHE_LECTURA_MTOK ?? 0),
};
const TC = Number(process.env.TIPO_CAMBIO_USD ?? 20);
const hayPrecios = Object.values(P).some(v => v > 0);

const miles = (n: number) => Math.round(n).toLocaleString('es-MX');
const usd = (n: number) => '$' + n.toFixed(2);
const mxn = (n: number) => '$' + (n * TC).toLocaleString('es-MX', { maximumFractionDigits: 0 });

interface Fila {
  fecha: string; consultas: number; llamadas: number;
  ent: number; sal: number; ce: number; cl: number;
}

const costoDe = (f: { ent: number; sal: number; ce: number; cl: number }) =>
  (f.ent / 1e6) * P.entrada + (f.sal / 1e6) * P.salida +
  (f.ce / 1e6) * P.cacheEscritura + (f.cl / 1e6) * P.cacheLectura;

async function main() {
  const { rows } = await pool.query<Fila>(
    `SELECT fecha::text, consultas, COALESCE(llamadas,0) AS llamadas,
            COALESCE(tok_entrada,0)::bigint         AS ent,
            COALESCE(tok_salida,0)::bigint          AS sal,
            COALESCE(tok_cache_escritura,0)::bigint AS ce,
            COALESCE(tok_cache_lectura,0)::bigint   AS cl
     FROM uso_ia
     WHERE tenant_id = $1
       AND fecha >= (now() AT TIME ZONE 'America/Mexico_City')::date - $2::int
     ORDER BY fecha DESC`,
    [TENANT, DIAS]
  );

  if (!rows.length) {
    console.log(`Sin uso registrado para "${TENANT}" en los últimos ${DIAS} días.`);
    await pool.end();
    return;
  }

  const n = (v: unknown) => Number(v ?? 0);
  const filas = rows.map(r => ({
    ...r, ent: n(r.ent), sal: n(r.sal), ce: n(r.ce), cl: n(r.cl),
  }));

  console.log(`\nConsumo de "${TENANT}" · últimos ${DIAS} días\n`);
  console.log(
    'Fecha'.padEnd(12) + 'Consultas'.padStart(10) + 'Llamadas'.padStart(10) +
    'Entrada'.padStart(11) + 'Salida'.padStart(10) + 'Caché'.padStart(11) +
    (hayPrecios ? 'Costo'.padStart(10) : '')
  );
  console.log('-'.repeat(hayPrecios ? 74 : 64));

  for (const f of filas) {
    console.log(
      f.fecha.padEnd(12) +
      String(f.consultas).padStart(10) +
      String(f.llamadas).padStart(10) +
      miles(f.ent).padStart(11) +
      miles(f.sal).padStart(10) +
      miles(f.ce + f.cl).padStart(11) +
      (hayPrecios ? usd(costoDe(f)).padStart(10) : '')
    );
  }

  const t = filas.reduce((a, f) => ({
    consultas: a.consultas + f.consultas, llamadas: a.llamadas + f.llamadas,
    ent: a.ent + f.ent, sal: a.sal + f.sal, ce: a.ce + f.ce, cl: a.cl + f.cl,
  }), { consultas: 0, llamadas: 0, ent: 0, sal: 0, ce: 0, cl: 0 });

  const diasConUso = filas.length;
  const tokensTot = t.ent + t.sal + t.ce + t.cl;

  console.log('-'.repeat(hayPrecios ? 74 : 64));
  console.log(
    'TOTAL'.padEnd(12) +
    String(t.consultas).padStart(10) + String(t.llamadas).padStart(10) +
    miles(t.ent).padStart(11) + miles(t.sal).padStart(10) + miles(t.ce + t.cl).padStart(11) +
    (hayPrecios ? usd(costoDe(t)).padStart(10) : '')
  );

  console.log(`\nPromedios sobre ${diasConUso} días con actividad:`);
  console.log(`  Consultas por día        ${(t.consultas / diasConUso).toFixed(1)}`);
  console.log(`  Tokens por consulta      ${miles(t.consultas ? tokensTot / t.consultas : 0)}`);
  console.log(`  Llamadas por consulta    ${(t.consultas ? t.llamadas / t.consultas : 0).toFixed(2)}`);
  if (t.ce + t.cl > 0) {
    console.log(`  Ahorro por caché         ${((t.cl / (t.ent + t.cl)) * 100).toFixed(0)}% de la entrada vino de caché`);
  }

  if (!hayPrecios) {
    console.log(`
Para ver costos, agrega los precios a .env (dólares por millón de tokens):

  PRECIO_ENTRADA_MTOK=
  PRECIO_SALIDA_MTOK=
  PRECIO_CACHE_ESCRITURA_MTOK=
  PRECIO_CACHE_LECTURA_MTOK=
  TIPO_CAMBIO_USD=20

Los valores vigentes están en:
  https://platform.claude.com/docs/en/about-claude/models/overview
`);
    await pool.end();
    return;
  }

  const costoTotal = costoDe(t);
  const porConsulta = t.consultas ? costoTotal / t.consultas : 0;
  const porDia = costoTotal / diasConUso;

  console.log(`\nCosto real:`);
  console.log(`  Por consulta             ${usd(porConsulta)}  ≈ ${mxn(porConsulta)} MXN`);
  console.log(`  Por día                  ${usd(porDia)}  ≈ ${mxn(porDia)} MXN`);
  console.log(`  Proyección mensual       ${usd(porDia * 30)}  ≈ ${mxn(porDia * 30)} MXN`);

  console.log(`\nSaldo a cargar en la API:`);
  for (const meses of [1, 3, 6]) {
    // 30% de holgura sobre el promedio observado
    const saldo = porDia * 30 * meses * 1.3;
    console.log(`  ${meses} mes${meses > 1 ? 'es' : ' '}                  ${usd(saldo)}  ≈ ${mxn(saldo)} MXN`);
  }

  console.log(`\nTope diario sugerido (2x el promedio observado):`);
  const tokensDia = tokensTot / diasConUso;
  console.log(`  npm run limite tokens ${Math.round(tokensDia * 2 / 1000) * 1000}`);
  console.log('');

  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
