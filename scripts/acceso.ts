/**
 * Interruptor de acceso por cliente.
 *
 *   npm run acceso                      ver estado de todos los clientes
 *   npm run acceso prueba 14            activar prueba de 14 días
 *   npm run acceso activar              acceso completo, sin vencimiento
 *   npm run acceso suspender            cortar acceso
 *   npm run acceso extender 7           agregar 7 días a la prueba actual
 *   npm run acceso contacto "Alex · 55 1234 5678"
 *
 * Cualquiera acepta el tenant como último argumento:
 *   npm run acceso suspender cliente2
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const [accion, arg] = process.argv.slice(2);
const POR_DEFECTO = process.env.TENANT_ID ?? 'brewwines';

/** El último argumento es el tenant si no es un número ni parte del comando. */
function tenantDe(): string {
  const args = process.argv.slice(2);
  const ultimo = args[args.length - 1];
  if (!ultimo || ultimo === accion) return POR_DEFECTO;
  if (!isNaN(Number(ultimo))) return POR_DEFECTO;
  if (args.length >= 3) return ultimo;
  return POR_DEFECTO;
}
const TENANT = tenantDe();

const hoyMx = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

async function estado() {
  const { rows } = await pool.query(
    `SELECT id, nombre, COALESCE(estado,'activo') AS estado, vence::text AS vence,
            contacto, COALESCE(limite_ia_diario, 50) AS limite
     FROM tenants ORDER BY id`
  );
  console.log(
    'Cliente'.padEnd(16) + 'Estado'.padEnd(13) + 'Vence'.padEnd(13) +
    'Días'.padStart(6) + '  IA/día'
  );
  console.log('-'.repeat(58));
  for (const r of rows) {
    const dias = r.vence
      ? Math.ceil((Date.parse(r.vence) - Date.parse(hoyMx())) / 86_400_000)
      : null;
    const etiqueta = r.estado === 'prueba' && dias !== null && dias < 0 ? 'VENCIDO' : r.estado;
    console.log(
      String(r.id).slice(0, 15).padEnd(16) +
      etiqueta.padEnd(13) +
      (r.vence ?? '—').padEnd(13) +
      (dias === null ? '—' : String(dias)).padStart(6) +
      '  ' + r.limite
    );
  }
  if (rows.some(r => r.contacto)) {
    console.log('\nContacto configurado:');
    for (const r of rows.filter(x => x.contacto)) console.log(`  ${r.id}: ${r.contacto}`);
  }
}

async function main() {
  switch (accion) {
    case undefined:
      break;

    case 'prueba': {
      const dias = Number(arg);
      if (!Number.isInteger(dias) || dias < 1) throw new Error('Indica los días: npm run acceso prueba 14');
      const { rowCount } = await pool.query(
        `UPDATE tenants SET estado = 'prueba',
                vence = ((now() AT TIME ZONE 'America/Mexico_City')::date + $1::int)
         WHERE id = $2`, [dias, TENANT]);
      if (!rowCount) throw new Error(`No existe el cliente "${TENANT}"`);
      console.log(`"${TENANT}" en prueba por ${dias} días.\n`);
      break;
    }

    case 'extender': {
      const dias = Number(arg);
      if (!Number.isInteger(dias) || dias < 1) throw new Error('Indica los días: npm run acceso extender 7');
      await pool.query(
        `UPDATE tenants
         SET estado = 'prueba',
             vence = GREATEST(COALESCE(vence, (now() AT TIME ZONE 'America/Mexico_City')::date),
                              (now() AT TIME ZONE 'America/Mexico_City')::date) + $1::int
         WHERE id = $2`, [dias, TENANT]);
      console.log(`Prueba de "${TENANT}" extendida ${dias} días.\n`);
      break;
    }

    case 'activar':
      await pool.query(
        `UPDATE tenants SET estado = 'activo', vence = NULL WHERE id = $1`, [TENANT]);
      console.log(`"${TENANT}" activo, sin vencimiento.\n`);
      break;

    case 'suspender':
      await pool.query(`UPDATE tenants SET estado = 'suspendido' WHERE id = $1`, [TENANT]);
      console.log(`"${TENANT}" suspendido. Los datos se conservan.\n`);
      break;

    case 'contacto':
      if (!arg) throw new Error('Indica el texto: npm run acceso contacto "Alex · 55 1234 5678"');
      await pool.query(`UPDATE tenants SET contacto = $1 WHERE id = $2`, [arg, TENANT]);
      console.log(`Contacto de "${TENANT}" actualizado.\n`);
      break;

    default:
      throw new Error(`Acción desconocida: ${accion}. Usa prueba, extender, activar, suspender o contacto.`);
  }

  await estado();
  await pool.end();
}

main().catch(e => { console.error('\n' + e.message); process.exit(1); });
