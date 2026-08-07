# Actualización — carga de datos y seguridad

## Qué cambió

**1. Pantalla de carga (`/cargar`).** El cliente arrastra sus Excel, ve un reporte de
validación, confirma, y el tablero se actualiza. Ya no dependes de correr scripts
en tu laptop.

**2. Login con contraseña.** Todo el tablero y todos los endpoints quedan detrás de
una sesión. Sin esto no puedes publicar en internet con datos reales de un cliente.

**3. ETL unificado.** `src/lib/etl.ts` es ahora la única fuente de verdad. La lo usan
tanto el script de terminal como el endpoint del navegador, así que no se pueden
desincronizar.

## Pasos para actualizar

```cmd
npm install
```

Agrega estas tres líneas a **`.env` y `.env.local`** (ambos):

```
APP_PASSWORD=la-contrasena-que-quieras
SESSION_SECRET=pega-aqui-una-cadena-larga
TENANT_ID=teravino
```

Genera el secreto con:

```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Luego:

```cmd
npm run dev
```

Te va a mandar a `/login`. Entra con tu `APP_PASSWORD`.

> **Si no defines `SESSION_SECRET`, el login se desactiva** y todo queda abierto.
> Es a propósito para no bloquearte en local, pero **en Vercel es obligatorio**.

## Cómo funciona la carga

1. **Arrastras los 6 Excel** — la pantalla marca cuáles ya pusiste y cuáles faltan
2. **"Revisar archivos"** — parsea y valida sin tocar la base. Muestra filas válidas,
   filas omitidas y avisos por archivo
3. **Confirmación con contexto** — te dice el periodo detectado y la venta total,
   para que verifiques que son los datos correctos antes de reemplazar nada
4. **"Confirmar y cargar"** — escribe todo dentro de una transacción

Si algo falla a la mitad, se hace ROLLBACK. **Nunca quedan datos parciales.**

### Validaciones que hace

- Archivos faltantes o vacíos
- Hojas con nombre distinto al esperado (avisa cuál usó y cuáles había)
- Filas sin llave o sin fecha, que se omiten
- Si más de la mitad de las filas fallan, avisa que probablemente cambiaron los
  encabezados y te muestra los que detectó

## Dar de alta un cliente nuevo

Ahora toma minutos:

```cmd
:: opción A: desde el navegador
:: cambia TENANT_ID en las variables y sube sus Excel en /cargar

:: opción B: desde terminal
npx tsx scripts/cargar.ts ./datos-cliente2/ cliente2 "Nombre del Cliente"
```

Todas las tablas llevan `tenant_id` y todas las consultas lo filtran, así que los
datos de dos clientes nunca se mezclan.

## Antes de publicar en Vercel

- [ ] `SESSION_SECRET` y `APP_PASSWORD` en las variables de entorno de Vercel
- [ ] `APP_PASSWORD` distinta de la de desarrollo
- [ ] Rotar el password de Neon si alguna vez lo compartiste
- [ ] Rotar la API key de Anthropic
- [ ] En plan gratuito: bajar `maxDuration` a 10 en `api/chat` y `api/cargar`

> **Límite de tamaño.** Vercel acepta hasta ~4.5 MB por petición en serverless.
> Tus archivos suman ~1 MB, así que va sobrado. Si un cliente tiene Excel más
> pesados, habrá que subirlos a almacenamiento y procesarlos aparte.

## Siguiente decisión

El login actual es **una contraseña compartida**, suficiente para demos y para un
cliente. Cuando tengas tres o más, conviene migrar a Clerk para tener usuarios
individuales, roles y que cada quien vea solo su tenant. Es un cambio de medio día
porque el middleware y el aislamiento por `tenant_id` ya están puestos.
