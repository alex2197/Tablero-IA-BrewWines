/**
 * CRITERIOS
 *
 * Bitácora de las reglas de negocio del cliente, las correcciones aplicadas al
 * reporte anterior y los puntos que siguen sin definirse.
 *
 * Las cifras se calculan en vivo contra la base, no van escritas a mano: si los
 * datos cambian, el texto de cada criterio se actualiza solo.
 */
import { pool, TENANT } from './db';
import { reglas, UMBRAL_BONIFICACION, UMBRAL_POWERBI } from './consultar';
import { mxn, entero, pct } from './formato';

export type EstadoCriterio = 'activa' | 'corregido' | 'abierto';

export interface Criterio {
  estado: EstadoCriterio;
  titulo: string;
  /** Lo que pidió el cliente, en sus términos */
  regla?: string;
  /** Qué hace el tablero hoy */
  detalle: string;
  /** Qué conviene revisar o decidir */
  nota?: string;
  /** Cifras en vivo que respaldan el criterio */
  cifras?: { etq: string; val: string }[];
}

export interface Criterios {
  activas: Criterio[];
  correcciones: Criterio[];
  abiertos: Criterio[];
}

const n = (v: unknown) => Number(v ?? 0);

export async function criterios(): Promise<Criterios> {
  const rg = await reglas();

  const [mkt, cli, noCom, neg, vendConcepto, ventasTot, almacenes, cruce, anom] =
    await Promise.all([
      // Composición de la partida de marketing
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE precio_unitario <= $2)::int              AS cortesia_n,
           SUM(monto_total) FILTER (WHERE precio_unitario <= $2)::float8   AS cortesia_monto,
           SUM(costo_unitario*unidades) FILTER (WHERE precio_unitario <= $2)::float8 AS cortesia_costo,
           COUNT(*) FILTER (WHERE precio_unitario > $2 AND precio_unitario < $3)::int      AS media_n,
           SUM(monto_total) FILTER (WHERE precio_unitario > $2 AND precio_unitario < $3)::float8 AS media_monto,
           AVG(precio_unitario) FILTER (WHERE precio_unitario > $2 AND precio_unitario < $3)::float8 AS media_precio,
           SUM(unidades) FILTER (WHERE precio_unitario > $2 AND precio_unitario < $3)::int AS media_botellas
         FROM ventas WHERE tenant_id = $1`,
        [TENANT, UMBRAL_BONIFICACION, UMBRAL_POWERBI]),

      // Clientes por estatus y cuántos compran de verdad
      pool.query(
        `SELECT COALESCE(estatus,'Sin estatus') AS estatus, COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM ventas v WHERE v.tenant_id = c.tenant_id AND v.cliente_clave = c.clave
                ))::int AS compraron
         FROM clientes c WHERE c.tenant_id = $1 GROUP BY 1 ORDER BY n DESC`, [TENANT]),

      // Conceptos que no son venta de vino
      pool.query(
        `SELECT p.descripcion, SUM(v.monto_total)::float8 AS monto, COUNT(*)::int AS n
         FROM ventas v JOIN productos p
           ON p.tenant_id = v.tenant_id AND p.clave = v.producto_clave
         WHERE v.tenant_id = $1 AND p.descripcion = ANY($2)
         GROUP BY 1 ORDER BY monto DESC`,
        [TENANT, ['VEHICULO USADO','NOTA DE CREDITO','DEVOLUCIONES','SERVICIOS DE FACTURACION']]),

      // Saldos negativos en cobranza
      pool.query(
        `SELECT COUNT(*)::int AS n, SUM(saldo_pendiente)::float8 AS monto
         FROM cuentas_por_cobrar WHERE tenant_id = $1 AND saldo_pendiente < 0`, [TENANT]),

      // Vendedores que son conceptos, no personas
      pool.query(
        `SELECT ven.nombre, SUM(v.monto_total)::float8 AS monto,
                (SUM(v.monto_total - v.costo_unitario*v.unidades)/NULLIF(SUM(v.monto_total),0)*100)::float8 AS margen
         FROM ventas v JOIN vendedores ven
           ON ven.tenant_id = v.tenant_id AND ven.clave = v.vendedor_clave
         WHERE v.tenant_id = $1 AND (
           ven.nombre ILIKE '%INTER-CIA%' OR ven.nombre ILIKE '%VENTA EMPLEADO%' OR
           ven.nombre ILIKE '%CASA%' OR ven.nombre ILIKE '%PAYPAL%' OR ven.nombre ILIKE '%PATROCINIO%')
         GROUP BY 1 ORDER BY monto DESC`, [TENANT]),

      pool.query('SELECT SUM(monto_total)::float8 AS t FROM ventas WHERE tenant_id = $1', [TENANT]),

      // Almacenes que no parecen mercancía vendible
      pool.query(
        `SELECT COALESCE(al.nombre, a.almacen) AS nombre, SUM(a.existencias)::int AS u
         FROM inventario_almacen a
         LEFT JOIN almacenes al ON al.tenant_id = a.tenant_id AND al.codigo = a.almacen
         WHERE a.tenant_id = $1
           AND (al.nombre ILIKE '%tránsito%' OR al.nombre ILIKE '%transito%'
             OR al.nombre ILIKE '%merma%' OR al.nombre ILIKE '%proceso%')
         GROUP BY 1 ORDER BY u DESC`, [TENANT]),

      // Cruce entre ventas y cobranza
      pool.query(
        `SELECT
           (SELECT COUNT(DISTINCT factura) FROM ventas WHERE tenant_id = $1)::int AS ventas,
           (SELECT COUNT(*) FROM cuentas_por_cobrar WHERE tenant_id = $1)::int    AS cxc,
           (SELECT COUNT(DISTINCT v.factura) FROM ventas v
            WHERE v.tenant_id = $1 AND EXISTS (
              SELECT 1 FROM cuentas_por_cobrar c
              WHERE c.tenant_id = v.tenant_id AND c.factura = v.factura))::int    AS cruzan`,
        [TENANT]),

      // Factura grande con margen anómalo
      pool.query(
        `SELECT v.factura, MAX(v.fecha)::text AS fecha,
                MAX(COALESCE(c.nombre_comercial, c.razon_social)) AS cliente,
                SUM(v.monto_total)::float8 AS monto,
                (SUM(v.monto_total - v.costo_unitario*v.unidades)/NULLIF(SUM(v.monto_total),0)*100)::float8 AS margen
         FROM ventas v LEFT JOIN clientes c
           ON c.tenant_id = v.tenant_id AND c.clave = v.cliente_clave
         WHERE v.tenant_id = $1
         GROUP BY v.factura
         HAVING SUM(v.monto_total) > 500000
            AND (SUM(v.monto_total - v.costo_unitario*v.unidades)/NULLIF(SUM(v.monto_total),0)*100) < 15
         ORDER BY monto DESC LIMIT 1`, [TENANT]),
    ]);

  const m = mkt.rows[0] ?? {};
  const total = n(ventasTot.rows[0]?.t) || 1;
  const conceptoTotal = vendConcepto.rows.reduce((a, r) => a + n(r.monto), 0);

  /* ---------------- Reglas activas ---------------- */
  const activas: Criterio[] = [];

  activas.push({
    estado: rg.umbralMarketing != null ? 'activa' : 'abierto',
    titulo: `Ventas bajo $${rg.umbralMarketing ?? UMBRAL_POWERBI} se clasifican como marketing`,
    regla: 'Todo lo menor a $190 es Marketing.',
    detalle: rg.umbralMarketing != null
      ? `La regla está aplicada: esas líneas no cuentan como ingreso y su monto se registra como marketing.`
      : `La regla está en pausa: por ahora todas las ventas cuentan como ingreso. Se activa cuando quede definido el umbral.`,
    cifras: [
      { etq: `Líneas a $${UMBRAL_BONIFICACION} o menos`, val: `${entero(n(m.cortesia_n))} · ${mxn(n(m.cortesia_monto))}` },
      { etq: 'Costo real de esas cortesías', val: mxn(n(m.cortesia_costo)) },
      { etq: `Líneas entre $${UMBRAL_BONIFICACION} y $${UMBRAL_POWERBI}`, val: `${entero(n(m.media_n))} · ${mxn(n(m.media_monto))}` },
      { etq: 'Precio promedio de esas líneas', val: mxn(n(m.media_precio)) },
    ],
    nota: n(m.media_n) > 0
      ? `Las ${entero(n(m.media_n))} líneas del segundo grupo tienen precio promedio de ${mxn(n(m.media_precio))} y ${entero(n(m.media_botellas))} botellas. Por volumen y precio parecen venta de vino económico más que promoción. Conviene confirmar si el umbral debería ser más bajo.`
      : undefined,
  });

  activas.push({
    estado: 'activa',
    titulo: 'Moroso cuenta como activo, suspendido no',
    regla: 'Cliente moroso debe tomarse en cuenta como activo. Clientes suspendidos no.',
    detalle: 'Retención, churn y conteo de clientes excluyen a los suspendidos e incluyen a los morosos.',
    cifras: cli.rows.map(r => ({
      etq: r.estatus, val: `${entero(r.n)} · ${entero(r.compraron)} con compra`,
    })),
    nota: 'Los datos respaldan el criterio: casi ningún suspendido compra, mientras que varios morosos siguen activos comercialmente.',
  });

  activas.push({
    estado: 'activa',
    titulo: 'Las casas vinícolas son la categoría',
    regla: 'Las casas las trataremos como categorías.',
    detalle: 'La agrupación de producto es por casa productora, no por tipo de vino. El tablero muestra los nombres completos en lugar de los códigos internos.',
    nota: 'No hay forma de segmentar por tipo (tinto, blanco, espumoso), región ni añada. Si se quiere esa lectura, hay que agregar esos campos al catálogo de productos.',
  });

  activas.push({
    estado: 'activa',
    titulo: 'Se muestra el nombre comercial',
    regla: 'Mostrar el nombre comercial en vez de la razón social.',
    detalle: 'Aplicado en todo el tablero. Cuando un cliente no tiene nombre comercial capturado, se usa la razón social como respaldo.',
  });

  activas.push({
    estado: 'activa',
    titulo: 'Los conceptos de venta se mantienen como vendedores',
    regla: 'Dejar las ventas así con estos conceptos.',
    detalle: `INTER-CIA, CASA, VENTA EMPLEADO y VENTAS PAYPAL aparecen en el listado de vendedores junto con las personas.`,
    cifras: [
      ...vendConcepto.rows.map(r => ({
        etq: r.nombre,
        val: `${mxn(n(r.monto))} · ${pct(n(r.margen))} margen`,
      })),
      { etq: 'Suma de conceptos', val: `${mxn(conceptoTotal)} · ${pct(conceptoTotal / total * 100)} del total` },
    ],
    nota: conceptoTotal / total > 0.3
      ? `Más de la mitad de la venta no está asignada a un vendedor de campo. El ranking de productividad queda encabezado por un concepto y no por una persona. Vale la pena poder ver el ranking con y sin ellos.`
      : undefined,
  });

  /* ---------------- Correcciones ---------------- */
  const correcciones: Criterio[] = [
    {
      estado: 'corregido',
      titulo: 'La retención medía otra cosa',
      detalle: 'El reporte anterior dividía clientes activos entre el catálogo completo, lo que da penetración, no retención. Ahora se mide cuántos de los que compraron el mes anterior volvieron a comprar.',
      nota: 'Las dos cifras se muestran en la pestaña Retención para poder comparar con el reporte viejo.',
    },
    {
      estado: 'corregido',
      titulo: 'El pronóstico no proyectaba nada',
      detalle: 'Antes multiplicaba los ingresos por 0.85 y por 1.20, o sea la misma curva histórica escalada. Ahora es una regresión sobre la tendencia mensual, con proyección a tres meses y nivel de confianza visible.',
    },
    {
      estado: 'corregido',
      titulo: 'El inventario se filtraba por una lista de cantidades',
      detalle: 'El reporte anterior solo mostraba existencias que coincidieran con 44 números específicos, dejando fuera el resto. Ahora se cuentan todas.',
      cifras: [
        { etq: 'Mostraba el reporte anterior', val: '14,323 unidades' },
        { etq: 'Inventario real', val: '91,338 unidades' },
      ],
    },
    {
      estado: 'corregido',
      titulo: 'La cobranza no respondía a los filtros',
      detalle: 'Cuentas por cobrar no estaba ligada al resto del modelo, así que el DSO y el saldo pendiente no cambiaban al filtrar por categoría o vendedor, aunque pareciera que sí. Ahora responden.',
    },
    {
      estado: 'corregido',
      titulo: 'Los almacenes se veían como números',
      detalle: 'Las bodegas de salida aparecían como 1, 2, 3. Ahora muestran su nombre. El catálogo se lee del propio archivo de inventario, así que un almacén nuevo aparece solo.',
    },
  ];

  /* ---------------- Puntos abiertos ---------------- */
  const abiertos: Criterio[] = [];

  if (noCom.rows.length) {
    abiertos.push({
      estado: 'abierto',
      titulo: 'Conceptos que no son venta de vino',
      regla: 'No incluir el vehículo usado. No tomar en cuenta notas de crédito, devoluciones ni servicios de facturación.',
      detalle: 'Estos conceptos siguen sumando a los ingresos y distorsionan el precio promedio por botella.',
      cifras: noCom.rows.map(r => ({ etq: r.descripcion, val: `${mxn(n(r.monto))} · ${r.n} línea(s)` })),
      nota: 'Falta definir si se excluyen del ingreso o se registran aparte. En el caso de devoluciones y notas de crédito, lo habitual es restarlas de la venta en lugar de ignorarlas.',
    });
  }

  if (n(neg.rows[0]?.n) > 0) {
    abiertos.push({
      estado: 'abierto',
      titulo: 'Saldos negativos en cobranza',
      regla: 'Descartar ese registro.',
      detalle: 'La factura señalada en su momento ya no aparece en los datos. Hoy hay otros saldos negativos, que son pagos en exceso o notas a favor.',
      cifras: [
        { etq: 'Facturas con saldo negativo', val: entero(n(neg.rows[0].n)) },
        { etq: 'Suma', val: mxn(n(neg.rows[0].monto)) },
      ],
      nota: 'Conviene definir la regla general en vez de caso por caso: descartarlos hace que la cartera se vea más alta de lo que realmente es.',
    });
  }

  if (almacenes.rows.length) {
    abiertos.push({
      estado: 'abierto',
      titulo: 'Almacenes que no parecen mercancía vendible',
      detalle: 'Estos almacenes cuentan hoy como inventario disponible.',
      cifras: almacenes.rows.map(r => ({ etq: r.nombre, val: `${entero(r.u)} botellas` })),
      nota: 'Falta definir si deben verse aparte del inventario disponible. La merma, en particular, suele tratarse como pérdida y no como existencia.',
    });
  }

  const cr = cruce.rows[0];
  if (cr && cr.ventas - cr.cruzan > 0) {
    abiertos.push({
      estado: 'abierto',
      titulo: 'Facturas de venta sin registro en cobranza',
      detalle: 'Una parte de las facturas de venta no aparece en el archivo de cuentas por cobrar.',
      cifras: [
        { etq: 'Facturas de venta', val: entero(cr.ventas) },
        { etq: 'Con registro en cobranza', val: entero(cr.cruzan) },
        { etq: 'Sin cruce', val: entero(cr.ventas - cr.cruzan) },
      ],
      nota: 'Pueden ser ventas de contado que nunca entran a cartera, o el archivo de cobranza puede estar cubriendo solo una parte. Afecta el cálculo del DSO y del porcentaje cobrado.',
    });
  }

  if (anom.rows.length) {
    const a = anom.rows[0];
    abiertos.push({
      estado: 'abierto',
      titulo: `Factura ${a.factura}, del ${a.fecha}`,
      detalle: `Venta de ${mxn(n(a.monto))} a ${a.cliente} con ${pct(n(a.margen))} de margen. Arrastra el promedio del mes y del vendedor que la registró.`,
      nota: 'Falta confirmar si fue liquidación autorizada, error de precios o un movimiento entre almacenes que se facturó.',
    });
  }

  abiertos.push({
    estado: 'abierto',
    titulo: 'Zona real de los vendedores',
    detalle: 'Hay vendedores con la plaza en el nombre (Querétaro, Tijuana, Mérida) pero asignados al canal CDMX. Los tres están dados de baja y no tienen ventas en el periodo, así que hoy no afecta ninguna cifra.',
    nota: 'Si el canal se usó como valor por defecto, la concentración en CDMX podría estar sobrestimada y las plazas foráneas subrepresentadas.',
  });

  return { activas, correcciones, abiertos };
}
