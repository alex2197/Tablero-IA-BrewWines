# Tablero con IA

Dashboard de métricas de negocio con asistente conversacional que **consulta datos reales y manipula el tablero**.

Compilado y verificado con Next.js 15 · React 19 · Postgres · Claude API.

---

## Arranque rápido

```bash
npm install
cp .env.example .env.local     # llena DATABASE_URL y ANTHROPIC_API_KEY
npm run db:schema              # crea las tablas
mkdir datos                    # copia aquí los 7 .xlsx
npm run db:cargar              # ETL Excel -> Postgres
npm run dev                    # http://localhost:3000
```

Cargar otro cliente en la misma base:

```bash
npx tsx scripts/cargar.ts ./datos-cliente2/ cliente2 "Nombre del Cliente"
```

---

## Arquitectura

```
Usuario escribe: "¿quién me debe más?"
        │
        ▼
POST /api/chat  ──►  Claude decide: consultar_cartera(dias_minimos=90)
        │
        ▼
src/lib/consultar.ts  ──►  SQL parametrizado contra Postgres
        │
        ▼
tool_result con cifras reales  ──►  Claude redacta la respuesta
        │
        ▼
SSE al frontend: texto en streaming + acciones sobre el tablero
```

**La IA nunca escribe SQL.** Elige métricas y dimensiones de una lista cerrada
(`src/lib/metricas.ts`) y el motor arma la consulta con parámetros. Es imposible
que inyecte SQL o invente un número.

---

## Archivos que importan

| Archivo | Qué hace | Cuándo lo tocas |
|---|---|---|
| `src/lib/metricas.ts` | **Capa semántica.** Define qué significa cada métrica | Cliente nuevo o métrica nueva |
| `src/lib/consultar.ts` | Motor de consultas + detección de anomalías | Consulta nueva |
| `src/lib/herramientas.ts` | Descripciones que lee el modelo para decidir | Constantemente. Es el prompt real |
| `src/app/api/chat/route.ts` | Bucle de tool use + streaming | Rara vez |
| `src/store/estado.ts` | Estado compartido usuario ↔ IA | Filtro nuevo |
| `evals/casos.json` | Casos de prueba de ruteo | Cada vez que cambies un prompt |

---

## Los tres detalles que evitan bugs de producción

**1. Fechas relativas contra el corte de datos.**
El system prompt inyecta `desde`/`hasta` reales del dataset. Sin esto, "¿cómo va
este mes?" resuelve contra `CURRENT_DATE` y devuelve cero.

**2. El modelo no formatea cifras.**
Cada `tool_result` incluye el valor crudo y el string ya formateado (`saldo_fmt`,
`formateado`). El prompt instruye a usar el segundo textualmente.

**3. Facturas normalizadas.**
Ventas trae `BR0013269`, cuentas por cobrar trae `BR-0005117`. El ETL les quita
guiones y espacios. Sin eso, las dos tablas no cruzan.

---

## Evals

```bash
npm run evals
```

20 casos de `pregunta → herramienta esperada`. Córrelos antes de cada deploy:
sin ellos vas a estar ajustando prompts a ciegas.

Para agregar casos, edita `evals/casos.json`. Los casos con `"espera": []`
verifican que **no** llame herramientas (saludos, preguntas fuera de rango).

---

## Publicar

```bash
git init && git add . && git commit -m "Primera versión"
gh repo create tablero-ia --private --source=. --push
```

En vercel.com: importar el repo, agregar `DATABASE_URL`, `ANTHROPIC_API_KEY` y
`NEXT_PUBLIC_EMPRESA` como variables de entorno, y desplegar.

`/api/chat` tiene `maxDuration = 60`, que requiere plan Pro de Vercel. En plan
gratuito bájalo a 10 y reduce `MAX_VUELTAS` a 3.

---

## Pendientes antes de cobrarle a un cliente

- [ ] **Autenticación** — `npm install @clerk/nextjs`. Hoy cualquiera con la URL ve todo
- [ ] **Tenant desde la sesión** — `TENANT` en `src/lib/db.ts` está fijo por variable de entorno
- [ ] **Límite de gasto** en platform.claude.com
- [ ] **Caché** de consultas repetidas (Redis o `unstable_cache` de Next)
- [ ] **Rate limiting** en `/api/chat`

El aislamiento multi-tenant ya está en el esquema: todas las tablas llevan
`tenant_id` y todas las consultas lo filtran. Solo falta que salga de la sesión
en vez de la variable de entorno.

---

## Cambiar de giro

Este repo está armado para una distribuidora, pero el esqueleto sirve para
cualquier negocio con ventas, clientes y productos:

1. Ajusta `METRICAS` y `DIMENSIONES` en `src/lib/metricas.ts`
2. Ajusta el mapeo de columnas en `scripts/cargar.ts`
3. Ajusta el texto de `sistema()` en `src/app/api/chat/route.ts`
4. Corre los evals y ajusta descripciones de herramientas

El frontend no cambia.
