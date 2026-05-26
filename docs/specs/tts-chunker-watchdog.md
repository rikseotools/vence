# Spec — TTS Chunker + Watchdog Retry Counter

**Estado:** vigente desde 2026-05-26 (fix bucle Art. 1 Reglamento Asamblea Madrid)
**Archivos cubiertos:** `lib/tts/chunker.ts`, `lib/tts/engine.ts`
**Tests de regresión:** `__tests__/lib/tts/chunker.test.ts`, `__tests__/lib/tts/chunker.invariants.test.ts`, `__tests__/lib/tts/engine.test.ts`, `__tests__/lib/tts/engine.scenarios.test.ts`

## 1. Contexto y bug que se cierra

Usuaria Nila (Chrome Android 148, voz "español España", `c16c186a-…`) reportó:
"Lee un artículo y sin terminarlo vuelve al principio de ese artículo. Del 2 al 11 perfecto, el 1 no."

El artículo 1 del **Reglamento Asamblea Madrid** es un párrafo único de 474 caracteres con 7 comas y un único punto al final. Causa raíz combinada:

1. **Chunker antiguo**: las frases que excedían `MAX_CHUNK_LENGTH` (250) se devolvían íntegras. El comentario lo asumía como compromiso ("preferimos un chunk grande que un chunk roto").
2. **Chrome móvil**: rechaza síncronamente con `synthesis-failed` (o silente sin `onend`) los utterances de aproximadamente >300 chars.
3. **Watchdog del engine**: detectaba el chunk muerto pero `speakChunk()` **reseteaba `watchdogRetries = 0` en cada retry**, así el contador nunca alcanzaba `> MAX_WATCHDOG_RETRIES`. El skip-safeguard no disparaba → bucle infinito sobre el mismo chunk.

La simulación sobre el corpus REAL (45.666 artículos en producción) mostró que **51.5%** de los artículos producían algún chunk >300 chars con el chunker antiguo.

## 2. Contrato del chunker

### 2.1 API pública

```ts
splitIntoChunks(text: string): string[]
prepareForSpeech(raw: string): string[]               // = splitIntoChunks(cleanText(raw))
prepareSectionsForSpeech(sections: TTSSection[]): TTSChunkMeta[]
firstChunkOfSection(chunks: TTSChunkMeta[], idx: number): number
cleanText(raw: string): string
```

### 2.2 Invariantes garantizadas

| # | Invariante | Excepciones documentadas |
|---|---|---|
| **I1** | `output.length ≥ 1` para cualquier input | — |
| **I2** | Para texto vacío o solo whitespace: `output = [text]` (NO `[]` ni `null`) | — |
| **I3** | Ningún chunk emitido es cadena vacía cuando hay contenido | — |
| **I4** | `chunk.length ≤ MAX_CHUNK_LENGTH (250)` | Excepción I4-a: una **palabra única** (sin espacios) >MAX se devuelve íntegra. No rompemos a mitad de carácter. |
| **I5** | **PRESERVACIÓN**: la concatenación de chunks por espacio contiene todos los tokens del input limpio, en el mismo orden, sin duplicados ni omisiones | — |
| **I6** | `prepareSectionsForSpeech`: `sectionIdx` crece monótonamente entre chunks consecutivos | — |
| **I7** | `prepareSectionsForSpeech`: toda sección con texto no-vacío aparece al menos una vez como `sectionIdx` | — |

### 2.3 Estrategia de partición (orden de preferencia)

```
1. Por terminadores de frase  → /(?<=[.!?;])\s+/
2. Si una frase aún excede MAX → forceSplitOversize:
     a. Por comas              → /(?<=,)\s+/
     b. Si una sub-pieza aún excede MAX → por palabras (whitespace)
     c. Palabra única > MAX    → se devuelve íntegra (excepción I4-a)
3. Empaquetado final           → packBySize (≤ MAX contando separador)
```

### 2.4 Casos edge cubiertos por tests

| Caso | Test |
|---|---|
| Texto vacío | `chunker.test.ts` |
| Solo whitespace | `chunker.invariants.test.ts` |
| Frase única > MAX con comas | `FIX OVERSIZE` en `chunker.test.ts` + caso Art. 1 RAM en `invariants` |
| Frase única > MAX sin comas | `FIX OVERSIZE` en `chunker.test.ts` |
| Palabra única monstruosa | `FIX OVERSIZE` en `chunker.test.ts` (I4-a) |
| 100 inputs aleatorios con comas | `chunker.invariants.test.ts` (preservación + tamaño) |
| 100 inputs aleatorios sin comas | `chunker.invariants.test.ts` |
| Secciones múltiples, monotonicidad | `chunker.invariants.test.ts` |

## 3. Contrato del watchdog del engine

### 3.1 Estado relevante

```ts
private watchdogRetries = 0
private chunkStartTime = 0
private currentChunkIdx = 0
```

Constantes (`engine.ts`):
- `WATCHDOG_INTERVAL_MS = 2_000`
- `CHUNK_ZOMBIE_TIMEOUT_MS = 30_000`
- `MAX_WATCHDOG_RETRIES = 2` (= 2 retries antes de skip → skip al 3er tick)

### 3.2 Invariantes del contador de retries

| # | Invariante |
|---|---|
| **W1** | `watchdogRetries` se resetea a 0 al iniciar/reanudar sesión vía `play()` |
| **W2** | `watchdogRetries` **NO** se resetea cuando `speakChunk` es invocado con `index === currentChunkIdx` (retry del mismo chunk) |
| **W3** | `watchdogRetries` se resetea a 0 cuando `speakChunk` avanza a un chunk distinto (sea via `onend` natural, `onerror` sin breaker, o seek manual) |
| **W4** | Tras `MAX_WATCHDOG_RETRIES + 1` ticks consecutivos con chunk muerto/zombie, el watchdog hace **skip** al siguiente chunk e incrementa `chunksSkipped` |
| **W5** | Skip NUNCA puede llevar `currentChunkIdx` retroceder — solo avanza |

### 3.3 Tabla de transiciones del watchdog

| Tick | Condición synth | Acción | `watchdogRetries` antes → después | `currentChunkIdx` |
|---|---|---|---|---|
| 1 | `!speaking && !pending` | retry mismo chunk | 0 → 1 | sin cambio |
| 2 | igual | retry mismo chunk | 1 → 2 | sin cambio |
| 3 | igual | **SKIP** → speakChunk(idx+1) | 2 → 0 (reset por cambio de idx) | +1 |

Para zombie (synth.speaking=true pero chunkAge > 30s) misma lógica.

## 4. Resultados empíricos (simulación corpus producción)

Script: `scripts/simulate-tts-chunker-impact.cjs`
Ejecutado: 2026-05-26 sobre 45.666 artículos.

### 4.1 Antes del fix (LEGACY)

| Métrica | Valor |
|---|---|
| Artículos con chunk >300 chars | 23.497 (51.5%) |
| Artículos con chunk >400 chars | 12.482 (27.3%) |
| Artículos con chunk >500 chars | 5.884 (12.9%) |
| Total chunks oversize >300 | 51.752 |
| Chunk más grande (absoluto) | 2.634 chars |
| P95 max-chunk-len por artículo | 615 chars |
| P99 max-chunk-len por artículo | 810 chars |

### 4.2 Tras el fix (NUEVO)

| Métrica | Valor |
|---|---|
| Artículos con chunk >300 chars | **0 (0.00%)** |
| Chunk más grande (absoluto) | **250 chars** |
| P99 max-chunk-len por artículo | 250 chars |
| Chunks adicionales emitidos | +52.941 (+20.2%) — overhead esperado |
| Texto perdido tras chunkear | **0** (invariante lossless: 100% del corpus) |

## 5. Cómo correr la simulación / tests

```bash
# Simulación full corpus
node scripts/simulate-tts-chunker-impact.cjs

# Tests TTS (unit + invariantes + scenarios)
npx jest __tests__/lib/tts/

# Solo invariantes
npx jest __tests__/lib/tts/chunker.invariants.test.ts

# Solo scenarios
npx jest __tests__/lib/tts/engine.scenarios.test.ts
```

## 6. Riesgos / Pendiente

- **Overhead +20% chunks**: cada chunk añade ~1 onend round-trip. Con rate=1.0 y chunks de ~200 chars, 1 chunk dura ~2s → +20% chunks = +1s cada 5 → impacto perceptible mínimo. Asumido.
- **Spanish legal text peculiarities**: el chunker corta por comas, lo que puede sonar entrecortado en frases muy ricas en comas. Se prefiere a no oírse en absoluto. Mejorable a futuro con un splitter prosódico (conjunciones, gerundios).
- **Cobertura zombie watchdog**: `engine.scenarios.test.ts` cubre el camino `dead` (synth.speaking=false). El camino `zombie` (synth.speaking=true + chunkAge>30s) tiene la misma lógica pero requiere mockear `Date.now()` para tests deterministas. Pendiente si aparece un caso real.

## 7. Histórico

| Fecha | Cambio | Commit |
|---|---|---|
| 2026-05-25 | Refactor TTS robusto, state machine, watchdog | `b176ec69` |
| 2026-05-26 | Fix chunker force-split + watchdog retry counter | TBD |
