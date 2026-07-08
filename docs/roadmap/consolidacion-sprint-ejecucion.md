# Sprint de Consolidación SSOT `convocatorias` — Plan de ejecución (paso a paso, OK por fase)

> **Diseño:** `consolidacion-convocatorias-radar-ssot.md` (qué + por qué). **Este doc = CÓMO**, ordenado, con gate de OK de Manuel por fase, verificación y rollback.
> **Regla:** ninguna fase avanza sin ✅ verificación + OK. Trabajar en **worktree** (`git worktree`) para aislar. Ejecutar en horario de bajo tráfico.
> **Estado de partida (08/07):** quick wins hechos (commits `7d749437`→`2adfc12c`, LOCAL sin push): radar no hand-set estado, guardrail apply, matcher+advance-estado leen SSOT, audit escala, 33 catalogadas limpiadas, tests. La SSOT `convocatorias` sigue con **~92/2.500 filas** (snapshot congelado). db/schema.ts stale.

---

## Fase 0 — Desplegar y verificar los quick wins (PRE-REQUISITO)
Nada de lo de abajo tiene sentido si los fixes no están vivos.
1. **Push + deploy** backend (radar, matcher, advance-estado) + frontend (apply guardrail, audit-estados).
2. **Verificar en prod (24-48h):**
   - `advance-estado` corre y su dual-write toca `convocatorias` (mirar `updated_at` de las 92 con fila).
   - No aparecen NUEVAS date-less open (`SELECT count(*) FROM oposiciones WHERE estado_proceso IN ('inscripcion_abierta','convocada') AND inscription_start IS NULL`) → debe seguir en 4 (las legítimas pre-inscripción).
   - `audit-estados` no lanza falsos rojos por las 4 convocadas.
- **Rollback:** revert de los commits (son aditivos/no-esquema).
- **🚦 GATE:** OK de Manuel tras 48h estable.

## Fase 1 — Poblar la SSOT (backfill `convocatorias` para TODAS)
La causa raíz: 2.408 oposiciones sin fila en `convocatorias` → la vista cae a legacy. Objetivo: **cada oposición con una fila `is_current` en `convocatorias`** = snapshot de sus columnas de convocatoria actuales.
1. Migración idempotente: por cada oposición SIN `convocatorias is_current`, INSERT copiando `estado_proceso, plazas_*, inscription_*, exam_date, exam_date_approximate, oep_*, boe_*, convocatoria_*, landing_estadisticas, landing_description, landing_faqs, examen_config, requisitos_especiales`; `año` = year de `oep_fecha`/`convocatoria_fecha`/`CURRENT_DATE`; `is_current=true`.
2. `ON CONFLICT (oposicion_id, año) DO NOTHING` (no pisar las 92 ya buenas).
- **Verificar:** `count(convocatorias is_current) == count(oposiciones)`; muestrear 20 en `oposiciones_ssot` = valores esperados; los 46 reconciliados a mano el 06/07 no se rompen.
- **Rollback:** `DELETE FROM convocatorias WHERE created_at >= '<sprint>' AND is_current` (las filas nuevas son identificables por timestamp — pasar el timestamp por args, no `now()` en script).
- **🚦 GATE:** OK.

## Fase 2 — Todos los lectores → vista SSOT (completar)
Checklist "NADA SE PIERDE" §1-6. Ya migrados: catálogo API, matcher Next, matcher backend (08/07). **Verificar uno a uno que NO leen `oposiciones.<col convocatoria>` directo:**
1. `getOposicionLandingData` (landing, mayor consumidor) — resolver `requisitos_especiales/seo_title/color_primario` (se quedan en oposiciones).
2. Banner + CTA home + `/oposiciones` (comparten `lib/oposiciones/inscripcion.ts`) — migrar A LA VEZ.
3. ROI Google Ads (`exam_date`) → `oposiciones_ssot.exam_date`.
4. Chat contextual.
5. `is_convocatoria_activa` → `is_current AND archived_at IS NULL`.
- **Verificar:** grep de lectura de columnas legacy de convocatoria en `oposiciones` = 0 fuera de la vista; landing/catálogo/banner idénticos antes/después (snapshot visual).
- **🚦 GATE:** OK.

## Fase 3 — E2E del puente `promoteSignalToConvocatoria`
Escrito (Fase 3) pero solo validado SQL+typecheck. Guardrail ya extraído+testeado (`estadoParaPromover`, 6 tests).
1. **Test de integración** (o E2E manual en `/admin/oep-signals`): aplicar una señal real con fechas → verificar `convocatorias` actualizada + `oposiciones_ssot` refleja + NO diverge legacy (o queda cubierto por el dual-write de la propia función).
2. Caso guardrail: aplicar señal `inscripcion_abierta` SIN deadline → NO escribe estado (queda null → advance-estado deriva).
- **🚦 GATE:** OK.

## Fase 4 — (HECHO) `discovered_processes` dropped. Sin acción.

## Fase 5 — Cortar el dual-write + re-introspectar + drop legacy (IRREVERSIBLE)
Solo cuando Fases 1-3 ✅ y estables.
1. **Writers → solo SSOT:** `advance-estado` deja de escribir `oposiciones.estado_proceso` (solo `convocatorias`). `check-seguimiento` se queda en `oposiciones` (columnas `seguimiento_*` = del cuerpo, correcto). `auto-promote-coverage` se queda (`coverage_level` = del cuerpo).
2. **Re-introspectar `db/schema.ts`** (`npx drizzle-kit introspect`) para modelar el `convocatorias` VIVO → elimina el SQL crudo disperso (advance-estado, oep-signals, promote). Revisar el diff con lupa (no arrastrar drift de otras tablas).
3. **Backfill `convocatoria_hitos.convocatoria_id`** al 100% (hoy 11%) ANTES de que nada filtre por él (checklist §10) — con UPDATE de FK, NUNCA DELETE+INSERT (alertas 🔔, §9).
4. **DROP columnas legacy** de `oposiciones` (estado_proceso, plazas_*, inscription_*, exam_date*, oep_*, boe_*, convocatoria_*, landing_estadisticas/faqs, examen_config, requisitos_especiales). **IRREVERSIBLE** → solo tras confirmar 0 lectores (Fase 2) + tests de consistencia verdes.
- **Verificar:** `npx jest __tests__/integration/oposicionesDataConsistency`; smoke de landing/catálogo/home/banner/ROI; radar E2E.
- **Rollback:** el drop no tiene rollback fácil → **backup/snapshot RDS antes**; hasta el drop, todo es reversible.
- **🚦 GATE FINAL:** OK.

---

## Riesgos y mitigaciones
- **Divergencia durante la transición:** mientras conviven las dos tablas, el dual-write las mantiene; el orden (poblar SSOT → migrar lectores → cortar dual-write → drop) evita ventanas de incoherencia.
- **Alertas 🔔 / hitos:** reasociar por UPDATE de FK, nunca DELETE+INSERT (re-spam de campana).
- **Sesiones paralelas:** commit atómico por fase; worktree aislado.
- **`convocatorias_boe` (20k) / `convocatorias_legacy` (año de examen):** FUERA de scope, no tocar (ingesta / FK de exámenes).

## Orden de merge
Fase 0 (deploy quick wins) → 1 → 2 → 3 → 5. Cada una su PR/commit con verificación adjunta. Nada se pushea a `main` sin la verificación de su fase.
