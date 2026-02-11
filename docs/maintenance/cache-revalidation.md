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

### Opción 2: Endpoint de admin

Si no existe, crear `/app/api/admin/revalidate/route.ts`:

```typescript
import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

const VALID_TAGS = ['temario', 'teoria', 'laws']

export async function POST(request: NextRequest) {
  // TODO: Verificar que es admin
  const { tag } = await request.json()

  if (!VALID_TAGS.includes(tag)) {
    return NextResponse.json({ error: 'Tag no válido' }, { status: 400 })
  }

  revalidateTag(tag)
  return NextResponse.json({ success: true, revalidated: tag })
}
```

Uso:
```bash
curl -X POST https://www.vence.es/api/admin/revalidate \
  -H "Content-Type: application/json" \
  -d '{"tag": "temario"}'
```

### Opción 3: Redeploy en Vercel

Un redeploy completo también limpia todas las cachés, pero es más lento.

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

## Pre-generación de páginas (Build Time)

Además de la caché de datos, las páginas de temario se **pre-generan en build time** usando `generateStaticParams`. Esto significa que **nunca** hay queries a la BD cuando un usuario visita un tema.

### Páginas pre-generadas

| Ruta | Temas | Archivo |
|------|-------|---------|
| `/auxiliar-administrativo-estado/temario/tema-*` | 1-16, 101-112 (28 total) | `app/auxiliar.../temario/[slug]/page.tsx` |
| `/tramitacion-procesal/temario/tema-*` | 1-37 | `app/tramitacion.../temario/[slug]/page.tsx` |
| `/administrativo-estado/temario/tema-*` | 1-11, 201-204, 301-307, 401-409, 501-506, 601-608 (45 total) | `app/administrativo.../temario/[slug]/page.tsx` |

### Cómo funciona

```typescript
// En cada page.tsx de temario
export const revalidate = false  // Nunca revalidar automáticamente

export async function generateStaticParams() {
  // Pre-genera todas las páginas en build
  // Ejemplo Auxiliar: Bloque I (1-16) + Bloque II (101-112)
  const bloqueI = Array.from({ length: 16 }, (_, i) => ({ slug: `tema-${i + 1}` }))
  const bloqueII = Array.from({ length: 12 }, (_, i) => ({ slug: `tema-${101 + i}` }))
  return [...bloqueI, ...bloqueII]
}
```

### Flujo

```
BUILD TIME:
  next build → genera HTML de tema-1, tema-2, ... tema-28

RUNTIME:
  Usuario visita /tema-5 → Sirve HTML pre-generado (0 queries)
```

### Añadir temas nuevos

Si se añaden más temas a una oposición:
1. Actualizar `totalTopics` en `lib/api/temario/schemas.ts`
2. Actualizar `generateStaticParams` en el page.tsx correspondiente con los nuevos números de bloque
3. Actualizar `scripts/warm-temario-cache.sh` con los nuevos números
4. Hacer deploy (el build generará los nuevos temas)

**Nota sobre numeración por bloques:**
- Auxiliar: Bloque I (1-16), Bloque II (101-112)
- Tramitación: Secuencial (1-37)
- Administrativo: 6 bloques (1-11, 201-204, 301-307, 401-409, 501-506, 601-608)

---

## Cache Warming (Opcional)

Si después de un deploy quieres asegurar que todas las páginas están cacheadas (sin depender del build de Vercel), puedes ejecutar el script de cache warming:

```bash
# Desde la raíz del proyecto
./scripts/warm-temario-cache.sh

# O especificando URL base
./scripts/warm-temario-cache.sh https://www.vence.es
```

**Qué hace:**
- Visita las 110 páginas de temario (28 + 37 + 45)
- Usa 5 peticiones concurrentes
- Muestra ✅ o ❌ para cada URL

**Cuándo usarlo:**
- Después de un deploy si sospechas que el build no generó todas las páginas
- Si ves errores de timeout en Vercel logs para páginas de temario
- Para verificar que todas las páginas responden correctamente

**Nota:** Normalmente NO es necesario. El deploy de Vercel debería generar todas las páginas gracias a `generateStaticParams`. Usar solo si hay problemas.

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-02-11 | Añadido `generateStaticParams` a páginas de temario para pre-generar en build |
| 2026-02-11 | Páginas de temario cambiadas de `force-dynamic` a `revalidate: false` |
| 2026-02-06 | Todas las cachés de temario y teoría cambiadas a `revalidate: false` |
| 2026-02-06 | `getLawsWithQuestionCounts` mantenida en 30 días (datos dinámicos) |
| 2026-02-06 | Creada documentación completa de cachés |
