# Ajuste — control de acceso y periodo de prueba

## Por qué no se tumba el hosting

Borrar el deployment es mala idea:

- El cliente ve un error, no un mensaje. Parece falla tuya, no fin de prueba
- Reactivar significa redesplegar y reconfigurar variables
- Se pierde la conversación comercial: un error no invita a llamarte

Este control hace lo contrario. Cuando vence, el cliente ve una pantalla que
dice que su prueba terminó, que **sus datos siguen guardados**, y a quién
contactar. Reactivar es un comando.

## Comandos

```cmd
npm run acceso                     :: ver estado de todos los clientes
npm run acceso prueba 14           :: prueba de 14 días desde hoy
npm run acceso extender 7          :: agregar 7 días a la prueba actual
npm run acceso activar             :: acceso completo, sin vencimiento
npm run acceso suspender           :: cortar acceso
npm run acceso contacto "Alex · 55 1234 5678"
```

Todos aceptan el cliente como último argumento:

```cmd
npm run acceso suspender cliente2
```

Ninguno requiere redesplegar. El cambio surte efecto en la siguiente carga.

## Los tres estados

| Estado | Qué pasa |
|---|---|
| `activo` | Acceso completo, sin vencimiento |
| `prueba` | Acceso completo hasta `vence`. Banda con días restantes |
| `suspendido` | Sin acceso, con pantalla explicativa |

Una prueba vencida se comporta igual que suspendido, sin que tengas que hacer nada.

## Qué ve el cliente

**Durante la prueba** — una banda discreta arriba: *"PERIODO DE PRUEBA · quedan 6
días"*. Los últimos 3 días se pone ámbar.

Es un recordatorio comercial constante sin ser molesto.

**Al vencer** — no puede entrar. Ve:

> **Tu periodo de prueba terminó.**
> Tus datos siguen guardados. En cuanto se reactive el acceso, el tablero
> vuelve exactamente como lo dejaste.
> Para reactivarlo: Alex · 55 1234 5678

El texto está pensado para que llame, no para que se frustre.

## Dónde se verifica

En el **login** (no puede entrar) y en **cada endpoint** (por si conserva una
sesión abierta cuando vence). Si la prueba expira con el tablero abierto, la
siguiente acción lo corta.

## Configuración para la demo

```cmd
npm run db:migrar
npm run acceso contacto "Alex · 55 1234 5678"
npm run acceso prueba 14
npm run limite 20
npm run acceso
```

Y cuando cierre la venta:

```cmd
npm run acceso activar
```

## Corte inmediato de emergencia

Si necesitas cortar **ahora mismo** a todas las sesiones abiertas, cambia
`SESSION_SECRET` en Vercel y redespliega. Eso invalida todas las cookies al
instante.

Es el botón de emergencia. Para el flujo normal usa `npm run acceso suspender`,
que es más limpio y no te obliga a redesplegar.

## Pasos

```cmd
npm install
npm run db:migrar
npm run build
git add .
git commit -m "Control de acceso y periodo de prueba"
git push
```

`db:migrar` agrega las columnas sin borrar datos.

### Para probar que funciona

```cmd
npm run acceso suspender
```

Recarga el tablero: debe salir la pantalla de acceso suspendido.

```cmd
npm run acceso prueba 14
```

Recarga: vuelve el tablero con la banda de días restantes.
