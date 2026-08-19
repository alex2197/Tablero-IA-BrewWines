# Corrección — el archivo de inventario cambió de estructura

## Qué pasó

El nuevo `Inventario.xlsx` viene distinto al anterior en cuatro cosas:

| | Antes | Ahora |
|---|---|---|
| Hoja | `INVENTARIO` | `COST_PRICE-GRAL (i)` |
| Encabezados | fila 1 | **fila 2** (arriba hay una fila de totales) |
| Columna de clave | `Clave de producto` | `Clave` |
| Columna de existencias | `Existencias` | `EXISTENCIAS` |

Cada uno por separado rompe la carga. Los cuatro juntos explican el
*"0 de 402 filas pasaron la validación"*.

## Qué se corrigió

En lugar de parchar los cuatro nombres, hice el ETL resistente a este tipo de
cambios:

**Búsqueda de hoja por fragmento.** Si no encuentra `INVENTARIO`, busca hojas que
contengan `inventario`, `cost_price` o `existencias` antes de rendirse.

**Detección de la fila de encabezados.** Ya no asume que es la primera. Busca la
fila que contenga una columna conocida —en este caso `LINEA`— dentro de las
primeras doce. Si el archivo trae totales, títulos o filas en blanco arriba, los
salta solo.

**Nombres de columna alternativos.** `Clave de producto` o `Clave`. `Existencias`
o `EXISTENCIAS` o, como respaldo, `SUMA`.

Sumado a la tolerancia de espacios y acentos que ya tenía, ahora aguanta la
mayoría de los cambios cosméticos sin tocar código.

**Los nombres de almacén también se ajustan.** Se leen de la fila siguiente a los
encabezados, sea cual sea, en lugar de la fila 2 fija.

## Verificado con el archivo nuevo

```
inventario     400 filas
  existencias:  89,452
  valor:       $23,270,048
  almacenes:   602 registros en 13 almacenes

ventas       $29,065,136
cartera      $16,922,534
```

Las 89,452 existencias coinciden con el total que trae la propia columna del
Excel.

Aparecieron dos almacenes que antes no tenían existencias: **La Comer Cajas** (24
botellas) y una redistribución entre Almex y Departamentales.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "ETL tolerante a cambios de estructura en el inventario"
git push
```

Después de desplegar, vuelve a intentar la carga desde *actualizar datos*.

Vas a ver este aviso, que es informativo y correcto:

> *Usé la hoja "COST_PRICE-GRAL (i)" porque no encontré "INVENTARIO".*

## Recomendación para el cliente

Vale la pena pedirles que **mantengan estable el nombre de la hoja y de las
columnas**. El sistema ya aguanta bastante variación, pero si un día cambian algo
que no anticipé, la carga vuelve a fallar.

Una frase simple: *"el archivo puede traer los datos que sea, pero la hoja y los
títulos de columna conviene que no cambien de nombre"*.
