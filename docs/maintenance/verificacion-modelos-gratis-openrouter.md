# Manual: Verificación barata con modelos GRATIS (OpenRouter) — capa de triaje

> **Para qué:** abaratar la revisión de preguntas usando **modelos gratis de OpenRouter** para la parte *mecánica de juicio binario* (¿el artículo/opción sostiene LITERALMENTE la respuesta? sí/no), reservando **Claude para el juicio caro** (a qué artículo revincular, escribir la explicación, verificar la fuente, adjudicar). No sustituye el método de `revisar-preguntas-con-agente.md`; es una **capa previa** que le quita volumen.
>
> **Regla de oro:** *modelo gratis = red ancha de triaje; Claude = el juicio.* Y antes que nada: **si basta un script Node, no metas ningún LLM** (extract/merge/apply/scope ya cuestan 0 tokens).

Relacionado: **[`revisar-preguntas-con-agente.md`](./revisar-preguntas-con-agente.md)** (el método completo verify+audit con agentes Claude) · memoria `project_verificar_vivas_campana` (campaña del cubo mislink).

---

## 1. Estado / credencial

- **Clave:** `OPENROUTER_API_KEY` en `.env.local` (formato `sk-or-v1-…`). Añadida 14/07/2026. Cuenta **free tier** (`is_free_tier: true`, sin crédito).
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions` (compatible OpenAI). Validar clave: `GET /api/v1/key`. Listar modelos: `GET /api/v1/models` (filtrar `id.endsWith(":free")`).

### Límites del tier gratis (verificado 14/07/2026 en la doc oficial)
| | Sin crédito | Con ≥$10 de crédito |
|---|---|---|
| **Por día** | **50 req/día** | **1.000 req/día** |
| **Por minuto** | 20 req/min | 20 req/min (no cambia) |

- Los **$10 NO se consumen** con modelos gratis: se quedan como saldo; solo son un **umbral** que sube el tope diario 50→1.000. Solo hace falta recargar si se **industrializa** (cientos/día). Para pilotos, 50/día sobra.
- El **20 req/min** limita el paralelismo pase lo que pase → ir con **espaciado ~3,2 s entre llamadas**, no 4-en-paralelo.
- Error **429 "temporarily rate-limited upstream"** = el *proveedor* del modelo está saturado (≠ tu cupo). El dinero no lo arregla; se arregla con **retry + fallback a otro modelo `:free`**.

---

## 2. Qué SÍ y qué NO puede hacer el modelo gratis

**SÍ (probado, fiable):** juicio **binario de literalidad** con el artículo ya dado en el prompt → *"¿el artículo contiene literalmente la base de la clave?"* = **FP** (bien vinculada) vs **MISLINK** (mal). No necesita herramientas.

**NO (una llamada plana no tiene tools):**
- Decidir **a qué artículo** revincular (necesita `lookup_any` sobre otros artículos).
- **Escribir la explicación** didáctica §8.1 con calidad/precisión clínica-legal.
- **Verificar contra fuente oficial** (WebSearch a BOE/AEMPS/MS Support…).
- Adjudicar conflictos verify↔audit.

→ Todo eso **sigue siendo de Claude**.

---

## 3. Resultado del PILOTO (14/07/2026, banco Esterilización, 19 preguntas)

Modelo `nvidia/nemotron-3-super-120b-a12b:free`, comparado contra la **disposición final real** (verdad-terreno en `mislink_review_cohort`) y contra el verify de Claude:

| Métrica | Resultado |
|---|---|
| Acuerdo binario FP-vs-mislink **vs verdad-terreno** | **15/16 = 94 %** |
| **Mislinks reales con falso "todo OK"** (el riesgo de verdad) | **0** ✅ |
| Mislinks reales cazados | 15/15 |
| FP marcado como mislink (error conservador, inocuo) | 1 |
| **Respuestas que rompen el JSON** | **3/19 ≈ 16 %** ⚠️ |

**Lecciones:**
- **Seguridad excelente:** 0 falsos "déjala viva" a una pregunta mala (la métrica que importa).
- **Es conservador:** tiende a decir MISLINK → en bancos con muchos FP (ofimática) **sobre-marcaría** y ahorra poco (habría que Claude-confirmar sus MISLINK).
- **~16 % falla el JSON:** nemotron a veces escupe razonamiento antes del objeto o repite el esquema → usar `response_format` json-mode + parser tolerante (regex `\{[\s\S]*?\}`) + fallback de modelo.
- **gemma-4 free dio 429** (saturación upstream) → fallback obligatorio.

---

## 4. En qué CUBOS ayuda (análisis con tamaños reales, 14/07/2026)

Encaja donde la tarea es *"¿este texto sostiene literalmente a este otro?"* **y hay volumen**:

| Cubo | Tamaño | Fit | Por qué |
|---|---|---|---|
| **Opción no literal** (vivas `options_ok=false`) | **846** | 🟢 **nº1** | "¿la opción marcada reproduce LITERAL el artículo?" = comparar 2 textos. Claude solo aplica `option_fix`. Volumen alto → ahorro real. |
| **Clave dudosa** (vivas `answer_ok=false`) | **93** | 🟢 | binario, alto riesgo → su 0-falsos-OK vale. Pequeño. |
| **Cubo mislink** (art mal vinculado, `batch IS NULL`) | ~431 | 🟡 | triaje FP/mislink (94 %), pero el **relink lo hace Claude**. Sirve para priorizar + auto-confirmar obvios. |
| **Explicación floja** (`explanation_ok=false`) | ~1.749 | 🟡 | no es literal-match; como **generador de borrador** (Claude filtra). |
| **needs_human** (ya ocultas) | ~4.386 | 🔴 | disposición = buscar destino/fuente (tools). |
| **draft** (imports sin activar) | ~19.120 | 🔴 | otro problema (validación de import). |

**Recomendación:** el mejor uso NO es el cubo mislink (pequeño y atado a Claude), sino **arrancar el cubo de "opción no literal" (846)** con el modelo gratis como flagger + Claude aplicando los `option_fix`.

Consultas para medir tamaños (vivas = `lifecycle_state IN ('approved','tech_approved')`):
```sql
-- opción no literal
SELECT count(DISTINCT v.question_id) FROM ai_verification_results v JOIN questions q ON q.id=v.question_id
WHERE q.lifecycle_state IN ('approved','tech_approved') AND v.options_ok=false AND v.discarded=false;
-- clave dudosa: options_ok→answer_ok ; explicación floja: →explanation_ok
```

---

## 5. Herramientas (durables en `verify-live-scripts/`)

- **`verify_openrouter.cjs`** — corre el triaje FP/MISLINK sobre chunks `cN.json` (mismo formato que `mislink_extract`). Retry + **fallback entre modelos `:free`** ante 429/parse-error, espaciado 3,2 s. Salida: array `{id, veredicto:"FP|MISLINK", confianza, motivo, model_used}`.
  ```bash
  NODE_PATH=$PWD/node_modules node verify_openrouter.cjs <c1.json> [c2.json …] <out.json>
  ```
- **`compare_openrouter.cjs`** — compara la salida contra la **verdad-terreno** (`mislink_review_cohort.status`: `false_positive`=FP; `relinked/enriched/hidden`=MISLINK) y contra el verify de Claude (`passA_all.json`). Da % de acuerdo + **matriz de confusión** (lo crítico: *mislink PERDIDOS* = falsos OK).
  ```bash
  NODE_PATH=$PWD/node_modules node compare_openrouter.cjs <dir>   # dir=ester,…
  ```
- **`piloto_openrouter_ester_out.json`** — salida del piloto (referencia).

Lista de modelos (en `verify_openrouter.cjs`, orden de fallback): `nemotron-3-super-120b`, `nemotron-3-nano-30b`, `gemma-4-31b`, `gemma-4-26b` (todos `:free`). Ajustar según disponibilidad (`GET /api/v1/models`).

---

## 6. Bake-off de modelos (cómo elegir el mejor)

No elegir a ojo — hay varianza (JSON-rate, precisión, conservadurismo, 429). Método:
1. Un cubo (p.ej. opción-no-literal), **muestra etiquetada ~12 preguntas** (con verdad-terreno).
2. **3-4 modelos `:free`** sobre la MISMA muestra.
3. Métricas: (a) % JSON parseable, (b) acuerdo con verdad, (c) **0 falsos-OK**, (d) tasa 429.
4. Gana el que más acierta sin inventar → se fija ESE + wrapper json-mode.
5. Cuenta: 4 modelos × 12 = 48 llamadas → **cabe en 50/día**. Iterar más el mismo día ⇒ ahí sí los $10.

---

## 7. Arquitectura recomendada (pipeline híbrido)

```
chunk (Node, 0 tokens) → verify_openrouter (GRATIS): FP vs MISLINK, red de seguridad
   ├─ FP        → Claude confirma barato (o se acepta si el modelo es fiable en ese banco)
   └─ MISLINK   → Claude (con lookup_any + WebSearch): destino relink + explicación §8.1 + adjudicación
                  → *_close.cjs (Node, 0 tokens): aplica
```

**Nunca** dejar que el modelo gratis: cambie una clave, elija destino de relink sin verificación, o escriba la explicación final sin gate. Su rol es **marcar**, no **decidir**.

---

## 8. Estado del PILOT y CÓMO CONTINUAR (14/07/2026)

> Esta sección es el punto de retome si se corta la sesión. Scripts durables en `verify-live-scripts/`; muestra y resultados en `<scratchpad>/relink/bakeoff/`.

**Manuel metió $10 de crédito** → la cuenta ya NO es free_tier (`is_free_tier:false`) → tope **1.000/día** + prioridad. Los $10 quedan de saldo (los `:free` no los tocan; solo desbloquean el tier).

**Veredicto tier GRATIS (probado → descartado como base):** poco fiable. Los modelos fuertes (`qwen3-next-80b`, `llama-3.3-70b`, `hermes-405b`, `gemma-4-31b`) dan **429 constante aun con crédito** (proveedor saturado); los de razonamiento (`nemotron-3-*`) **rompen el JSON** (emiten `<think>` largo); los que dan JSON limpio (`gemma-4-26b`, `gpt-oss-20b`) **no discriminan** (dicen MISLINK a todo). → no usar gratis para esto.

**Veredicto modelos de PAGO baratos (la vía buena):** fiables — **12/12 JSON**, sin 429, ~1 s, coste **~$0.17–0.76 para las ~850 preguntas** del trabajo restante (los $10 lo cubren ×13–60). Bake-off de **14 modelos** sobre muestra de 12 (6 FP + 6 MISLINK, verdad-terreno de `mislink_review_cohort.status`):
- Casi todos **conservadores**: 0 peligrosos pero solo reconocen ~2/6 FP (sobre-marcan → filtro flojo).
- `openai/gpt-4o-mini`: mejor discriminador (6/6 FP) pero **2 peligrosos** (deja colar malas) → no usar solo.
- **`anthropic/claude-haiku-4.5` ($1/M) NO fue mejor** que los de $0.10 (peor incluso) → pagar por Haiku aquí no aporta.

**🔑 HALLAZGO (idea de Manuel) — ENSEMBLE de 2-3 modelos = doble-pasada barata.** Regla: *"limpiar (FP, saltar Claude) SOLO si TODOS coinciden en FP; si alguno dice MISLINK → a Claude"*. Medido sobre los datos ya capturados (0 llamadas, `ensemble_analysis.cjs`): **TODOS los combos → 0 peligrosos** (el consenso neutraliza los 2 fallos de gpt-4o-mini). Mejor combo: **`gpt-4o-mini` + `gemini-2.5-flash` + `deepseek-chat`**. Caveat: en el cubo mislink el ahorro es modesto (limpia 2/6) porque la tarea es *fuzzy*; 3 diversos = punto dulce (añadir un 4º muy conservador BAJA los FP-limpiados por endurecer la unanimidad).

**Herramientas durables (`verify-live-scripts/`):**
- `bakeoff_openrouter.cjs` — corre la lista `MODELS` sobre `bakeoff/sample.json`, json-mode, **MERGE acumulativo** (salta modelos ya hechos) → `bakeoff/bakeoff_out.json`. Editar `MODELS` para probar más.
- `bakeoff_compare.cjs` — tabla por modelo (JSON✓, acuerdo, PELIGRO, FP-ok, ms).
- `ensemble_analysis.cjs` — consenso de combos sobre datos capturados (0 llamadas). Editar `COMBOS`.
- `build_sample2.cjs` — genera muestra etiquetada de 12 (6 FP + 6 MISLINK) desde los chunks de bancos cerrados + cohorte.

**CÓMO CONTINUAR (próxima sesión):**
1. **Gem-hunt HECHO (44 modelos) → 2 JOYAS.** `amazon/nova-lite-v1` ($0.06, **602ms** el más rápido) y `google/gemma-3-12b-it` ($0.05): ambos **12/12 JSON, 0 PELIGROSOS, 4/6 FP-ok** — el DOBLE de discriminación que el pelotón conservador (2/6) manteniendo 0 peligro, y mejores que gpt-4o-mini (6/6 FP pero 2 peligrosos). Son los ganadores individuales. (Descartados: glm-4.6/4.7-flash, gpt-5-nano rompen JSON; kimi-k2 da 400.) Ranking en `bakeoff/bakeoff_out.json` (rehacer tabla: `node verify-live-scripts/bakeoff_compare.cjs` con `SP` apuntando a la muestra).
2. **Pilot PENDIENTE — cubo "opción no literal" (846 vivas, `options_ok=false`):** es su tarea NATURAL y más limpia (¿la opción marcada reproduce LITERAL el artículo?) → el ensemble debería limpiar MUCHO más que 2/6. Montar: extraer ~12-15 del cubo, **etiquetar a mano** la literalidad de la opción (verdad-terreno), correr el ensemble-3 (o el gem ganador) y medir ahorro. Si limpia mucho + 0 peligro → industrializar el cubo con Claude aplicando el `option_fix`; si no, aparcar.
3. **Arquitectura si sale bien:** ensemble de pago barato = capa de triaje (marca lo que Claude revisa); Claude sigue el juicio (relink/explicación/fuente/adjudicación). El ensemble NUNCA cambia clave ni decide destino sin verificación.

---

## 9. RESULTADO del pilot "opción no literal" (15/07/2026) — APARCADO

Se ejecutó el paso 2 (§8): ensemble **nova-lite + gemma-3-12b + gpt-4o-mini** sobre 15 preguntas vivas `options_ok=false`, con verdad-terreno etiquetada a mano (8 FP + 7 MISLINK; FP = la opción marcada está reproducida LITERAL en el artículo; MISLINK = distorsionada/ausente/meta/corrupta). Datos en `<scratchpad>/optlit/` (`sample_raw.json`, `labels.json`, `ens_out.json`, `run_ensemble.cjs`, `optlit_extract.cjs`).

**Resultado:** ❌ **PELIGRO=1** (no 0), ahorro 3/8 FP (38%), 11/15 a Claude. Acierto individual bajo: nova 9/15, gemma 10/15, gpt-4o-mini 11/15.

**Por qué falló (2 hallazgos clave):**
1. **El cubo NO es homogéneo ni "literal-limpio".** Mezcla: opción verbatim legal, preguntas *"señale la FALSA"* (la correcta es un enunciado falso que por diseño NO está en el artículo), meta-opciones ("Ninguna"/"No"/"Sí"), datos **corruptos** (008d63d7: la opción contiene todo un caso práctico pegado), y respuestas conceptuales cortas ("Diez días", "En 2024"). Los modelos baratos se lían con esa variedad → sobre-marcan FP reales (03793496/041f972a/0497f13a) y aciertan solo ~⅔.
2. **El consenso NO protege ante fallo CORRELACIONADO.** En la corrupta 008d63d7 los **3 modelos** dijeron FP→mantener a la vez → el ensemble la habría dejado viva. La regla "limpiar solo si todos coinciden" solo da seguridad si los errores son independientes; en casos-borde fallan en bloque.

**CONCLUSIÓN: aparcar la industrialización del triaje con modelos baratos para estos cubos.** No es problema de precio ni de ensemble: la tarea de literalidad con casos-borde (falsas/metas/corruptas) exige juicio que los baratos no dan de forma fiable, y un solo peligroso ya rompe la premisa de "filtro seguro".

### 9.1 MATRIZ DE DECISIÓN — para qué usar y para qué NO (con estado de evidencia)

> ⚠️ **Honestidad sobre la evidencia:** de todo lo de abajo, SOLO se han hecho 2 pilotos reales: el **bake-off** (§8, fiabilidad/precio/JSON de 44 modelos — PROBADO) y el **triaje de literalidad** (§9 — PROBADO que FALLA). Todo lo demás es **HIPÓTESIS razonada, NO medida**. No tratar una hipótesis como un hecho: antes de usar el barato para una tarea marcada `HIPÓTESIS`, hacer su pilot (muestra etiquetada → medir acierto + peligrosos, igual que §9).

| Tarea | ¿Usar barato? | Evidencia | Nota |
|---|---|---|---|
| **Elegir modelo / medir fiabilidad-precio-JSON** | ✅ Sí | **PROBADO** (§8) | 44 modelos; joyas nova-lite/gemma-3-12b; Haiku no aporta |
| **Clasificar tema/familia** (clínico/ofimática/legal) | ✅ **Sí** | **PROBADO** (§9.2 P3) | gemma **97%**. Útil para pre-escopar |
| **Triaje literalidad en sub-cubo HOMOGÉNEO** (opción larga + alto solape) | ✅ **Sí** | **PROBADO** (§9.2 P1) | ensemble: **0 peligro, 67% ahorro**. Solo sobre el sub-cubo filtrado |
| **Borrador de explicación §8.1** (Claude verifica cita+estilo) | 🟡 Parcial | **PROBADO** (§9.2 P5) | 6/6 formato OK, pero Claude fact-checkea la cita y quita estilo. Nunca auto-aplicar |
| **Triaje literalidad en cubo MIXTO** (saltar Claude) | ❌ **NO** | **PROBADO que FALLA** (§9) | 1 peligroso, fallo en bloque en casos-borde |
| **Priorizar/ordenar cola por sospecha** | ❌ **No** | **PROBADO que FALLA** (§9.2 P2) | Score invertido; peor que azar |
| **Detectar explicación=nota auditoría** | ❌ **No** | **PROBADO que FALLA** (§9.2 P4) | Sobre-marca+pierde notas; usar grep (`health-sweep.cjs`) |
| **Triaje mislink FP/relink** (saltar Claude) | ⚠️ No | Parcial (piloto 94% pero 16% JSON roto; el relink lo hace Claude) | Como mucho priorización, no decisión |
| **Reformateo determinista / extraer keywords / deduplicar** | 🟡 Probable | **HIPÓTESIS — sin pilot** | 0 casos-borde → debería ir bien, pero NO medido |
| **Decidir clave / destino de relink / literalidad sin verificación** | ❌ **NUNCA** | Principio | El juicio es de Claude, siempre |
| **Saltarse a Claude en cubo heterogéneo / verificación fina** | ❌ **NUNCA** | **PROBADO que FALLA** (§9, §9.2) | Casos-borde rompen el consenso |
| **Pre-filtro DETERMINISTA por solape de palabras** (código, 0 LLM: ¿la opción correcta aparece en el artículo vinculado?) | ❌ **NO** | **PROBADO que FALLA** (§9.4, 15/07) | 67% de las "aparentemente bien" eran descartables. El solape de palabras NO capta si el HECHO está |

### 9.2 RESULTADOS de los 5 pilotos (15/07/2026 — TODOS HECHOS)

Datos y scripts en `verify-live-scripts/pilots/` (`extract_pilots`, `run_pilots`, `analyze_234`, `run_p1_p5` + los `*_out.json`). Modelos: gemma-3-12b-it, nova-lite-v1, gpt-4o-mini (baratos). Gotcha: **OpenAI en json-mode 400 si el prompt no contiene la palabra literal "json"** (gemma/nova no lo exigen).

| # | Tarea | Resultado | Veredicto |
|---|---|---|---|
| **3** | **Clasificar tema** (clínico/ofimática/legal) | gemma **29/30 = 97%** | ✅ **FUNCIONA** |
| **1** | **Literalidad SOLO en sub-cubo HOMOGÉNEO** (opción 60-400 chars + solape≥0.5) + ensemble | **PELIGRO 0**, limpia **8/12 FP (67%)**, 7/15 a Claude | ✅ **FUNCIONA** (¡vs cubo mixto que dio 1 peligro/38%!) |
| **5** | **Borrador de explicación §8.1** | gemma **6/6 pasan gate de formato**, pero 1 cita mal el artículo (def. no está) + saludos fuera de estilo | 🟡 **PARCIAL** (ahorra estructura, NO el fact-check ni el estilo) |
| **2** | **Priorizar cola por sospecha** | score DEFECTO=60 < BUENO=69 (**invertido**); top-mitad 5/13 (peor que azar) | ❌ **FALLA** |
| **4** | **Detectar explicación=nota auditoría** | gemma 4/12, sobre-marca + pierde 2 notas | ❌ **FALLA** |

**Conclusiones firmes (ya PROBADAS, actualizan la matriz §9.1):**
- ✅ **Clasificación temática** (P3): fiable. Útil para pre-escopar/agrupar bancos por familia.
- ✅ **Triaje de literalidad, PERO solo en sub-cubo HOMOGÉNEO** (P1): el filtro `opción larga + alto solape con artículo` **quita los casos-borde** (falsas/metas/corruptas/cortas) que hundieron el cubo mixto → el ensemble da **0 peligrosos y 67% de ahorro**. Clave: **no correr el ensemble sobre el cubo entero, sino sobre el sub-conjunto homogéneo**; el resto va directo a Claude.
- 🟡 **Borrador de explicación** (P5): el barato clava el **formato** (6/6 gate) → ahorra el andamiaje, pero **Claude sigue teniendo que verificar la cita** (una de 6 atribuía al artículo algo que no estaba) **y quitar el estilo chateado**. Vale como primer borrador con revisión Claude obligatoria, NUNCA auto-aplicar.
- ❌ **Priorización** (P2) y ❌ **detección nota-auditoría** (P4): fallan. La priorización incluso invierte; para nota-auditoría un grep de patrones (que ya existe en `health-sweep.cjs`) es más fiable que el LLM barato.

**Patrón de fondo (la lección):** el barato sirve para **clasificar/estructurar sobre entrada LIMPIA** (P3, P1-homogéneo, P5-formato) y falla en cuanto hay **juicio de calidad o casos-borde** (P2, P4, P1-mixto, verificación fina). Homogeneizar la entrada ANTES (filtrar) es lo que convierte una tarea de ❌ a ✅.

### 9.4 Pilot 7 — pre-filtro DETERMINISTA por solape (código, sin LLM) sobre needs_human (15/07/2026)

**Pregunta:** ¿se puede triar el cajón `needs_human` con CÓDIGO puro (sin IA) comparando si la opción correcta aparece literal en el artículo vinculado? Sería lo más barato y "con garantías" (determinista).

**Método:** verdad-terreno = las **53 preguntas del piloto Orden INT/859/2023** ya adjudicadas a mano ese día (11 recuperables / 42 descartadas, memoria `project_drenaje_needs_human_piloto_ordenint`). Métrica = *recall* de la opción correcta dentro del artículo **original** vinculado (fracción de palabras significativas de la opción presentes en el artículo). Umbral "bien vinculada" = recall ≥ 0.7. Script `verify-live-scripts/prefilter_val.cjs`.

**Resultado: ❌ FALLA.** De las 12 que el código marcó "bien vinculada" (recall alto), **8 eran DESCARTADAS** → **67% de error** en el grupo que se auto-aceptaría. Peligrosos con recall=1.0 (2aa62ca0, 340792c9, 4aff6155, 71462f4e, 72673309, b6fb79dc, d07f2979, e15df9cc).

**Por qué falla (la lección):** el solape de palabras mide *vocabulario compartido*, NO *verdad del hecho*. Ejemplo: pregunta "¿dónde está la Brigada del **Museo del Prado**?" → opción "Unidad Central de Protección"; esas palabras SÍ están en el art. 7 (recall=1.0), pero el artículo **no dice** que el Museo del Prado esté ahí. Coinciden las palabras, no el hecho. Idéntico modo de fallo que el LLM barato en cubo mixto (§9): la literalidad es *juicio*, no *coincidencia de tokens*.

**Conclusión (3ª medición convergente):** ni LLM barato (§9) ni código de solape (§9.4) triar con garantías el juicio de literalidad. El recall bajo (<0.3) SÍ indica "el artículo vinculado no la responde", pero NO distingue *descartable* de *re-vinculable* (la respuesta puede estar en OTRO artículo → sigue siendo juicio). **Lo único mecánico útil y seguro es AGRUPAR el cajón por ley/banco** (código trivial, o clasificador temático barato P3 al 97%) para que los agentes Claude procesen lotes homogéneos con contexto compartido — que es de donde vino el ahorro real del piloto. El **juicio** de disposición (FP/relink/retire) es de Claude, sin atajo.

### 9.3 Implicación para tareas grandes de verificación (p.ej. biblioteca 4.381 draft)
La verificación de un banco draft (¿bien colocada + clave/explicación correcta?) es **juicio** → el barato NO la sustituye (cae como P2/P4/P1-mixto). PERO puede meter **dos capas de ahorro medidas**: (a) **clasificar tema/colocación** (P3, 97%) para pre-escopar; (b) **pre-limpiar el sub-cubo homogéneo** (P1, opción verbatim del artículo → 0 peligro, 67%) para que los agentes Claude no gasten en las obvias-correctas. El grueso (juicio fino, casos-borde) sigue con agentes Claude. **Sin auto-aplicar nada del barato**; siempre con Claude/gate detrás. Para saber el ahorro real en biblioteca → **Pilot 6 dedicado** (mismo método) sobre ~15 draft reales de esa oposición.

> **DECISIÓN (15/07/2026):** la verificación de los **4.381 draft de biblioteca se hace con Claude Code** (agentes/workflow), NO con OpenRouter — es verificación fina (juicio), la categoría donde el barato falla. El Pilot 6 queda **sin hacer** (no necesario para esa tarea). Las capas de ahorro barato (clasificar colocación + pre-limpiar homogéneas) quedan documentadas por si se quieren usar como pre-filtro en el futuro, pero la decisión tomada es Claude Code.

---

## 10. RESUMEN EJECUTIVO (para qué usar OpenRouter barato y para qué no)

**Probado que FUNCIONA (usar con Claude/gate detrás, nunca auto-aplicar):**
- Clasificar tema/familia de un banco (gemma-3-12b ≈97%).
- Triaje de literalidad **solo en sub-cubo homogéneo** (opción larga + alto solape con el artículo) con ensemble de 2-3 (nova-lite + gemma-3-12b + gpt-4o-mini) → 0 peligrosos, ~67% de ahorro.
- Borrador de explicación §8.1: buen esqueleto (formato), pero Claude verifica la cita y limpia el estilo.

**Probado que NO funciona:** triaje de literalidad en cubo mixto/heterogéneo, **pre-filtro determinista por solape de palabras** (código sin LLM: 67% error, el solape no capta el hecho — §9.4), priorización de cola por sospecha, detección de nota-auditoría (para esto usar grep de `health-sweep.cjs`), y cualquier verificación fina o decisión de clave/relink sin Claude. **Regla derivada:** el juicio de literalidad NO se mecaniza con garantías (ni IA barata ni código); lo único mecánico seguro es **agrupar por ley/banco** para dar a Claude lotes homogéneos.

**Modelos ganadores:** `amazon/nova-lite-v1` ($0.06, 602ms) y `google/gemma-3-12b-it` ($0.05); ensemble con `openai/gpt-4o-mini` ($0.15). Claude Haiku ($1) no aporta. Coste de procesar cientos de preguntas: céntimos.

**Regla única:** el barato **clasifica y estructura sobre entrada limpia**; **homogeneizar/filtrar la entrada ANTES** es lo que convierte una tarea de ❌ a ✅. El **juicio** (verificar, decidir clave, elegir destino, escribir la explicación final) **es siempre de Claude**.

## 11. VEREDICTO coste/beneficio (15/07/2026) — ¿merece la pena para NUESTROS cubos? NO

Decisión tomada tras medirlo: **para los cubos actuales de calidad fina, NO compensa desplegar la capa barata.**

- **El ahorro seguro es pequeño y acotado.** La única franja probada segura (sub-cubo homogéneo de "opción no literal") es una fracción (~30%) de las 846; aplicando 67% de limpieza ≈ **150-200 preguntas de UN cubo** que pasarían de "revisión profunda" a "confirmación rápida". Los demás cubos (clave dudosa 93, explicación floja 1.749, mislink ~431, needs_human 4.386, draft 19.120) **no tienen franja segura**: o fallan el test, o Claude hace el trabajo igual.
- **Contra ese ahorro, el coste del pipeline** (filtro → ensemble de 3 modelos → split → confirm de Claude) + sus fallos (429, JSON roto, rutas mangled, gotcha "json" en OpenAI) **no sale rentable** para ~200 preguntas.
- **Lo que SÍ valió la pena:** la investigación. Ahora sabemos —con datos— que los baratos NO sustituyen el juicio de Claude en trabajo de calidad, y dónde sí (clasificación limpia, sub-cubos homogéneos). Evita reintentarlo a ciegas. Los $10 quedan de saldo.
- **Cuándo SÍ valdría la pena (futuro):** una tarea **enorme Y homogénea** (miles de preguntas de una fuente, clasificación/normalización masiva sobre entrada limpia) — NO los cubos de verificación fina actuales.

**Acción:** parar aquí con OpenRouter (todo documentado + scripts reutilizables en `verify-live-scripts/{pilots,optlit,bakeoff}`); seguir el trabajo de cubos con **agentes Claude**, que es fiable y sin lío. Reabrir solo si aparece una tarea enorme-homogénea.

---

## 12. Pilot Kimi K3 (22/07/2026) — triaje NO; generar/reescribir SÍ, pero el barato empata

> **Motivo:** salió **Kimi K3** en OpenRouter (16/07/2026, `moonshotai/kimi-k3`, 2.8T open-weight multimodal **reasoning**, 1M contexto, **$3/M in · $15/M out**). Pregunta de Manuel: ¿el modelo más nuevo/caro sirve para los cubos de revisión, aunque sea caro? Se probó a fondo en 3 tipos de tarea contra la verdad-terreno de BD y contra el barato ganador (`google/gemma-3-12b-it`). Scripts+datos en `scratchpad/` (durables re-ejecutando el método): `build_sample_k3.cjs`, `run_triage*.cjs`, `run_rewrite.cjs`, `run_gen.cjs`, `eval_*.cjs`, `compare_*.cjs`.

**Técnica (gotchas nuevos):** K3 responde **HTTP 200** (Kimi **K2 daba 400** en el bake-off §8) y da **100% JSON parseable** porque **OpenRouter separa el razonamiento en un campo `reasoning` aparte** → el `content` sale limpio. Esto **anula el viejo problema "los razonadores rompen el JSON"** (§8). Pero es **lento y caro por los tokens de razonamiento** (~200 tok reason/pregunta facturados a $15/M): **~$0.006/pregunta**, 14-55 s cada una.

### 12.1 Resultados (muestras reales de BD + verdad-terreno, K3 vs gemma-3-12b)

| Tarea | Muestra | **Kimi K3** | gemma-3-12b (barato) | ms/preg K3 vs barato |
|---|---|---|---|---|
| **Triaje literalidad FP/MISLINK** (red de seguridad) | 50 (25 FP + 25 MISLINK, cohorte mislink) | ❌ **5/25 PELIGROSOS** (los MÁS de todos) | 3/25 | 14.300 vs 1.400 |
| **Reescribir explicación §8.1** (`explanation_ok=false`) | 12 vivas | ✅ **12/12** formato+cita REAL+estilo | 11/12 | 55.000 vs 7.700 |
| **Generar pregunta** desde artículo | 8 artículos (39/2015, 40/2015, CE, LCSP, LO 3/2007) | ✅ **8/8** clave correcta y fundada | 8/8 correctas | 30.700 vs 2.800 |

(Bake-off triaje completo: gpt-4o-mini 2 peligro, nova-lite 3. Con prompt **escéptico/adversarial** K3 baja a 1 peligro pero la discriminación se hunde —FP-ok 19→11— o sea vuelve conservador y deja de ahorrar; y aun así 1 leak.)

### 12.2 Hallazgo central — el razonamiento de K3 CAMBIA DE SIGNO según la tarea

- **Triaje = LASTRE.** K3 **racionaliza**: construye una justificación de por qué un artículo del mismo tema *podría* sostener la clave → deja pasar vínculos malos. Ejemplo real: art. 440 CC usa la palabra "causante" de pasada y K3 se autoconvence de que la define. **Mismo modo de fallo que el solape determinista de §9.4** (palabra presente ≠ hecho presente). Un razonador NO arregla el triaje de literalidad; falla distinto (con más aplomo).
- **Generar/reescribir = ACTIVO.** Citas reales Y correctas (encontró la *letra h)* enterrada en el art. 2 LAJG y explicó por qué la letra a) es la regla general), **0 citas inventadas** en 12 (el fallo del P5 barato), distractores más finos (art. 190 LCSP: trampa "inspeccionar en todos los casos" explotando el "en ningún caso derecho general a inspeccionar").

### 12.3 Veredicto (confirma §11, ahora con datos de K3)

- **Como red de triaje/verificación:** **NO** — K3 es peor que el barato y reconfirma que el juicio de literalidad es de Claude. Cerrado.
- **Como generador/reescritor:** K3 es **genuinamente bueno** — aquí "aunque sea caro" tendría lógica. PERO **el barato ya aprueba** esas tareas (gemma 8/8 claves, 11/12 explicaciones) a **~1/120 del coste y 10-20× más rápido**. K3 solo gana en pulcritud de formato y dureza de distractor: margen pequeño que **no justifica 120×** salvo como "generador premium" puntual para preguntas difíciles, y **con revisión detrás igualmente**.
- **Ni K3 se libra del gate:** su pregunta del art. 258 LCSP quedó con **riesgo de doble respuesta** (opción B "riesgo de mercado por demanda" discutiblemente también verdadera) justo por buscar un distractor sofisticado → **toda pregunta generada (K3 o barato) necesita gate Claude/humano** antes de publicar.

**Acción:** para el grueso generativo (reescribir explicaciones, generar bancos) usar **baratos + gate Claude**; reservar K3 —si acaso— como generador premium puntual. **Prueba pendiente donde K3 podría por fin diferenciarse del barato:** material difícil que hunde al barato (síntesis multi-artículo, preguntas derivadas con inferencia jurídica) — en artículo único directo ambos empatan en corrección.
