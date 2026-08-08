# Ajuste — Teravino → Brew Wines

## Dónde aparecía el nombre

En tres lugares distintos, y cada uno se cambia diferente:

| Dónde | Qué es | Cómo se cambia |
|---|---|---|
| Encabezado del tablero, login, PDF | Variable `NEXT_PUBLIC_EMPRESA` | En `.env`, `.env.local` y **Vercel** |
| Nombre en la base de datos | Columna `nombre` de `tenants` | Con `npm run db:renombrar` |
| Valores por defecto del código | `'teravino'` y `'Teravino'` | **Ya vienen corregidos** en este paquete |

## Pasos

### 1. Actualiza el código

```cmd
npm install
```

### 2. Cambia las variables locales

```cmd
notepad .env
```

```
NEXT_PUBLIC_EMPRESA=Brew Wines
TENANT_ID=brewwines
```

Guarda, y **repite lo mismo en `.env.local`**. Los dos archivos deben quedar iguales.

### 3. Renombra el cliente en la base

```cmd
npm run db:renombrar teravino brewwines "Brew Wines"
```

Mueve todas las filas al identificador nuevo dentro de una transacción y borra el
viejo. Te va a listar cuántas filas movió de cada tabla.

Es seguro correrlo dos veces: si `teravino` ya no existe, solo actualiza el nombre.

### 4. Verifica

```cmd
npm run acceso
```

Debe listar **brewwines**. Luego:

```cmd
npm run build
npm run dev
```

El encabezado debe decir **Brew Wines**.

### 5. Cambia las variables en Vercel

Este paso es fácil de olvidar y sin él la app publicada sigue diciendo Teravino.

Vercel → **Settings** → **Environments** → **Production**:

- `NEXT_PUBLIC_EMPRESA` → `Brew Wines`
- `TENANT_ID` → `brewwines`

Edita cada una con los tres puntos `...` → **Edit**.

> `NEXT_PUBLIC_EMPRESA` se incrusta en el código del navegador al compilar, así
> que **requiere redesplegar** para que surta efecto. No basta con guardarla.

### 6. Sube y redespliega

```cmd
git add .
git commit -m "Cambia el nombre del cliente a Brew Wines"
git push
```

El push dispara el deploy con las variables nuevas ya aplicadas.

### 7. Confirma en producción

Abre la app. Deben decir **Brew Wines**:

- El encabezado del tablero
- La pantalla de login
- La portada del PDF

## Si algo queda diciendo Teravino

Casi siempre es que faltó cambiar `NEXT_PUBLIC_EMPRESA` en Vercel, o que se
cambió pero no se redesplegó. Haz **Redeploy** desde Deployments.
