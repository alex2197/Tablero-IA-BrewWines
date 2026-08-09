# Preguntas para el cliente y datos que faltan

Todo lo de aquí sale de revisar sus Excel al 7 de agosto de 2026. Las cifras
están verificadas y son comprobables contra sus propios archivos.

---

# PARTE 1 — Las preguntas que cambian los números

Estas cinco pueden mover cifras importantes. Vale la pena resolverlas antes de
que alguien tome una decisión con el tablero.

## 1 · ¿Teravino es una empresa relacionada?

**Esta es la pregunta más importante de todas.**

| Dato | Valor |
|---|---|
| Ventas a "TERAVINO" | **$12,994,932** |
| Porcentaje del total | **44.7%** |
| Vendedor asignado | **INTER-CIA** (vende solo a ese cliente) |
| Saldo pendiente | **$5,179,440** |

Un vendedor llamado *Inter-Cía* que le factura exclusivamente a un cliente
llamado *Teravino* tiene toda la pinta de ser **transferencia entre empresas del
mismo grupo**, no venta a un tercero.

Si es así, casi todo el tablero está midiendo dos negocios mezclados:

| | Con Teravino | Sin Teravino |
|---|---|---|
| Ingresos | $29,065,136 | **$16,070,204** |
| Margen bruto | 51.1% | **42.9%** |

**Preguntar:** *"¿Teravino es cliente externo o empresa del grupo? ¿Quieres verlo
junto o separado?"*

**Qué haríamos con la respuesta.** Marcar esas ventas como intercompañía y agregar
un interruptor: ver el negocio consolidado o solo la venta externa. También
sacaría ese saldo de la cartera de riesgo, porque deberse dinero a sí mismo no
es lo mismo que un cliente moroso.

## 2 · La factura BR0015697

7,761 botellas por **$2,165,502** con **0.3% de margen**, el 16 de julio, a
*Happy Wine Happy Life*, registrada por el vendedor **CASA**.

Sin esa factura, julio cerraba en **50.5%** de margen en lugar de 27.6%.

Ese vendedor "CASA" acumula $2,523,235 con **7.2% de margen** — y $2.16M de eso
es esta sola factura.

**Preguntar:** *"¿Qué fue esa venta? ¿Liquidación autorizada, error de precios, o
movimiento entre almacenes que se facturó?"*

## 3 · ¿Dónde están las devoluciones?

En los datos **no hay una sola línea** de `DEVOLUCIONES` ni `NOTA DE CREDITO`,
aunque el Power BI tenía filtros para excluirlas.

Eso significa una de dos: o no se han registrado devoluciones en todo el año, o
se manejan en otro sistema que no está en estos archivos.

**Preguntar:** *"¿Las devoluciones y notas de crédito dónde quedan? ¿Se restan de
la venta o se registran aparte?"*

**Por qué importa:** si existen y no las vemos, las ventas están sobrestimadas y
el margen también.

## 4 · El vehículo usado

Hay una línea de **VEHICULO USADO por $155,172** contada como ingreso.

Infla los ingresos y distorsiona el precio promedio por botella, porque el
sistema lo trata como si fuera un producto más.

**Preguntar:** *"¿Ese tipo de venta debe contar en los ingresos del negocio de
vino, o va aparte?"*

## 5 · La cobranza no cruza con las ventas

| | Facturas |
|---|---|
| En ventas y en cobranza | 1,042 |
| Solo en ventas | **1,472** |
| Solo en cobranza | 507 |

Las 507 que solo están en cobranza son de 2022 a 2025, lo cual tiene sentido.

Pero **1,472 facturas de venta no aparecen en cuentas por cobrar**. O son ventas
de contado que nunca entran a cartera, o el archivo de cobranza está incompleto.

**Preguntar:** *"¿Las ventas de contado entran al reporte de cobranza? Hay 1,472
facturas de venta sin registro de cobranza."*

**Por qué importa:** el DSO y el porcentaje cobrado se calculan sobre bases
distintas y podrían estar mal.

---

# PARTE 2 — Preguntas de criterio

No cambian los números, pero definen qué significan.

## 6 · El umbral de $190

El criterio actual manda a marketing todo lo que salga por debajo de $190 de
precio unitario. De esa partida:

- **$424** son cortesías reales, a $0.81 por botella promedio
- **$671,484** son 4,268 botellas a $166 promedio, que parecen venta económica

**Preguntar:** *"¿El umbral debería ser más bajo? Con $5 en lugar de $190,
separarías las cortesías de la venta de vino económico."*

## 7 · Los almacenes de tránsito y merma

De las 91,338 botellas en inventario:

| Almacén | Botellas |
|---|---|
| Tránsito | 19,599 |
| En Proceso (Almex) | 1,275 |
| Merma | 172 |

**Preguntar:** *"¿Tránsito, En Proceso y Merma cuentan como inventario
disponible, o deben verse aparte?"*

**Por qué importa:** si se cuentan, el inventario disponible está sobrestimado en
más de 21,000 botellas.

## 8 · La cartera muy vieja

La factura más antigua sin cobrar lleva **1,344 días** — casi cuatro años. Hay
**812 facturas** con más de 90 días, por **$3,503,778**.

**Preguntar:** *"¿Hay facturas que ya se dieron por incobrables? ¿A partir de
cuántos días las consideras perdidas?"*

**Qué haríamos:** separar "cartera recuperable" de "incobrable" según su criterio,
y que el DSO se calcule solo sobre la primera.

## 9 · Los clientes suspendidos

De 747 clientes: 488 activos, **215 suspendidos**, 44 morosos.

**Preguntar:** *"¿Un cliente suspendido debe contar en las métricas de retención y
en el conteo de clientes dormidos?"*

Hoy los contamos todos, lo que hace que la "penetración de catálogo" se vea peor
de lo que es.

## 10 · Los canales

CDMX concentra el **93.7%** de la venta. Cancún, Querétaro y Cabos juntos no
llegan al 7%.

**Preguntar:** *"¿Cancún y Querétaro son operaciones nuevas, o llevan tiempo así?
¿Hay meta de crecimiento para esas plazas?"*

Cabos tiene el mejor margen de todos (54.9%) con el menor volumen. Puede ser una
oportunidad o un caso aislado.

---

# PARTE 3 — Datos que faltan y qué desbloquearían

Cada uno es una pestaña o un bloque de métricas que hoy no se puede construir.

## Alto impacto, fácil de conseguir

### Metas de venta
**Qué pedir:** presupuesto mensual por vendedor, canal y línea.

**Qué desbloquea:** gráficas de cumplimiento, semáforos de meta, alertas de
vendedores rezagados a media quincena. Es de lo primero que pide un director
comercial y hoy no existe en ninguno de los dos tableros.

### Comisiones de vendedores
**Qué pedir:** esquema de comisión (porcentaje o tabla por rango).

**Qué desbloquea:** rentabilidad neta por vendedor. Hoy sabemos quién vende más,
pero no quién deja más dinero después de comisión. A veces no son el mismo.

### Términos de crédito por cliente
**Qué pedir:** días de crédito autorizados y límite por cliente.

**Qué desbloquea:** saber si una factura de 45 días está vencida o no —hoy usamos
la fecha de vencimiento del archivo, pero no sabemos el criterio. También
alertas de clientes que superaron su límite.

### Lista de precios por canal
**Qué pedir:** precio autorizado por producto y canal.

**Qué desbloquea:** detectar ventas fuera de política. Con eso, la factura de
$2.1M al costo habría saltado una alerta el mismo día, no un mes después.

## Alto impacto, más trabajo

### Compras y entradas de inventario
**Qué pedir:** órdenes de compra o entradas al almacén con fecha, producto,
cantidad y costo.

**Qué desbloquea:** rotación real de inventario, días de inventario, y detectar
sobrecompra. Hoy sabemos qué no se vende, pero no cuánto tiempo lleva parado ni
cuánto se sigue comprando de eso.

**Es probablemente el dato que más valor agregaría.** Con $3.6M en producto sin
movimiento, saber cuándo entró cambia la conversación.

### Costos operativos
**Qué pedir:** nómina, renta, logística y gastos fijos por mes.

**Qué desbloquea:** margen neto de verdad. Hoy solo tenemos margen bruto. Un
distribuidor con 46% bruto puede estar ganando o perdiendo según su estructura.

### Añadas y caducidad
**Qué pedir:** año de cosecha y, si aplica, fecha límite de venta.

**Qué desbloquea:** alertas de vino próximo a perder valor. En una distribuidora
de vinos con $23M de inventario, esto puede ser dinero real.

## Valiosos, no urgentes

| Dato | Qué desbloquea |
|---|---|
| Ubicación de clientes | Mapa de cobertura, densidad por zona, rutas |
| Pedidos pendientes | Backorder, ventas perdidas por faltante |
| Visitas de vendedores | Efectividad comercial: visitas por venta cerrada |
| Motivo de suspensión | Entender por qué se van los clientes |
| Tipo de establecimiento | Segmentar restaurante vs tienda vs mayorista |

---

# PARTE 4 — Cómo plantear la conversación

**No lleves las diez preguntas de golpe.** Elige tres y guarda el resto.

Mi orden:

1. **Teravino** — porque puede cambiar la mitad de las cifras
2. **La factura BR0015697** — porque es dinero concreto y reciente
3. **Metas de venta** — porque es la pregunta que abre la siguiente venta

Las tres tienen algo en común: **son preguntas, no correcciones**. Estás pidiendo
información para hacer mejor tu trabajo, no señalando errores.

Y las tres demuestran algo que el Power BI no podía demostrar: que alguien revisó
sus datos con cuidado.

### Una frase para abrir

> "Revisando tus datos me quedaron algunas dudas de criterio. No son errores,
> son cosas que necesito entender para que el tablero mida lo que tú quieres
> medir. Son tres."

### Lo que sigue después

Si te dan metas de venta, eso es una pestaña nueva y una razón legítima para
cobrar más. Si te dan compras, es otra.

**Cada dato nuevo es una conversación de expansión**, no solo una mejora técnica.
