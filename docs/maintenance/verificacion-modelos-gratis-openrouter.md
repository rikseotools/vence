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
