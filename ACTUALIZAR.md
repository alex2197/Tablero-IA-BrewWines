# Ajuste — una sola cifra para el cliente

## El problema

Había dos límites y dos números que podían contradecirse: el chat bloqueado
mientras el pie decía *"8 de 20 consultas"*. Al cliente le parecía un error.

## La solución

**El presupuesto de tokens se traduce a consultas**, y se muestra siempre el menor
de los dos. Una sola cifra, imposible de contradecir.

```
TE QUEDAN 12 CONSULTAS              de 20
████████░░░░░░░░░░░░
Se reinicia a medianoche
```

Al agotarse:

```
SIN CONSULTAS DISPONIBLES
████████████████████
Alcanzaste tu límite de hoy · se reinicia a medianoche
```

Nunca se menciona cuál de los dos topes se alcanzó. Para el cliente da igual.

## La conversión

Se usa el promedio real de tokens por consulta **de ese cliente**, calculado sobre
su histórico. Mientras haya menos de 5 consultas registradas se asume un valor
conservador (25,000 tokens), para no prometer más consultas de las que caben.

En cuanto hay uso real, el número se afina solo.

### El efecto secundario que vale la pena

Si el cliente hace una pregunta muy pesada, el contador puede bajar de 12 a 9 en
lugar de a 11. Eso es intuitivo — *"esa pregunta me costó tres"* — y le enseña sin
explicarle que las consultas complejas consumen más.

### Ejemplos

| Quedan por conteo | Alcanza el presupuesto para | Muestra |
|---|---|---|
| 12 | 18 | **12** |
| 12 | 3 | **3** |
| 12 | 0 | **0**, bloqueado |

## Tu vista no cambia

```cmd
npm run limite
```

```
Cliente        Ve el cliente  Consultas   Tokens hoy   Tope tok.   Gasto hoy  Presup.
Brew Wines           12 de 20       8/20      198,432     522,466       $9.49      $25
  promedio observado: 24,804 tokens por consulta
```

La primera columna es exactamente lo que ve el cliente. El resto es tu desglose:
consultas reales, tokens, tope y gasto en pesos.

Ahí también ves el **promedio observado**, que es el número que usa la conversión.
Si es muy distinto a 25,000, ya tienes datos suficientes para ajustar el
presupuesto con criterio.

## Pasos

```cmd
npm install
npm run build
git add .
git commit -m "Una sola cifra de consultas disponibles"
git push
```

Sin migración.
