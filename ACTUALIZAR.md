# Ajuste — barra en tiempo real y botón de detener

## 1. La barra ya no necesita refresh

**Qué pasaba.** El porcentaje se calculaba en la ruta `/api/cupo`, pero cuando el
chat terminaba una consulta recibía el cupo por otro camino que no lo incluía.
Al no venir el dato, caía a 0 hasta que recargabas la página.

**Qué cambió.** El porcentaje ahora se calcula dentro de `estadoLimite()`, que es
la función que usan todos los caminos. Así el número es el mismo se pida por donde
se pida, y la barra avanza en cuanto termina cada consulta.

## 2. Botón de detener

Mientras la consulta corre, el botón de enviar se convierte en un **cuadro rojo de
detener**. También aparece un enlace *"detener consulta"* debajo del indicador de
actividad, por si el cursor está más cerca de ahí.

### Qué pasa al detener

| Momento | Qué se cobra |
|---|---|
| Antes de que la API responda | **Nada.** Se devuelve la consulta al contador |
| A media respuesta | Solo los tokens que ya se generaron |
| Con herramientas ya ejecutadas | Los tokens de esas llamadas |

El texto que alcanzó a escribirse se conserva, con la nota *"Consulta cancelada"*
al final. Después de cancelar, la barra se relee del servidor para que refleje
exactamente lo consumido.

### Lo que sí y lo que no se puede devolver

**Los tokens ya generados no se devuelven**, porque ya se pagaron a la API. Lo que
sí hace el botón es **cortar la generación** para que deje de gastar de inmediato.

**El conteo de consultas sí se devuelve** si se cancela antes de que la API haya
respondido algo. Es lo justo: no se usó nada.

### Cómo funciona por dentro

El navegador corta la conexión con `AbortController`. El servidor lo detecta en el
`cancel()` del stream, aborta la llamada al modelo, registra los tokens que
alcanzaron a consumirse y, si no hubo ninguna respuesta, devuelve el cupo.

Sin ese `abort` del lado del servidor, el modelo seguiría generando aunque nadie
esté escuchando, y esos tokens se pagarían igual.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Barra en tiempo real y boton de detener"
git push
```

Sin migración.

### Para probar

1. Haz una pregunta y verifica que la barra avance sin recargar
2. Haz otra y toca el cuadro rojo apenas empiece: debe cancelarse y **no** subir
   el contador de consultas
3. Haz una tercera y déjala responder a medias antes de cancelar: ahí sí cuenta,
   porque ya se generaron tokens
