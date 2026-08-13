# Corrección — el valor del inventario salía en cero

## Qué pasaba

El encabezado de la columna de costo en `Inventario.xlsx` es **`" COSTO "` con
espacios alrededor**, no `"COSTO"`. El ETL buscaba el nombre exacto, no lo
encontraba, y cargaba `null` en todas las filas.

Las existencias sí cargaban (89,589 botellas). Lo que faltaba era el costo, y sin
él el valor del inventario daba $0 y los meses de cobertura 0.0.

## Qué se corrigió

**La lectura de encabezados ahora tolera espacios, acentos y mayúsculas.**

Antes buscaba coincidencia exacta. Ahora `" COSTO "`, `"Costo"` y `"COSTO"` se
resuelven igual. Aplica a todas las columnas de todos los archivos, así que un
cambio cosmético en cualquier Excel deja de romper la carga.

**Aviso en la validación.** Si una columna numérica llega vacía en todas las
filas, la pantalla de carga lo señala antes de confirmar:

> *La columna "costo" llegó vacía en todas las filas. Revisa que el encabezado
> del Excel no haya cambiado.*

Eso convierte un error silencioso en uno visible.

**Los ceros ya no se muestran como cifra buena.** Si el inventario o la cartera
vienen en cero, Pulso muestra `—` con la nota *"sin inventario cargado"* en lugar
de `0.0 meses`. Un cero que parece dato real es peor que decir que falta
información.

## Verificado con tus archivos

```
inventario     400 filas
  existencias: 89,589
  valor:       $23,228,673
  almacenes:   594 registros en 15 almacenes

ventas      $29,065,136
cartera     $16,922,534
```

Ventas y cobranza no cambiaron: el problema era exclusivo del inventario.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Corrige lectura de encabezados con espacios"
git push
```

**Después de desplegar, recarga los datos** desde *actualizar datos*. Sin eso el
costo sigue en null en la base.

### Qué debe cambiar en Pulso

| Ahora | Después |
|---|---|
| 0.0 meses · $0 en stock | **10.7 meses · $23,228,673** |
| 5 hallazgos | **6 hallazgos** |

El hallazgo nuevo es *"$17.2M en inventario con más de un año de cobertura"*, que
es de los más fuertes que tienes.

Revisa también **Operativos**: el valor de inventario debe salir en $23.2M.
