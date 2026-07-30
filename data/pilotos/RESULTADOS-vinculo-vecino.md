# A/B de modelos — adjudicar `vinculo_articulo_vecino` (29-30/07/2026)

Muestra: `vinculo-vecino-golden.json` — 10 casos reales, veredicto adjudicado a mano contra el BOE.
Comando: `npm run llm:ab-vinculo -- --modelos <lista>`.
**CATÁLOGO AGOTADO: 279 modelos probados** — todos los del catálogo de OpenRouter por debajo de
3 $/M con contexto suficiente. Solo **97 se ejecutaron de verdad**; el resto devuelve error sin
llegar a correr (se reconocen por coste 0,00 $ y menos de un segundo). Quedan fuera 33 más caros que
Sonnet y 13 con contexto por debajo de 30k, donde no caben los dos artículos por debajo de 3 $/M de entrada, todos con el mismo arnés.

---

## ⚠️ Léase esto antes que la tabla: CUATRO veces el arnés mintió antes que el modelo

Ninguna medición sirve si el banco está mal. En dos días, cuatro veces di por malo a un modelo y el
fallo era mío:

| # | qué pasaba | síntoma | efecto real |
|---|---|---|---|
| 1 | `max_tokens: 400` | 10 modelos con «SIN_JSON» | eran modelos de RAZONAMIENTO: gastaban el presupuesto pensando y devolvían vacío. `gemini-3.5-flash` pasó de **1/10 a 10/10** |
| 2 | el prompt no pedía `"v": 1` | 0/3 «por culpa del modelo» | `isStructuredExplanation` lo exige y rechazaba estructuras perfectas |
| 3 | gate de no-regresión equivocado | 0/6 en transformación | `mismoContenidoExplicacion` compara dos renders de la MISMA estructura, no un texto con su reestructuración. **El parser determinista de producción también sacaba 0/6**: cuando tu examen suspende al patrón de oro, el examen está mal |
| 4 | umbral de anclaje a ojo (0,35) | 20-40% en reescritura | **suspendía 13 de las 26 razones de explicaciones escritas a mano y verificadas contra el BOE**. Explicar bien es PARAFRASEAR. Recalibrado al percentil 10 humano (0,12) → **83%** |

**Regla que queda: cuando un modelo saca 0, sospechar del arnés primero.**

Y un quinto error, este de SELECCIÓN: la primera lista la armé de memoria y me dejé fuera las
versiones nuevas de media docena de familias — entre ellas **Kimi K3, que saca 10/10**, y
**claude-sonnet-5, que está a 2 $/M**. Lo señaló Manuel. Ahora la lista se arma consultando el
catálogo de OpenRouter, no la memoria.

---

## La tabla (los que puntúan 8 o más)

| modelo | aciertos | tiempo | $/10 casos |
|---|---|---|---|
| **google/gemini-3.6-flash** | **10/10** | 21s | 0,0304 |
| **google/gemini-3.5-flash** | **10/10** | 25s | 0,0397 |
| **moonshotai/kimi-k3** | **10/10** | 76s | 0,0564 |
| qwen/qwen3.6-flash | 9/10 | 217s | 0,0242 |
| openai/gpt-5.4-mini | 9/10 | 54s | 0,0124 |
| minimax/minimax-m2.5 | 9/10 | 143s | 0,0130 |
| openai/o4-mini | 9/10 | 27s | 0,0189 |
| **qwen/qwen3.7-flash** | 8/10 | 111s | **0,0027** |
| deepseek/deepseek-chat | 8/10 | 34s | 0,0029 |
| **google/gemma-4-31b-it** | 8/10 | 252s | **0,0032** |
| openai/gpt-5.4-nano | 8/10 | 22s | 0,0036 |
| nvidia/nemotron-3-super-120b | 8/10 | 125s | 0,0037 |
| deepseek/deepseek-v4-flash | 8/10 | 730s | 0,0045 |
| google/gemma-4-26b-a4b-it | 8/10 | 476s | 0,0050 |
| google/gemini-3.1-flash-lite | 8/10 | 16s | 0,0051 |
| mistralai/mistral-small-2603 | 8/10 | 54s | 0,0055 |
| minimax/minimax-m3 | 8/10 | 84s | 0,0066 |
| deepseek/deepseek-v3.2 | 8/10 | 573s | 0,0076 |
| minimax/minimax-m2.7 | 8/10 | 145s | 0,0149 |
| amazon/nova-premier-v1 | 8/10 | 21s | 0,0322 |
| x-ai/grok-4.3 / grok-4.5 / grok-build | 8/10 | 42-111s | 0,024-0,046 |

**Referencia: el agente Sonnet de Claude Code sacó 10/10.**

### Los que decepcionan (importa tanto como los que ganan)

- **`anthropic/claude-haiku-4.5`: 7/10 por 0,042 $** — de lo peor en calidad/precio de la tabla, y era
  mi favorito de partida. Cuesta 15 veces más que `qwen3.7-flash`, que acierta más.
- **`anthropic/claude-sonnet-5` por API: 7/10** — por debajo de tres modelos más baratos, y por debajo
  del **agente** Sonnet de Claude Code (10/10). El agente delibera; la llamada suelta no.
- **`stepfun/step-3.5-flash` y `moonshotai/kimi-k2`: 0/10**, diez fallos de formato cada uno. Ni con el
  arnés arreglado devuelven JSON.
- `gpt-4o-mini` 4/10 y `gpt-5-nano` 4/10: descartados sin discusión.

---

## Lo que quedaba: nada nuevo en la banda alta

La última tanda de 64 no aportó ningún candidato: el único que llegó a 8/10 fue `openrouter/free`
(el enrutador a modelos gratuitos), que **no sirve para producción** — no eliges qué modelo responde
y va con límites de uso. Los otros 63 no se ejecutaron o quedaron por debajo. Es decir: **la banda
alta ya estaba encontrada**, y los mejores candidatos siguen siendo los de la tabla de arriba.

## El caso que casi todos fallan (y hay que meter en el prompt de producción)

`0c76f387` — Ley de Enjuiciamiento Civil, artículo 440 frente al 442. **El enunciado CITA el artículo
440.** Casi todos los modelos, incluidos los de 9/10, proponen re-vincular al 442 y **romperían una
pregunta correcta**. Los otros dos patrones trampa del golden set:

- `0f0776ce` — pregunta de EXCLUSIÓN («no tendrá en cuenta»): la opción correcta cita el vecino
  precisamente porque es lo que queda FUERA.
- `3252df5b` — la respuesta no está en ninguno de los dos artículos: hay que saber decir «ninguno».

---

## ⚠️ Con 10 casos NO se corona a un ganador

±1 acierto es ruido. Esta tabla sirve para **descartar** (los de 4-6/10 quedan fuera sin discusión) y
para ver que la banda alta es asequible. Para elegir entre 10/10 y 8/10 hace falta ampliar el golden
set. Estado: **11 de 20 casos nuevos salieron unánimes** con un panel de los tres mejores; **9
necesitan adjudicación humana** — y ese 45% de discrepancia entre los mejores modelos es, en sí
mismo, la prueba de que adjudicar no se automatiza.

## ¿Los modelos nuevos son mejores? SÍ, y medirlo mal casi me hace decir que no

Sobre **97 modelos que de verdad se ejecutaron** (de 215 probados, 118 devolvieron error sin llegar
a correr):

| semestre de publicación | n | media |
|---|---|---|
| 2024-S2 | 10 | 5,2/10 |
| 2025-S1 | 18 | 5,8/10 |
| 2025-S2 | 24 | 6,0/10 |
| **2026-S1** | 37 | **7,5/10** |
| 2026-S2 | 8 | 7,0/10 |

**r = 0,473.** Dos puntos y medio de mejora en dos años.

**Y el QUINTO artefacto del arnés, que casi invierte la conclusión:** el primer cálculo dio r = 0,128
(«no hay patrón») porque incluía los 118 que **no se ejecutaron** — se reconocen por **coste 0,00 $ y
0,4 segundos**, y como muchos son de julio de 2026, hundían justo la cohorte más reciente. Un modelo
que devuelve error no es un modelo que falla.

**Cómo se usa esto:** priorizar los recientes al elegir a quién probar, **no** darlos por buenos sin
medir. `deepseek/deepseek-chat` es de diciembre de 2024 y saca 8/10, por encima de bastantes de 2026.

## Los rankings generales no predicen esta tarea

En el índice de Artificial Analysis varios baratos empatan o superan a Sonnet 4.6. Aquí
`gemini-3.5-flash-lite` saca 7/10 y `gemini-3.5-flash` 10/10; `claude-sonnet-5` saca 7/10 y
`gemma-4-31b` (75 veces más barato) saca 8/10. La dirección del ranking acierta —los baratos
compiten— pero el orden concreto **no se traslada**. Por eso este banco existe: se mide en la tarea.
