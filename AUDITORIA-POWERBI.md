# Auditoría completa del Power BI

Revisión del código Power Query, las 34 medidas DAX, el modelo de relaciones y
los 73 visuales del `Dashboard.pbix`. Ocho hallazgos, ordenados por impacto.

Todas las cifras están verificadas contra los Excel al 7 de agosto de 2026.

---

## 1 · El filtro de precio saca ventas del reporte y las vuelve gasto

**Severidad: crítica.**

En la consulta de `Ventas`:

```m
Table.SelectRows(#"Texto recortado", each [Precio unitario de venta] >= 190)
```

Y en la de `Marketing`, sobre el mismo archivo:

```m
Table.SelectRows(#"Texto recortado", each [Precio unitario de venta] < 190)
...
Table.Group(..., {"Monto Invertido", each List.Sum([Monto total de venta])})
```

Toda línea con precio unitario menor a $190 **desaparece de las ventas** y su
monto **se suma como gasto de marketing**.

### El umbral mezcla dos cosas distintas

| | Líneas | Botellas | Venta | Costo |
|---|---|---|---|---|
| Cortesías (precio ≤ $5) | 389 | 524 | $424 | **$85,082** |
| Venta económica ($5 a $190) | 121 | 4,268 | **$671,484** | $517,864 |

Las primeras son promoción real: precio promedio de **$0.81** por botella.

Las segundas tienen precio promedio de **$166** y volumen real. Entre ellas hay
una venta de **Benvolio Pinot Grigio por $146,304** que el reporte no muestra.

### El doble error

1. Se restan $671,484 de ingresos reales
2. Se suman $671,908 de gasto que no existe

El gasto verdadero del muestreo es el **costo** de las botellas regaladas:
**$85,082**. No su precio de venta, y desde luego no el de las ventas legítimas.

**Corregido:** el tablero cuenta todas las ventas como ingreso y mide aparte el
*costo de muestreo comercial*. Si el cliente insiste en su criterio, el umbral se
puede activar con `npm run regla 190` y el tablero se comporta como el Power BI,
con un aviso permanente que lo explica.

## 2 · El inventario se filtra por una lista de 44 números

**Severidad: crítica.**

```m
Table.SelectRows(..., each ... and (
  [Valor] = 10 or [Valor] = 20 or [Valor] = 30 or ... or [Valor] = 2250
))
```

Cualquier existencia que no sea exactamente uno de esos 44 valores desaparece.

| | Power BI | Real |
|---|---|---|
| Registros | 74 | **594** |
| Unidades | 14,323 | **91,338** |

**Está viendo el 16% de su inventario.** Y empeora con cada actualización: las
cantidades cambian al comprar y vender, y las nuevas casi nunca coinciden con la
lista.

**Corregido:** se cargan todas las existencias con cantidad mayor a cero.

---

## 3 · La retención mide otra cosa

**Severidad: alta.**

```dax
Tasa Retencion = DIVIDE([Clientes Activos], [Clientes Totales])
Tasa Churn = 1 - [Tasa Retencion]
```

Eso es **penetración de catálogo**, no retención. Con 280 activos de 747 marcaba
~37% de retención y **63% de churn** — una cifra alarmante y falsa.

**Corregido:** de los clientes que compraron el mes anterior, cuántos volvieron a
comprar. Las dos cifras se muestran para poder comparar.

---

## 4 · El forecast no proyecta nada

**Severidad: alta.**

```dax
Proy Conservadora = [Ingresos Totales] * 0.85
Proy Optimista    = [Ingresos Totales] * 1.20
```

Las tres líneas del gráfico son la misma curva histórica escalada. No predice
ningún mes futuro.

**Corregido:** regresión lineal sobre la tendencia mensual, con R² visible, banda
de confianza sobre el error histórico y proyección a tres meses reales. El último
mes se excluye del cálculo si está incompleto.

---

## 5 · Cuentas por cobrar no está relacionada al modelo

**Severidad: alta.**

Las relaciones son Ventas→Clientes, Ventas→Productos, Ventas→Vendedores e
Inventario→Productos. `CuentasPorCobrar` **no tiene ninguna**.

`DSO` y `Saldo Pendiente` ignoran los filtros de categoría y vendedor. El usuario
filtra, los números no cambian, y parece que sí filtraron.

**Corregido:** las métricas de cobranza reciben los mismos filtros que el resto.

---

## 6 · Los saldos negativos se descartan

**Severidad: media.**

```m
Table.SelectRows(#"Tipo cambiado", each [Saldo pendiente] >= 0)
```

Hay 3 facturas con saldo negativo por **−$16,672**, que son pagos en exceso o
notas a favor. Al excluirlas, la cartera queda sobrestimada por ese monto.

**Corregido:** se incluyen, así el saldo neto es correcto.

---

## 7 · Conceptos que no son venta de vino suman a los ingresos

**Severidad: media.**

`Ventas` excluye por descripción: `VEHICULO USADO`, `NOTA DE CREDITO`,
`DEVOLUCIONES` y `SERVICIOS DE FACTURACION`.

Excluir devoluciones y notas de crédito **es un error contable**: significa que
las ventas nunca se netean. En estos datos no hay líneas de ese tipo, así que hoy
no afecta, pero en cuanto aparezca una devolución quedará invisible.

Sí existe **VEHICULO USADO por $155,172** en una sola línea. Incluirlo infla los
ingresos y distorsiona el precio promedio por botella.

**Corregido:** no se filtra nada en silencio. El tablero muestra una alerta con el
monto de estos conceptos para que el cliente decida cómo tratarlos.

---

## 8 · Riesgos latentes

Cosas que hoy no rompen nada pero van a fallar.

**Vendedores filtrados por estatus.**
```m
Table.SelectRows(..., each ([Estatus del Vendedor] = "Activo"))
```
Hay 11 de 30 vendedores dados de baja. Hoy ninguno tiene ventas registradas, así
que no se nota. El día que den de baja a alguien con historial, sus ventas
pierden el nombre del vendedor.
**Corregido:** el catálogo se carga completo.

**Renombrado de bodegas por reemplazo de texto.**
Se usa `Replacer.ReplaceText`, que sustituye subcadenas, no valores exactos, en 13
pasos encadenados. Funciona solo porque el orden es de 13 hacia 1 y ningún nombre
resultante contiene los dígitos pendientes. Agregar una bodega nueva o cambiar un
nombre puede corromper la columna.
**Corregido:** catálogo con código y nombre, resuelto por llave.

**Periodo de marketing sin cero a la izquierda.**
```m
Text.From(Date.Month([Fecha de factura])) & "/" & Text.From(Date.Year(...))
```
Genera `7/2026` y `10/2026`. Al ordenar como texto, octubre queda antes que julio.
**Corregido:** formato `YYYY-MM`, que ordena bien siempre.

**Rutas absolutas al disco de una persona.**
Las seis consultas apuntan a `C:\Users\Dell\OneDrive\...`. El reporte solo se
puede actualizar desde esa máquina, con esa carpeta, con esos nombres de archivo.
**Corregido:** el cliente sube sus archivos desde el navegador.

---

## Resumen del impacto

| Concepto | Power BI | Corregido | Diferencia |
|---|---|---|---|
| Ingresos del periodo | $28,238,056 | **$29,065,136** | +$827,080 |
| Inventario (unidades) | 14,323 | **91,338** | +77,015 |
| Cartera | sobrestimada | neta | −$16,672 |
| Gasto de marketing | $671,908 | **$85,082** | −$586,826 |
| Churn mensual | 63% | recompra real | — |
| Proyección | la misma curva escalada | regresión con R² | — |
| Cobranza con filtros | no respondía | responde | — |
| Conceptos no comerciales | ocultos | visibles con alerta | — |
