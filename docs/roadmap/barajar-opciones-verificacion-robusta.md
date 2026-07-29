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

### La NARRATIVA de la explicación estructurada también entra en el gate (T-262, 29/07/2026)

Con explicación estructurada la seguridad deja de depender del flag: las razones van keadas al
índice de su opción y la letra la pone el render. Esa afirmación es cierta **para las razones** y
se extendió sin querer a todo el objeto. No lo es para `intro` y `outro`: son texto libre que el
render emite **verbatim en cualquier orden**.

```
La respuesta correcta es la **C**.     ← intro, FIJO
…
**Por qué A es correcta:** …           ← cabecera, la calcula el render
```

**Medido el 29/07:** 1.211 activas `safe` así. Se colaron por el camino de **transcripción**, no
por el de escritura: el 27/07 se arregló que el backfill perdía el párrafo de contexto y pasó a
capturar el `intro` verbatim — con la línea de la letra dentro. Ninguna llegó a servirse barajada
(`option_order` está a NULL en toda la historia de `test_questions`), así que es una mina sin
detonar; estallaría al reencender el piloto ([T-235]).

Las **cuatro capas** que decían "safe por construcción" y hoy miran también la narrativa:

| Capa | Qué se añadió |
|---|---|
| Gate de serve (`isShuffleServeEligible`) | Parámetro `structuredNarrative` — con letra clavada, **no baraja** aunque esté `safe` |
| Escritura (`aplicar-explicacion.ts`) | Rechaza cualquier letra en `intro`/`outro`, no solo la apertura canónica |
| Transcripción (`parse*Explanation`) | `podarAperturaConLetra` — la apertura no entra en la estructura |
| Detector nocturno (`sweep-shuffle-safety-drift.ts`) | Cuenta aparte `narrative_stale_letters` → hallazgo `shuffle_narrativa_letra_clavada` |
| Simulación (`sim-explicacion-estructurada-gates.ts`) | Aserción de **no-contradicción**: renderizaba en todas las posiciones pero solo comprobaba que la cabecera existiera |

**Reparar:** `npm run shuffle:narrativa` (dry-run) → `-- --apply`. Poda la apertura **solo si la
línea es exactamente esa frase**. Reparto real: **887 podables** (estilo boletín; pierden una línea
redundante porque la cabecera «Por qué C es correcta» ya la anuncia) y **337 a criterio humano**.

> ⚠️ Las 337 son el formato §5.1, que abre nombrando la opción entera («La respuesta correcta es
> **B) Podrá aprobarse el remate…**»). Podar el prefijo dejaba el texto de la opción suelto y
> mutilado — se descubrió comprobando la reparación contra tres casos reales **antes** de lanzarla
> sobre 1.155 preguntas, cuando el recuento ya decía "podable". Decidir si se pierde esa repetición
> del enunciado no es mecánico.

> ⚠️ **El @Cron nocturno NO refresca este hallazgo** (ni `shuffle_safe_regressed`): los emite el
> subproceso `npx tsx scripts/sweep-shuffle-safety-drift.ts`, que importa `@/lib/shuffle/*`, y el
> backend NestJS no puede ejecutarlo. Están declarados CLI-only en
> `__tests__/health/content-sweep-parity.test.ts`. **Consecuencia: un badge a cero aquí significa
> "nadie ha corrido el CLI", no "no hay ninguna".** Correrlo a mano al revisar el barajado.
> Promoverlos al nocturno exige un paquete compartido — reimplementar el detector en el backend
> crearía la segunda copia de patrones que este módulo lleva cuatro calibraciones evitando.

**La `cita` NO entra en el detector**, a propósito: el articulado se cita por letras en lenguaje
jurídico corriente («la letra b) del art. 9.1»). Se midió la alternativa amplia (cualquier letra
suelta en mayúscula) y añadía 26 hallazgos que eran **todos** falsos positivos: `M.C.D`, `D+1`,
`Ctrl+A`, «C de contacto».

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
