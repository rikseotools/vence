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

### Sprint B — Eliminar `OFFICIAL_OPOSICIONES` hardcoded (estimado 2h)

**Objetivo:** la BD es la única fuente de verdad. El componente `OnboardingModal` fetcha en vez de tener array hardcoded.

**Tareas:**
1. Crear endpoint `/api/oposiciones/catalog` que devuelve TODAS las oposiciones con `coverage_level >= 'catalogada'`, paginado.
2. Refactor `OnboardingModal.tsx`: borrar array `OFFICIAL_OPOSICIONES`, llamar al endpoint.
3. Refactor `app/perfil/page.tsx` igual.
4. Refactor `lib/utils/searchOposicion.ts` para trabajar con datos del endpoint.
5. Tests adaptados.

**Criterio de éxito:** búsqueda de oposición en onboarding sigue funcionando idéntica. Sin diff visible para el usuario.

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

### Sprint F — Alertas y newsletter automatizada (estimado 1-2h)

**Objetivo:** monetizar la detección. Cuando una `catalogada` sube de nivel, los usuarios con `target_oposicion = X` reciben aviso.

**Tareas:**
1. Cron `notify-coverage-upgrades`: lee `coverage_history` últimas 24h, agrupa por oposición, envía email a `user_profiles.target_oposicion = slug`.
2. Plantilla email: "Tu oposición X ha pasado de Y a Z. Empieza a estudiar aquí: <link>".
3. Para saltos a `con_landing` o `full`: incluye newsletter con highlight de funcionalidad nueva.
4. Bell campana en la app.

**Criterio de éxito:** primera notificación enviada cuando una `monitorizada` sube a `con_temario`.

## 4. Métricas de éxito al cerrar las 6 fases

- Cobertura: ≥95% de las oposiciones C1+C2 conocidas en España presentes en BD.
- Detección: latencia mediana <24h entre publicación oficial y señal generada.
- Auto-promoción: ≥40% de los saltos de nivel ocurren sin intervención humana.
- Conversión: ≥10% de usuarios con `target_oposicion=X` clican el email cuando su oposición sube a `con_temario`.
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
- Sprint F: ¿qué umbral de demanda dispara newsletter? Inicial: ≥10 usuarios con `target_oposicion=X`.

## 7. Plan de salida (rollback)

Cada sprint es reversible:

- Sprint A: migración SQL tiene DOWN clause. Drop columnas + restore OFFICIAL_OPOSICIONES desde git.
- Sprint B: revert commit del endpoint + restore array OFFICIAL_OPOSICIONES.
- Sprint C: solo añade datos a BD. Para rollback: UPDATE seguimiento_url = NULL WHERE coverage_level = 'catalogada'.
- Sprint D: parar cron. Las filas `coverage_history` no se borran.
- Sprint E: revert components. La data BD intacta.
- Sprint F: parar cron. Emails enviados no se rebotan.

## 8. Referencias

- Roadmap detección sensors: `docs/roadmap/deteccion-convocatorias-oeps-completo.md`
- Audit cobertura: `docs/maintenance/audit-seguimiento-coverage.md`
- Catálogo manual (obsoleto tras Sprint A): `docs/maintenance/catalogo-oposiciones-c2-c1-espana.md`
- Manual crear oposición: `docs/maintenance/crear-nueva-oposicion.md`
- Manual generar preguntas IA: `docs/maintenance/generar-preguntas-con-ia.md`
