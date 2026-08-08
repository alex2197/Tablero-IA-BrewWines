# Ajuste — límite diario de consultas con IA

## Cómo funciona

Un contador por cliente y por día. El chat cuesta **1 operación**, generar el
reporte con resumen escrito cuesta **3** (manda mucho más contexto al modelo).

El contador vive en la base de datos, no en memoria: en Vercel cada petición
corre en un proceso distinto, así que un contador en RAM no serviría.

El reinicio ocurre a **medianoche hora de Ciudad de México**, no UTC.

### Qué ve el usuario

- Normal: el pie del chat dice lo de siempre
- Quedan 10 o menos: *"Te quedan 7 de 50 consultas hoy"* en ámbar
- Sin cupo: el campo se bloquea y aparece el aviso en rojo

El tablero completo sigue funcionando sin cupo. Solo se apaga el chat y el
resumen escrito del PDF — **el reporte se genera igual**, nada más sin el
párrafo de análisis.

## Ajustar el límite

```cmd
npm run limite            :: ver uso actual e histórico de 7 días
npm run limite 80         :: subir a 80 por día
npm run limite 80 cliente2 :: para otro cliente
```

No requiere redesplegar. El límite vive en la tabla `tenants`, así que cada
cliente puede tener el suyo.

## Pasos para actualizar

```cmd
npm install
npm run db:migrar
npm run build
git add .
git commit -m "Limite diario de consultas IA"
git push
```

`db:migrar` agrega la columna y la tabla sin borrar datos.

## Nota sobre concurrencia

La reserva de cupo usa un `INSERT ... ON CONFLICT DO UPDATE ... WHERE` en una
sola sentencia. Si dos peticiones llegan al mismo tiempo con una sola operación
disponible, solo una pasa. Con un contador leído y luego escrito, ambas pasarían.
