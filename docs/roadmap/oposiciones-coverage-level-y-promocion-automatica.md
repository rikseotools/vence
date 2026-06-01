# Roadmap: Oposiciones con `coverage_level` + promoción automática

> **Detonante:** 2026-06-01 sesión catálogo C2+C1 + Sprint 1 Lambda headless + audit Fase 0. Manuel pidió: *"tener todas las oposiciones en BD con sus URLs de seguimiento y detectar todo para que cuando salga una convocatoria, estar avisado y crear la oposición"* + *"llegará un momento que estén todas activas y vivas"*.
>
> **Objetivo:** unificar el catálogo (138 entradas aspiracionales en `OFFICIAL_OPOSICIONES` + 45 implementadas en BD `oposiciones`) en una sola tabla con ciclo de vida natural. Cada oposición es ciudadano de primera clase. Sistema multi-sensor + Lambda headless las vigila TODAS. Auto-promoción de nivel cuando se detectan condiciones. SLA medible de extremo a extremo.
>
> **Principios robustez/escalabilidad/profesionalidad:**
> 1. **Una sola tabla, ciudadanos de primera clase.** No hay `aspirational vs implementada` como dicotomía artificial. Solo etapas de un mismo ciclo.
> 2. **Auto-promoción.** El sistema sube de nivel oposiciones cuando se cumplen criterios objetivos. No se gasta tiempo humano en clasificar manualmente.
> 3. **Visibilidad pública con honestidad.** El usuario ve TODAS las oposiciones, con badge claro según etapa. No se ocultan las "aspiracionales" — se comunican.
> 4. **Eliminar fuentes de verdad duplicadas.** OFFICIAL_OPOSICIONES hardcoded en TypeScript desaparece. Tabla BD es la única fuente.
> 5. **Escala a 500+ oposiciones sin cambios de código.** Añadir oposición nueva = INSERT. Nivel sube solo cuando hay datos.
>
> **Estado:** 📋 ROADMAP — Sprint A en in_progress.
>
> **Última actualización:** 2026-06-01.

## 1. Modelo de coverage_level

Niveles ordenados de menor a mayor cobertura, cada uno acumula los anteriores:

- **`catalogada`** (mínimos): nombre, slug, categoria, administracion, seguimiento_url. Sistema multi-sensor la vigila. Aparece en buscador con badge "📋 Catalogada — monitorizando convocatorias".
- **`monitorizada`**: + plazas, fechas, hitos extraídos automáticamente por LLM Haiku del sensor. Aparece con badge "🔍 Monitorizando — datos detectados". Demanda agregada para priorizar.
- **`con_temario`**: + topic_scope, topics con epígrafes literales del BOE/BOP. Aparece con badge "📚 Temario disponible".
- **`con_tests`**: + ≥50 preguntas vinculadas vía topic_scope. Aparece con badge "🎯 Tests disponibles".
- **`con_landing`**: + landing dinámica con FAQs, estadísticas, JSON-LD SEO. Aparece con badge "✨ Landing completa".
- **`full`**: + frontend dedicado (`app/<slug>/`), branding propio, integración profunda. Aparece sin badge especial.

Constraint SQL: `coverage_level TEXT NOT NULL CHECK (coverage_level IN ('catalogada','monitorizada','con_temario','con_tests','con_landing','full'))`.

**Ortogonalidad con `estado_proceso`:** son ejes independientes. Una oposición puede estar `coverage_level='con_landing'` (Vence está bien preparado para ella) Y `estado_proceso='examen_realizado'` (proceso en fase final). El usuario ve ambos.

## 2. Auto-promoción — el motor del sistema vivo

Cron nocturno `auto-promote-coverage` que cada noche evalúa cada oposición y propone subidas con criterios objetivos:

- `catalogada → monitorizada`: si el sensor LLM Haiku ha extraído al menos uno de {plazas, fecha_examen, boe_reference} y los ha guardado en la fila. Cuando se aplica la señal (auto o manual), el upgrade es automático.
- `monitorizada → con_temario`: cuando se INSERT-an topics con epígrafe + topic_scope para la oposición (>=5 topics).
- `con_temario → con_tests`: cuando `COUNT(questions vía topic_scope) >= 50`.
- `con_tests → con_landing`: cuando `landing_faqs`, `landing_estadisticas`, `examen_config` no son nulos y tienen contenido válido (validador de schema).
- `con_landing → full`: requiere intervención humana (verificar `app/<slug>/` existe + tests funcionales + branding). Manual.

Cada salto registra timestamp en una nueva tabla `coverage_history(oposicion_id, from_level, to_level, at, reason, by)`. Eso da SLAs:
- Tiempo medio `catalogada → monitorizada` (latencia de detección).
- Tiempo medio `monitorizada → con_temario` (tu velocidad de implementación).
- Etc.

## 3. Sprints

### Sprint A — Esquema BD + migración masiva (estimado 3-4h)

**Objetivo:** convertir la BD en la única fuente de verdad del catálogo.

**Tareas:**
1. Migración SQL `supabase/migrations/YYYYMMDD_oposiciones_coverage_level.sql`:
   - ALTER TABLE `oposiciones` ADD COLUMN `coverage_level` TEXT NOT NULL DEFAULT 'catalogada' CHECK (...).
   - ADD COLUMN `fetcher_type` TEXT NOT NULL DEFAULT 'http' CHECK (...) — integración con Lambda headless Sprint 1.
   - ADD COLUMN `demand_score` INTEGER DEFAULT NULL.
   - ADD COLUMN `headless_required` BOOLEAN NOT NULL DEFAULT false — atajo del audit.
   - CREATE TABLE `coverage_history` (id, oposicion_id, from_level, to_level, at, reason, by).
   - Backfill: para las 45 existentes, calcular `coverage_level` real (heurística §3.2 abajo).
2. Script Node `scripts/migrate-official-oposiciones-to-bd.cjs`:
   - Parsea `components/OnboardingModal.tsx` extrayendo las 138 entradas C1+C2.
   - Para cada una que NO existe en BD por `slug` (con guiones), INSERT mínimo con `coverage_level='catalogada'`.
   - Mapea `administracion` (Estado/Sanitaria/Local/etc.) al campo existente.
   - Idempotente (re-ejecutable sin duplicar).
3. Tests: verificar que las queries existentes siguen funcionando + nuevos tests para `coverage_level`.

**Criterio de éxito:** `SELECT COUNT(*) FROM oposiciones` pasa de ~48 a ~180 (las 48 actuales + ~130 nuevas, descontando las que ya existían en ambos). Las 45 implementadas conservan su nivel real (con_landing o full).

**Heurística inicial de `coverage_level` para las 45 existentes:**

- `full` si existe `app/<slug>/page.tsx` o `app/<slug>/test/page.tsx`.
- `con_landing` si la oposición tiene `landing_faqs`+`landing_estadisticas`+`examen_config` no nulos.
- `con_tests` si `COUNT(questions via topic_scope) >= 50`.
- `con_temario` si existe ≥5 topics activos en BD para esa `position_type`.
- `monitorizada` si tiene `convocatoria_fecha` o `exam_date` o `plazas_libres`.
- `catalogada` resto.

### Sprint B — Endpoint catálogo + cache multi-capa + refactor frontend (estimado 3-4h)

**Objetivo:** la BD es la única fuente de verdad, accesible desde frontend con latencia <50ms en el caso 99% (cache hit) gracias a una estrategia de cache profesional desde el primer momento.

**Estrategia de cache multi-capa (orden de consulta del request):**

1. **Cliente — React Cache + localStorage** (Onboarding, Selector perfil):
   - SWR (`useSWR`) con `revalidateOnFocus=false` + `dedupingInterval=600s` (10 min).
   - localStorage como fallback offline: si la primera carga falla, mostrar el último catálogo conocido.
   - El catálogo no cambia frecuentemente — caché agresivo en cliente sin penalizar UX.

2. **Vercel Edge CDN — Next.js ISR**:
   - `export const revalidate = 600` (10 min) en el endpoint.
   - Tag de invalidación: `revalidateTag('oposiciones-catalog')`.
   - Cuando una oposición cambia coverage_level / is_active / nombre / slug, el cron `auto-promote-coverage` (Sprint D) o el endpoint admin invalidan el tag.

3. **Redis Upstash (ya en uso en el proyecto)**:
   - Key: `oposiciones:catalog:v1`.
   - TTL: 600s (10 min) — alineado con Vercel ISR.
   - Pipeline de invalidación: cualquier UPDATE/INSERT en `oposiciones` que pase por la API (no SQL manual) borra esta key. Para SQL manual, el cron de invalidación nocturno la borra como red de seguridad.

4. **PostgreSQL — índices y query simple**:
   - Índice compuesto `idx_oposiciones_catalog (coverage_level, categoria, administracion)` para el filtro principal.
   - Índice `idx_oposiciones_demand_score DESC` para ordenar por demanda.
   - La query es SELECT plano sin JOINs. <50ms en p99.

5. **Backup — Materialized view** (futuro, solo si la query base supera 100ms):
   - `mv_oposiciones_catalog` refrescada cada hora.
   - Sin necesidad inicial; añadir si los datos crecen >500 filas y la latencia BD se va.

**Tareas:**

1. Migración SQL `YYYYMMDD_oposiciones_indices_catalog.sql`:
   - CREATE INDEX CONCURRENTLY `idx_oposiciones_catalog` (coverage_level, categoria, administracion).
   - CREATE INDEX CONCURRENTLY `idx_oposiciones_demand_score`.
   - CREATE INDEX CONCURRENTLY `idx_oposiciones_slug` (si no existe).

2. Endpoint `app/api/oposiciones/catalog/route.ts`:
   - `GET /api/oposiciones/catalog?categoria=C2&search=madrid&limit=50` (filtros opcionales).
   - Pipeline: Redis Upstash → query Drizzle → cachear en Redis → respuesta con headers `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`.
   - `export const revalidate = 600` para Next.js ISR.
   - Devuelve campos mínimos para listado: `id, slug, nombre, short_name, categoria, administracion, icon, coverage_level, is_active, badge_emoji, demand_score`.

3. Endpoint `app/api/oposiciones/catalog/[slug]/route.ts`:
   - `GET /api/oposiciones/catalog/<slug>` para detalle individual.
   - Devuelve TODO lo del registro + datos derivados (URL de seguimiento, fase, etc.).
   - Cache también por slug con key `oposiciones:slug:<slug>:v1` TTL 600s.

4. Helper `lib/utils/oposiciones-cache.ts`:
   - `getCatalog(opts?)` — fetcha del endpoint con SWR en cliente o desde Redis directo en server.
   - `invalidateCatalog()` — llama a `revalidateTag` + `redis.del`.
   - `searchOposicion(term, catalog)` — refactor de `matchesOposicion` actual, agnóstico de la fuente.

5. Refactor `components/OnboardingModal.tsx`:
   - Borrar array `OFFICIAL_OPOSICIONES`.
   - Reemplazar con `const { data: oposiciones } = useSWR('/api/oposiciones/catalog', fetcher, { dedupingInterval: 600_000 })`.
   - Mostrar skeleton durante primera carga (raro porque cache cliente lo evita).
   - Badge visual según `coverage_level` (catalogada, monitorizada, etc.).

6. Refactor `app/perfil/page.tsx`:
   - Eliminar array `oposiciones` hardcoded del selector.
   - Fetchar del endpoint igual que el modal.

7. Refactor `lib/utils/searchOposicion.ts`:
   - Mantener la función `matchesOposicion(o, term)` igual — recibe oposición + término.
   - El cambio es solo de dónde viene el array, no en la función.
   - Asegurar que sigue siendo agnóstica de la fuente.

8. Cache invalidation hooks:
   - Función `notifyOposicionChanged(slug)` que se llama desde cualquier UPDATE/INSERT a `oposiciones`.
   - Llama a `revalidateTag('oposiciones-catalog')` + `redis.del('oposiciones:catalog:v1', 'oposiciones:slug:<slug>:v1')`.
   - Documentar en el manual `crear-nueva-oposicion.md` que tras INSERT/UPDATE hay que llamar a esta función.

9. Tests:
   - Unitarios del endpoint con mock de Redis.
   - Integración: crear oposición → invalidar → endpoint devuelve la nueva.
   - E2E del onboarding modal mostrando las 100 catalogadas nuevas con badge.

**Criterio de éxito:**
- Onboarding y perfil siguen funcionando idénticos en UX.
- 100 catalogadas nuevas visibles en el modal con badge "📋 Catalogada".
- Latencia p95 del endpoint < 50ms (Redis hit) o < 150ms (BD fallback).
- 0 array hardcoded de oposiciones en el código TypeScript.

**Métricas a observar tras Sprint B:**
- Hit ratio del endpoint en Redis (target >90%).
- Latencia p50/p95/p99 del endpoint.
- Errores en cache invalidation (deben ser 0).

### Sprint C — Investigación masiva de `seguimiento_url` (estimado 4-6h, distribuible)

**Objetivo:** rellenar `seguimiento_url` para cada una de las ~130 nuevas catalogadas.

**Tareas:**
1. WebSearch + WebFetch sistemático por administración:
   - 17 CCAA × portal empleo público.
   - 17 servicios autonómicos de salud (TCAEs ya tienen mucha cobertura).
   - 50 BOPs provinciales (algunos ya en `detection_sources`).
   - ~25 Ayuntamientos top capitales.
2. Para cada URL: testear con audit Fase 0 (¿estática o JS-rendered?) y marcar `fetcher_type` + `headless_required`.
3. Documentar resultados en `docs/maintenance/audit-seguimiento-coverage.md` (actualizar).

**Criterio de éxito:** ≥80% de las ~130 nuevas tienen `seguimiento_url` válida + `fetcher_type` correcto.

### Sprint D — Cron `auto-promote-coverage` (estimado 2-3h)

**Objetivo:** el motor que sube niveles automáticamente.

**Tareas:**
1. Backend NestJS: cron diario `auto-promote-coverage` que evalúa cada oposición con los criterios de §2.
2. Cuando un salto aplica: UPDATE coverage_level + INSERT en `coverage_history`.
3. Emit evento a `observable_events` con metadatos del salto.
4. Métricas: COUNT por nivel diario.

**Criterio de éxito:** primer salto auto-aplicado en producción. Visible en log + history table.

### Sprint E — Frontend con badges + dashboard `/admin/oposiciones-coverage` (estimado 2-3h)

**Objetivo:** visibilidad humana del sistema vivo.

**Tareas:**
1. Listing `/oposiciones`: mostrar TODAS las `coverage_level >= 'catalogada'`, ordenadas por (demanda DESC, nivel DESC). Badge según nivel.
2. Onboarding: cuando user selecciona una `catalogada`, mensaje específico: "Hemos detectado tu interés. Te avisaremos en cuanto haya temario disponible."
3. Dashboard admin con métricas: % por nivel, SLA promedio entre niveles, top demanda en `catalogada` (priorizar implementación), oposiciones con `seguimiento_url` fallida.

**Criterio de éxito:** Manuel puede ver de un vistazo qué oposiciones merecen atención prioritaria.

### Sprint F — DESCARTADO (riesgo de spam)

**Estado:** ❌ Descartado por Manuel el 01/06/2026 tras smoke E2E.

**Razón:** el cron `notify-coverage-upgrades` envía emails masivos a users con `target_oposicion = slug` cada vez que una oposición sube de nivel. Riesgo alto de percepción como spam (un user con `auxiliar_administrativo_madrid` puede recibir varios emails al año aunque ya esté usando la app). Manuel: "no es una funcion que me interese y puede provocar spam".

**Decisión:** las promociones de `coverage_level` (Sprint D) se mantienen — Manuel las ve en `/admin` y decide manualmente si comunicar. Sin envío automático a users.

**Si en el futuro se quiere rescatar:** el código eliminado vive en commit anterior al de descarte. Se requeriría:
- Flag `DRY_RUN` por defecto.
- Frecuencia max semanal por user (deduplicación cross-oposiciones).
- Doble opt-in explícito en preferencias de email.
- Borrador del email enviado siempre a Manuel para OK antes del envío masivo.

## 4. Métricas de éxito al cerrar las 6 fases

- Cobertura: ≥95% de las oposiciones C1+C2 conocidas en España presentes en BD.
- Detección: latencia mediana <24h entre publicación oficial y señal generada.
- Auto-promoción: ≥40% de los saltos de nivel ocurren sin intervención humana.
- Frontend honesto: 0 usuarios en encuestas reportan "no entiendo qué oposiciones puedo estudiar y cuáles no".

## 5. Conexión con roadmaps relacionados

- **`docs/roadmap/deteccion-convocatorias-oeps-completo.md`**: este roadmap es la consecuencia natural de aquel. Aquel diseña los sensores; este unifica las oposiciones que vigilan.
- **`docs/maintenance/audit-seguimiento-coverage.md`**: Fase 0 ya ejecutada, output usado en Sprint C.
- **`docs/maintenance/catalogo-oposiciones-c2-c1-espana.md`**: catálogo manual usado como referencia inicial; tras Sprint A pasa a ser obsoleto (la BD es la fuente).
- **Sprint 1 Lambda headless ya en producción**: clave para `fetcher_type='headless'` en oposiciones JS-rendered.

## 6. Decisiones pendientes antes de cada Sprint

- Sprint A: ¿el slug en BD usa guiones (`auxiliar-administrativo-madrid`) o underscores (`auxiliar_administrativo_madrid`)? Decisión: convención BD = guiones (slug), config = underscores (positionType). Se mapea con `id.replace(/_/g, '-')`.
- Sprint B: ¿endpoint `/api/oposiciones/catalog` cacheado en Redis o regenerado cada N min? Decisión inicial: cachear Vercel ISR 1h. Subir a Redis si latencia >300ms p95.
- Sprint C: ¿WebSearch para cada URL una a una o batch + LLM con prompt "lista 50 BOP URLs"? Inicial: batch por administración type.
- Sprint D: ¿el cron envía email al admin antes de auto-aplicar el salto, o aplica y notifica? Para `catalogada → monitorizada` y `monitorizada → con_temario`: aplica directo. Para `con_landing → full`: requiere humano (no auto).
- Sprint F: descartado, ver §3 Sprint F.

## 7. Plan de salida (rollback)

Cada sprint es reversible:

- Sprint A: migración SQL tiene DOWN clause. Drop columnas + restore OFFICIAL_OPOSICIONES desde git.
- Sprint B: revert commit del endpoint + restore array OFFICIAL_OPOSICIONES.
- Sprint C: solo añade datos a BD. Para rollback: UPDATE seguimiento_url = NULL WHERE coverage_level = 'catalogada'.
- Sprint D: parar cron. Las filas `coverage_history` no se borran.
- Sprint E: revert components. La data BD intacta.
- Sprint F: descartado, ya no aplica.

## 8. Referencias

- Roadmap detección sensors: `docs/roadmap/deteccion-convocatorias-oeps-completo.md`
- Audit cobertura: `docs/maintenance/audit-seguimiento-coverage.md`
- Catálogo manual (obsoleto tras Sprint A): `docs/maintenance/catalogo-oposiciones-c2-c1-espana.md`
- Manual crear oposición: `docs/maintenance/crear-nueva-oposicion.md`
- Manual generar preguntas IA: `docs/maintenance/generar-preguntas-con-ia.md`
