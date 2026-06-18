# Cerrar la entrada: `options_ok` en el pipeline + re-endurecer el gate §19 (palanca 2/3)

> **Estado: SPEC listo, NO ejecutado.** Cambio de producción que toca el gate de visibilidad
> de preguntas. El §19 del manual `revisar-preguntas-con-agente.md` documenta que endurecer el
> gate sin que el pipeline rellene `options_ok` **rompió el flujo en silencio**. Por eso este
> cambio requiere los 4 pasos EN ORDEN y prueba del pipeline antes de re-endurecer. No hacerlo
> a ciegas.

## Por qué

El barrido de junio 2026 saneó el STOCK (`answer_ok=false` activas: 5.605 → ~50). Pero el
pipeline `app/api/topic-review/verify/route.js` que promociona preguntas **no comprueba
`options_ok`** (la literalidad de las opciones presentadas como correctas, §3.2). El gate §19
actual exige `answer_ok` + `explanation_ok` TRUE y `article_ok`/`options_ok` NO FALSE — pero como
el pipeline deja `options_ok` en NULL, una opción distorsionada pasa el gate. Sin cerrar esto, el
banco se vuelve a llenar de preguntas con opciones malas (el incidente recurrente §3.2/§16).

## Pasos (EN ORDEN)

### 1. Pedir `optionsOk` al verificador (prompt) — `verify/route.js`
En los prompts de verificación (legal §4 y técnico §3, funciones `buildPrompt*` del fichero),
añadir el 4º check §3.2: comprobar la literalidad **solo de las opciones presentadas como
correctas** (la marcada y, en "todas las anteriores", cada sub-opción A/B/C; NUNCA los
distractores). Añadir `optionsOk` (boolean) al JSON de salida esperado del modelo.

### 2. Persistir `options_ok` en el upsert — `verify/route.js` (~línea 804)
En `verificationValues` añadir:
```js
optionsOk: aiResponse.optionsOk === true,   // false si una opción-correcta no es literal
```
(La columna `options_ok` ya existe en `ai_verification_results`, §17.4.)

### 3. `determineReviewStatus` factoriza `optionsOk` — `verify/route.js` (~línea 99)
Si `optionsOk === false`, la pregunta NO es `perfect`/`tech_perfect` aunque los otros 3 pasen:
enrutar a `bad_explanation`/`needs_review` (estado oculto) hasta corrección de la opción.
Hoy la firma es `(articleOk, answerOk, explanationOk, isVirtual)` → añadir `optionsOk`.

### 4. Re-endurecer el gate SQL (función `transition_question_state`)
SOLO cuando 1-3 estén desplegados y verificado que el pipeline setea `options_ok=true`
afirmativamente en los "perfect" (consultar: `SELECT count(*) FROM ai_verification_results
WHERE options_ok IS TRUE AND verified_at > '<deploy>'`). Entonces cambiar en el bloque del gate
(§19): `av.options_ok IS DISTINCT FROM FALSE` → `av.options_ok IS TRUE`.
Esto recupera la protección plena contra "clave/opción equivocada" en la promoción automática.

### 5. (Complementario) Detector mecánico §19 como test+cron
Modelo: `__tests__/integration/supuestoPracticoOrphans.test.ts`. Detectar sobre activas:
`dup_options` (A===B…), `leaked_meta` (`(artículo N)` final, "Pregunta anulada"), `ocr`
(`]`/`[` intra-palabra). En junio 2026 el barrido dejó el catálogo limpio (~2 hits) — el test
es un guardarraíl para que no se reacumulen. Rutear hits a `needs_human`.

## Prueba antes de re-endurecer
- Lanzar el pipeline sobre un lote pequeño y confirmar que `options_ok` se rellena (true/false).
- Confirmar que ninguna promoción legítima falla (el §19 avisa: un gate que mira flags que el
  productor no rellena rompe el flujo en silencio, capturado como warning).
- Separar además la fase estructural (`keep_structural`) de la aprobación de contenido: un pase
  estructural NO debe conceder `ai_verified_tech_perfect` (debe ir a `needs_review`).
