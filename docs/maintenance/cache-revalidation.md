# Revalidación de Caché en Vence

## Resumen

El contenido estático (leyes, artículos, temas) está cacheado **permanentemente** para evitar problemas de rendimiento. Este documento explica todas las cachés, cuándo y cómo invalidarlas.

## Problema que resolvimos (2026-02-06)

### Síntomas en Vercel

```
Error: write CONNECT_TIMEOUT aws-0-eu-west-2.pooler.supabase.com:6543
Error: canceling statement due to statement timeout (code: '57014')
```

### Causa raíz: "Thundering Herd"

Teníamos las cachés configuradas para revalidar cada 24 horas:

```typescript
{ revalidate: 86400, tags: ['temario'] } // 1 día
```

El problema:
1. **48 temas** (16 temas × 3 oposiciones) se cacheaban al mismo tiempo
2. **24 horas después**, todos expiraban simultáneamente
3. **48 funciones Vercel** intentaban revalidar a la vez
4. Cada función hace **5-8 queries** a la base de datos
5. **250+ queries** golpeaban Supabase en segundos
6. El **pooler de conexiones se saturaba** → timeouts

### Solución aplicada

Cambiamos a caché permanente:

```typescript
{ revalidate: false, tags: ['temario'] }
```

El contenido de leyes y artículos **casi nunca cambia**, así que no tiene sentido revalidar automáticamente.

---

## Todas las Cachés del Sistema

### Resumen de Tags

| Tag | Uso | Comando para invalidar |
|-----|-----|------------------------|
| `temario` | Contenido de temas (scope, leyes, artículos) | `revalidateTag('temario')` |
| `teoria` | Contenido de teoría (leyes, artículos, navegación) | `revalidateTag('teoria')` |
| `laws` | Lista de leyes con conteo de preguntas | `revalidateTag('laws')` |
| `test-counts` | Conteo preguntas por tema + nombres de temas | `revalidateTag('test-counts')` |

### Detalle de Cachés

#### 1. Temario - Contenido de Temas

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `lib/api/temario/queries.ts` |
| **Función** | `getTopicContentBaseCached` |
| **Cache Key** | `topic-content-base` |
| **Revalidate** | `false` (permanente) |
| **Tag** | `temario` |
| **Qué cachea** | Tema + topic_scope + leyes + artículos + conteo preguntas oficiales |
| **Queries** | 5-8 queries por tema (~500ms sin caché) |

#### 2. Teoría - Lista de Leyes

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `app/teoria/page.js` |
| **Función** | `getCachedLaws` |
| **Cache Key** | `teoria-laws-list` |
| **Revalidate** | `false` (permanente) |
| **Tag** | `teoria` |
| **Qué cachea** | Lista de todas las leyes para página /teoria |

#### 3. Teoría - Contenido de Artículo

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `lib/api/teoria/queries.ts` |
| **Función** | `getArticleContent` |
| **Cache Key** | `teoria-article-content` |
| **Revalidate** | `false` (permanente) |
| **Tag** | `teoria` |
| **Qué cachea** | Contenido completo de un artículo específico |

#### 4. Teoría - Navegación de Artículos

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `lib/api/teoria/queries.ts` |
| **Función** | `getArticleNavigation` |
| **Cache Key** | `teoria-article-navigation` |
| **Revalidate** | `false` (permanente) |
| **Tag** | `teoria` |
| **Qué cachea** | Lista de números de artículos para prev/next |

#### 5. Teoría - Artículos Relacionados

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `lib/api/teoria/queries.ts` |
| **Función** | `getRelatedArticles` |
| **Cache Key** | `teoria-related-articles` |
| **Revalidate** | `false` (permanente) |
| **Tag** | `teoria` |
| **Qué cachea** | Artículos sugeridos como relacionados |

#### 6. Teoría - Info Básica de Ley

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `lib/api/teoria/queries.ts` |
| **Función** | `getLawBasicInfo` |
| **Cache Key** | `teoria-law-basic-info` |
| **Revalidate** | `false` (permanente) |
| **Tag** | `teoria` |
| **Qué cachea** | Metadata de una ley (nombre, descripción, slug) |

#### 7. Leyes - Conteo de Preguntas ⚠️

| Propiedad | Valor |
|-----------|-------|
| **Archivo** | `lib/api/laws/queries.ts` |
| **Función** | `getLawsWithQuestionCounts` |
| **Cache Key** | `laws-with-question-counts` |
| **Revalidate** | `2592000` (30 días) |
| **Tag** | `laws` |
| **Qué cachea** | Lista de leyes con número de preguntas |

> ⚠️ **Nota:** Esta caché tiene revalidación automática de 30 días porque el conteo de preguntas cambia cuando se añaden preguntas nuevas. Si añades muchas preguntas y quieres que se reflejen inmediatamente, usa `revalidateTag('laws')`.

---

## Cache server-side compartido (Redis Upstash) — Fase 1 escalabilidad

Capa adicional al `unstable_cache` de Next.js. **Diferencias clave:**

| Aspecto | Next.js `unstable_cache` | Redis Upstash |
|---|---|---|
| Alcance | Vercel Data Cache (CDN edge) | Cross-instance shared (servidor) |
| Tipo de invalidación | Por **tag** (`revalidateTag`) | Por **clave** (`invalidate`/`invalidateMany`) |
| Casos de uso | Contenido global semi-estático | Datos por-usuario que cambian con frecuencia |
| Fallback | Sirve stale + revalidate background | Cae a BD si Redis lento o caído |
| TTL | `revalidate: false` (permanente) o segundos | Segundos (configurable por clave) |

**No se invalidan entre sí.** `revalidateTag('temario')` no toca Redis. `invalidate('user_stats:x')` no toca Next.js. Son capas independientes.

### Endpoints con cache Redis

| Endpoint | Clave | TTL | Invalidación |
|---|---|---|---|
| `/api/v2/user-stats` | `user_stats:{userId}` | 30s | Tras INSERT en `test_questions` (`/api/v2/answer-and-save`) |
| `/api/exam/pending` | `exam_pending:{userId}:{type}:{limit}` | 30s | Tras INSERT/UPDATE en `tests` (idem) |
| `/api/v2/topic-progress/theme-stats` | `theme_stats:{userId}` | Fresh 5min, retain 24h | Tras INSERT en `test_questions` + freshness window expirada |

### Patrón "fresh con stale fallback" (theme-stats)

Para queries pesadas (>1s) cuyo timeout puede saturar la app, en vez del simple `getOrSet` se usan `getCached` + `setCached` con timestamp interno:

- Si cached existe y `Date.now() - ts < FRESH_WINDOW_MS` → devolver inmediato (sin tocar BD)
- Si cached existe pero stale → intentar BD; si BD timeout, devolver stale (mejor datos viejos que pantalla vacía)
- Si cached no existe y BD timeout → devolver vacío

Detalle: `Redis TTL = STALE_TTL_S` (24h) cubre todo el periodo. La "freshness" es lógica interna basada en `ts`. Esto evita una segunda escritura en Redis solo para "marcar fresh".

### Feature flag

```bash
REDIS_CACHE_ENABLED=false  # Desactiva todos los Redis lookups (fallback a BD)
```

Útil si Upstash está caído o se sospecha que el cache devuelve datos corruptos.

### Cuándo invalidar manualmente

Tras cualquier escritura que afecte a las stats del usuario, añadir el `invalidateMany` correspondiente. Ejemplo en `answer-and-save/route.ts`:

```typescript
import { invalidateMany } from '@/lib/cache/redis'

after(async () => {
  await invalidateMany([
    `user_stats:${user.id}`,
    `exam_pending:${user.id}:all:10`,
    `theme_stats:${user.id}`,
  ])
})
```

**No es bloqueante**: si Redis falla, el TTL natural eventualmente refresca el valor stale. Pero invalidar es preferible (datos frescos al instante para el usuario).

---

## Cuándo revalidar manualmente

### Tag `temario`

Invalida cuando:
- Añades una ley nueva al sistema
- Modificas el contenido de artículos
- Cambias qué artículos van en cada tema (`topic_scope`)
- Corriges errores en contenido de artículos
- Añades un tema nuevo

### Tag `teoria`

Invalida cuando:
- Añades una ley nueva
- Modificas contenido de artículos
- Cambias estructura de artículos (números, títulos)
- Corriges errores en contenido legal

### Tag `laws`

Invalida cuando:
- Añades muchas preguntas nuevas y quieres reflejar el conteo inmediatamente
- Cambias el nombre o descripción de leyes
- Añades o eliminas leyes del sistema

### Tag `test-counts`

Invalida cuando:
- Añades muchas preguntas nuevas a temas existentes
- Cambias topic_scope (qué artículos pertenecen a qué tema)
- Añades o renombras temas (topics)
- Cambias is_active de preguntas en bloque

Cachea: conteo de preguntas por tema (`getThemeQuestionCounts`), nombres de temas (`getTopicNamesMap`). Usado por las páginas `/test`, `/test/aleatorio` y `/test/test-aleatorio-examen` de todas las oposiciones.

### NO necesitas revalidar cuando:
- Añades pocas preguntas (se actualizará automáticamente en 30 días)
- Cambias usuarios o suscripciones
- Modificas tests o configuraciones
- Cambias feedback o analytics

---

## Cómo revalidar

### Opción 1: Desde código (Server Action o API Route)

```typescript
import { revalidateTag } from 'next/cache'

// En cualquier Server Action o Route Handler
revalidateTag('temario')  // Invalida todo el temario
revalidateTag('teoria')   // Invalida toda la teoría
revalidateTag('laws')     // Invalida lista de leyes
```

### Opción 2: Endpoint genérico `/api/admin/revalidate`

Acepta cualquier tag de la allowlist en `app/api/admin/revalidate/route.ts`. Requiere `x-cron-secret`.

**Tags válidos** (actualizado 2026-05-06 tras Sprint 2):

| Tag | Qué cachea | Cuándo invalidar |
|---|---|---|
| `temario` | Estructura de temas + bloques + artículos del temario por oposición | Tras sync BOE, cambio scope, añadir/quitar artículos |
| `teoria` | Contenido teórico de artículos (texto + navegación) | Tras editar contenido legal |
| `laws` | Lista de leyes con counts de preguntas | Tras añadir muchas preguntas o ley nueva |
| `landing` | Datos de oposición (plazas, hitos, descripción) | Tras editar oposición o subir hitos |
| `test-counts` | Counts de preguntas por tema/ley para configurador | Tras importar preguntas masivas |
| `medals` | Datos de medallas y rankings | Tras update de medallas |
| `profile` | Perfil de usuario (60s TTL, tag-invalidate fuerza refresco) | Manualmente raro — auto via webhook Stripe + onboarding |
| `questions` | Validación de preguntas en `getQuestionValidationCached` | Tras editar `correct_option` o `explanation` (auto via lib/cache/questions.ts) |
| `user-theme-stats` | Stats por tema (Phase 1 Redis) | Tras INSERT en test_questions |
| `test-config` | sections + articles + essential-articles + estimate del configurador | Auto via lifecycle transition; manual tras scripts mutación |
| `hot-articles` | Hot articles per oposición | Manual tras `scripts/sync-hot-articles.cjs` |
| `law-stats` | Counts de preguntas activas por ley | Auto via lifecycle transition |
| `verify-stats` | Estado de verificación BOE por ley | Auto via `updateLawVerification`; manual raro |

```bash
# Revalidar un tag específico
curl -X POST https://www.vence.es/api/admin/revalidate \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"tag": "teoria"}'
```

### Opción 3: Endpoint especializado `/api/admin/revalidate-temario`

Revalida tags `temario` + `landing` de golpe. No requiere body.

```bash
curl -X POST https://www.vence.es/api/admin/revalidate-temario
```

### Opción 4: Desarrollo local (IMPORTANTE)

`revalidateTag()` y el endpoint `/api/admin/revalidate` **NO funcionan en el dev server local**. La caché de `unstable_cache` persiste en `.next/cache` incluso entre reinicios de `npm run dev`.

Para invalidar en local:

```bash
# Parar el dev server, borrar .next y reiniciar
rm -rf .next && npm run dev
```

Sin este paso, la lista de `/leyes` (y temarios, teoría, etc.) seguirá mostrando datos viejos aunque hayas añadido preguntas o leyes nuevas en la BD.

### Opción 5: Redeploy en Vercel

Un redeploy completo también limpia todas las cachés, pero es más lento.

---

## Qué revalidar según el tipo de cambio

| Cambio | Tags de datos | Páginas ISR |
|--------|--------------|-------------|
| Sincronización de ley desde BOE | `temario` + `teoria` | Landing + temario de oposiciones afectadas |
| Añadir/modificar artículos | `temario` + `teoria` | — |
| Actualizar hitos/plazas de oposición | — | Landing de esa oposición (`purge-cache`) |
| Añadir ley nueva | `temario` + `teoria` + `laws` | — |
| Añadir muchas preguntas | `laws` + `test-counts` | — |
| Cambiar topic_scope o temas | `temario` + `test-counts` | — |
| Añadir muchas preguntas | `laws` | — |
| Cambio masivo (varias leyes + oposiciones) | `node scripts/purge-all-cache.js` (ISR) + tags manuales | Todo |

**Importante:** `purge-cache` (revalidatePath) y `revalidateTag` son mecanismos **independientes**. Tras sincronizar artículos desde BOE hay que hacer ambos:

```bash
# 1. Tags de datos (cachés permanentes)
curl -X POST https://www.vence.es/api/admin/revalidate \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"tag": "temario"}'

curl -X POST https://www.vence.es/api/admin/revalidate \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"tag": "teoria"}'

# 2. Páginas ISR (landings, temarios por ruta)
curl -X POST https://www.vence.es/api/purge-cache \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"path": "/auxilio-judicial/temario"}'
```

---

## Configuración de conexión a BD

Archivo: `db/client.ts`

```typescript
const conn = postgres(urlWithTimeout, {
  max: 1,              // 1 conexión por función serverless
  idle_timeout: 20,    // 20 segundos idle
  connect_timeout: 10, // 10 segundos para conectar
  prepare: false,      // Requerido para Supabase Transaction Pooler
})
```

Timeouts adicionales en connection string:
- `statement_timeout=30000` (30 segundos máximo por query)
- `idle_in_transaction_session_timeout=60000` (60 segundos)

---

## Monitoreo

Si vuelven a aparecer errores de `CONNECT_TIMEOUT` o `statement timeout` en Vercel logs:

1. **Verificar Supabase Dashboard** → Database → Conexiones activas
2. **Revisar si hay muchas revalidaciones** → Puede que se haya cambiado `revalidate: false`
3. **Verificar si hay picos de tráfico** → Muchos usuarios accediendo simultáneamente
4. **Buscar nuevas cachés** → Verificar que no se hayan añadido cachés con revalidación automática

---

## Renderizado de páginas (force-dynamic)

Desde el 30/04/2026, las páginas de temario, test y landings usan `force-dynamic` en vez de generación estática (`generateStaticParams`). Esto significa que se renderizan en el servidor en la primera visita.

### Por qué no SSG

El build intentaba generar ~3600 páginas estáticas con 3 workers. Con 90 conexiones máximas en Supabase, esto causaba:
- `57014 statement timeout` — queries cancelados por timeout
- Page timeouts (>60s) — Vercel abandona la página tras 3 intentos
- Builds de 30+ minutos que fallaban frecuentemente

### Cómo funciona ahora

```typescript
// En cada page.tsx de temario, test y landings
export const dynamic = 'force-dynamic'
```

```
PRIMERA VISITA:
  Usuario visita /auxilio-judicial/temario/tema-5 → SSR (query a BD) → HTML cacheado

VISITAS SIGUIENTES:
  Vercel sirve el HTML cacheado (0 queries)
```

**SEO intacto:** Google recibe HTML completo con metadata, canonical URLs, Schema.org — igual que con SSG.

### Añadir temas nuevos

Si se añaden más temas a una oposición:
1. Añadir el topic en la tabla `topics` con `disponible = true`
2. Actualizar `totalTopics` en `lib/config/oposiciones.ts`
3. El temario se renderizará automáticamente en la primera visita (no requiere cambios en page.tsx)
4. El warmup post-deploy lo calentará automáticamente (lee temas de BD)

---

## Cache Warming (Automático tras deploy)

Dado que las páginas son `force-dynamic`, la primera visita tras un deploy hace queries a la BD. Para que ningún usuario experimente esa latencia, un script de warmup visita **todas** las páginas automáticamente tras cada deploy.

### Script: `scripts/warm-cache-post-deploy.js`

```bash
# Manual desde la raíz del proyecto
node scripts/warm-cache-post-deploy.js

# Especificando URL
node scripts/warm-cache-post-deploy.js https://www.vence.es
```

**Qué hace:**
- Lee oposiciones activas y temas disponibles de la BD
- Genera ~963 URLs: landing + test + temario index + cada tema + estáticas
- Visita todas con 8 peticiones concurrentes
- Si no hay BD (CI sin secrets), parsea el sitemap como fallback
- Reporta progreso y errores
- Exit code 1 si >10% de fallos

### GitHub Actions: ejecución automática

El workflow `.github/workflows/warm-cache-post-deploy.yml`:
1. Se dispara en cada push a `main`
2. Espera 5 minutos para que Vercel termine el deploy
3. Ejecuta el script de warmup (~963 URLs en ~3-5 minutos)
4. También se puede lanzar manualmente desde GitHub UI (workflow_dispatch)

### Script legacy: `scripts/warm-temario-cache.sh`

El script bash original que solo calienta 110 páginas de 3 oposiciones. **Sustituido** por `warm-cache-post-deploy.js` que cubre todas las oposiciones y tipos de página.

---

## Revalidación de páginas ISR (landings, leyes, temarios)

Además de las cachés de datos (tags), las **páginas ISR** (landings de oposiciones, páginas de leyes, temarios) están cacheadas con `revalidate = 86400` (24h). Cuando se actualizan hitos, plazas o artículos de leyes en la BD, hay que revalidar estas páginas.

### Revalidar TODO de golpe

Cuando hay cambios masivos (sincronización BOE, actualización de hitos, etc.):

```bash
node scripts/purge-all-cache.js
```

Este script lee oposiciones y leyes activas de la BD y revalida:
- Landing + test + temario de cada oposición
- Página de cada ley
- Páginas estáticas (home, /leyes, /oposiciones, etc.)
- ~550 rutas en ~2 minutos

### Revalidar una ruta específica

```bash
curl -X POST "https://www.vence.es/api/purge-cache" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <CRON_SECRET>" \
  -d '{"path": "/auxiliar-administrativo-carm"}'
```

**IMPORTANTE:** El secret va en el header `x-cron-secret` (es el `CRON_SECRET` de `.env.local`, el segundo si hay dos).

### Cuándo revalidar páginas ISR

| Situación | Qué revalidar |
|-----------|---------------|
| Actualización de hitos/plazas | Landing de esa oposición |
| Sincronización de ley desde BOE | Página de esa ley |
| Cambio legislativo masivo | `node scripts/purge-all-cache.js` (todo) |
| Antes de enviar newsletter con links | Las rutas enlazadas en el email |
| Deploy con cambios de código | Se revalida automáticamente |

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-05-02 | **Sección "Cache server-side compartido (Redis Upstash)"** añadida. Documenta los 3 endpoints con Redis (user-stats, exam/pending, theme-stats), el patrón "fresh con stale fallback" para queries pesadas, y cómo invalidar manualmente. Antes el manual solo cubría Next.js `unstable_cache` + ISR, no Redis. |
| 2026-05-02 | **theme-stats promovido de Map in-memory a Redis** con stale fallback. Resuelve fragmentación del cache entre instancias Vercel Fluid en query de 16s. Invalidación añadida en `answer-and-save`. |
| 2026-04-30 | **Todas las páginas de temario, test y landings migradas a `force-dynamic`** para evitar saturar Supabase en build (~3600 páginas SSG → 0). Script `warm-cache-post-deploy.js` creado para calentar ~963 URLs tras deploy. Workflow automático en GitHub Actions. Script legacy `warm-temario-cache.sh` sustituido. |
| 2026-04-16 | **Eliminados triggers PG de revalidación automática** sobre `topics`, `topic_scope`, `oposicion_bloques` y `oposiciones`. Cada UPDATE/INSERT disparaba regeneración de ~1000 páginas (~5M ISR Writes/mes, ~$20). El cron `check-seguimiento` solo ya generaba 41 disparos/día sin que cambiara nada visible. Migración: `supabase/migrations/20260416_drop_revalidate_triggers.sql`. Endpoint `/api/admin/revalidate-temario` se mantiene para invocación manual. Mismo patrón que feedback (`166c1ddf`) y disputes (`3774509e`) ya migrados. |
| 2026-04-09 | Añadido script `purge-all-cache.js` para revalidar todas las rutas ISR |
| 2026-04-09 | Documentada revalidación por ruta con `/api/purge-cache` |
| 2026-02-11 | Añadido `generateStaticParams` a páginas de temario para pre-generar en build |
| 2026-02-11 | Páginas de temario cambiadas de `force-dynamic` a `revalidate: false` |
| 2026-02-06 | Todas las cachés de temario y teoría cambiadas a `revalidate: false` |
| 2026-02-06 | `getLawsWithQuestionCounts` mantenida en 30 días (datos dinámicos) |
| 2026-02-06 | Creada documentación completa de cachés |
