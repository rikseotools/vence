# Roadmap: Eliminar diccionario hardcodeado de lawMappingUtils

## Problema

`lib/lawMappingUtils.ts` tiene ~1.173 lineas con 3 diccionarios estaticos (432 + 206 + 30 entradas) que hay que actualizar manualmente cada vez que se anade una ley. Si no se actualiza, paginas como `/leyes/[slug]` dan 404.

La tabla `laws` en BD ya tiene toda la informacion necesaria (`slug`, `short_name`, `name`, `description`) con 325 leyes activas, todas con slug, sin duplicados.

## Objetivo

Que cualquier ley nueva funcione automaticamente en toda la app con solo existir en la tabla `laws`. Cero cambios de codigo al anadir leyes.

## Arquitectura nueva: Drizzle + Zod + Context

```
┌─────────────────────────────────────────────────────────┐
│  BD (laws table)  ── fuente de verdad unica             │
└────────────┬────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│  lib/api/laws/queries.ts (Drizzle)                      │
│  - loadSlugMappingCache()   cache en memoria 1h         │
│  - resolveLawBySlug()       ley completa desde slug     │
│  - getShortNameBySlug()     slug → short_name           │
│  - getSlugByShortName()     short_name → slug           │
│  - getCanonicalSlugAsync()  short_name → slug canonico  │
│  - getLawInfoBySlug()       slug → {name, description}  │
│  - getAllActiveSlugs()      para generateStaticParams    │
│  - normalizeLawShortName()  variantes → canonico        │
└────────────┬──────────────┬─────────────────────────────┘
             │              │
    Server Components    API endpoint
    (import directo)     /api/v2/law-slugs
                            │
                   ┌────────▼─────────────────────────────┐
                   │  LawSlugContext (React Context)       │
                   │  - Precargado en app/layout.tsx (SSR) │
                   │  - getSlug()        sync              │
                   │  - getShortName()   sync              │
                   │  - getLawInfo()     sync              │
                   │  - normalizeName()  sync              │
                   └──────────────────────────────────────┘
                              │
                      Client Components
                      (useLawSlugs() hook)
```

### Validacion con Zod en cada capa

| Capa | Schema | Proposito |
|------|--------|-----------|
| BD → Cache | `LawResolvedSchema` | Validar cada ley al cargar cache |
| API endpoint | `SlugMappingResponseSchema` | Contrato tipado del endpoint |
| Schemas base | `lawSlugSchema`, `lawShortNameSchema` | Validar inputs |

### Ventajas sobre lawMappingUtils

| Aspecto | Antes (lawMappingUtils) | Despues (Drizzle + Context) |
|---------|------------------------|----------------------------|
| Fuente de verdad | 3 diccionarios + BD | Solo BD |
| Anadir ley | Editar 1.173 lineas en 3 maps | INSERT en `laws` |
| Tipos | `Record<string, string>` | Zod schemas + infer |
| Validacion | Ninguna | Zod en cache load y API |
| Client components | Import sincrono del modulo completo | Context con datos precargados SSR |
| Fallback | 3 niveles (cache → dict → pattern) | 2 niveles (cache → pattern) |
| Build time | Depende de BD + dict estatico | Cache en memoria + BD fallback |

## Estado actual

### Ya implementado (Fase 0-1)

- [x] Fallback a BD en `/leyes/[law]/page.tsx` (commit b4e2b122)
- [x] Migrar page.js a page.tsx (commit df2c9259)
- [x] `lib/api/laws/schemas.ts` - Schemas Zod completos (LawResolved, LawInfo, SlugMapping)
- [x] `lib/api/laws/queries.ts` - Funciones Drizzle con cache en memoria
- [x] `lib/api/laws/index.ts` - Re-exports del modulo
- [x] `app/api/v2/law-slugs/route.ts` - Endpoint GET con Cache-Control
- [x] `contexts/LawSlugContext.tsx` - React Context + hook `useLawSlugs()`
- [x] `app/layout.tsx` - LawSlugProvider inyectado con datos precargados SSR
- [ ] Verificar que tabla `laws` tiene indice unico en `slug`
- [ ] Verificar que `NORMALIZATION_MAP` y aliases legacy estan cubiertos

### 56 archivos importan de lawMappingUtils.ts

| Funcion | Archivos | Tipo principal |
|---------|----------|----------------|
| `getCanonicalSlug` | 20 | 17 TopicContentView (client) + 3 otros |
| `normalizeLawShortName` | 16 | 16 test-aleatorio-examen (client) |
| `mapLawSlugToShortName` | 16 | 6 server + 7 lib + 3 otros |
| `generateLawSlug` | 11 | 5 client + 3 lib + 1 server + 2 otros |
| `getLawInfo` | 4 | 2 server + 1 hook + 1 test |
| `getAllLawSlugsWithDB` | 3 | 3 server (generateStaticParams) |
| `setDbCache/invalidate/isLoaded` | 1 | warmCache.ts |

## Plan de migracion

### Fase 2: Indice unico en laws.slug

**Objetivo:** Garantizar integridad de datos.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS laws_slug_unique
  ON laws (slug) WHERE slug IS NOT NULL;
```

**Riesgo:** Nulo (ya verificado: 0 duplicados)

### Fase 3: Migrar server components a Drizzle

**Objetivo:** Los server components usan `resolveLawBySlug()` / `getShortNameBySlug()` en vez del diccionario.

**Patron de migracion:**
```typescript
// ANTES
import { mapLawSlugToShortName, getLawInfo } from '@/lib/lawMappingUtils'
const shortName = mapLawSlugToShortName(slug)
const info = getLawInfo(slug)

// DESPUES
import { resolveLawBySlug } from '@/lib/api/laws'
const law = await resolveLawBySlug(slug)
// law.shortName, law.name, law.description - todo tipado
```

**Archivos (13):**
- `app/leyes/[law]/page.tsx` (ya migrado parcialmente)
- `app/leyes/[law]/avanzado/page.js`
- `app/leyes/[law]/test-rapido/page.js`
- `app/teoria/[law]/page.js`
- `app/teoria/[law]/[articleNumber]/page.tsx`
- `app/test/aleatorio-examen/page.js`
- `app/sitemap-static.xml/route.ts`
- `lib/lawFetchers.ts`
- `lib/testFetchers.ts`
- `lib/teoriaFetchers.ts`
- `lib/api/teoria/queries.ts`
- `lib/chat/domains/search/PatternMatcher.ts`
- `lib/chat/domains/stats/StatsService.ts`

**Riesgo:** Bajo. Cada archivo se migra independientemente.

### Fase 4: Consolidar TopicContentView duplicados

**CORRECCION vs roadmap original:** Los 17 TopicContentView NO son identicos. Cada uno tiene:
- `getBlockInfo(topicNumber)` con bloques especificos de la oposicion
- `topicVideoCourses` mapping distinto por oposicion
- Prop `oposicion` hardcodeado

**Estrategia:**
1. Extraer `getBlockInfo` y `topicVideoCourses` a `lib/config/oposiciones.ts` (o similar), keyed por oposicion
2. Crear un unico `components/TopicContentView.tsx` compartido que reciba oposicion como prop
3. Cada page wrapper pasa el slug de oposicion (patron TemaTestPage ya validado)

**Archivos a crear:** 1 componente compartido
**Archivos a reducir:** 17 → 17 wrappers minimos (3-5 lineas cada uno)

**Riesgo:** Medio. Requiere verificar que la extraccion de config no rompe nada.

### Fase 5: Migrar client components al Context

**Objetivo:** Los client components usan `useLawSlugs()` en vez del import directo.

**Patron de migracion:**
```typescript
// ANTES
import { getCanonicalSlug, normalizeLawShortName } from '@/lib/lawMappingUtils'
const slug = getCanonicalSlug(shortName)

// DESPUES
import { useLawSlugs } from '@/contexts/LawSlugContext'
const { getSlug, normalizeName } = useLawSlugs()
const slug = getSlug(shortName)
```

**Archivos (~30, se reduce si Fase 4 se hace primero):**
- 17 TopicContentView (→ 1 si Fase 4 completada)
- 16 test-aleatorio-examen pages
- `components/TestConfigurator.tsx`
- `components/ExamLayout.tsx`
- `components/OfficialExamLayout.tsx`
- `components/Statistics/ThemePerformance.tsx`
- `components/LeyesClientWrapper.js`
- `components/test/TemaTestPage.tsx`
- `hooks/useIntelligentNotifications.ts`

**Riesgo:** Bajo (Context ya esta inyectado en el root layout).

### Fase 6: Eliminar lawMappingUtils.ts y warmCache.ts

**Objetivo:** Borrar las ~1.173 lineas de mapping estatico y el puente Supabase.

1. Eliminar `lib/lawMappingUtils.ts` completo
2. Eliminar `lib/api/laws/warmCache.ts` (ya no necesario, Drizzle cache lo reemplaza)
3. Verificar que ningun archivo importa de estos modulos
4. Limpiar references en CLAUDE.md

**Riesgo:** Nulo si fases 3-5 estan completas.

## Orden recomendado

```
Fase 2 (indice) → Fase 4 (consolidar TopicContentView) → Fase 3 (server) → Fase 5 (client) → Fase 6 (eliminar)
```

Fase 4 antes de 5 reduce el trabajo de migracion client de ~30 a ~18 archivos.

## Riesgos identificados y mitigaciones

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| URLs legacy con encoding roto (c-digo-civil) | Alta | Los 432 slugs incluyen ~100 aliases. Verificar que estan en BD como slugs, o crear redirects en middleware |
| Build falla si BD no responde en generateStaticParams | Media | `getAllActiveSlugs()` ya tiene try/catch que retorna [] |
| Race condition en primer render sin Context | Nula | Context se precarga en SSR via layout, no hay fetch client-side |
| LAW_INFO solo tiene 30 entradas vs 325 leyes | Baja | `getLawInfoBySlug()` usa `law.name` y genera description fallback |
| Performance del layout async | Nula | Cache en memoria 1h, solo 1 query ligera por cold start |

## Criterio de exito

- 0 lineas de diccionario hardcodeado
- Anadir una ley nueva a la tabla `laws` con slug → funciona en toda la app automaticamente
- Sin regresion: todas las URLs existentes siguen funcionando
- Sin impacto en rendimiento: mapping se carga 1 vez en SSR y se pasa via Context
- Tipos end-to-end: Zod valida BD → cache → API → Context → componente
- 0 imports de `lawMappingUtils.ts` en todo el codebase

## Pendiente: Aliases de slugs legacy

El diccionario SLUG_TO_SHORT_NAME tiene ~432 entradas pero la BD solo tiene ~325 leyes. La diferencia son:
- Aliases con encoding roto (ej: `c-digo-civil` → `Código Civil`)
- Variantes historicas (ej: `constitucion-espanola` y `ce` apuntan a `CE`)

**Opciones:**
1. **Middleware de redirects** - `middleware.ts` con Map de aliases → slug canonico (301 redirect)
2. **Columna `slug_aliases` en laws** - Array JSON de aliases alternativos
3. **Tabla `law_slug_aliases`** - (slug_alias, law_id, reason)

Recomendacion: Opcion 1 (middleware) para URLs legacy, opcion 2 para aliases legitimos.
