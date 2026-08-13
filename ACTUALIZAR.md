# Ajuste — Pulso sin filtros

Los slicers de mes y categoría se ocultan cuando la vista activa es Pulso.

## Por qué

**La razón de fondo es que el dato no existe.**

La tabla de inventario no tiene columna de fecha: es una fotografía del día, no
una serie histórica. La cartera es igual — `saldo_pendiente` refleja lo que deben
hoy, no lo que debían en junio.

Si Pulso aceptara un filtro de mes:

| Indicador | Qué pasaría |
|---|---|
| Venta del mes | Cambia correctamente |
| Margen bruto | Cambia correctamente |
| Días de cartera | Mezclaría un saldo de hoy con ventas de junio |
| Meses de inventario | **Imposible.** No hay inventario histórico |

Dos de los cuatro indicadores no pueden filtrarse, y no por decisión de diseño
sino porque no existe el dato. Un control que mueve la mitad de los números y
deja la otra mitad quieta confunde más que ayudar.

A eso se suma que los hallazgos de tendencia —clientes en caída, concentración,
cumplimiento de pago— comparan el primer tercio del periodo contra el último.
Filtrados a un mes no se vuelven más precisos: se rompen.

## Qué cambia en pantalla

En Pulso, en lugar de los slicers aparece una línea discreta:

> *panorama del periodo completo · usa las otras pestañas para filtrar*

Los filtros no se pierden: si estabas viendo Cancún en Canales, pasas a Pulso y
regresas, el filtro sigue puesto. Solo se ocultan mientras estás en la vista que
no los usa.

El enlace de **exportar pdf** desde Pulso genera el reporte sin filtros, para que
coincida con lo que se está viendo.

## El asistente también lo sabe

Si preguntan *"¿cómo va Cancún?"* o *"¿y en junio?"*, el chat ya no lleva a Pulso:
va a la pestaña que corresponda con el filtro aplicado.

## Un efecto secundario que me gusta

Al entrar al tablero, lo primero que se ve es una pantalla **sin controles**. No
hay nada que configurar ni que decidir: solo el estado del negocio.

La exploración empieza en la segunda pestaña, cuando el director ya sabe qué
buscar.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Pulso sin filtros"
git push
```

Sin migración.
