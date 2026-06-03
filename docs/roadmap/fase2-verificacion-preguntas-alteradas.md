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

## Ciclo completo validado — Murcia (03/06/2026) — alcance B (QA completa)
Murcia (86 preguntas, Ley 3/2009 + D80/2005 + D236/2010) procesada con el ciclo profesional completo, file-based (agentes escriben su JSON con Write → cero riesgo de transcripción):
1. **Verificar** (5 agentes): detectó 39% mal vinculadas.
2. **Re-rutar** (3 agentes con índice de artículos): 33 preguntas movidas a su artículo correcto (`primary_article_id`).
3. **Reescribir explicación didáctica** (6 agentes, contra el artículo correcto): 86 explicaciones nuevas (negrita + cita en blockquote + análisis por opción + fuente).
4. **Finalizar**: 86 `ai_verification_results` con `ai_provider='claude_code_phase2_relink'`; `questions.explanation` actualizada + `verified_at` + `verification_status`. 79 OK, **7 marcadas `problem`** (answer/article dudoso → revisión humana: p.ej. art.21/art.24/art.9 D236 donde el texto del artículo en BD no contiene literalmente la cláusula o la respuesta del banco es dudosa).

**Pipeline reusable (scripts en /tmp/aulaplus_audit/):** export por ley agrupado por artículo → chunks → agentes verifican (rwout) → re-rutar wrong-article → agentes reescriben explicación (Write a fichero) → apply_phase2.cjs (merge+dedup+update explanation+upsert verification). **CLAVE FIABILIDAD: los agentes escriben su salida a fichero con Write, NO se transcribe a mano.** Coste Murcia ≈ 0,5M tokens / 86 preguntas → extrapolado a 17.546 ≈ 100M+ tokens: ejecutar ley por ley, en sesiones, "lento pero fiable".

## Estado
- ✅ Cohorte (17.546) identificada y definida.
- ✅ Piloto + ciclo completo validado en **Murcia (86)** — alcance B.
- ⬜ Resto (~17.460): mismo ciclo, ley por ley.

## Galicia (03/06/2026) — ciclo completo, pipeline combinado
186 preguntas. Pasada combinada verificar+reescribir (10 agentes, file-based): 116 OK directas. 70 mal vinculadas (38%, consistente con Murcia) → re-rutadas (5 agentes con índice de 325 arts): 65 a artículo correcto + 5 fuera de índice (Decreto 200/1993 y estructura, no creados) → reescritas (5 agentes). Total: **181/186 verificadas + explicación didáctica**, 5 pendientes, ~11 'problem' a revisión. Optimización vs Murcia: pasada combinada (verify+rewrite en una) reduce agentes para el 62% correcto.

Progreso Fase 2: **272 / 17.546** (Murcia 86 + Galicia 186). Siguiente: Madrid, Aragón, Carta (legislativas) → luego clínicas 1-25.

## Madrid (03/06) — 97/98 verificadas. Pipeline 100% generalizado (scripts param.)
Scripts reutilizables en /tmp/aulaplus_audit/: export+chunk por ley → agentes combinados verify+rewrite (Write a galout/madout_N) → apply_combined.cjs <pfx> <n> → reroute_prep.cjs <pfx> <cont> <n> → agentes reroute (Write a Xrrout_N) → reroute_apply_sim.cjs (aplica reroutes-agente + similitud para los que falten + export rewrite) → agentes rewrite (Write Xrwout_N) → apply_rw.cjs. **Incidencias infra: timeouts de stream y rate-limit transitorio del servidor con 4+ agentes en paralelo → el fallback de similitud (script, sin agentes) cubre los huecos de reroute.** Progreso: **362/17.546** (Murcia+Galicia+Madrid). Siguiente: Aragón (legislativa grande), Carta, luego clínicas 1-25.

## Aragón (03/06) — 257/304 verificadas (la más dura). Progreso 650/17.546
Aragón fue el peor caso: **53% mal vinculadas** (era el más ruteado por similitud). El router por similitud FALLÓ para re-rutar (decretos de estructura comparten vocabulario) → hubo que usar re-ruteo por AGENTE con índice (fiable). 257 verificadas+explicación; 36 de normas fuera de catálogo (Estatuto Marco Ley 55/2003, Convenio, Ley 39/2015, Ley 5/2014, geografía…) marcadas article_ok=false pendientes; 11 flagged.

### ⚠️ LÍMITE DE FIABILIDAD detectado (importante para el resto)
Los agentes que hacen **verify+rewrite combinado escribiendo a fichero se degeneran ~40-50% de las veces a esta escala** (escriben N copias del mismo question_id, o leen un fichero viejo y "saltan"). Mitigaciones que funcionan: (1) **borrar el fichero antes de re-correr** (no pueden saltar); (2) usar **rewrite-only** (sin lógica article_ok) que es mucho más estable; (3) **validar unicidad** tras cada pasada y re-correr degenerados; (4) re-ruteo SIEMPRE por agente+índice (la similitud falla en leyes de vocabulario solapado). Además: timeouts de stream y rate-limit del servidor con muchos agentes en paralelo.

### Estado real
Legislativas hechas (full QA): **Murcia, Galicia, Madrid, Aragón ≈ 660 preguntas**. Falta: Carta Social (140) + conexas menores + **las 25 clínicas (~16.400, el grueso)**. A la tasa y fiabilidad actuales, completar 17.546 en autopilot continuo NO es viable de una sola vez (miles de llamadas a agente con ~mitad de fallos que requieren reintento). Recomendación: ejecutar por tandas controladas (p. ej. N leyes/sesión) con validación de unicidad, o construir un harness más robusto.

## Carta Social Europea (03/06) — 142 (92 OK, 50 a revisión). LEGISLATIVAS COMPLETAS. Progreso 772/17.546
Caso especial: el tratado tiene **artículos breves** (solo se enriquecieron 13 con cifras); muchas `article_ok=false` no son mal-ruteo sino **contenido insuficiente** (el artículo es el correcto pero su texto es un resumen) → tarea de enriquecimiento de contenido, no de re-vinculación. Otras sí son mal-ruteo real (grab-bag arts 27/10/31) → re-rutar. Quedan 50 marcadas.

### Refuerzo del protocolo (confirma §20 del manual)
El formato **combinado** (verify+rewrite con explicación, escrito a fichero) se degeneró otra vez ~50% en Carta. El split **verify-only** (salida mínima) fue 100% fiable. → **Estándar para el grueso clínico: pasada 1 verify-only (article_ok/answer_ok/options_ok) + pasada 2 rewrite-only solo sobre las article_ok=true.** Más pasadas pero sin degeneración.

### Cohorte legislativa CERRADA
Murcia 86 + Galicia 181 + Madrid 97 + Aragón 257 + Carta 92(+50 rev) ≈ **772 verificadas**. Falta el grueso: **25 clínicas (~16.400)**. Estas son más simples (un artículo-contenedor temático por ley, re-ruteo dentro de la misma ley) → probablemente menor % de mal-vinculado. Ejecutar por tandas verify-only→rewrite-only con validación de unicidad.

## ⚠️ HALLAZGO CLÍNICO (03/06) — los contenedores temáticos están mal-bucketizados ~50%
Validación en "Trabajo en equipo sanitario" (73 preg): **36 article_ok=true, 37 article_ok=false, 2 errores de clave reales**. PERO el 37 article_ok=false **NO se arregla re-rutando dentro de la ley**: esas preguntas son de temas que NO existen como artículo en el contenedor (proxémica, bioética, estadística, epidemiología, deontología, funciones TCAE, técnicas de comunicación, relaciones familiares…). El bucketing por palabra-clave que creó los contenedores arrastró preguntas de OTROS temas.

**Implicación:** para el grueso clínico (~16.400) `article_ok=false` significa mayoritariamente "pregunta en el contenedor equivocado", no "sub-artículo equivocado". El ciclo verify→reroute-dentro-de-ley NO basta para clínicas. Opciones:
- **A) Re-bucketing global:** índice de TODOS los contenedores clínicos + re-rutar cada article_ok=false al contenedor correcto (caro, complejo, pero correcto).
- **B) Enriquecer cada contenedor** con más sub-artículos que cubran los temas reales que aparecen (muchos sub-artículos por contenedor).
- **C) Aceptar contenedores como "bolsa temática" gruesa** y en clínicas solo arreglar errores de clave reales (answer_ok=false), dejando article_ok como informativo.

DECISIÓN PENDIENTE DE MANUEL antes de procesar las 16.400. Progreso Fase 2: **845/17.546** (legislativas 772 + Trabajo en equipo 73).

## ✅ MÉTODO ROBUSTO CLÍNICO validado (03/06) — re-ruteo cross-contenedor + índice global
Decisión Manuel: hacerlo bien (cada pregunta cuelga del artículo que de verdad la responde), aunque sea lento. NO aceptar "bolsa gruesa".

**Índice global** (`/tmp/aulaplus_audit/global_index.json`): 24 contenedores clínicos × sus artículos = **89 artículos** = menú de destinos válidos cross-contenedor.

**Pipeline reutilizable por contenedor** (scripts en `/tmp/aulaplus_audit/`):
1. `clin_export.cjs <lawId> <prefix>` → chunks de 16 por artículo.
2. Agentes **verify-only** (article_ok/answer_ok/options_ok, sin explicación = no degenera) → `<prefix>out_i.json`.
3. `clin_apply_verify.cjs <prefix> <n>` → registra verificación, marca errores de clave como `problem`, exporta `<prefix>_wrong.json` (article_ok=false).
4. `clin_rr_prep.cjs <prefix> <nrr>` → empaqueta huérfanas + índice global.
5. Agentes **reroute** (eligen target_article_id del índice global; null si no hay casa) → `<prefix>rrout_i.json`.
6. `clin_apply_rr.cjs <prefix> <nrr>` → mueve `primary_article_id` al contenedor correcto, acumula sin-casa en `_sin_casa_global.json`.

**Validación (Trabajo en equipo, 73):** 36 verificadas en sitio + 29 re-rutadas a su contenedor real (Comunicación, Bioética, Paliativos…) + 8 sin casa + 2 errores de clave. CERO preguntas dejadas en contenedor equivocado.

**Temas sin-casa recurrentes** (necesitan contenedor nuevo, se acumulan global y se crean al final): estadística/bioestadística, epidemiología (cohortes), demografía, deontología, metodología de investigación, funciones sociales de la familia, gestión/rol administrativo TCAE.

**Pendiente explicaciones:** Fase 2 fija el VÍNCULO correcto + caza errores de clave. La reescritura didáctica de explicaciones es una pasada posterior (rewrite-only) sobre las ya bien vinculadas.

Progreso: **874/17.546** (legislativas 772 + Trabajo en equipo 73 resuelto + extras). Faltan 24 contenedores clínicos (~16.300). Los gigantes (Esterilización 1476, Movilización 1305…) van por varias tandas.

## 🔑 DOS MODOS DE FALLO en clínicas (refinado 03/06 con Residuos)
La verificación destapa DOS causas distintas de `article_ok=false`, que exigen acciones OPUESTAS:
1. **Estray (pregunta de OTRO tema)** — típico de contenedores pequeños/vagos (Trabajo en equipo: ~50% eran estadística, epidemiología, bioética…). Acción: **re-rutar** al contenedor correcto (índice global).
2. **Artículo-resumen (pregunta ON-TOPIC pero el artículo no detalla)** — típico de contenedores coherentes y grandes (Residuos: las 163 SON de residuos, pero los arts son resúmenes y el banco pregunta colores/galga/Ley 22/2011/códigos H/capacidad). Acción: **ENRIQUECER el artículo del propio contenedor con fuente oficial**, NO mover ni marcar error.

**Implicación crítica:** verificar contra un artículo-resumen produce **falsos `answer_ok=false`** (el agente no encuentra el dato en el texto y lo marca, aunque la respuesta sea correcta). → En contenedores coherentes, **enriquecer PRIMERO, verificar DESPUÉS**. Los grandes (Esterilización, Movilización, Higiene, Alimentación…) serán mayoritariamente modo 2 (enriquecer). Solo los pequeños/vagos (Trabajo en equipo, Informática, quizá Bioética) son modo 1 (re-rutar).

`verification_status` es columna LEGACY (no afecta is_active/visibilidad) → marcar 'problem' por error no daña al usuario; se corrige al re-verificar (mismo ai_provider sobrescribe el registro).

**Residuos (163):** modo 2. Enriquecer arts 1-3 (clasificación completa 4 grupos + variación CCAA/Madrid 7 clases, Ley 22/2011, códigos H peligrosidad, colores de bolsa/contenedor, galga 69/200, capacidad 3/4, DIN, transporte, citostáticos cabina flujo laminar vertical) desde fuente oficial → re-verificar.

## ✅ Residuos sanitarios CERRADO (03/06) — modo ENRIQUECER validado end-to-end
Flujo: verify (vs resumen) → detecta thin-article → enriquecer 3 arts con fuente oficial (agente WebSearch; correcciones: Ley 7/2022 deroga 22/2011; galga 200=50µm no 69; Madrid 7 clases Decreto 83/1999; CSB clase II flujo laminar vertical) → re-verify vs enriquecido.
**Resultado: article_ok=false 94→28, in-place verified 69→135.** Backup contenido original en `/tmp/aulaplus_audit/res_backup.json`.
**8 defectos de clave reales a revisión humana:** eb2b8c4c, 64ac43ae, 99a8112c (químicos=Grupo IV no II), 1e489ea6 (sin opción correcta: Ley 10/1998 no está), cbb24630, 7151df91 (apósito=Grupo II no I), 0587d3f3, df4edc81 (todas opciones son Grupo III).
28 article_ok=false residuales = detalles muy granulares (capacidad contenedor, etiquetado CLP, ENRESA/radiactivos, penitenciarías) → barrido de enriquecimiento fino opcional al final.

**Progreso Fase 2: 1.008/17.546.** Legislativas 772 (Murcia/Galicia/Madrid/Aragón/Carta) + Trabajo en equipo 73 (modo re-rutar) + Residuos 163 (modo enriquecer).

**Plantilla de enriquecimiento por contenedor (modo 2, para los grandes):** (1) export+verify rápido para confirmar modo 2; (2) agente WebSearch redacta artículos enriquecidos fieles con "Fuente:" y verificación de cifras; (3) aplicar con backup; (4) re-verify con criterio "temario TCAE estándar, no más estricto que el examen"; (5) registrar, marcar errores de clave reales, recoger estrays para reroute. Coste ~0.5-0.7M tokens por contenedor pequeño; los gigantes (Esterilización 1476…) por varias tandas.
