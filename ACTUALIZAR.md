# Ajuste — pestaña de Criterios

Una bitácora dentro del tablero con las reglas del negocio, lo que se corrigió y
lo que sigue abierto. Visible para el cliente, sin necesidad de mandarle un
documento aparte.

## Tres bloques

### Reglas del negocio
Lo que ellos definieron, citado en sus propias palabras, con lo que hace el
tablero hoy:

- Ventas bajo $190 como marketing
- Moroso cuenta como activo, suspendido no
- Las casas vinícolas son la categoría
- Se muestra el nombre comercial
- Los conceptos de venta se mantienen como vendedores

### Correcciones
Diferencias con el reporte anterior, para cuando una cifra no coincida:

- La retención medía penetración de catálogo
- El pronóstico no proyectaba meses futuros
- El inventario se filtraba por una lista de cantidades
- La cobranza no respondía a los filtros
- Los almacenes se veían como números

### Por definir
Puntos abiertos, con la nota de que mientras tanto se muestra el dato completo:

- Conceptos que no son venta de vino
- Saldos negativos en cobranza
- Almacenes de tránsito, proceso y merma
- Facturas de venta sin registro en cobranza
- La factura grande con margen anómalo
- Zona real de los vendedores

## Las cifras se calculan solas

Nada está escrito a mano. Cada criterio consulta la base al abrirse, así que si
los datos cambian el texto se actualiza. Por ejemplo, el criterio de clientes
muestra cuántos hay de cada estatus y cuántos de ellos compraron de verdad.

Si un punto abierto se resuelve —por ejemplo, si dejan de existir saldos
negativos— la tarjeta desaparece sola.

## El asistente la conoce

Si preguntan *"¿por qué esta cifra no cuadra con mi reporte anterior?"* o
*"¿cómo calculas el margen?"*, el chat los lleva a esa pestaña.

## Por qué conviene tenerla

Un tablero que explica sus propios criterios se defiende solo. Cuando alguien del
equipo cuestione un número en una junta, la respuesta está ahí y no depende de
que tú estés presente.

Y los puntos abiertos funcionan como recordatorio permanente: cada vez que
alguien entra, ve lo que falta definir.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Pestana de criterios"
git push
```

Sin migración.
