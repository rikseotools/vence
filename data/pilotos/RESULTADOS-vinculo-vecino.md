# A/B de modelos para adjudicar `vinculo_articulo_vecino` — 29/07/2026

Muestra: `vinculo-vecino-golden.json` (10 casos reales, veredicto adjudicado a mano contra el BOE).
Comando: `npm run llm:ab-vinculo -- --modelos <lista>`.

## ⚠️ Lo primero: la primera tanda estaba MAL, y por mi culpa

Con `max_tokens: 400` y sin `response_format`, **diez modelos sacaron 0-2/10 por «SIN_JSON»**. No era
incapacidad: eran modelos de RAZONAMIENTO que se gastaban el presupuesto pensando y devolvían
contenido vacío. Al subir a 4.000 tokens y forzar JSON por API:

| modelo | antes | después |
|---|---|---|
| google/gemini-3.5-flash | 1/10 | **10/10** |
| google/gemini-3.6-flash | 2/10 | 9/10 |
| deepseek/deepseek-v4-pro | 1/10 | 9/10 |
| nvidia/nemotron-3-super-120b | 2/10 | 9/10 |
| z-ai/glm-4.7-flash | 0/10 | 8/10 |

**Medir con el techo bajo no compara modelos, compara arneses.** Es la trampa nº 1 de este tipo de
banco de pruebas y conviene no repetirla.

## Tabla (34 modelos, todos con el arnés corregido)

| modelo | aciertos | tiempo | coste/10 casos |
|---|---|---|---|
| google/gemini-3.5-flash | **10/10** | 31s | $0,0415 |
| nvidia/nemotron-3-super-120b-a12b | 9/10 | 89s | $0,0065 |
| deepseek/deepseek-v4-pro | 9/10 | 118s | $0,0214 |
| google/gemini-3.6-flash | 9/10 | 22s | $0,0253 |
| **mistralai/mistral-small-3.2-24b** | 8/10 | 28s | **$0,0009** |
| deepseek/deepseek-v4-flash | 8/10 | 111s | $0,0020 |
| deepseek/deepseek-chat | 8/10 | 22s | $0,0027 |
| openai/gpt-5.4-nano | 8/10 | 36s | $0,0034 |
| google/gemini-3.1-flash-lite | 8/10 | 16s | $0,0051 |
| z-ai/glm-4.7-flash | 8/10 | 442s | $0,0084 |
| x-ai/grok-4.3 | 8/10 | 47s | $0,0243 |
| x-ai/grok-4.5 | 8/10 | 59s | $0,0372 |
| anthropic/claude-haiku-4.5 | 8/10 | 55s | $0,0405 |
| qwen/qwen3-235b-a22b-2507 · gemini-2.5-flash-lite · gemini-3.5-flash-lite · gpt-4.1-mini · deepseek-v3.2 · gpt-5.4-mini · nova-2-lite · gemini-2.5-flash · qwen3.5-plus · mistral-medium-3.1 | 7/10 | — | — |
| llama-4-maverick · gpt-5-mini · glm-4.5-air · minimax-m2 · qwen3-next-80b · kimi-k2-0905 · qwen3.6-plus | 6/10 | — | — |
| gpt-4.1-nano | 5/10 | 16s | $0,0011 |
| gpt-5-nano · gpt-4o-mini | 4/10 | — | — |
| z-ai/glm-4.6 | 2/10 | 412s | $0,0306 |

**Referencia: el agente Sonnet del manual de revisión sacó 10/10 por ~0,30 $** en los mismos 10 casos.

## ⚠️ Lo segundo: 10 casos no separan 10/10 de 8/10

Con esta muestra, ±1 acierto es ruido. La tabla sirve para **descartar** (los de 4-6/10 quedan fuera
sin discusión) y para ver que hay modelos 7 veces más baratos que el agente en la banda alta. **No
sirve para coronar un ganador.** Para eso hay que ampliar el golden set a 30-40 casos y correr solo
los finalistas.

## Lo tercero: los rankings generales NO predicen esta tarea

En el índice de Artificial Analysis (julio 2026) varios modelos baratos empatan o superan a Sonnet
4.6 (35,9): DeepSeek V4 Flash 37,5 · Gemini 3.5 Flash-Lite 36,5. Aquí, sin embargo,
**gemini-3.5-flash-lite saca 7/10 y gemini-3.5-flash 10/10**, y deepseek-v4-flash 8/10. La dirección
del ranking acierta (los baratos compiten), el orden concreto no se traslada. Por eso este banco
existe: se mide en la tarea, no se deduce de una tabla general.

## Los tres casos que separan a un buen adjudicador de uno malo

1. `0c76f387` — el enunciado CITA el artículo vinculado («de conformidad con el artículo 440»). Es el
   caso que más modelos falla: proponen re-vincular y **romperían una pregunta correcta**.
2. `0f0776ce` — pregunta de EXCLUSIÓN («no tendrá en cuenta»): la opción correcta cita el vecino
   porque es lo que queda fuera.
3. `3252df5b` — la respuesta no está en ninguno de los dos artículos; hay que saber decir «ninguno».
