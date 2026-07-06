# Analizador de Competidores

Subsistema de **inteligencia de mercado**: catálogo DURADERO de academias/plataformas
competidoras, sus oposiciones, precios (con histórico) y **todas** sus URLs (sitemap),
con **detección de cambios**. Complementa —sin mezclarse con— el radar de señales OEP.

> **Por qué separado del radar.** El radar son *eventos efímeros* ("¿hay una OEP
> nueva?"): una señal nace, matchea y muere al catalogarse. Esto son *entidades
> duraderas* ("¿quién es esta academia, qué prepara, a qué precio, qué ha lanzado?"):
> estado que vive, se actualiza y se consulta históricamente. Meterlo en
> `oep_detection_signals` degradaría ambas cosas. Por eso: **subsistema aparte que
> ALIMENTA al radar** (la Capa 3 lee de estas tablas).

Estado: **Fase 1 construida (06/07/2026), sin desplegar ni migrar a RDS.**

## Modelo de datos (escala a "muchas oposiciones × muchos precios × muchas URLs")

Migración: `supabase/migrations/20260706_competitor_intelligence.sql`. Schema Drizzle
backend: `backend/src/competitors/competitors.schema.ts`.

```
competitors ─┬─* competitor_sources  N fuentes/competidor (sitemaps/listados) + last_hash
             ├─* competitor_urls      todas las URLs; content_hash por URL
             ├─* competitor_courses   1 por oposición que preparan (oposicion_id NULL = GAP)
             │        └─* competitor_prices  1 por tipo×audiencia×periodo + histórico (is_current)
             └─* competitor_changes   log append-only (url/course/price added/removed/changed/modified)
```

- **`competitors`** — la academia. `slug`, `base_url`, `tipo`
  (academia_presencial | plataforma_online | hibrida), `region`, `last_synced_at`.
- **`competitor_sources`** — **N fuentes por competidor** (espejo de `detection_sources`
  del radar). `source_type` (sitemap | sitemap_index | listing_html | rss | api), `url`,
  `last_hash`, `last_checked_at`, `last_success_at`, `last_error`. Un competidor
  puede tener varios sitemaps, o un **listado HTML** si su sitemap no cubre todas
  las landings, o RSS/API.
- **`competitor_urls`** — el analizador de URLs. `url`, `url_type`
  (oposicion | categoria | page | post | other), `content_hash`, `lastmod`,
  `content_checked_at`, `is_active` (false al desaparecer del sitemap),
  `first/last_seen_at`, `last_changed_at`.
- **`competitor_courses`** — lo que preparan. `oposicion_id` FK→`oposiciones`
  (NULL = **gap**: la preparan y nosotros no → señal de producto), `raw_name`, `modalidad`.
- **`competitor_prices`** — precios normalizados. `price_kind`
  (matricula | cuota | intensivo | tasa | material | otro) × `audience`
  (nuevo | antiguo | general) × `period` (mensual | trimestral | unico | curso),
  `amount_cents`, `raw`, `is_current`. Histórico = al cambiar un precio se marca
  `is_current=false` + `superseded_at` y se inserta la fila nueva.
- **`competitor_changes`** — backbone de "cuando lo actualicen, detectarlo fácil".

## Arquitectura del backend (`backend/src/competitors/`)

**Un fichero adapter por competidor** (no habrá muchos y cada uno tiene su markup):

- `sitemap.ts` — parser PURO de sitemap XML (index + urlset). Sin deps de XML.
- `adapters/types.ts` — contrato `CompetitorAdapter` (`classifyUrl`, `parseCourse`).
- `adapters/tecnoszubia.ts` — 1er competidor (Tecnos Zubia, Granada). `parseCourse`
  **acotado a los paneles de precio** para no tragarse ruido (el sueldo
  "1.500 €–1.900 €" del cuerpo del artículo NO es un precio del curso).
- `adapters/registry.ts` — array de adapters. Añadir competidor = fichero + línea + spec.
- `competitor-queries.service.ts` — ops de BD + match conservador curso→oposición
  (precisión > recall; si duda, NULL = gap) + `getCompetitorsForOposicion(id)`.
- `competitor-sync.service.ts` — el motor: sitemap → diff URLs (nuevas/eliminadas) →
  **descarga incremental** de cursos nuevos/cambiados (tope `MAX_COURSES_PER_RUN=40`
  + educado 500ms; sin silencios: loguea los pendientes) → upsert curso →
  **reconciliación de precios** (histórico) → log de cambios.
- `competitors.cron.ts` — `@Cron('0 5 * * *')` UTC, **antes del radar (07:00)** para
  que la Capa 3 lea datos frescos. Heartbeat + observability como `radar.cron`.

### Detección de cambios (robusta, "como el radar")

Dos niveles de hash + red de seguridad, para que el estado estacionario sea barato
sin perderse cambios:

1. **Hash por fuente** (`competitor_sources.last_hash`) — ¿cambió el sitemap/listado?
   Observabilidad por fuente (checked/success/error). Si una fuente falla, **no** se
   corre la detección de URLs eliminadas (evita falsos "removed" por caída transitoria).
2. **Hash por URL** (`competitor_urls.content_hash`) — ¿cambió esta landing concreta?
3. **Gateo de re-descarga**: una landing conocida solo se re-baja si
   `nunca bajada` · `lastmod movido` · `content_checked_at > STALE_RECHECK_DAYS` (14d).
   El coste real no es hashear (gratis) sino el **fetch** de cientos de páginas
   (ancho de banda + no ser bloqueado por martillear). Por eso se gatea.
4. **Red de seguridad `STALE_RECHECK_DAYS`**: cubre CMS que **no actualizan `lastmod`**
   al editar — cada landing se re-chequea al menos cada 14 días aunque el lastmod no
   se mueva. `content_checked_at` se sella en cada descarga (aunque no cambie).

Novedades detectadas → `competitor_changes`: `url_added` (nueva landing),
`url_removed`, `url_modified` (landing editada aunque no cambie el precio),
`course_added`, `price_changed`.

**Landings fuera del sitemap** (excluidas/huérfanas/noindex): se cubren con una
fuente `source_type='listing_html'` + el hook opcional `adapter.discoverUrls(html)`
(scrapea los enlaces de una página de listado/categoría). tecnoszubia no lo necesita
(sitemap completo, 654 landings).

### El radar se alimenta del competitor-DB
`backend/src/radar/layers/competitors/from-competitor-db.ts` — adapter FACTORY
(`makeCompetitorDbAdapter(queries)`, `key: 'competitor-db'`, `priority: 320`,
`sensor_type: 'competitor'`). El orquestador lo registra **dinámicamente** (inyecta
`CompetitorQueriesService`, `@Optional`) porque necesita BD y los adapters const no
la tienen. Surface solo cursos con **movimiento reciente** (`getRadarCandidates(7)`:
añadidos o página cambiada en 7d) → pista de posible convocatoria; `dedupeKey`
estable por curso (una señal por curso, no una diaria).

## Verificación (06/07/2026)

- `npm run test` (jest) — 12 tests nuevos (sitemap + adapter), 59 verdes en
  competitors+radar+oep-signals. `tsc --noEmit` limpio.
- **End-to-end contra el sitio real** (sin BD): sitemap index → 2004 URLs
  clasificadas (654 curso / 41 categoría / 1021 post / 288 página); curso
  Administrativo del Estado → nombre + modalidad `mixta` + 6 precios exactos
  (matrícula 60€ vigente, cuota 125/105€, intensivo 60/50€, tasa 15,57€), sin
  tragarse el sueldo.

## Pendiente (no hecho aún)

1. **Aplicar migración a RDS** (`vence-prod`) — requiere OK de Manuel. Regenerar
   `db/schema.ts` (app Next.js) con las 5 tablas para el futuro panel.
2. **Desplegar backend** (ECS) para activar el cron.
3. **Endpoint + panel `/admin/competidores`** — la query `getCompetitorsForOposicion`
   ya existe; falta controller (con `guardAdminApi`) + UI. Consulta clave:
   "para la oposición X → qué competidores la preparan, a qué precio, en qué modalidad";
   además: gaps (cursos sin match = demanda), blue ocean (oposiciones sin competidor),
   pricing.
4. **Emitir señales al radar por gap/lanzamiento** de forma explícita (hoy el radar
   ya consume `competitor_courses` con movimiento; falta distinguir lanzamiento vs gap).
5. **Migrar `oposiciones.es`** (hoy adapter HTTP directo del radar) a un competidor
   del competitor-DB → fuente única, sin doble conteo. Segundo competidor a añadir.
