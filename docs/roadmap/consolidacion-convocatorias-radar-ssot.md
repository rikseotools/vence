# Roadmap — Consolidación SSOT: `oposiciones` · `convocatorias` · radar · competidores

> **Detonante (06/07/2026):** el bug de León (tarjeta de catálogo sin fechas de inscripción) destapó que el concepto "convocatoria/proceso" está modelado en **6 tablas** con columnas casi idénticas, sin una fuente de verdad única y sin pipeline que las una. Este documento **amplía `sprint-g-oposiciones-vs-convocatorias.md`** (que solo cubría `oposiciones` vs `convocatorias`) para incluir el **radar OEP** y dejar claro qué queda **fuera** (competidores, BOE harvest).
>
> **Basado en auditoría exhaustiva de 6 frentes (06/07/2026)** — lectores/escritores/funcionalidad de cada tabla verificados en código + datos vivos (RDS). Objetivo rector: **una sola fuente de verdad por concepto, SIN perder ninguna funcionalidad.**
>
> **Estado:** 📋 DISEÑO para revisión. No ejecutar esquema sin OK de Manuel.

---

## 1. Principio rector

**Una fuente de verdad por concepto.** Tres conceptos ortogonales, tres capas:

| Concepto | Tabla | Rol |
|---|---|---|
| **Cuerpo** (estable: identidad + temario + relaciones de usuario) | `oposiciones` | **Ancla**. Todo lo de usuario (seguidas, alertas, hitos, seguimiento, coverage) cuelga de `oposicion_id`. NO se fragmenta por año → evita el bug Madrid-2025. |
| **Proceso confirmado** (temporal: plazas, fechas, estado, BOE, `is_current`) | `convocatorias` | **SSOT del proceso**. Lo leen TODAS las superficies (landing, catálogo, home, banner, chat, ROI ads, matcher). |
| **Detección cruda** (append-only + triaje) | `oep_detection_signals` | **Capa de ingesta**. `is_novel`, `confidence`, `dedupe_key`, `raw_extraction`. "Aplicar" **promueve** a `convocatorias`. |

Fuentes que ALIMENTAN la detección (no son verdad, son entrada): `convocatorias_boe` (BOE), sensores del radar, PAG, competidores.

```
FUENTES:  convocatorias_boe · sensores boletín/LLM · PAG · competidores(Capa 3)
              │  (crudo, append-only)
              ▼
   oep_detection_signals  ──[triaje "Aplicar" = promover]──►  convocatorias  (SSOT proceso)
   (is_novel/confidence/dedupe/raw)                                │ FK
                                                                   ▼
                                                              oposiciones  (CUERPO = ancla)
                                                                   │
   satélites (hitos·seguidas·alertas·seguimiento·coverage) ──oposicion_id──┘
                                                                   │
   Lectores (landing·catálogo·home·banner·chat·ROI·matcher) ─────► convocatorias
```

---

## 2. Estado real hoy (auditado, no asumido)

- **`convocatorias` (91 filas) es un SNAPSHOT CONGELADO:** todas las filas tienen `created_at = updated_at = 2026-06-01` (el backfill único de `sprint-g-migrate-data.cjs`). **Ningún cron runtime ni rebuild la actualiza** (advance-estado, check-seguimiento y las altas escriben solo `oposiciones`). Solo 2 lectores migrados (catalog API + auto-promote). Consecuencia medida (06/07): **46 convocatorias vigentes tenían estado/plazas/fechas divergentes de `oposiciones`** — el catálogo mostraba datos de junio-1 (p.ej. SAS Andalucía 5.101 plazas vs 1.789 reales tras el rollover OEP 2025). **`oposiciones` es la fuente autoritativa** (fresca); `convocatorias` estaba silenciosamente equivocada. **Reconciliado a mano (sync `oposiciones→convocatorias` de las 46) el 06/07 como tirita** — pero volverá a divergir en cuanto un cron toque `oposiciones` sin tocar `convocatorias`. El fix permanente es la Fase 1.
- **`oposiciones` sigue siendo la fuente autoritativa:** ~9 grupos de lectores (landing, `/oposiciones`, home, banner, chat, ROI ads, matcher radar) leen sus columnas legacy.
- **`db/schema.ts` STALE:** introspectado del Supabase congelado; el `convocatorias` que modela es en realidad el actual `convocatorias_legacy`. No modela el `convocatorias` vivo.
- **Backfill `convocatoria_hitos.convocatoria_id` al 11%** (147/1296). `convocatoria_id` no se lee en NINGÚN sitio del código (todo va por `oposicion_id`).
- **`discovered_processes` (13) = experimento muerto** (sin writer; seed manual de junio ya consumido; único lector = un contador de badge que hoy da 0).
- **`convocatorias_boe` (20k) = cosecha BOE de otro grano;** cron `sync-convocatorias` desactivado, página `/convocatorias` eliminada → hoy huérfana pero es infraestructura de ingesta.
- **`convocatorias_legacy` (10)** solo sobrevive por FK de `articulos_examenes`/`preguntas_examenes_oficiales` (código muerto, 6 filas) — preserva el **año del examen** oficial.
- **Competidores:** encapsulado y ortogonal; alimenta Capa 3 del radar unidireccionalmente. **Fuera de scope.** (Construido, sin desplegar.)

---

## 3. Checklist "NADA SE PIERDE" (criterios de HECHO por fase)

De la auditoría — cada funcionalidad tiene destino; ninguna se elimina:

1. **Landing `/[oposicion]`** (mayor consumidor, ~30 cols) + **JSON-LD FAQPage/Event** → reapuntar `getOposicionLandingData` a `convocatorias`+`oposiciones`. Resolver `requisitos_especiales`, `seo_title`, `color_primario` (se quedan en `oposiciones`).
2. **Catálogo `/oposiciones` + banner + CTA home** comparten `lib/oposiciones/inscripcion.ts` → migrar las 3 superficies A LA VEZ (o se contradicen).
3. **`is_convocatoria_activa`** (no existe en `convocatorias`) → mapear a `is_current && archived_at IS NULL`.
4. **Campos card-only** (`landing_features/requirements/difficulty/duration`, `temas_count`, `bloques_count`, `diario_*`) → decidir hogar (quedan en `oposiciones` salvo decisión contraria).
5. **ROI Google Ads** (`exam_date`, "fuente única oposiciones") → reapuntar a `convocatorias.exam_date`.
6. **Matcher radar** (`lib/api/oep-signals/queries.ts`) lee estado/plazas/oep de `oposiciones` → reapuntar a `convocatorias`.
7. **Los 3 crons writers** → mover a `convocatorias` ANTES del drop: `advance-estado` (único que escribe `estado_proceso`), `check-seguimiento` (único que escribe `seguimiento_*`). `auto-promote-coverage` escribe `coverage_level` en `oposiciones` → **se queda ahí** (es del cuerpo, OK).
8. **Año del examen oficial** en `convocatorias_legacy` → preservar como edición histórica antes de repuntar FK de exámenes.
9. **Alertas 🔔**: `user_oposicion_alerts.hito_id` es `ON DELETE CASCADE` → reasociar hitos con **UPDATE de FK, NUNCA DELETE+INSERT** (si no, se borran avisos entregados + se re-spamea la campana; el `ON CONFLICT` no protege si cambia el `hito_id`).
10. **Backfill `convocatoria_hitos.convocatoria_id`** completarlo ANTES de que ningún reader filtre por él (o desaparece el 89% de los timelines de las landings).
11. **Radar `is_novel`/descubrimiento huérfano** debe quedarse en la capa de señales (`convocatorias.oposicion_id` es NOT NULL FK → no aloja descubrimientos sin catalogar).
12. **`detected_*` = "propuesto sin verificar"** ≠ campos confirmados de `convocatorias`. El gate §4e (email/publicación solo desde hito verificado por humano) se mantiene aunque el destino sea `convocatorias`.

---

## 4. Plan por fases (cada una reversible; BD → readers → writers → drop)

### Fase 0 — Higiene (sin riesgo)
- Re-introspectar `db/schema.ts` contra RDS (modelar el `convocatorias` vivo + `convocatorias_legacy`).
- Borrar código muerto/roto del esquema viejo: `getConvocatoriaActiva`, `components/ConvocatoriaLinks.tsx` (0 imports), `_tmp_setup_clm/ext/gva.cjs`.
- Exponer el tag `oposiciones-catalog` en `/api/admin/revalidate` (hoy no está en el whitelist → no se puede invalidar el catálogo a mano).

### Fase 1 — Parar la hemorragia (alta ya parcheada 06/07)
- ✅ **HECHO (06/07):** manual §2c reescrito con esquema vivo; gate `audit:oposicion` FASE 2c endurecido (exige `estado`/`plazas`/`inscription_*` consistentes con el cuerpo); **sync tirita de 46 convocatorias vigentes** `oposiciones→convocatorias` (divergentes → 0).
- ✅ **HECHO (06/07):** `advance-estado` ahora hace **dual-write** — tras avanzar `estado_proceso` en `oposiciones`, refleja el estado en la convocatoria vigente (`UPDATE convocatorias … WHERE is_current`, SQL crudo porque no hay modelo Drizzle). Corta la deriva diaria de `estado_proceso` en el catálogo. (Typecheck limpio; SQL idéntico al de la sync ya probada. **Sin desplegar** — surte efecto al pushear el backend.)
- Pendiente Fase 2: `check-seguimiento` escribe `seguimiento_*`, que **nadie lee aún de `convocatorias`** → su dual-write es preparatorio, se hace cuando el panel `/admin/seguimiento-convocatorias` migre a leer `convocatorias`. Los rebuilds `_*_fase23` ya dual-escriben plazas/fechas.

### Fase 2 — Migrar lectores a `convocatorias`
- ✅ **HECHO (06/07): `getOposicionLandingData`** (la landing `/[oposicion]` + JSON-LD SEO, el mayor lector). Reescrito a SQL crudo con `LEFT JOIN LATERAL` a la convocatoria vigente + `COALESCE(convocatorias, oposiciones)` por campo temporal (cuerpo se queda en `oposiciones`). Verificado contra RDS (León muestra fechas; SAS 1.789 no 5.101; catalogada sin fila cae al fallback). Ahora **landing y catálogo leen la misma fuente**. Typecheck limpio.
- ✅ **PATRÓN ELEGIDO Y APLICADO (06/07): VISTA `oposiciones_ssot`** (migración `20260706_oposiciones_ssot_view.sql`, aplicada a RDS). Drop-in de `oposiciones` (57 columnas, mismos nombres) con los 21 campos temporales resueltos vía `COALESCE(convocatoria is_current, oposiciones)`. El merge vive UNA sola vez en la vista. Objeto Drizzle type-safe en `db/oposicionesSsot.ts` (`pgView(...).existing()`).
- ✅ **TODOS los lectores temporales migrados** a la vista (barrido exhaustivo, no solo los 7 del audit inicial):
  - **SQL crudo → `FROM oposiciones_ssot`:** landing, `/oposiciones` (getOposiciones), home (getOpenConvocatorias), `/oposiciones/[filtro]` (getFiltered + getCatalogadasAbiertas), getAllOposicionesCardData, y el **catálogo** (COALESCE añadido a su LATERAL → deja de mostrar en blanco las ~518 catalogadas sin fila).
  - **Drizzle → alias `oposicionesSsot as oposiciones`** (solo lectura, 0 escrituras): banner (open-inscriptions + dismiss), ROI ads, chat (loadOposicionesCache + chat/queries + ChatOrchestrator), stats/queries, **matcher radar** (`oep-signals/queries`, incl. leftJoin). Typecheck limpio.
- **Se dejan en `oposiciones` DELIBERADAMENTE** (no son cabos sueltos): auditores de integridad (`audit-estados`, `oep-consistency` — deben ver la tabla cruda), `seguimiento-convocatorias` (campos `seguimiento_*` viven en `oposiciones`), y lectores solo-cuerpo (coverage, suggestions, seguidas, newsletters, temario, competitors).
- Pendiente menor: decidir si se cablea `mv_oposiciones_activas` (existe, nadie la lee) o se descarta.

### Fase 3 — Puente radar → `convocatorias`  ✅ (código, 06/07)
- ✅ **`reviewSignal` "Aplicar" ahora PROMUEVE** (`lib/api/oep-signals/queries.ts`, `promoteSignalToConvocatoria`): al aplicar una señal matcheada (con `oposicion_id`), vuelca sus `detected_*` a la **convocatoria vigente** (SSOT) + dual-write a `oposiciones.*` (para advance-estado/auditores). Reglas de seguridad: **COALESCE** (solo escribe lo detectado, nunca pisa con NULL); **ciclo nuevo** (`detected_year` > año vigente) → archiva la vigente + INSERT (con `ON CONFLICT (oposicion_id, año)`); promueve **antes** de marcar `applied` (si falla, no la marca); refresca `landing`. El admin ve los `detected_*` en el panel antes de Aplicar → acción verificada (§4e). Dry-run verificado contra RDS + typecheck limpio.
- **Señales `is_novel` (sin `oposicion_id`)** siguen catalogándose a mano (crear la oposición primero; `convocatorias.oposicion_id` es NOT NULL FK) — el puente solo cubre matcheadas, por diseño.
- Los sensores siguen escribiendo señales crudas; NO escriben `convocatorias` directo (preservar §3.11/§3.12).
- ⚠️ **Pendiente antes de desplegar:** probar el flujo real en el panel `/admin/oep-signals` (E2E) — aquí solo se validó SQL + typecheck.

### Fase 4 — Retiros  ✅ (06/07)
- ✅ **Backup previo** de las 39 filas de las 5 tablas → `docs/roadmap/fase4-backup-tablas-retiradas.json` (restaurable).
- ✅ **`discovered_processes` + `discovered_process_milestones` DROPPED**: experimento muerto (0 writer, badge siempre 0). Desacoplado el badge `discoveredCount` (query eliminada de `getPendingSignalsCount`; el campo queda a 0 por compat). El `promoted_to_oposicion_id` de las 13 filas queda en el backup.
- ✅ **`convocatorias_legacy` + `articulos_examenes` + `preguntas_examenes_oficiales` DROPPED**: clúster de código muerto (0 lectores, 16 filas). El año-de-examen (2021/22/23) queda en el backup. Sin dependientes externos → drop en bloque (transacción).
- Pendiente NO bloqueante: backfill `convocatoria_hitos.convocatoria_id` (§3.10) — hoy 11%, pero **nadie lo lee** (todo va por `oposicion_id`), así que no urge; completar con UPDATE (§3.9) antes de que algún reader lo use.
- ⚠️ **Cabo suelto post-DROP (Fase 0):** `db/schema.ts` (stale) aún modela `convocatorias`(=legacy) + las tablas de examen, y existe `getConvocatoriaActiva`/`ConvocatoriaLinks` muertos que las referencian → re-introspectar schema + borrar ese código muerto. No rompe runtime (0 consumidores).

### Fase 5 — Drop de columnas legacy de `oposiciones`
- Solo tras Fases 1-4 reposadas: eliminar las ~22 columnas de convocatoria de `oposiciones` (o dejarlas como vista/GENERATED sobre la vigente durante un ciclo). Auditar los ~15 lectores de `estado_proceso` antes del drop.

---

## 5. Fuera de scope (confirmado por auditoría)

- **Competidores** (`competitor_*`): módulo autónomo, ortogonal, no toca convocatoria. Solo alimenta Capa 3 del radar vía `getRadarCandidates`. NO se toca. (Pendiente propio: desplegar a Fargate — 0 runs en prod.)
- **`convocatorias_boe`**: cosecha nacional BOE de grano distinto (20k publicaciones + cadenas `convocatoria_origen_id`). Se queda como **staging de ingesta** (fuente que puede alimentar el radar/convocatorias), NO se funde en `convocatorias`. Reactivar su cron es decisión aparte.

---

## 6. Acción inmediata pendiente (no bloqueante)
- **Newsletter León** (`administrativo-universidad-leon`, inscripción cierra 13/07) — la tarjeta del catálogo ya muestra fechas tras el backfill.
- Verificar a Estela (usuaria que la pidió; su target sigue siendo la Auxiliar).

---
## Quick wins ejecutados (08/07/2026)

Sin esperar al esquema completo, se atacó la chapuza raíz (**`estado_proceso` fijado a mano sin fechas → tarjetas invisibles en la home**). Auditoría del radar/OEP-signals confirmó: la consolidación estaba al **~4% (92/2.500 con fila en `convocatorias`)**; el resto vive en `oposiciones` legacy y el discovery escribía estado a ciegas.

**Principio reforzado:** **`estado_proceso` se DERIVA de las fechas verificadas (`advance-estado`), NUNCA se afirma a mano.** Sin `inscription_deadline` no se puede saber si un plazo está abierto.

Cambios (commits `7d749437`, `94d6a60d`):
1. **Radar no afirma estado** — `radar/layers/competitors/oposiciones-es.ts` pone `estado=null` (era `'inscripcion_abierta'` a ciegas). **Guardrail central en el apply** (`lib/api/oep-signals/queries.ts` `promoteSignalToConvocatoria`): nunca escribe `inscripcion_abierta`/`convocada` sin `deadline`.
2. **Matcher del backend → vista SSOT** (`oep-signals-queries.service.ts` `loadOposicionesForMatch` + byBoc leen `oposiciones_ssot`, no `oposiciones` legacy). Cierra el gap de Fase 2 (el gemelo backend quedó fuera del barrido).
3. **`audit-estados`** escala incoherencias de estado↔fechas; `convocada` sin fechas = **warn** (pre-inscripción legítimo, no error — bases publicadas, plazo por abrir).
4. **Data (prod):** 33 catalogadas date-less con estado abierto → `sin_oep`. Las convocadas reales (bases publicadas, plazo pendiente de BOE: Cádiz 44plz, Badajoz 9plz…) NO se tocaron — su estado es correcto; el seguimiento las auto-avanzará al abrir el plazo.

**Sigue pendiente el sprint** (Fases 3-5): E2E del puente `promoteSignalToConvocatoria`, re-introspectar `db/schema.ts` (modela el legacy), drop de columnas legacy de `oposiciones`, y verificar despliegue del dual-write de `advance-estado`.

**Plan de ejecución paso a paso (con OK por fase):** `docs/roadmap/consolidacion-sprint-ejecucion.md`.
