# Fase 2 — Verificación independiente de preguntas alteradas (re-vinculadas)

> **Independiente y trazable** del proyecto de contenedores/leyes (ver `leyes-contenedores-sanidad.md`). Objetivo: re-verificar con agente las preguntas cuyo `primary_article_id` fue **alterado** (redistribuido en clínicos 1-25, re-vinculado en legislativos 26-30 + conexas) durante la operación 02-03/06/2026, ahora que TODAS tienen artículo literal real, para fijar `answer_ok / explanation_ok / article_ok / options_ok` y promocionarlas por el lifecycle.

## Por qué es necesaria
Las re-vinculaciones se hicieron por **nº de artículo citado / rúbrica / similitud de contenido** (auto-ruteo). Eso pone la mayoría en su artículo correcto, pero **puede haber preguntas en el artículo equivocado** o con respuesta/explicación que ya no casa. La Fase 2 lo verifica una a una contra el artículo literal y deja constancia.

## Cohorte (definición reproducible)
**Preguntas activas cuyo `primary_article_id` ∈ artículos reales (≠ `_tmp_hold`) de estas 62 leyes:**
- **30 contenedores** (los redistribuidos/re-vinculados): los 25 clínicos TCAE + 4 legislativos (Murcia `d459c687`, Galicia `d73d21ee`, Madrid `0bdba0c8`, Aragón `e3e6e305`) + Carta Social Europea `803d9365`. (Lista de los 25 clínicos en `leyes-contenedores-sanidad.md`.)
- **32 leyes conexas nuevas** creadas en la operación (queryable: `laws.created_at >= '2026-06-02'`).

**Tamaño (03/06/2026):** **17.546 preguntas** con artículo real + 28 en `_tmp_hold` (pendientes de norma/baja confianza). Script de cálculo: `/tmp/aulaplus_audit/cohorte.cjs`.

## Tracking (convención obligatoria, manual revisar-preguntas-con-agente §5.1)
La constraint de `ai_verification_results` es `(question_id, ai_provider)`. Para NO sobrescribir verificaciones previas y dejar esta fase como cohorte independiente trazable:
- **`ai_provider = 'claude_code_phase2_relink'`** para todos los registros de esta fase.
- Cada registro con `ai_model`, `verified_at`, `confidence`, `explanation`, y los 4 flags.
- Así, `SELECT ... WHERE ai_provider='claude_code_phase2_relink'` da la traza completa de qué pregunta alterada pasó la verificación y con qué resultado.

## Criterios (del manual)
- `article_ok` (§3.1): la pregunta se responde con el artículo vinculado (cita literal). Si no → `article_ok=false` + `correct_article_suggestion`.
- `answer_ok`: la opción marcada correcta lo es.
- `explanation_ok` (§8.1): explicación didáctica (4 elementos).
- `options_ok` (§3.2): la opción correcta es literal al artículo.
- Gate: `transition_question_state` exige `answer_ok+explanation_ok TRUE` y `article_ok/options_ok ≠ FALSE` para promocionar (`approved`/`tech_approved`).

## Ejecución
17.546 verificaciones AI = **trabajo multi-agente a gran escala** (un agente lee artículo+pregunta y juzga). Estimación: lotes de ~15-20 preguntas/agente → ~900-1.200 agentes. Requiere **workflow** (orquestación multi-agente) — pendiente de arranque explícito.

Patrón por lote: extraer (pregunta + opciones + correct_option + artículo literal) → agente juzga 4 flags + sugerencias → upsert `ai_verification_results` (`ai_provider='claude_code_phase2_relink'`) → para las que pasan, `transition_question_state` a approved/tech_approved → para `article_ok=false`, re-vincular al artículo sugerido y re-verificar (iterar).

## Estado
- ✅ Cohorte identificada y definida (17.546 + 28).
- ⬜ Verificación AI (pendiente de arrancar — workflow).

## Piloto de calibración — Murcia (03/06/2026)
86 preguntas (Ley 3/2009 + D80/2005 + D236/2010) verificadas con 5 agentes paralelos; 85 verdicts registrados en `ai_verification_results` (`ai_provider='claude_code_phase2_relink'`). Mecanismo validado end-to-end (extraer → agente juzga 4 flags → registrar con tag).

**Resultado clave (Murcia fue de las MÁS limpias — ruteada por nº de artículo citado):**
- **article_ok TRUE: 52 (61%) → 39% MAL VINCULADAS** (mi auto-ruteo keyword/similitud puso ~40% en artículo equivocado: deberes art.63 recibió líneas-de-actuación/CI/intimidad; art.12 elección recibió segunda-opinión/derechos-básicos; art.31 recibió art.32 excepciones; art.50 recibió formalización art.51; etc.). En clínicas (keyword) y similitud el error será ≥ este.
- **answer_ok TRUE: 79/85** (las respuestas correctas del banco mayormente bien).
- **explanation_ok TRUE: 3/85 (~96% NO didácticas)** — explicaciones heredadas/vacías.

**Implicación para las 17.546:** Fase 2 NO es solo "verificar". Las preguntas YA están ACTIVAS (live), así que lo CRÍTICO es **re-rutar el ~40% mal vinculado a su artículo correcto** (daño de mi auto-ruteo sobre preguntas vivas: teoría/AIChat/impugnaciones apuntan a artículo equivocado). El rewrite de explicaciones (~96%) es mejora de calidad aparte. Gate lifecycle exige explanation_ok=true para promocionar a perfect, pero las preguntas ya están activas → la prioridad es corregir article_ok, no promocionar.

**Decisión de alcance pendiente para las 17.546:** (A) solo verificar + RE-RUTAR wrong-article (corregir el daño, prioritario); (B) además reescribir explicaciones no didácticas (QA completa, enorme). Ejecución = lotes de agentes (Agent tool desde el bucle, no Workflow: los agentes necesitan los datos en el prompt y no pueden leer Supabase).
