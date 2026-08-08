# Ajuste — presupuesto en pesos y barra de consumo

## Lo que pediste, resuelto

**Tú defines cuánto quieres gastar al día. El sistema lo convierte a tokens,
apaga el chat cuando se agota, y el cliente ve una barra de cuánto lleva.**

---

## 1. Definir el presupuesto en pesos

```cmd
npm run limite pesos 25
```

Respuesta:

```
Presupuesto de "brewwines": $25 MXN por día
  equivale a 1,842,000 tokens diarios
  ≈ $750 MXN al mes si lo agota todos los días
```

La conversión usa los precios de tu `.env` y **la mezcla real de entrada, salida
y caché que ha tenido ese cliente**. Si aún no hay histórico usa una mezcla típica
y te lo advierte; en cuanto haya uso real, la conversión se afina sola.

Para quitarlo: `npm run limite pesos 0`

> Requiere los precios en `.env`. Si faltan, te lo dice y te manda a la página
> de precios.

### Otras formas

```cmd
npm run limite 20              :: tope de consultas
npm run limite tokens 400000   :: tope directo en tokens
```

Los topes conviven. Se bloquea con el primero que se alcance.

---

## 2. La barra que ve el cliente

En el panel del chat, abajo:

```
CONSUMO DE HOY                    42%
████████░░░░░░░░░░░░
8 de 20 consultas
```

- **Verde** hasta el 75%
- **Ámbar** del 75 al 90%
- **Rojo** arriba del 90% o agotado

Al agotarse, el campo se bloquea y dice *"Consumo diario agotado · se reinicia
a medianoche"*.

El porcentaje toma **el mayor de los dos topes**: si va en 40% de consultas pero
80% de presupuesto, muestra 80%. Así la barra siempre refleja el límite que
realmente lo va a detener.

**Al cliente nunca se le muestran pesos ni tokens.** Solo el porcentaje. El
dinero lo ves tú desde la terminal.

---

## 3. Tu vista de control

```cmd
npm run limite
```

```
Cliente          Consultas   Tokens hoy         Tope   Gasto hoy   Presup.
--------------------------------------------------------------------------
Brew Wines            8/20      742,318    1,842,000      $10.07       $25
```

Y el detalle histórico:

```cmd
npm run costo 7
```

---

## Cómo elegir el presupuesto

### Paso 1 — Pon los precios en `.env` y `.env.local`

```
PRECIO_ENTRADA_MTOK=
PRECIO_SALIDA_MTOK=
PRECIO_CACHE_ESCRITURA_MTOK=
PRECIO_CACHE_LECTURA_MTOK=
TIPO_CAMBIO_USD=20
```

Cópialos de https://platform.claude.com/docs/en/about-claude/models/overview

### Paso 2 — Decide desde el precio de venta, no desde el costo

La regla: **el costo de IA no debe pasar del 10% de lo que cobras.**

| Le cobras al mes | Presupuesto diario de IA | Comando |
|---|---|---|
| $4,500 | $15 | `npm run limite pesos 15` |
| $7,500 | $25 | `npm run limite pesos 25` |
| $12,000 | $40 | `npm run limite pesos 40` |

Con $25 al día tu piso de costo mensual es $750 aunque lo agote todos los días.
Sobre $7,500 de venta son 10%.

### Paso 3 — Ajusta con datos reales

Después de una semana:

```cmd
npm run costo 7
```

Si el promedio real está muy por debajo del presupuesto, súbelo — no quieres
que topen. Si está pegado al tope, o subes el precio de venta o bajas el
presupuesto.

### Paso 4 — Saldo a cargar

`npm run costo` te lo calcula con el consumo observado. La regla rápida:
**presupuesto diario × 30 × meses × 1.3**.

Con $25 al día, un mes son unos $975 MXN. **No cargues más de un mes al principio.**

---

## Recomendación para la demo de Brew Wines

```cmd
npm run limite 20
npm run limite pesos 25
npm run limite
```

20 consultas y $25 de presupuesto. Lo que llegue primero. En la práctica el de
consultas va a topar antes, y el de pesos te protege del día raro en que alguien
haga preguntas muy pesadas.

---

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Presupuesto en pesos y barra de consumo"
git push
```

No hay migración: las columnas ya existen desde la actualización anterior.
