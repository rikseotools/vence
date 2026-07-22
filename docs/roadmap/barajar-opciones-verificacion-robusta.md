# Barajar opciones — verificación robusta (manual de diseño)

> **Objetivo:** que "¿es seguro barajar esta pregunta?" sea una propiedad **verificada,
> persistida y auto-invalidable del dato**, no una adivinación por regex en cada
> request. Mismo estándar que el lifecycle de preguntas (`is_active` GENERATED) y la
> verificación de scope (`topic_scope_verification`, auto-invalidada por trigger).
>
> Contexto y Fase 1/2: `barajar-opciones-fase1-spec.md`. Tarea T-080.

## Por qué (el problema con el enfoque "regex en serve")

Fase 1/2 decide la elegibilidad con `isShuffleEligible()` = `shuffle_mode='full'` ∧ un
regex sobre la explicación, **en cada petición**. Medido sobre 117.961 preguntas reales,
un regex NO alcanza un 0-FN demostrable (letras en negrita markdown, ordinales,
numeradas, frases raras). Un falso negativo = explicación rota visible al usuario. Un
heurístico en el hot-path no es auditable por-pregunta, ni robusto ante ediciones
futuras (alguien edita la explicación y mete "la B" → la pregunta seguía barajándose).

## Principio: la seguridad es DATO verificado, no decisión en vivo

Calcado a lo que el proyecto ya usa y en lo que confía:
- **Lifecycle** (`lifecycle_state` → `is_active` GENERATED, `transition_question_state`, audit append-only): invariante por construcción.
- **`topic_scope_verification`** (`never_verified/verifying/verified_*/stale`, trigger de invalidación por hash de contenido): "verified_issues" = revisión humana, no "seguro mal".

## Modelo de datos (columnas en `questions`)

- `shuffle_safety text NOT NULL DEFAULT 'unverified'` CHECK ∈ `('unverified','safe','unsafe','stale')`.
  - `unverified` — nunca comprobada (default; NO se baraja).
  - `safe` — verificada barajable (detector determinista **y**, en Paso 2, auditoría LLM).
  - `unsafe` — la explicación/opciones referencian posición/letra, o `shuffle_mode≠full` → NO barajar.
  - `stale` — se verificó pero el contenido cambió desde entonces (trigger) → re-verificar.
- `shuffle_safety_reason text` — provenance del veredicto (`deterministic_v3`, `llm_audit`, `not_full`, la clase detectada…).
- `shuffle_safety_hash text` — hash del contenido (explicación + opciones + `shuffle_mode`) sobre el que se emitió el veredicto.
- `shuffle_safety_verified_at timestamptz`, `shuffle_safety_verified_by text` — provenance.

Auditoría: tabla append-only `question_shuffle_safety_history` (opcional en Paso 1, recomendada).

## Auto-invalidación por trigger (anti-drift — el corazón de "sin fallos")

`compute_shuffle_safety_hash(question)` = `md5` determinista de explicación + `option_a..e` + `shuffle_mode`.

Trigger `BEFORE UPDATE` en `questions`: si el hash del contenido NUEVO difiere de
`NEW.shuffle_safety_hash` y el estado es `safe`/`unsafe`, poner `NEW.shuffle_safety='stale'`.
- Cuando el verificador escribe (`state='safe'` + `hash=hash_actual`) en el mismo UPDATE → coinciden → NO se marca stale.
- Cuando un edit cambia la explicación sin tocar el hash → difieren → `stale` → deja de barajarse hasta re-verificar.
- Es `BEFORE UPDATE` puro (solo muta `NEW`), no puede romper el UPDATE.

## Gate de serve (defensa en profundidad)

`shuffleEligible(q) = q.shuffle_mode==='full' ∧ q.shuffle_safety==='safe' ∧ !explanationReferencesLetters(q.explanation)`.
El **dato verificado manda**; el regex determinista queda como **última línea barata**
contra un flag stale/erróneo (múltiples capas, `feedback_feature_multiples_capas_seguridad`).
Sin backfill → todo `unverified` → no baraja (más inerte todavía).

## Pipeline de verificación (verifica → audita → aplica)

1. **Determinista (Paso 1, backfill):** el detector endurecido marca `safe`/`unsafe` + hash. Barato, sesgo 0-FN.
2. **Auditoría LLM (Paso 2):** modelo barato (OpenRouter, `reference_openrouter_modelos_gratis` + harness de verificación) sobre las `safe` con smell → confirma o baja a `unsafe` con razón. Da el **0-FN práctico** que el regex no promete. Persiste veredicto + provenance. Re-corre sobre `stale`.

## Observabilidad (martillo)

- Serve: `shuffle_options_request_active` (cobertura). Validador: `shuffle_option_order_invalid` (warn, clave rota). [ya en Fase 2]
- **Drift sweep** ✅: `scripts/sweep-shuffle-safety-drift.ts` (detector REAL, prefiltro SQL, ~5s) → `health-sweep.cjs` kind `shuffle_safe_regressed` + frase *"revisa el barajado"*. Caza `safe` que citen letras + integridad del trigger (hash).
- **Métrica de éxito** ✅: `scripts/metric-shuffle-position-bias.ts` (baseline pre/post-piloto desde `test_questions`). BASELINE 22/07 (90 días, n≈1,12M): spread de accuracy por posición de la correcta **1,8%** (plano → la posición no sesga directo); **LIFT en repeticiones +14,6%** (1er intento 59,9% → repeticiones 74,5%) = la parte de "memorizo la posición" que barajar debe recortar; **23,4%** de las exposiciones caen sobre preguntas `safe` (cobertura al encender). Re-correr tras el piloto y comparar el lift.
- **Canary prod:** verifica el invariante en BD (no solo 200). [pendiente wiring al framework de canaries]

## Rollout escalable

Flag `FEATURE_SHUFFLE_OPTIONS` + `SCOPE` por oposición (ya) + bucket de canario **por-usuario** (ramp 1%→…). Encender solo con Pasos 1-2 verdes y la métrica vigilada. Reversible en un cambio de SSM.

## Estado final (definitivo, en paralelo)

- **Fase 2 explicaciones estructuradas sin letras** → la seguridad deja de ser condicional: toda pregunta barajable.
- **Validación server-authoritative** → el server valida por `option_order` y deja de mandar `correct_option` al cliente → cierra el barajado **y** el leak conocido (`project_pending_filtered_correct_option_leak`).

## Orden de construcción

1. ✅ **HECHO** Columnas `shuffle_safety*` + `compute_shuffle_safety_hash` + trigger de invalidación + `record_shuffle_safety` + audit history + backfill determinista + gate de serve. Migración `20260722_shuffle_safety_verification` aplicada a RDS. Backfill: safe 72.068 / unsafe 62.578.
2. ✅ **HECHO** Auditoría LLM (`scripts/audit-shuffle-safety-llm.ts`, ensemble 3 modelos, umbral mayoría) sobre las 9.585 `safe` con smell → **6.362 safe confirmadas + 3.223 bajadas a unsafe** (labels que el regex no caza). Estado: safe 68.845 / unsafe 65.863. GOTCHA: el backfill (1ª capa) NO debe re-procesar filas ya auditadas por el LLM → solo `unverified/stale` (recuperación via audit history si pasa).
3. ✅ **HECHO** Drift finding (`shuffle_safe_regressed`) + métrica de éxito (`metric-shuffle-position-bias.ts`, baseline arriba). Falta: wiring del canary al framework de canaries (opcional).
4. Rollout por-usuario; encender piloto (1 opos vía `FEATURE_SHUFFLE_OPTIONS_SCOPE`).
5. Fase 2 (estructuradas + server-authoritative; cierra el leak `correct_option`).
