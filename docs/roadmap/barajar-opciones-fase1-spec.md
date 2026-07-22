# Spec de implementación — Barajar opciones, FASE 1

> **Contexto y diseño completo:** ver la tarea "Barajar el orden de las opciones" en `tareas-pendientes.md` (diseño v2, clasificador v3.2, detector, demanda medida). Esto es SOLO la spec técnica de la Fase 1 (valor pronto, bajo riesgo, sin migrar las ~130k explicaciones).
>
> **Demanda que lo justifica (medida 22/07):** 34% de todas las exposiciones son repetición; **77,4% de los usuarios activos** ven preguntas repetidas → memorizan la POSICIÓN. Fuente: `scratchpad/repeat_stats.cjs`.

## 0. Objetivo y alcance de la Fase 1

**Objetivo:** que al servir una pregunta se pueda **permutar el orden de las opciones** de forma segura, sin romper nada, para las preguntas que hoy son seguras de barajar — **sin** depender todavía de la migración de explicaciones (Fase 2).

**Predicado de elegibilidad (Fase 1):**
```
barajable  ⇔  shuffle_mode = 'full'
           ∧  la explicación NO referencia letras  (regex /\b[ABCD]\)/ y "opción [ABCD]" / "apartado [ABCD]")
```
- `shuffle_mode` lo da el clasificador determinista (§2).
- La condición de "explicación sin letras" evita el 26% letra-anclado (que espera a la Fase 2). **Se evalúa dinámicamente**, no se congela: cuando en la Fase 2 una explicación pase a formato estructurado SIN letras, sigue siendo elegible; si alguien la "mejora" al §8.1 con letras, deja de barajarse (auto-corrector). **Mandato para Fase 2: toda mejora de explicación se escribe en formato estructurado sin letras** (ver tarea, Diseño v2).
- `anchor_last` y `no_shuffle` quedan **fuera de la Fase 1** (se sirven en orden fijo). Se abordan cuando el renderer soporte anclaje/estructura.

**Fuera de alcance F1:** migrar explicaciones a estructurado (Fase 2), barajar `anchor_last`, el flag detector de mislink (Fase 3).

## 1. Modelo de datos

### 1.1 Columna `questions.shuffle_mode`
```sql
-- migración additiva
ALTER TABLE questions ADD COLUMN shuffle_mode text NOT NULL DEFAULT 'no_shuffle'
  CHECK (shuffle_mode IN ('full','anchor_last','no_shuffle'));
COMMENT ON COLUMN questions.shuffle_mode IS
  'Clasificación de barajabilidad de las opciones. Default no_shuffle = seguro (no barajar hasta clasificar).';
```
- **Default `no_shuffle`** a propósito: mientras no se clasifique, NO se baraja (sesgo seguro; barajar de más = romper, no barajar de más = inocuo).
- Backfill por lotes con el clasificador v3.2 (§2). No bloquea el deploy: hasta que se backfillee, todo es `no_shuffle` (comportamiento actual = sin barajar).
- Añadir a `db/schema.ts` (tabla `questions`, línea ~2285) + `types/database.types.ts`.

### 1.2 Persistencia de la permutación por exposición: `test_questions.option_order`
```sql
ALTER TABLE test_questions ADD COLUMN option_order integer[] NULL;
COMMENT ON COLUMN test_questions.option_order IS
  'Permutación aplicada al servir: option_order[i] = índice ORIGINAL (0=A DB) mostrado en la posición i. NULL = sin barajar (orden natural).';
```
- Se escribe cuando se crea la fila servida (§4). NULL ⇒ orden natural (retrocompatible con todo lo histórico).
- Es la **fuente de verdad** para mapear "posición mostrada → opción original" en la validación server-side (§5).

## 2. Clasificador `shuffle_mode` (determinista, portar de `scratchpad/classify_v32.cjs`)

Nuevo módulo puro **`lib/shuffle/classifyShuffleMode.ts`** (con tests). Validado a escala: **0 falsos negativos en 5.000 preguntas** (ver tarea). Reglas:

- **`no_shuffle`** (opciones que se cruzan por letra/número/ordinal — barajar rompe):
  cruces `A) y B) son correctas`, `son correctas la B y la C`, `la A y la B`, `respuestas 1,2 y 3 son ciertas`, `ambas`, `las dos primeras`, `primera y segunda`.
- **`anchor_last`** (genéricas todo/nada — se barajan las demás y se fija esta al final):
  **patrón GENERAL `todas … son (correctas|falsas|ciertas|incorrectas)`** (no listar sustantivos: captura "todas las definiciones/proposiciones/alternativas… son correctas" y el typo "repuestas"), `ninguna…`, `son todas…`, `todas las X anteriores`, `todas estas`, `todas pueden`, `en todos los anteriores`.
- **`full`**: el resto.

Firma:
```ts
export function classifyShuffleMode(opts: {A?:string;B?:string;C?:string;D?:string;E?:string}): 'full'|'anchor_last'|'no_shuffle'
```
**Redes de seguridad (obligatorias):** (a) ante meta-smell dudoso → preferir NO `full` (FP inocuo); (b) 2ª opinión opcional con clasificador LLM barato (97%, manual OpenRouter §9.2 P3) sobre las `full` que contengan meta-smell, antes de barajarlas en prod. Guardrail de tests: fixtures con los casos-borde de la tarea (paréntesis, números, "todas las demás respuestas", "ambas Cámaras"=contenido→full).

### 2.1 Predicado de "explicación sin letras"
```ts
export const explanationReferencesLetters = (e?: string|null) =>
  !!e && /\b[ABCD]\)|opci[óo]n(?:es)?\s+[ABCD]\b|apartado\s+[ABCD]\b|letra\s+[ABCD]\b/i.test(e);
```
`shuffleEligible(q) = q.shuffle_mode==='full' && !explanationReferencesLetters(q.explanation)`.

## 3. Permutación (pura, reproducible, VARÍA por exposición)

Módulo **`lib/shuffle/permute.ts`**:
```ts
// Fisher-Yates sembrado por (questionId + nonce). El nonce cambia por exposición
// (para que la repetición reordene) y se persiste en test_questions.option_order.
export function permutationFor(questionId: string, nonce: string, n: number): number[]
export function applyOrder<T>(items: T[], order: number[]): T[]   // items reordenados según order
export function displayedToOriginal(order: number[], displayedIdx: number): number  // order[displayedIdx]
```
- **NO** usar `Math.random` en el fetcher server (reproducibilidad/tests) → derivar de `hash(questionId + nonce)`. El `nonce` = id de la fila servida / test_session_id + question_order (algo único por exposición).
- El resultado (`order`) es lo que se guarda en `test_questions.option_order`. Con eso, la reproducibilidad no depende del algoritmo: la verdad es la fila.

## 4. Servir la pregunta (fetcher) — `lib/testFetchers.ts` (~línea 388-393)

Hoy devuelve `options: string[]` (array ya filtrado) + `correct_option` (índice 0-based) + `explanation`. Cambios:

```ts
const naturalOptions = [q.option_a,q.option_b,q.option_c,q.option_d,q.option_e].filter(...) // (igual que ahora)
let options = naturalOptions, optionOrder: number[] | null = null, correctOption = q.correct_option;

if (shuffleEligible(q) && FEATURE_SHUFFLE) {
  const order = permutationFor(q.id, exposureNonce, naturalOptions.length);
  options = applyOrder(naturalOptions, order);
  optionOrder = order;
  if (correctOption != null) correctOption = order.indexOf(correctOption); // remap para la validación CLIENT-side
}
return { id:q.id, options, correct_option: correctOption, option_order: optionOrder, explanation:q.explanation, ... }
```
- **Doble camino de validación (importante):**
  - **Client-side** (este fetcher hoy envía `correct_option` — validación instantánea): basta con **remapear `correct_option` al nuevo índice** (línea de arriba). Self-contained.
  - **Server-side seguro** (`/api/answer`, `/api/v2/answer-and-save`, examen): NO recibe `correct_option`; compara el índice enviado contra el de BD → necesita `option_order` (§5).
- **Persistir `option_order`** en la fila `test_questions` al crearla (puntos de inserción: `app/api/ai/create-test`, `app/api/exam/init`, y donde se materialice el test). El `exposureNonce` sale de ahí (id de fila / session).
- **Gotcha D=null / 3 opciones:** `naturalOptions` ya filtra nulos → la permutación es sobre las presentes (3 ó 4). Correcto por construcción. No permutar una lista con hueco.

## 5. Validar la respuesta (server-side seguro) — mapear mostrada→original

En los validadores que comparan índice contra BD (`/api/v2/answer-and-save`, `/api/exam/answer`, `/api/exam/validate`):
```ts
// el cliente envía la posición MOSTRADA que eligió (displayedIdx)
const order = await getOptionOrder(testQuestionRowId); // test_questions.option_order (o null)
const originalIdx = order ? order[displayedIdx] : displayedIdx;
const isCorrect = originalIdx === dbCorrectOption;
```
- Si `option_order` es NULL (no barajada / histórico) → identidad (comportamiento actual). **Retrocompatible al 100%.**
- Guardar en `test_questions.user_answer` el índice **original** (no el mostrado) para que analytics/tracking sigan siendo coherentes con la BD.

## 6. Render (cliente) — sin cambios de lógica de letras

- El cliente ya pinta A/B/C/D a partir de la POSICIÓN del array `options`. Al venir permutado, las letras se asignan solas en el orden mostrado. **No hay que tocar la asignación de letras.**
- La **explicación se muestra tal cual** (en Fase 1 solo barajamos preguntas cuya explicación no cita letras → no hay desajuste). Componentes: `TestLayout.js`, `DynamicTest.js`, `ExamLayout.js` — verificar que envían al validador la **posición mostrada** elegida (y que el back mapea, §5).

## 7. Feature flag + rollout

- Flag runtime `FEATURE_SHUFFLE_OPTIONS` (SSM, default `off`). Encender por lotes/canario.
- Orden de despliegue seguro:
  1. Migraciones (`shuffle_mode`, `option_order`) — additivas, sin efecto (default no_shuffle / null).
  2. Backfill `shuffle_mode` con el clasificador (lotes) — sin efecto hasta encender el flag.
  3. Código de fetcher/validador desplegado con flag **off** (identidad).
  4. Encender flag para una oposición/usuario piloto → verificar: (a) opciones salen en orden distinto en repeticiones, (b) la validación sigue acertando (no romper la clave), (c) `user_answer` guarda el índice original, (d) analytics coherentes.
  5. Ampliar.
- **Métrica de éxito:** baja la correlación "posición de la correcta ↔ acierto" en repeticiones; 0 incremento de impugnaciones "la respuesta correcta está mal".

## 8. Checklist de "no romper" (lo que la simulación ya de-riesgó)

- [x] Clasificador 0 FN en 5.000 (v3.2) — barajar solo `full`.
- [x] Mecanismo permutar+remapear clave: 100% en simulación.
- [x] `option_order` NULL ⇒ identidad (histórico intacto). — `displayedToOriginal(null,…)`=identidad; tests `permute`/`validationSemantics`.
- [x] Validación server-side mapea mostrada→original (test unitario con permutación no trivial). — `answer-and-save/queries.ts` + `__tests__/lib/shuffle/validationSemantics.test.ts`.
- [x] `user_answer` guarda índice ORIGINAL. — `validateAndSaveAnswer` pasa `originalUserAnswer` a `insertTestAnswer`; gap-fill de `complete-test` idéntico.
- [x] D=null: permutar solo opciones presentes. — `naturalOptions` filtra nulos antes de permutar; test de 3 opciones.
- [ ] Subtarea de precisión del detector antes de subir el flag a general (muestra etiquetada, 0 falsos negativos; ver tarea).

## 8-bis. Estado de implementación (Fase 2 tajada — 22/07, rama `feat/shuffle-fase1`)

**Código completo, INERTE hasta encender el flag. Falta deploy + canario.**

- **Módulos puros:** `lib/shuffle/permute.ts` (Fisher-Yates sembrado + `applyOrder`/`displayedToOriginal`/`isValidOrder`) y `lib/shuffle/flag.ts` (`isShuffleEnabled`/`isShuffleEnabledFor`). Tests: `__tests__/lib/shuffle/*` (84).
- **Serve** (`lib/api/filtered-questions/queries.ts`): `transformQuestion(q, i, shuffle)` permuta si `shuffle && isShuffleEligible(q)`, adjunta `option_order` y remapea `correct_option` a la posición MOSTRADA. `shuffleOn = params.shuffleOptions && isShuffleEnabledFor(positionType)`. Nuevo campo request `shuffleOptions` (OPT-IN: solo lo piden los fetchers de `testFetchers.ts` → TestLayout, NUNCA el modo examen que valida por letra en orden natural).
- **Validación/persistencia** (`answer-and-save`, `complete-test` gap-fill): mapean mostrada→original vía `option_order`; guardan `user_answer` en índice ORIGINAL y persisten `option_order` en `test_questions`. `null`/inválido ⇒ identidad.
- **Cliente** (`components/TestLayout.tsx`): reenvía `option_order` de la pregunta al payload de `answer-and-save` y al `detailedAnswer` de `complete-test`.
- **Modo examen INTACTO** (no baraja en Fase 2): ExamLayout consume filtered pero sin `shuffleOptions` → `shuffleOn=false`. OfficialExamLayout usa rutas propias (no filtered).
- **Encender:** `FEATURE_SHUFFLE_OPTIONS=true` (SSM) + opcional `FEATURE_SHUFFLE_OPTIONS_SCOPE=<position_type,…>` para piloto por oposición. Requiere deploy del código (backend+frontend) ANTES de tocar el flag (orden código→flag).

### Capas de seguridad construidas (22/07)
- **Unit** (84 tests): `permute`/`flag`/`classify`/`validationSemantics` con la función real.
- **Guardrail cableado** (`__tests__/lib/shuffle/wiring.guardrail.test.ts`, CI): afirma que `option_order`/`shuffle_mode` siguen cableados en cada salto (columna Drizzle→serve→schemas→cliente→validador→persistencia→gap-fill) + los emisores de observabilidad.
- **transformQuestion unit** (`transformQuestionShuffle.test.ts`, node-env, CI): barajado eligible + **bail-out seguro** + no-eligibles + flag off, con la función real.
- **Integración + Simulación + Canary** (`__tests__/canary/shuffleRoundtripBD.test.ts`, guardado por `DATABASE_URL`): 500 preguntas `full` reales de RDS → invariante (correcta preservada, round-trip reversible, 0 opciones perdidas) + retrocompat flag-off + coherencia de persistencia + coherencia del predicado de elegibilidad.
- **Observabilidad:** `shuffle_options_request_active` (serve, adopción) + `shuffle_option_order_invalid` (warn, detector de clave rota/desincronía serve↔cliente).

### Revisión adversarial (agente fresco) — hallazgos plegados
- ✅ Confirmado: examen nunca baraja (auditoría exhaustiva de callers), coordenadas coherentes (UI 100% en mostradas, persistencia en originales), sin caché de permutaciones, retrocompat.
- 🔧 **MEDIUM arreglado:** bail-out de `transformQuestion` cuando la correcta cae en hueco NO presente dejaba opciones permutadas con la clave descolocada → ahora sirve natural intacto (+ test).
- 🔧 **Endurecido:** gap-fill de `complete-test` recomputa `isCorrect` server-side (no confía en el cliente) — simetría con answer-and-save.
- ⚠️ **NOTA de diseño (antes del flip):** el barajado NO da beneficio anti-scraping y lo EMPEORA — el serve manda `correct_option` remapeado + `option_order`, así que un scraper recupera la clave (`original = option_order[correct_option]`). Además ACOPLA la feature al leak conocido `project_pending_filtered_correct_option_leak`: el fix de dejar de mandar `correct_option` rompería la validación client-side del barajado tal como está diseñada. Decisión pendiente antes de encender el flag general.

## 9. Estimación

Pequeña-media: 2 migraciones additivas + 1 módulo clasificador (portado y testeado) + 1 módulo permutación + toques en fetcher y 2-3 validadores + flag. El grueso del riesgo (clasificación) ya está resuelto y validado. La Fase 2 (explicaciones estructuradas) es el proyecto grande aparte.
