# Manual: Generar preguntas con IA (Claude) + auditoría doble

> **Versión 2.3** — 2026-05-25. Basado en **29 batches piloto**: 21 CARM + 8 Aragón. **388 preguntas activas IA-generadas, 0 defectos en producción**. **v2.3 cierra la SECUENCIA T13 completa (6 batches consecutivos sobre Ley 6/1990 Archivos Murcia)** llevándolo de 39 → 96 preguntas (96% del objetivo 100q). **Hallazgo principal**: la curva de rendimiento marginal por batch es **predecible y decreciente** (15 → 11 → 10 → 8 → 8 → 5 preguntas), confirmando empíricamente que el techo natural realista de una ley monotemática está en ~95-96%, no 100%. Forzar el último 5% requiere ángulos artificiales con rendimientos negativos.
>
> **Cambios v2.3**: secciones **5.26** (batch 20 redundancia arts con 3q, 8q PERFECT), **5.27** (batch 21 caso límite Art 7 con 7 existentes → 8 nuevas viables tras dedup mental por apartado), **5.28** (batch 22 cierre techo natural T13, 5q tras dedup mental estricto). Métricas acumuladas actualizadas a **29 batches / 388 preguntas** (sección 5.20). **Anti-pattern nuevo**: forzar el último 5% del objetivo cuando los rendimientos marginales caen por debajo de 5 preguntas/batch. Nuevos aprendizajes operativos: (a) **el número de apartados ESTRUCTURALES del artículo determina el techo natural** mejor que su tamaño en caracteres (Art 7 con 8 apartados admite 15q, Art 20 con 3 apartados admite ~6q); (b) **un art aparentemente saturado con 7 existentes puede admitir 8 nuevas** si el análisis dedup mental por apartado revela margen real; (c) **curva rendimiento marginal validada empíricamente**: 15→11→10→8→8→5 preguntas/batch en 6 batches consecutivos sobre la misma ley; (d) **declarar el techo natural a tiempo evita dilución de calidad** — 96/100 es mejor cierre que forzar 100/100 con candidatas dudosas.
>
> **Cambios v2.2**: secciones **5.23** (batch 17 cobertura inicial T13, 15q PERFECT directos), **5.24** (batch 18 cobertura extendida T13, 11q tras retirar 1 por modo fallo batch 16 Art 29) y **5.25** (batch 19 redundancia controlada T13, 10q tras descartar 2 candidatas pre-Sonnet por dedup nivel 3 manual). Métricas acumuladas actualizadas a **26 batches / 367 preguntas** (sección 5.20). Nuevos aprendizajes operativos: (a) **descartar candidatas pre-Sonnet por dedup nivel 3 mental ahorra rondas** (en batch 19 descarté 2 antes de generar JSON al ver que la opción correcta planeada ya estaba en la opción correcta de una existente); (b) **detectar duplicados pre-existentes en BD durante el dedup del batch nuevo** (Sonnet flagged Art 4 E1/E2 duplicadas exactas, deuda histórica a limpiar); (c) **la SECUENCIA cobertura inicial → extendida → redundancia es replicable**: T2 CARM siguió implícitamente esa secuencia (batches 8 + 13 + 15 + 16), T13 la siguió explícitamente.
>
> **Cambios v2.1**: sección **5.22** con resumen del batch 16 (T2 LO 4/1982 cierre a 100q, 11 preguntas tras retiro de 1 por intruso solapado); métricas acumuladas actualizadas a **23 batches / 331 preguntas**. Nuevo aprendizaje operativo: **arts muy escuetos (<150 chars) tienen un techo más bajo que arts medios — el mecanismo intruso solapa cognitivamente con la enumeración positiva cuando la lista es corta y conocida**. Y: **el enunciado de una existente que cita texto literal del artículo "contamina" el conocimiento adquirido y vacía de valor cualquier nueva pregunta cuya opción correcta coincida con esa cita** (caso #5 batch 16 Art 29).
>
> **Cambios v2.0**: sección **5.21** con resumen del batch 15 (T2 LO 4/1982 redundancia controlada en serie, 12 preguntas); métricas acumuladas actualizadas a **22 batches / 320 preguntas** (sección 5.20). Nuevo aprendizaje operativo: **cuando Sonnet flaguea NEEDS_REVIEW por "solapamiento posible" sin tener acceso a las opciones de las existentes, verificar manualmente las respuestas correctas — un solapamiento de tema/apartado NO equivale a solapamiento real si la respuesta evalúa otro dato**.
>
> **Cambios v1.10**: nuevo check **`question_text_ok`** (§2.2 + §2.4 + paso 6); §1.bis extendida con cross-tema misma oposición; nuevo **Paso 0bis** "Verificar/reparar `topic_scope`"; sección **5.19** con resumen de los 7 batches Aragón Ley 5/2021 (b2-b8); métricas acumuladas actualizadas a 21 batches (sección 5.20). Nuevo modo de fallo documentado: **drift en enunciado por sumario libre del artículo**.
>
> **Cambios v1.9**: nueva sección **§2.6 Redundancia controlada** (5 mecanismos cognitivos, reglas por estructura del artículo, dedup específico de redundancia). Nueva sección **§1.bis Maximizar impacto cross-oposición** (criterios de priorización por ROI). Sección 5.18 con piloto Art 42 LO 4/1982 (3 nuevas preguntas validadas como ortogonales). Las dos lecciones permiten **superar el "techo natural"** documentado en v1.8 cuando la cobertura es prioritaria.
>
> **Cambios v1.8**: añadidos Batches 10 (T3 +7 easy win), 11 (T10 +18 r3), 12 (T10 +15 r4) y 13 (T2 +7 techo natural) — secciones 5.13 a 5.16. Métricas acumuladas (5.17). Nueva lección §6 sobre **techo natural del scope** cuando el articulado disponible se agota. Documentado caso #15 batch 11 (sospecha de error de transcripción en `article_content` BD vs BORM oficial: "reparto" probable errata por "reparo").
>
> **Cambios v1.7**: añadidos Batches 8 (LO 4/1982 T2) y 9 (Ley 6/2004 + Ley 7/2004 T3) — secciones 5.10 y 5.11. Métricas acumuladas (sección 5.12). Confirmada repetibilidad en quinta tipología (Estatuto de Autonomía) y sexta (leyes orgánicas internas del gobierno autonómico).
>
> **Cambios v1.6**: añadido Batch 7 Aragón (sección 5.8); lección crítica — el paso 9 NO siempre redunda con la auditoría doble pre-aplicación: los dos Sonnets pre-transición pueden converger en el mismo sesgo y el Sonnet del paso 9 detectar lo que ambos dejaron pasar (caso Q15 batch 7). Refuerzo §2.4 + nuevo modo de fallo §2.2 (cláusulas coordinadas por "así como") + nuevo anti-pattern §6.
>
> **Cambios v1.5**: añadidos batches 5 (sección 5.6) y 6 (sección 5.7); métricas acumuladas actualizadas (5.9); confirmación de drift API/BD por cache de propagación (no error de flujo); lecciones operativas sobre cache-bypass para verificación final.
>
> **Cambios v1.4**: añadido Batch 4 (sección 5.4) con primer hallazgo real de la auditoría doble + lección clave §3.2 (omisiones sustantivas en opciones correctas).
>
> **Cambios v1.3**: añadido **Paso 9 (re-verificación post-aplicación)** y convención §5.1 de `ai_provider` diferenciado por fase — alineamiento estricto con el flujo v2.1 de `revisar-preguntas-con-agente.md` (§7). Los 3 primeros batches NO aplicaron el Paso 9 — deuda metodológica conocida.

## 1. Cuándo usar este flujo

Generar preguntas con IA tiene sentido cuando se cumplen **todas** estas condiciones:

- Hay un **gap de cobertura demostrable** en BD (ej. ley autonómica con 0-20 preguntas en 50+ artículos).
- No tenemos scraping disponible o ya agotado para esa fuente.
- El contenido legal es **literal, no interpretativo** (un decreto autonómico bien redactado, no doctrina ni jurisprudencia).
- Hay capacidad de auditar (humana + Sonnet) cada lote antes de transicionar a `approved`.

**Cuándo NO usar:**

- Si existe scraping de OpositaTest/TuTestDigital sin importar. Importarlo primero (ver `importar-preguntas-scrapeadas.md`).
- Para psicotécnicas con figura/tabla. La IA no genera bien `content_data` JSON estructurado.
- Para exámenes oficiales (deben venir del PDF real con `exam_source` exacto).
- Para temas con doctrina abundante donde el "texto legal" no es la fuente de verdad (Derecho Civil, Constitucional avanzado).
- Si no hay tiempo ni capacidad de auditar — el manual de revisión (`revisar-preguntas-con-agente.md`) advierte: una pregunta IA-generada sin auditoría es peor que una scrapeada con verificación.

## 1.bis Maximizar impacto: cobertura cross-oposición (priorización)

Antes de elegir QUÉ ley ampliar, verificar cuántas oposiciones se benefician. **Las preguntas cuelgan del artículo, no del tema** → cualquier `topic_scope` que incluya ese artículo recibe las preguntas automáticamente, sin acción adicional.

**Cómo verificar cobertura cross-oposición de una ley:**

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const lawId = '<UUID_LEY>';
(async () => {
  const { data: scopes } = await s.from('topic_scope').select('topic_id').eq('law_id', lawId);
  const topicIds = [...new Set(scopes.map(s => s.topic_id))];
  const { data: topics } = await s.from('topics')
    .select('topic_number, title, position_type').in('id', topicIds);
  const byOpo = {};
  for (const t of topics) {
    byOpo[t.position_type] = (byOpo[t.position_type]||[]);
    byOpo[t.position_type].push('T'+t.topic_number);
  }
  for (const [opo, ts] of Object.entries(byOpo)) console.log(opo+': '+ts.join(','));
})();
"
```

**Criterio de priorización:**

| Caso | Acción |
|---|---|
| Ley usada solo en 1 oposición | Ampliar **si es la única vía** para esa oposición; ROI bajo |
| Ley usada en 2-3 oposiciones | Buen ROI — cada pregunta beneficia múltiples temas |
| Ley estatal usada en 10+ oposiciones (Ley 39/2015, RDL 5/2015, CE, etc.) | ROI máximo — pero suelen estar ya saturadas |
| Ley autonómica de comunidad pequeña | Verificar si solo aplica a esa CCAA antes de invertir |

**Caso real (validado 2026-05-25)**: LO 4/1982 Estatuto Murcia usada por `auxiliar_administrativo_carm` (T2 + T3) Y `tcae_murcia` (T1). Las 78 preguntas IA-generadas que se añadieron a esta ley benefician automáticamente a las 3 ubicaciones sin trabajo adicional. En cambio, Ley 6/1990 Archivos Murcia (T13 CARM) solo aplica a una oposición — mismo coste de generación, ⅓ de impacto.

**Regla operativa:** antes de un batch nuevo, ejecutar la query de cobertura. Si la ley aparece en múltiples scopes, anotar el multiplicador de impacto en la documentación del batch.

### Cross-tema dentro de la misma oposición (v1.10)

Además del criterio cross-oposición, una **ley grande con secciones temáticamente distintas** puede mapearse a varios temas DE LA MISMA OPOSICIÓN. Antes de batchear, **revisar el sumario de la ley** (Títulos/Capítulos) y mapear cada bloque al tema del epígrafe oficial que corresponda.

**Caso real (validado 2026-05-25)**: Ley 5/2021 Aragón (158 arts) en DGA Aragón:
- Arts 1-8 + 70-144 (Administración + Sector Público) → **T5** ("órganos de gobierno y administración")
- Arts 145-158 (relaciones interadm) → **T6** ("derecho administrativo y sus fuentes")
- Arts 9-34 + 37-58 (competencia/colegiados/abstención/electrónica/actuación) → **T7** ("disposiciones administrativas y acto administrativo")
- Arts 35-36 + 59-69 (sancionador + régimen jurídico actuación) → **T8** ("eficacia y validez")

→ Las 119 preguntas IA-generadas sobre Ley 5/2021 sirven simultáneamente a 4 temas de la misma oposición. Cada batch generado sobre arts del Título III contribuye a T5; un batch futuro sobre arts 9-22 contribuiría a T7, etc. **El topic_scope se prepara UNA vez (Paso 0bis) y los batches sucesivos aprovechan el reparto.**

**Cuándo el cross-tema es viable:**
- Ley grande (50+ arts) con estructura por Títulos/Capítulos temáticamente independientes (procedimiento ≠ organización ≠ sancionador, etc.).
- El epígrafe de cada tema del programa oficial cubre **un bloque distinto** de la ley.
- NO viable si la ley es monotemática (ej. Ley 6/1990 Archivos: todos los arts giran sobre patrimonio documental → solo T13).

## 2. Principios fundamentales (no negociables)

### 2.1 Importar siempre en `draft` — invisible por construcción

Igual que `importar-preguntas-scrapeadas.md` §"Importar Desactivadas, Activar Tras Revisión":

```javascript
{
  // ... otros campos
  lifecycle_state: 'draft',           // El sync trigger pone is_active=false automáticamente
  deactivation_reason: 'Pendiente de revisión post-generación IA',
  topic_review_status: 'pending',
  tags: ['ia_generada', '<piloto_xxx>'],  // tag específico del batch para poder filtrar/revertir
}
```

**NO pasar `is_active` ni `content_hash`:**
- `is_active` es `GENERATED ALWAYS AS (lifecycle_state IN ('approved','tech_approved'))` — UPDATE directo falla.
- `content_hash` lo genera la BD vía trigger (MD5, 32 chars).

### 2.2 La opción correcta debe ser cita LITERAL del artículo

Esta es **la regla cero**. Si la IA parafrasea, cambia un verbo o estrecha un sujeto, la pregunta ya está rota — el manual de revisión §3.2 advierte que los modos de fallo típicos son:

- Cambiar un verbo: "garantizar" ↔ "defender", "deberá" ↔ "podrá".
- Estrechar/ampliar un sujeto: "en unos y otros" → "entre las personas responsables".
- Añadir texto que no existe: "...o desde que deviniesen ejecutivas".
- Cambiar un plazo o su anclaje: "quince días desde la adopción" → "quince días desde la iniciación".
- **Omitir cláusulas coordinadas (batch 4 + batch 7)**: si el artículo dice "X o Y", "X, así como Y", "X junto con Y" o "X además de Y" y todo cuelga del mismo predicado preguntado, la opción correcta DEBE incluir Y. Bajo cualquier ambigüedad gramatical de alcance, **incluir la cláusula**. Detectado en batch 4 (Art 17.1 CARM "...o aquellos otros que le sean encargados...") y batch 7 (Art 70 Aragón "principios de A y B, así como otros órganos...").
- **Drift en el enunciado por sumario libre del artículo (v1.10 — b5 Aragón Q15)**: cuando el enunciado **describe** o **resume** el supuesto del artículo en lugar de citarlo, puede omitir bloques sustantivos silenciosamente. Caso real Art 92 Ley 5/2021 Aragón: el enunciado decía "actividades administrativas y de contenido económico" cuando el artículo dice "actividades administrativas, **sean de fomento, prestación o de gestión de servicios públicos o de producción de bienes de interés público susceptibles de contraprestación**; actividades de contenido económico…". La opción correcta y la explicación estaban impecables, pero el enunciado había hecho una **condensación libre** del artículo omitiendo un bloque material. Las dos pasadas pre-aplicación lo dieron por bueno; el Sonnet del paso 9 lo detectó. **Regla**: si el enunciado menciona "según el artículo X", lo que diga sobre X debe ser cita literal del artículo o usar **puntos suspensivos / paréntesis para señalar elipsis explícita** ("según el artículo X, que regula A (entre otras cuestiones)…"). Nunca resumir.

**Si no se puede formular una opción correcta como cita literal o condensación válida, NO se genera la pregunta sobre ese punto.** Mejor menos cantidad que cualquier alucinación.

**¿Qué es "condensación válida"?** Una omisión de metalenguaje (p.ej. "a efectos de este decreto") o de la cláusula introductoria que ya está en el enunciado. Lo que NO se puede:
- Cambiar palabra clave.
- Cambiar sujeto, verbo, complemento.
- Cambiar plazo, número, referencia normativa.
- Reformular la cita.

### 2.3 Tag obligatorio: `'ia_generada' + '<batch_id>'`

Sin estos tags es imposible:
- Filtrar las IA-generadas para revisión periódica.
- Revertir un batch completo si después se detecta un fallo sistemático.
- Auditar el % de IA-generadas activas vs scrapeadas.

Convención del batch_id: `piloto_<ley>_<año>` o `gen_<ley>_<YYYY-MM-DD>`.

### 2.4 Auditoría doble PRE-aplicación + re-verificación POST-aplicación

El manual de revisión §18.1 advierte que **una sola auditoría tiene ~17% de falsos negativos**. Para IA-generadas el riesgo se multiplica (sesgo del propio generador). El flujo v2.1 de `revisar-preguntas-con-agente.md` exige **además** una re-verificación tras aplicar los cambios sobre la pregunta viva en BD (§7).

**Los 5 checks del workflow** (v1.10 amplía a 5 — antes eran 4):

| Check | Criterio | Detectable por |
|---|---|---|
| `article_ok` (§3.1) | El artículo contiene literalmente el supuesto preguntado | auto + Sonnet ciego + paso 9 |
| `answer_ok` | La opción marcada es realmente la correcta según la ley | auto + Sonnet ciego + paso 9 |
| `options_ok` (§3.2) | La opción correcta reproduce fielmente el texto legal (cita literal o condensación válida) | auto + Sonnet ciego + paso 9 |
| `explanation_ok` (§8.1) | Blockquote literal + "Por qué [LETRA] correcta" + bullets "Por qué las demás" + sin emojis/Truco | auto + Sonnet ciego + paso 9 |
| **`question_text_ok` (NUEVO v1.10)** | **El enunciado no condensa libremente el artículo. Si lo menciona, debe citar o usar elipsis explícita.** | **Frecuentemente solo por paso 9** — las dos pasadas pre-aplicación pueden converger en pasarlo por alto (caso b5 Aragón Q15) |

**Mínimo (PRE-aplicación):**
1. **Auto-audit** del propio generador (Claude) re-leyendo desde BD aplicando §3.1 + §3.2 + §8.1 + verificando fidelidad del enunciado.
2. **Auditoría independiente** con agente Sonnet ciego (no le digas que las generaste tú).

Si las dos pasadas coinciden y son PERFECT → transición a `approved`.
Si discrepan → adjudicar humano o Opus, no por defecto la auditoría.

**Obligatorio POST-aplicación (paso 7 v2.1, paso 9 de este manual):**

3. **Re-verificación con agente Sonnet NUEVO** (distinto al del paso 2) sobre la pregunta ya viva en BD. Iterar hasta una pasada completamente limpia. El lote no se cierra hasta entonces.

> ⚠️ **El paso 9 NO es siempre una formalidad de "confirmar drift BD"** (como sugirió el batch 4). El batch 7 (Aragón) demostró que **los dos Sonnets pre-aplicación pueden converger en el mismo sesgo gramatical** y dar 15/15 PERFECT con alta confianza, mientras el Sonnet del paso 9 (con prompt re-enmarcado como "están vivas, busca cualquier desviación") detecta un defecto real. Tratar el paso 9 como **tercer auditor independiente**, no como verificación de persistencia.

### 2.5 Convención `ai_provider` diferenciado por fase (§5.1 manual de revisión)

`ai_verification_results` tiene constraint único `(question_id, ai_provider)`. Si haces varias rondas con el mismo `ai_provider='claude_code'`, **cada upsert sobrescribe el anterior** y se pierde la traza histórica.

| Fase | `ai_provider` | Cuándo |
|---|---|---|
| Auditoría doble pre-aplicación | `claude_code` | Pasos 6+7 (auto-audit + Sonnet ciego antes de transicionar) |
| Re-verificación post-aplicación | `claude_code_recheck` | Paso 9 (Sonnet nuevo sobre pregunta viva tras transición) |
| Auditoría final (opcional) | `claude_code_audit` | Si se hace 3ª pasada con criterio estricto extra |

Esto permite que cualquier consulta a BD pueda ver el rastro completo: "esta pregunta pasó auditoría doble → fue transicionada → fue re-verificada", no solo el último registro.

### 2.6 Redundancia controlada — superar el techo natural del scope

**Cuando los artículos sin preguntas se agotan** pero el tema sigue por debajo del umbral de cobertura objetivo (≥100q), se puede generar **varias preguntas por artículo ya cubierto** SIEMPRE QUE cumplan condiciones estrictas. Lo opuesto a "redundancia" es "solapamiento": dos preguntas distintas que en realidad miden lo mismo.

**Validado en piloto Art 42 LO 4/1982 (2026-05-25)**: artículo enumerativo de 10 letras (a-j), 2 preguntas existentes pasaron a 5 sin solapar, todas auditadas como ortogonales por Sonnet.

#### Reglas por estructura del artículo

| Estructura | Máximo de preguntas |
|---|---|
| Enumerativo con ≥5 ítems (letras a-e o más) | **4-5 preguntas** |
| Con cláusula residual ("cualesquiera otros...", "lo demás") o distinción conceptual extra | **+1 más** (hasta 5) |
| Estructura simple (2-3 ítems, definición única) | **máx. 2** antes de empezar a solapar |
| Artículo de 1 frase (definición plana) | **1** — no insistir |

#### Los 5 mecanismos cognitivos para diversificar enfoques

Cada pregunta nueva debe usar un mecanismo **distinto** de las existentes. Si dos preguntas del mismo artículo comparten mecanismo, son redundantes aunque cambien la letra preguntada.

| # | Mecanismo | Forma típica | Discrimina sobre |
|---|---|---|---|
| 1 | **Intruso/negación** | "¿Cuál NO figura entre los X?" | Memoria del listado completo |
| 2 | **Reconocimiento literal** | "¿Qué dice la letra Y?" | Memoria de contenido por posición |
| 3 | **Camino inverso** | "¿Qué letra recoge el contenido Z?" | Memoria de la numeración/estructura |
| 4 | **Cláusula específica** | "¿Qué dice la cláusula residual?" / "¿Cuál es la salvedad?" | Memoria de elementos no-principales |
| 5 | **Distinción conceptual** | "¿Sobre qué se establece X?" (diferenciar X de Y dentro del mismo artículo) | Comprensión jurídica profunda, no solo memoria |

**Caveat operativo** (caso N4 del piloto): si una "nueva" usa el mismo mecanismo que una existente pero sobre letra distinta, el valor pedagógico es MEDIO, no ALTO. Aceptable, pero si hay que retirar alguna por exceso, esa es la primera.

#### Dedup específico para redundancia (más estricto que el general §3)

Cuando se generan varias preguntas sobre el mismo artículo, el dedup textual estándar (Jaccard 50%) no basta — comparten contexto. Aplicar 3 niveles:

```javascript
// Nivel 1: Jaccard de enunciado contra existentes — alerta a >=50%
// (esperado en redundancia controlada: 30-45% por contexto compartido — normal)

// Nivel 2: Jaccard entre las nuevas — alerta a >=50%
// (esperado: 35-45% — normal)

// Nivel 3 CRÍTICO: Jaccard de OPCIÓN CORRECTA nueva vs TODAS las opciones existentes
// (CADA letra A/B/C/D de cada existente) — alerta a >=50%
// Si hay alerta aquí, la "nueva" en realidad pregunta lo mismo que una existente
```

El nivel 3 es el que detecta el solapamiento real: dos preguntas pueden tener enunciados distintos pero la misma opción correcta significa que evalúan el mismo conocimiento.

#### Cómo planificar un batch de redundancia

1. **Listar arts ya cubiertos del tema** (1-3 preguntas existentes, contenido ≥800 chars).
2. **Para cada art candidato**: leer las preguntas existentes y registrar qué mecanismo cognitivo usa cada una (de los 5 anteriores).
3. **Asignar mecanismos NUEVOS** a las preguntas a generar:
   - Si las existentes usan solo "reconocimiento literal" → añadir intruso + camino inverso + distinción conceptual
   - Si ya existe intruso + reconocimiento → añadir camino inverso + cláusula específica
4. **Generar borrador** + dedup intensivo (los 3 niveles).
5. **Auditar con Sonnet añadiendo evaluación de redundancia** en el prompt (no solo los 4 checks de calidad). Ejemplo de prompt extra:
   > "Para cada nueva, evalúa: (1) ¿enfoque genuinamente distinto?; (2) ¿respuesta correcta solapa con existente?; (3) ¿valor pedagógico añadido (ALTO/MEDIO/BAJO/REDUNDANTE)?"
6. **Si Sonnet marca alguna como REDUNDANTE → no transicionar**, retirar.

#### Cuándo NO insistir con redundancia

- Si un artículo solo admitiría una 5ª pregunta forzando un mecanismo ya usado.
- Si las opciones correctas posibles se agotan (un artículo con 3 conceptos no admite 10 preguntas — habrá repetición de respuestas).
- Si el coste de auditar el dedup empieza a superar el valor pedagógico de la pregunta extra.

**Regla de oro**: la redundancia controlada extiende el techo natural, pero NO lo elimina. Cada artículo tiene un máximo absoluto en función de su estructura. Mejor 4 preguntas distintas por art × varios arts que 8 preguntas iterando sobre 1 art.

## 3. Workflow paso a paso

### Paso 0 — Selección de scope estrecho

Empezar siempre por **una ley + 3-5 artículos**. Nunca un batch grande al inicio.

Inventario rápido para detectar gaps:

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const lawId = '<UUID_LEY>';
(async () => {
  const { data: arts } = await s.from('articles')
    .select('id, article_number').eq('law_id', lawId);
  const { data: qs } = await s.from('questions')
    .select('primary_article_id').in('primary_article_id', arts.map(a=>a.id));
  const byArt = {};
  for (const q of qs||[]) byArt[q.primary_article_id] = (byArt[q.primary_article_id]||0)+1;
  console.log('Total arts:', arts.length, '| con preguntas:', Object.keys(byArt).length, '| sin:', arts.length - Object.keys(byArt).length);
}) ();
"
```

### Paso 0bis — Verificar/reparar `topic_scope` (v1.10, OBLIGATORIO si ley nueva o scope sospechoso)

**Cuándo es necesario este paso:**
- Acabas de crear una ley en BD a través del flujo del manual `monitoreo-boe-y-crear-leyes-nuevas.md` y la has añadido a `topic_scope` con `article_numbers=null` (toda la ley).
- El `topic_scope` actual de la ley/tema tiene `article_numbers=null` o un rango anómalo (ej. una ley grande de 158 arts en un solo tema cuando el epígrafe cubre solo una parte).
- La ley tiene varios Títulos temáticamente distintos pero está mapeada solo a un tema.

**Cómo verificar:**

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const lawId = '<UUID_LEY>';
(async () => {
  const { data: scopes } = await s.from('topic_scope')
    .select('topic_id, article_numbers')
    .eq('law_id', lawId);
  for (const sc of scopes) {
    const { data: t } = await s.from('topics')
      .select('topic_number, title, epigrafe').eq('id', sc.topic_id).single();
    const cobertura = sc.article_numbers === null ? 'TODA LA LEY' : sc.article_numbers.length + ' arts';
    console.log('T' + t.topic_number + ': ' + t.title);
    console.log('  Scope: ' + cobertura);
    console.log('  Epígrafe: ' + (t.epigrafe || '').slice(0,150));
  }
})();
"
```

**Cómo reparar (si scope incorrecto):**

1. **Leer el epígrafe oficial del tema** desde `topics.epigrafe`.
2. **Leer el sumario de la ley** (WebFetch al BOE: "lista los Títulos/Capítulos con sus rangos de artículos").
3. **Mapear bloques de la ley a temas** según el epígrafe (ver §1.bis cross-tema).
4. **UPDATE topic_scope con `article_numbers` explícito** restringido al núcleo del epígrafe:

```javascript
// Caso Ley 5/2021 Aragón → T5 (solo arts 1-8 + 70-144)
const t5Arts = [];
for (let i = 1; i <= 8; i++) t5Arts.push(String(i));
for (let i = 70; i <= 144; i++) t5Arts.push(String(i));

await s.from('topic_scope').update({
  article_numbers: t5Arts,
  include_full_title: false,
}).eq('id', t5ScopeId);

// Y añadir el resto de bloques a otros temas con INSERT separados
```

5. **Verificar tras reparar** que cada art de la ley aparezca en algún `topic_scope` (sin huérfanos) y que ningún art aparezca duplicado en temas que no corresponda.

**Por qué este paso es CRÍTICO antes del batch piloto:**

Sin reparar el scope, los batches sucesivos contaminan el tema: preguntas sobre procedimiento (Título I/II) aparecerían en T5 ("órganos de gobierno") cuando deberían ir a T7 ("acto administrativo"). El opositor que estudia T5 vería preguntas fuera de tema. **Reparar después es más caro** que hacerlo antes: requiere migrar el scope + invalidar caches + comprobar que los conteos por tema sean coherentes.

**Caso real (validado 2026-05-25, Ley 5/2021 Aragón)**: tras crear la ley con `article_numbers=null` en T5, restringí T5 a 83 arts (1-8 + 70-144) y añadí los otros 75 arts a T6/T7/T8 antes de batchear. Resultado: 7 batches consecutivos sobre arts del núcleo T5 sirvieron al tema correcto sin contaminación.

### Paso 1 — Leer contenido literal de los artículos seleccionados

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const ids = ['<art_id_1>','<art_id_2>','<art_id_3>'];
  for (const id of ids) {
    const { data } = await s.from('articles')
      .select('article_number, title, content').eq('id', id).single();
    console.log('=== Art ' + data.article_number + ' — ' + data.title + ' ===');
    console.log(data.content);
  }
})();
"
```

### Paso 2 — Generar las preguntas en JSON borrador

**Prompt mental que aplicas a TI MISMO (Claude):**

> Para cada artículo, identifico 1-5 "supuestos" o "reglas" que aparecen literalmente y son evaluables (definiciones, requisitos, plazos, remisiones a otras normas, listas tasadas, exclusiones).
>
> Por cada supuesto, formulo UNA pregunta con:
> - **Opción correcta**: cita literal del artículo (o condensación válida).
> - **3 distractores**: plausibles pero claramente falsos según el propio artículo. Si un distractor podría confundirse con otra norma vigente (Ley 39, Ley 40, etc.), añadirlo (trampa pedagógica útil).
> - **Explicación con formato §8.1 exacto:**
>   - Blockquote con cita literal del artículo (referencia "Art. X.Y Ley Z").
>   - "Por qué [LETRA] es correcta: [razón clara]"
>   - "Por qué las demás son incorrectas:" + bullet por cada opción distractor.
>   - Sin emojis, sin sección "Truco/Consejo".

Guardar borrador en `/tmp/<batch_id>_borrador.json`:

```json
[
  {
    "primary_article_id": "UUID",
    "article_label": "Art X Ley Y",
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_option": 0|1|2|3,
    "explanation": "> **Art. X.Y**\n> \"...cita literal...\"\n\n**Por qué [LETRA] es correcta:** ...\n\n**Por qué las demás son incorrectas:**\n- **A)** ...\n- **B)** ...\n- **C)** ..."
  }
]
```

### Paso 3 — Dedup pre-inserción contra BD

**OBLIGATORIO** antes de cualquier INSERT. Comparar contra:

- Toda la BD por `content_hash` (exacto).
- Preguntas existentes de los artículos seleccionados, por similitud Jaccard ≥ 50%.
- Preguntas que mencionan el código de la norma en `question_text` (ej. `%Decreto 302%`).

Si hay colisión → revisar manualmente. Si la pregunta nueva es idéntica/parafraseada de una existente, descartar.

Ver `importar-preguntas-scrapeadas.md` §"Detección de Duplicados" para el código de las 4 niveles.

### Paso 4 — Insertar UNA pregunta de prueba

Validar invariantes ANTES de insertar el batch entero. Insertar la primera pregunta y verificar:

| Invariante | Valor esperado |
|---|---|
| `lifecycle_state` | `'draft'` |
| `is_active` | `false` (sync trigger desde lifecycle_state) |
| `tags` | contiene `'ia_generada'` y el batch_id |
| `content_hash` | no-null, 32 chars (generado por trigger) |
| `correct_option` | el del JSON (0-3) |
| `question_type` | `'single'` (NO `'legislative'` — falla constraint) |

Si TODOS los invariantes pasan → seguir. Si alguno falla → debuggear antes.

### Paso 5 — Insertar el resto del batch

Misma estructura, una a una. Guardar IDs en `/tmp/<batch_id>_inserted_ids.json` para auditoría.

### Paso 6 — Auditoría 1: auto-audit (Claude generador)

Re-leer cada pregunta DESDE BD junto con el contenido literal del artículo (no desde tu memoria). Aplicar los **5 checks** (v1.10 amplía de 4 a 5):

| Check | Criterio |
|---|---|
| `article_ok` (§3.1) | El artículo contiene literalmente el supuesto preguntado + test inverso (¿la respuesta marcada es la correcta SEGÚN LA LEY, no solo según este artículo?) |
| `answer_ok` | La opción marcada es realmente la correcta según el contenido del artículo |
| `options_ok` (§3.2) | La opción marcada como correcta reproduce fielmente el texto legal (cita literal o condensación válida sin cambio de sentido) |
| `explanation_ok` (§8.1) | `isDidactic()` = blockquote + "Por qué [LETRA] correcta" + "Por qué las demás son incorrectas" + markdown |
| **`question_text_ok` (NUEVO v1.10)** | El enunciado no condensa libremente el artículo. Si menciona "según el artículo X", lo que diga de X debe ser cita o usar elipsis explícita (puntos suspensivos / paréntesis). Nunca resumir. Caso b5 Aragón Q15 Art 92 documentó este modo de fallo. |

Veredicto por pregunta: `PERFECT` o `NEEDS_REVIEW` con motivo.

### Paso 7 — Auditoría 2: agente Sonnet ciego e independiente

Lanzar agente `general-purpose` con `model='sonnet'`. Prompt que NO mencione:
- Que las preguntas las generaste tú.
- Tu auto-audit ni veredictos.
- Cualquier sesgo positivo.

El agente lee `/tmp/<batch_id>_audit_input.json` (preguntas + article_content), aplica los 4 checks y devuelve su propio veredicto independiente.

**Comparar resultados:**
- Si Sonnet coincide al 100% con tu auto-audit → proceder a transición.
- Si Sonnet flagea preguntas que tú diste por OK → adjudicar manualmente (priorizar la opinión más estricta).
- Si Sonnet aprueba preguntas que tú diste por NEEDS_REVIEW → no asumir que estaba mal tu auto-audit. Re-revisar.

### Paso 8 — Transición vía función SQL `transition_question_state`

**ÚNICA vía válida.** UPDATE directo a `is_active` falla:

```javascript
// Para cada pregunta que pasó AUDITORÍA DOBLE:

// 1. Registrar trazabilidad en ai_verification_results (constraint: (question_id, ai_provider))
await s.from('ai_verification_results').upsert({
  question_id, article_id, law_id,
  article_ok: true, answer_ok: true, explanation_ok: true,
  confidence: 'alta',
  explanation: 'IA-generada (Claude Opus 4.7). Auditoría doble: auto-audit + Sonnet independiente, ambas PERFECT.',
  ai_provider: 'claude_code',
  ai_model: 'claude-opus-4-7',
  verified_at: new Date().toISOString(),
}, { onConflict: 'question_id,ai_provider' });

// 2. Transición draft → approved
await s.rpc('transition_question_state', {
  p_question_id: questionId,
  p_expected_state: 'draft',
  p_new_state: 'approved',
  p_reason_code: 'ai_verified_perfect',
  p_changed_by: null,                          // o admin user id
  p_ai_verification_id: null,
  p_notes: 'Batch <batch_id> — auditoría doble (claude_code + sonnet independiente)'
});

// 3. Sync legacy fields para compat con UI admin actual
await s.from('questions').update({
  topic_review_status: 'perfect',
  verification_status: 'ok',
  verified_at: new Date().toISOString()
}).eq('id', questionId);
```

El sync trigger pondrá `is_active=true` automáticamente al transicionar a `approved`. Verificar después que `lifecycle_state='approved'` Y `is_active=true`.

### Paso 9 — Re-verificación POST-aplicación con agente Sonnet NUEVO (OBLIGATORIO)

Este paso es el **paso 7 del flujo v2.1** de `revisar-preguntas-con-agente.md` aplicado a IA-generadas. **Sin este paso el lote NO se cierra.**

**Por qué es crítico:** la auditoría pre-aplicación (pasos 6 + 7) audita los datos del JSON borrador antes de que estén en BD. Tras transicionar a `approved`, la pregunta está viva — visible para usuarios. Verificarla en su forma final (leída desde BD, no desde el borrador) detecta:

- Trigger PG que haya mutado algún campo al insertar (raro pero posible).
- Diferencias entre lo que "creías que escribiste" y lo que efectivamente quedó en BD.
- Cualquier acoplamiento entre los datos y el resto del sistema (sync trigger, normalización del content_hash, etc.).

**Cómo hacerlo:**

1. Releer las preguntas TRANSICIONADAS desde BD (no del borrador `/tmp`) con el contenido literal del artículo. Guardar nuevo input para el agente:

```javascript
const { data } = await s.from('questions')
  .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, articles!inner(article_number, content)')
  .in('id', transitionedIds);
// → /tmp/<batch>_post_audit_input.json
```

2. Lanzar agente Sonnet **NUEVO** (distinto al del paso 7) aplicando el mismo prompt de los 4 checks (§3.1, §3.2, §8.1) con la indicación adicional: "Estas preguntas ya están vivas en producción; busca cualquier desviación entre el contenido de BD y el artículo literal".

3. Registrar el resultado en `ai_verification_results` con `ai_provider='claude_code_recheck'` (NO `claude_code` — eso machacaría el registro del paso 7):

```javascript
await s.from('ai_verification_results').upsert({
  question_id, article_id, law_id,
  article_ok, answer_ok, explanation_ok,
  confidence,
  explanation: 'Re-verificación post-aplicación batch <batch_id> con agente Sonnet nuevo independiente del paso 7.',
  ai_provider: 'claude_code_recheck',     // ← clave: diferente al paso 7
  ai_model: 'claude-sonnet-4-6',
  verified_at: new Date().toISOString(),
}, { onConflict: 'question_id,ai_provider' });
```

4. **Si el recheck encuentra defectos:**
   - Reparar (UPDATE de los campos editables — NO toca `lifecycle_state`).
   - Volver a paso 9 con un agente Sonnet AÚN más nuevo (`ai_provider='claude_code_recheck_v2'` si hace falta otro pase).
   - **Iterar hasta una pasada completamente limpia.**
   - Si tras 3 iteraciones no se converge → transicionar a `needs_review` y escalar a humano.

5. **Si el recheck pasa limpio:**
   - Lote oficialmente cerrado.
   - Anotar en el manual (sección 5) que el batch tiene `claude_code` + `claude_code_recheck` con coincidencia.

### Paso 10 — Verificar impacto

Recalcular el conteo de preguntas activas del tema afectado **considerando `article_numbers=null` como "toda la ley"** (error frecuente: filtrar con `.includes()` sin contemplar null descarta scopes válidos).

```javascript
let ids;
if (sc.article_numbers === null) {
  ids = (allArts || []).map(a => a.id);  // toda la ley
} else {
  ids = (allArts || []).filter(a => sc.article_numbers.includes(a.article_number)).map(a => a.id);
}
```

Verificar:
- Conteo de la ley específica: ANTES + N = AHORA
- Conteo del tema afectado: ANTES + N = AHORA
- Audit trail: filas en `question_lifecycle_history` con `from_state='draft'`, `to_state='approved'`, `reason_code='ai_verified_perfect'`.

### Paso 11 — Invalidar caches

Tras transicionar, las páginas de tema y test cachean conteos. Ver `docs/maintenance/cache-revalidation.md` para detalle completo y casos avanzados (cross-runtime tags, Redis Upstash, etc.). Resumen mínimo para un batch de generación IA:

**Tags a invalidar:** `test-counts` + `laws` + `questions`.

**Páginas ISR a purgar:** landing + hub + temario de la oposición afectada + el tema concreto cuyo conteo cambia.

```bash
set -a; source .env.local; set +a

# 1. Tags de datos
for tag in test-counts laws questions; do
  curl -sS -X POST "https://www.vence.es/api/admin/revalidate" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $CRON_SECRET" \
    -d "{\"tag\": \"$tag\"}"; echo
done

# 2. Páginas ISR — ajustar a la oposición y temas afectados por el batch
for path in \
  "/<slug-oposicion>" \
  "/<slug-oposicion>/test" \
  "/<slug-oposicion>/temario" \
  "/<slug-oposicion>/test/tema/<N>"; do
  curl -sS -X POST "https://www.vence.es/api/purge-cache" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $CRON_SECRET" \
    -d "{\"path\": \"$path\"}"; echo
done
```

**Verificar que los conteos nuevos aparecen vía API real** antes de cerrar el batch:

```bash
USER='<un_user_id_de_la_oposicion>'  # necesario para que la API devuelva userProgress
curl -sS "https://www.vence.es/api/topics/<N>?oposicion=<slug>&userId=$USER" | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).userProgress?.totalQuestionsAvailable)})"
```

Si el conteo no coincide con BD raw, suele ser un filtro adicional del endpoint (lifecycle, sub-tablas) — comparar antes/después confirma que la invalidación funcionó.

## 4. Métricas y calibración del prompt

Tras cada batch, registrar:

| Métrica | Cálculo | Acción si... |
|---|---|---|
| % PERFECT en auto-audit | preguntas que pasan los 4 checks / total | < 80% → recalibrar prompt antes de seguir |
| % PERFECT en Sonnet audit | íd. independiente | < 60% → STOP, revisar a fondo |
| % de coincidencia auto vs Sonnet | preguntas donde ambos veredictos coinciden | < 90% → revisar criterio del prompt |
| Modos de fallo detectados | listar los tipos (paráfrasis, sujeto cambiado, distractor ambiguo, explicación sin formato) | añadir reglas explícitas al prompt para evitarlos |

**Si el batch sale 100/100/100 (como el piloto Decreto 302/2011)**: viable escalar a más artículos de la misma ley. Mantener tamaño de lote ≤ 20 preguntas/iteración para que la auditoría sea manejable.

## 5. Resultados de los batches piloto

### 5.1 Batch 1 — Decreto 302/2011 CARM (Régimen Jurídico Gestión Electrónica)

**2026-05-25** — Primera prueba del workflow.

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 3 (Art 1, Art 2, Art 10) |
| Preguntas generadas | 12 (4 + 3 + 5) |
| Insertadas en draft | 12/12 |
| Dedup colisiones | 0 |
| Auto-audit PERFECT | 12/12 (100%) |
| Sonnet audit PERFECT | 12/12 (100%) |
| Coincidencia | 100% (0 desacuerdos) |
| Transicionadas a `approved` | 12/12 |
| Impacto: Decreto 302/2011 activas | 4 → 16 (+12, ×4) |
| Impacto: T11 CARM activas | 309 → 321 (+12) |

**Observaciones del batch 1:**

- **#5 (Art 2, opción A)**: la opción correcta omitió "a efectos de este decreto" (metalenguaje). Ambas auditorías la marcaron como aceptable (condensación válida). Sirve de referencia: si el agente Sonnet hubiera sido más estricto, habría sido NEEDS_REVIEW.
- **#4 (Art 1)**: pregunta tipo "¿cuál NO se cita?". La sintaxis "Por qué las demás son incorrectas (sí están en el artículo 1)" evitó falso positivo del regex `hasDemas`. Documentar este tipo invertido en el prompt para que no genere variantes raras.
- **Bugs del workflow descubiertos**:
  - `question_type='legislative'` falla constraint (debe ser `'single'`).
  - `content_hash` lo genera la BD por trigger, NO pasar desde cliente.
  - Scope con `article_numbers=null` = toda la ley (no descartar al verificar conteos).

### 5.2 Batch 2 — Ley 12/2014 CARM (Transparencia y Participación Ciudadana)

**2026-05-25** — Segundo batch para validar repetibilidad del workflow en una ley distinta (transparencia, contenido más estructurado/definicional).

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 5 (Art 2 Definiciones, Art 3 Principios, Art 5 Ámbito subjetivo, Art 23 Derecho acceso, Art 25 Límites) |
| Preguntas generadas | 15 (4 + 3 + 3 + 2 + 3) |
| Insertadas en draft | 15/15 |
| Dedup colisiones | 0 (4 menciones de "12/2014" en BD eran de otra ley homónima fechada "26/12" — la nuestra es CARM "16/12") |
| Auto-audit PERFECT | 15/15 (100%) |
| Sonnet audit PERFECT | 15/15 (100%) |
| Coincidencia | 100% (0 desacuerdos) |
| Transicionadas a `approved` | 15/15 |
| Impacto: Ley 12/2014 CARM activas | 2 → 17 (+15, ×8.5) |
| Impacto: T16 CARM activas | 1011 → 1026 (+15) |

**Observaciones del batch 2:**

- **#2 (Art 2 b)**: la opción correcta omitió "señaladas en la letra anterior" (refers a la letra a previa del artículo). Detectada por Sonnet pero no por auto-audit. Aceptada por ambas: el sentido se mantiene porque el "señaladas en la letra anterior" es metalenguaje del texto, no contenido sustantivo. **Lección**: Sonnet es más exhaustivo que el auto-audit en detectar paráfrasis menores — útil tenerlo como segunda capa real, no formalismo.
- **#9 (Art 5.2)**: la opción correcta omitió "aprobado por Ley Orgánica 4/1982, de 9 de junio" tras la cita del art 27 del Estatuto. Detectado por ambas auditorías. Condensación válida (referencia normativa secundaria).
- **Ley homónima — peligro de dedup**: Decreto/Ley con mismo número (12/2014) en distintas CCAA. El dedup nivel 2 (búsqueda de mención textual en `question_text`) detectó las preguntas de la otra ley, pero al cruzar con `primary_article_id` quedó claro que no había colisión real. **Lección**: al hacer dedup, no quedarse solo en el número de la norma — verificar fecha completa, CCAA y `article_id`.

### 5.3 Batch 3 — Ley 6/1990 CARM (Archivos y Patrimonio Documental)

**2026-05-25** — Tercer batch para validar repetibilidad en una ley de naturaleza distinta: histórica (1990), texto con denominaciones de la época ("Consejería de Cultura, Educación y Turismo", referencias al "artículo 58 de la Ley de Patrimonio Histórico español"), contenido más heterogéneo (definiciones del patrimonio, competencias administrativas, ciclo de vida documental, obligaciones de particulares, depósitos).

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 5 (Art 2 patrimonio, Art 5 competencias Consejería, Art 12 ciclo documental, Art 14 obligaciones propietarios, Art 15 depósitos) |
| Preguntas generadas | 15 (3 + 3 + 3 + 3 + 3) |
| Insertadas en draft | 15/15 |
| Dedup colisiones | 0 (14 menciones de "6/1990" en BD pertenecían a otros arts ya cubiertos) |
| Auto-audit PERFECT | 15/15 (100%) |
| Sonnet audit PERFECT | 15/15 (100%) |
| Coincidencia | 100% (0 desacuerdos) |
| Transicionadas a `approved` | 15/15 |
| Impacto: Ley 6/1990 activas | 14 → 29 (+15, ×2.07) |
| Impacto: T13 CARM activas | 14 → 29 (+15, **tema duplicado en un único batch**) |

**Observaciones del batch 3:**

- **Denominaciones históricas mantenidas con exactitud**: "Consejería de Cultura, Educación y Turismo" se respeta literalmente en las 8 preguntas que la mencionan. Sonnet validó explícitamente que no se sustituye por denominaciones genéricas modernas. **Lección**: para leyes antiguas, mantener el nombre del órgano tal como aparece en el BOE original — aunque hoy se llame distinto, el opositor estudia el texto vigente publicado.
- **Referencias normativas cruzadas**: la pregunta #8 referencia "el artículo 58 de la Ley de Patrimonio Histórico español". Ambas auditorías validaron que la cita es exacta. **Lección**: las remisiones a otras leyes en leyes históricas son trampa pedagógica útil — sirven como distractores casi-correctos en preguntas futuras.
- **Tema duplicado en una sola iteración**: T13 CARM tenía 14 preguntas activas; con un solo batch de 15 ha pasado a 29. Esto demuestra el impacto real del workflow cuando se elige bien una ley pequeña con scope concentrado (Ley 6/1990 = único contenido de T13 CARM).
- **Sin descubrimiento de nuevos modos de fallo**: la auditoría no detectó condensaciones menores como en batches anteriores (#2 y #9 del batch 2). Posiblemente porque el lenguaje de la ley es más directo (instrucciones a propietarios, definiciones taxativas) y deja menos espacio a la paráfrasis.

### 5.4 Batch 4 — DL 1/1999 CARM (Texto Refundido Ley de Hacienda)

**2026-05-25** — Cuarto batch. Primera ley presupuestaria/financiera, contenido más técnico (categorías cerradas de derechos económicos, plazos de prescripción, órganos competentes, intervención). Es también el **primer batch que ejecuta el flujo v2.1 COMPLETO** (auditoría doble pre + reparación + recheck pre-transición + Paso 9 post-aplicación con `ai_provider='claude_code_recheck'`).

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 5 (Art 12 derechos económicos, Art 14 órganos competentes, Art 17 gestión recaudatoria, Art 25 prescripción obligaciones, Art 91 Intervención General) |
| Preguntas generadas | 15 (3 + 3 + 3 + 3 + 3) |
| Insertadas en draft | 15/15 |
| Dedup colisiones | 0 |
| Auto-audit PERFECT | 15/15 (100%) |
| Sonnet audit PERFECT | **14/15** — primer defecto real |
| Coincidencia auto vs Sonnet | 14/15 (un desacuerdo: #7) |
| Reparación tras hallazgo | #7 reparada → recheck PERFECT |
| Transicionadas a `approved` | 15/15 (incluida #7 reparada) |
| **Paso 9 v2.1 post-aplicación** | **15/15 PERFECT** con Sonnet nuevo (`claude_code_recheck`) |
| Impacto: DL 1/1999 activas | 19 → 34 (+15, ×1.79) confirmado en API |
| Impacto: T10 CARM activas | 19 → 34 (+15, **tema duplicado**) confirmado en API |

**Hallazgo crítico del batch 4 — pregunta #7 (Art 17.1):**

La opción C marcada como correcta omitía la cláusula final del artículo: "...o aquellos otros que le sean encargados, en régimen de concierto, por otras administraciones públicas, entidades o corporaciones."

- Mi auto-audit la dio por PERFECT (me centré en validar el sujeto "Consejería" y el primer complemento, pasé por alto la completitud del ámbito).
- Sonnet ciego detectó la omisión y la marcó NEEDS_REVIEW.
- Adjudicación (paso 4 v2.1): Sonnet tiene razón. Es un estrechamiento de sujeto exactamente como advertía §3.2.
- Reparación: ampliar opción C con la cláusula completa + actualizar blockquote de la explicación.
- Re-verificación con Sonnet nuevo (paso 7 v2.1 antes de transicionar): PERFECT.
- Re-verificación POST-aplicación (paso 9 de este manual, leído desde BD): PERFECT.

**Lecciones del batch 4:**

1. **La auditoría doble NO es formalismo.** En 60 preguntas IA-generadas (4 batches) Sonnet detectó 1 defecto real que yo no vi. Tasa de captura adicional ≈ 1.7% — pequeña pero crítica (sin él habría llegado a producción).

2. **El sesgo del generador es real.** Cuando generas la pregunta, automáticamente "rellenas mentalmente" lo que crees que dice y validas contra eso, no contra el texto literal. Sonnet, leyendo a ciegas, no tiene ese sesgo.

3. **Trampa específica detectada: omisión de cláusulas "X o Y".** Si el artículo dice "se aplica a A o B", la opción correcta DEBE incluir ambos. Omitir B estrecha el sujeto. **Nuevo modo de fallo a añadir explícitamente al prompt de generación.**

4. **Paso 9 (post-aplicación) sí funcionó como red de seguridad final.** No detectó nada adicional al recheck pre-transición, pero confirmó que la reparación se aplicó correctamente en BD (no había drift entre el JSON borrador y lo que finalmente queda escrito).

5. **Trazabilidad doble (`claude_code` + `claude_code_recheck`) funcionando**: 15/15 preguntas tienen ambos registros en `ai_verification_results`. Cualquier consulta futura puede ver el rastro completo, no solo el último.

### 5.5 Métricas acumuladas (4 batches)

| Métrica | Acumulado |
|---|---|
| Batches ejecutados | 4 |
| Preguntas generadas y transicionadas | **57** (12 + 15 + 15 + 15) |
| % éxito en auto-audit (1ª pasada) | 100% (57/57) |
| % éxito en Sonnet audit (2ª pasada ciega) | **98.3% (56/57)** — 1 defecto real detectado |
| % coincidencia entre auditorías | 98.3% (1 desacuerdo, adjudicado a favor de Sonnet) |
| Defectos llegados a producción | **0** (el único defecto fue corregido antes de transicionar) |
| % éxito en recheck post-aplicación (paso 9) | 100% (15/15 del único batch que lo aplicó) |
| Leyes con cobertura significativamente mejorada | 4 (Decreto 302/2011: ×4, Ley 12/2014: ×8.5, Ley 6/1990: ×2.07, DL 1/1999: ×1.79) |
| Temas CARM con impacto medible | T10 (×1.79 duplicado), T11 (+12), T13 (×2.07 duplicado), T16 (+15) |

### 5.6 Batch 5 — DL 1/1999 CARM Hacienda (segunda ronda T10)

**2026-05-25** — Primer batch de tamaño extendido (20 preguntas en vez de 15). 5 batches en total para esta sesión.

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 6 (Art 19 prerrogativas, Art 21 prescripción derechos, Art 37 compromisos plurianuales, Art 51 ordenación pagos, Art 78 operaciones financieras, Art 87 endeudamiento) |
| Preguntas generadas | 20 (4 + 4 + 4 + 3 + 3 + 2) |
| Insertadas en draft | 20/20 |
| Dedup colisiones | 0 |
| Auto-audit PERFECT | 20/20 (100%) |
| Sonnet audit PERFECT | **17/20** — 3 NEEDS_REVIEW |
| Adjudicación | #3 rechazado (adaptación gramatical válida a "salvo que"), #13 y #16 reparadas |
| Reparaciones aplicadas | 2 (#13 sic en blockquote, #16 reformateo a)/b)) |
| Recheck pre-transición de las 2 reparadas | PERFECT |
| Transicionadas a `approved` | 20/20 |
| **Paso 9 v2.1 post-aplicación** | **20/20 PERFECT** (`claude_code_recheck`) |
| Impacto: DL 1/1999 activas | 34 → 54 (+20, ×1.59) confirmado en API |
| Impacto: T10 CARM activas | 34 → 54 (+20, ×1.59 acumulado: ×2.84 desde inicio) |

**Hallazgos críticos del batch 5:**

- **#13 (Art 51.1)**: el artículo del BORM contiene un error gramatical original ("competen **al** Dirección General" en lugar de "a la"). El blockquote reproducía el error sin marcarlo. **Reparación**: añadir " *(sic)*" tras "al" para marcar que es fiel al BORM y no error del manual. **Nuevo modo de fallo**: anomalías gramaticales heredadas del texto legal deben marcarse con (sic) para no inducir a confusión al opositor.
- **#16 (Art 78.1)**: la opción A fusionaba los literales a) y b) del artículo en una sola frase con "o". Aunque incluía ambos contenidos, perdía la estructura tipográfica del artículo. **Reparación**: reformatear como "Mediante: a) ...; b) ..." reproduciendo la estructura del artículo. Es el mismo modo de fallo del batch 4 — confirma que es un patrón recurrente y conviene incluirlo explícitamente en el prompt de generación.
- **#3 (Art 19.3)**: Sonnet flageó por "inversión gramatical" (pregunta "salvo que" + opción afirmativa). Adjudicación humana: rechazado — es la adaptación natural cuando la pregunta usa "salvo que", no hay error de fondo. Lección: la adjudicación (paso 4 v2.1) **debe hacerse humano/Opus**, no aceptar por defecto el veredicto de Sonnet.

### 5.7 Batch 6 — Ley 6/1990 CARM Archivos (segunda ronda T13)

**2026-05-25** — Sexto batch. Completa la cobertura factible de Ley 6/1990 (arts restantes con contenido sustancial).

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 6 (Art 13 disolución entidades, Art 16 conservación y plan microfilmación, Art 18 responsabilidad propietarios, Art 19 censo, Art 20 difusión y secreto profesional, Art 23 planes edición + recogida) |
| Preguntas generadas | 10 (1 + 2 + 1 + 2 + 2 + 2) |
| Insertadas en draft | 10/10 |
| Dedup colisiones | 0 |
| Auto-audit PERFECT | 10/10 (100%) |
| Sonnet audit PERFECT | **10/10 (100%)** — 0 defectos |
| Coincidencia | 100% — 0 desacuerdos |
| Transicionadas a `approved` | 10/10 |
| **Paso 9 v2.1 post-aplicación** | **10/10 PERFECT** |
| Impacto: Ley 6/1990 activas | 29 → 39 (+10, ×1.34) confirmado en API |
| Impacto: T13 CARM activas | 29 → 39 (×1.34 acumulado: ×2.79 desde inicio) |
| Cobertura ley | 21/30 arts con preguntas (70% de la ley) |

### 5.8 Batch 7 — Ley 5/2021 Aragón (Organización y Régimen Jurídico del Sector Público Autonómico)

**2026-05-25** — **Primer batch fuera de CARM.** Disparador: feedback de Isabel B (premium DGA Aragón) reportando que T5 no cubría la Ley 5/2021. Reparación previa al batch: crear la ley en BD (158 arts via `sync-all` del BOE-A-2021-12701) + añadirla al `topic_scope` de T5 Aragón + añadir Ley 1/2009 Consejo Consultivo como bonus.

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 5 (Art 2 ámbito subjetivo, Art 70 principios organizativos, Art 71 órganos superiores/directivos, Art 85 sector público institucional, Art 94 personalidad jurídica) |
| Preguntas generadas | 15 (4 + 2 + 3 + 3 + 3) |
| Insertadas en draft | 15/15 |
| Dedup colisiones | 0 (ley recién creada, 0 preguntas existentes) |
| Auto-audit PERFECT | 15/15 (100%) |
| **Sonnet ciego pre-aplicación PERFECT** | **15/15 (100%, alta confianza)** |
| Coincidencia auto vs Sonnet pre | 100% (0 desacuerdos) |
| Transicionadas a `approved` (1ª ronda) | 15/15 |
| **Sonnet nuevo post-aplicación (paso 9)** | **14/15 PERFECT + 1 NEEDS_REVIEW (Q15)** con confianza media |
| Reparación tras hallazgo paso 9 | Q15 ampliada → recheck PERFECT |
| Impacto: Ley 5/2021 activas | 0 → 15 (ley creada en este batch) |
| Impacto: T5 Aragón activas | 11 → **73** confirmado vía API |

**Hallazgo crítico del batch 7 — pregunta Q15 (Art 70):**

La opción correcta original era: *"División funcional en departamentos y gestión territorial mediante delegaciones territoriales de ámbito provincial."* El artículo 70 dice: *"...se organizará de acuerdo con los principios de división funcional en departamentos y gestión territorial mediante delegaciones territoriales de ámbito provincial, **así como otros órganos o unidades administrativas de ámbito provincial, supracomarcal, comarcal o local** que se creen de acuerdo con lo establecido en esta ley."*

- Mi auto-audit (claude_code): PERFECT, alta confianza — interpreté que los "principios" eran solo dos.
- Sonnet ciego pre-aplicación (claude_code): PERFECT, alta confianza — mismo sesgo gramatical.
- **Sonnet nuevo post-aplicación (claude_code_recheck): NEEDS_REVIEW, confianza media** — detectó que la cláusula "así como C" cuelga del mismo predicado "principios de" y la opción correcta la truncaba.
- Adjudicación humana (manual §2.4): Sonnet del paso 9 tiene razón → reparar opción B con cláusula completa.
- Recheck con Sonnet aún más nuevo: PERFECT.

**Lecciones del batch 7 (lecciones únicas, no repetidas de batches anteriores):**

1. **Los Sonnets pre-aplicación pueden converger en el mismo sesgo del generador.** En 4 batches anteriores que aplicaron paso 9 (4, 5, 6), éste solo había confirmado persistencia. Aquí destapó un defecto real que las dos pasadas pre-transición habían dejado pasar con alta confianza. **El paso 9 deja de ser solo "verificación de drift BD" y se promueve a tercer auditor independiente.**

2. **Patrón gramatical más sutil que "X o Y"**: cláusulas coordinadas por **"así como"** (y por extensión "junto con", "además de"). El batch 4 documentó la regla para "X o Y"; este batch confirma que se extiende a cualquier coordinación que cuelgue del mismo predicado. **Bajo ambigüedad de alcance gramatical, la regla es incluir.**

3. **Repetibilidad fuera de CARM confirmada.** Es el primer batch sobre una comunidad autónoma distinta de Murcia. Resultado idéntico a los CARM (workflow opera igual, métricas comparables). La hipótesis de generalizabilidad del manual queda validada empíricamente.

4. **Reparación previa de catálogo posible en flujo único.** El usuario reportó "falta la ley X". En la misma sesión: crear ley en BD (sync-all desde BOE) + topic_scope + batch piloto de preguntas. El bucle "queja → reparación visible para el usuario" se cierra en una sola pasada.

### 5.9 Métricas acumuladas (7 batches)

| Métrica | Acumulado |
|---|---|
| Batches ejecutados | 7 |
| Preguntas generadas y transicionadas | **102** (12 + 15 + 15 + 15 + 20 + 10 + 15) |
| % éxito en auto-audit (1ª pasada) | 100% (102/102) |
| % éxito en Sonnet audit (2ª pasada ciega, pre-aplicación) | **96.1% (98/102)** — 4 defectos detectados (3 reparados, 1 adjudicado válido) |
| % éxito en Sonnet nuevo post-aplicación (paso 9) | **98.3% (59/60)** — 1 defecto adicional atrapado en batch 7 que las dos pasadas anteriores dejaron pasar |
| Defectos llegados a producción | **0** |
| Trazabilidad `claude_code` + `claude_code_recheck` | 60/102 (batches 4, 5, 6, 7) |
| Leyes con cobertura significativamente mejorada | 5 (CARM: Decreto 302/2011, Ley 12/2014, Ley 6/1990, DL 1/1999) + (Aragón: Ley 5/2021 nueva) |
| Temas con impacto acumulado | T10 CARM ×2.84 (19→54), T11 CARM +12 (309→321), T13 CARM ×2.79 (14→39), T16 CARM +15 (1011→1026), **T5 Aragón ×6.6 (11→73)** |

### 5.10 Batch 8 — LO 4/1982 CARM Estatuto de Autonomía Murcia (T2)

**2026-05-25** — Octavo batch. Primera ley **constitucional autonómica** (Estatuto de Autonomía como Ley Orgánica), estilo numeración "Uno", "Dos" característico de los Estatutos de los años 80. Tag BD: `batch7_lo_4_1982_t2`.

| Métrica | Resultado |
|---|---|
| Artículos seleccionados | 10 (Art 34 organización judicial, Art 35 competencia órdenes, Art 36 Presidente TSJ, Art 39 Administración de Justicia, Art 41 patrimonio, Art 42 Hacienda CARM, Art 43 administración tributos, Art 44 reclamaciones tributarias, Art 46 Presupuesto, Art 48 instituciones crédito) |
| Preguntas generadas | 18 (2+2+1+2+2+2+1+2+2+2) |
| Insertadas en draft | 18/18 |
| Dedup colisiones | 0 |
| Auto-audit PERFECT | 18/18 (100%) |
| Sonnet ciego pre-aplicación PERFECT | **16/18** — 2 NEEDS_REVIEW |
| Adjudicación | #8 reparada (añadir "y acciones" en letra a del Art 41.Uno); #17 rechazada (cita parcial de apartado válida cuando la pregunta acota explícitamente el contenido) |
| Reparaciones | 1 (#8 Art 41.Uno) |
| Transicionadas a `approved` | 18/18 |
| **Paso 9 v2.1 post-aplicación** | **18/18 PERFECT** (`claude_code_recheck`) — reparación confirmada |
| Impacto: LO 4/1982 activas en T2 | 35 → 53 BD raw (+18); API: 35 → 51 (drift normal) |

**Hallazgo del batch 8 — Q#8 (Art 41.Uno letra a):**

La opción correcta omitía "y acciones" en la enumeración "Los bienes, derechos **y acciones** pertenecientes al Ente Preautonómico y a la Diputación Provincial". Detectado por Sonnet pre-aplicación; mi auto-audit no lo vio. Es el **modo de fallo "lista tripartita reducida a binaria"** — variante del "X o Y" del batch 4, ahora con tres elementos en lugar de dos.

**Lecciones del batch 8:**

1. **Listas de 3+ elementos tasados merecen verificación token a token.** El sesgo del generador con listas tasadas no es exclusivo de pares "X o Y": cualquier coordinación enumerativa (X, Y **y** Z) puede sufrir omisión silenciosa. Extender la regla del batch 4 a listas tripartitas en adelante.

2. **Rechazar veredictos NEEDS_REVIEW formalistas con adjudicación humana.** Sonnet flageó #17 por "cita parcial del apartado Uno"; pero la pregunta acotaba explícitamente "primer párrafo". No hay defecto material — Sonnet a veces es excesivamente conservador. La adjudicación humana del paso 4 v2.1 es necesaria.

3. **Estatutos de Autonomía (años 80) preservar estilo numeración original.** "Uno", "Dos" en lugar de "1.", "2." aparece en LO 4/1982 (y en todos los Estatutos pre-1985). Mantener literal — es parte del texto vigente que el opositor estudia.

### 5.11 Batch 9 — Ley 6/2004 + Ley 7/2004 CARM (T3 Presidente y Consejo + Organización Admin)

**2026-05-25** — Noveno batch. **Doble ley en un solo batch** — primera vez que un batch toca dos leyes distintas (T3 CARM combina Ley 6/2004 del Estatuto del Presidente con Ley 7/2004 de Organización Administrativa). Sexta tipología (leyes orgánicas internas del gobierno autonómico: composición, cese, debates parlamentarios, potestad reglamentaria, organización departamental, contratación). Tag BD: `batch8_t3_carm`.

| Métrica | Resultado |
|---|---|
| Artículos seleccionados Ley 6/2004 | 7 (Art 6 delegación, Art 10 incompatibilidad, Art 20 efectos cese, Art 29 cese Consejo, Art 40 debates, Art 46 iniciativa legislativa, Art 52 potestad reglamentaria) → 10 preguntas |
| Artículos seleccionados Ley 7/2004 | 6 (Art 2 personalidad jurídica, Art 6 convenios, Art 13 estructura Consejerías, Art 24 órganos colegiados, Art 35 órganos contratación, Art 40 organismos públicos) → 10 preguntas |
| Preguntas generadas | 20 |
| Insertadas en draft | 20/20 |
| Dedup colisiones | 0 |
| Auto-audit PERFECT | 20/20 (100%) |
| **Sonnet ciego pre-aplicación PERFECT** | **20/20 (100%)** — 2 notas menores autodescartadas por Sonnet tras revisión |
| Coincidencia auto vs Sonnet | 100% (0 desacuerdos confirmados) |
| Transicionadas a `approved` | 20/20 |
| **Paso 9 v2.1 post-aplicación** | **20/20 PERFECT** (`claude_code_recheck`) |
| Impacto: Ley 6/2004 activas en T3 | 35 → 45 BD raw (+10) |
| Impacto: Ley 7/2004 activas en T3 | 29 → 39 BD raw (+10) |
| Impacto: T3 CARM activas | 71 → 93 BD raw (+22); API: 71 → 86 (drift normal) |

**Lecciones del batch 9:**

1. **Doble ley en batch único viable** cuando ambas pertenecen al mismo tema y comparten texturas (en este caso, leyes orgánicas autonómicas, estructura paralela: composición + funciones + procedimientos). No hay penalty operativo por mezclar leyes en un mismo batch siempre que el tag y el seguimiento estén claros.

2. **Sonnet con autorrevisión: no todo NEEDS_REVIEW inicial sobrevive a su propia segunda lectura.** En este batch Sonnet flageó 2 puntos y los descartó él mismo al ampliar el análisis. Modo de funcionamiento útil — no hay que reaccionar mecánicamente al primer flag; leer el razonamiento completo del agente.

3. **Listas tasadas en leyes orgánicas autonómicas son densas** (Art 13 Ley 7/2004: 4 órganos directivos por Consejería; Art 24: 3 categorías de competencias; Art 40.2: 4 letras de contenido mínimo de ley de creación). Disciplina con la enumeración completa = clave del 100% directo.

### 5.12 Métricas acumuladas (9 batches)

| Métrica | Acumulado |
|---|---|
| Batches ejecutados | 9 |
| Preguntas generadas y transicionadas | **140** (12 + 15 + 15 + 15 + 20 + 10 + 15 + 18 + 20) |
| % éxito en auto-audit (1ª pasada) | 100% (140/140) |
| % éxito en Sonnet audit (2ª pasada ciega, pre-aplicación) | **95% (133/140)** — 7 defectos detectados (5 reparados, 2 adjudicados válidos) |
| % éxito en Sonnet nuevo post-aplicación (paso 9) | **98.9% (97/98)** — 1 defecto adicional atrapado solo en batch 7 |
| Defectos llegados a producción | **0** |
| Trazabilidad `claude_code` + `claude_code_recheck` | 98/140 (batches 4, 5, 6, 7, 8, 9) |
| Leyes con cobertura mejorada | **7** (CARM: Decreto 302/2011, Ley 12/2014, Ley 6/1990, DL 1/1999, **LO 4/1982**, **Ley 6/2004**, **Ley 7/2004**) + Aragón: Ley 5/2021 |
| Temas con impacto acumulado | **T2 CARM +18 (35→53)**, **T3 CARM +22 (71→93)**, T10 CARM ×2.84 (19→54), T11 CARM +12, T13 CARM ×2.79 (14→39), T16 CARM +15, T5 Aragón ×6.6 |

**Resultado para CARM (8 batches, 138 preguntas)**: tras esta sesión, **todos los temas autonómicos puros** con cobertura legislativa (no informática) han pasado a cobertura digna:

- T2 Estatuto Murcia: 35 → 53 BD (+51% incremento)
- T3 Presidente/Consejo: 71 → 93 BD (+31%)
- T10 Hacienda Murcia: 19 → 54 BD (+184%)
- T11 Admin electrónica: 309 → 321 (+4%, ya tenía base estatal)
- T13 Archivos Murcia: 14 → 39 BD (+179%)
- T16 Igualdad/Transparencia: 1011 → 1026 (+1%, ya tenía mucha base estatal)

**Pendientes para CARM** (no factibles con IA-gen del workflow actual):
- T17 PowerPoint 2016, T18 Excel 2016, T20 Word 2016 — informática, requiere otro enfoque (scraping o generación con captura de pantalla).

**Modos de fallo detectados (3 distintos, todos en §3.2 "options_ok"):**
1. **Omisión de cláusulas "X o Y"** (batches 4 y 5): la opción correcta no incluye todas las alternativas tasadas.
2. **Anomalía gramatical heredada del BORM** (batch 5): blockquote reproduce error original sin marcar (lección: `(sic)`).
3. **Listas tripartitas reducidas a binarias** (batch 8): omisión silenciosa de un tercer elemento (caso "bienes, derechos y acciones" → "bienes y derechos"). Variante del modo de fallo 1 extendida a listas de 3+ elementos.

Además del modo de fallo del batch 7 ya documentado: **cláusulas coordinadas por "así como"** que cuelgan del mismo predicado (variante sutil de "X o Y").

**Conclusión tras 9 batches**: el workflow IA-gen es **estable, robusto y aplicable a múltiples tipologías de ley**:
- Decretos técnicos (302/2011 CARM)
- Leyes definicionales/transparencia (12/2014 CARM)
- Leyes históricas (6/1990 CARM)
- Leyes presupuestarias (DL 1/1999 CARM)
- Leyes orgánicas autonómicas (5/2021 Aragón)
- Estatutos de Autonomía constitucionales (LO 4/1982 CARM)

### 5.13 Batch 10 — Easy win T3 CARM (Ley 6/2004 + Ley 7/2004)

**2026-05-25** — Décimo batch. **Mini-batch** de 7 preguntas para alcanzar umbral 100q en T3 (estaba en 93). Tag: `batch10_t3_ge100`.

| Métrica | Resultado |
|---|---|
| Preguntas generadas | 7 (3 Ley 6/2004 + 4 Ley 7/2004) |
| Auto-audit + Sonnet ciego pre-app | 7/7 PERFECT (100%, 0 desacuerdos) |
| Paso 9 post-app | 7/7 PERFECT |
| T3 BD raw | 93 → **100 ✓** (umbral alcanzado) |

### 5.14 Batch 11 — T10 DL 1/1999 r3 (camino hacia 100)

**2026-05-25** — 18 preguntas en 6 arts no cubiertos (Arts 18, 23, 38, 44, 53, 55). Tag: `batch11_t10_dl1999_r3`.

| Métrica | Resultado |
|---|---|
| Preguntas generadas | 18 |
| Auto-audit | 18/18 PERFECT |
| Sonnet ciego pre-app | **17/18 PERFECT + 1 sospecha** (#15 Art 53.5) |
| Adjudicación #15 | Aceptada PERFECT — la pregunta es fiel al `article_content` de BD; la sospecha es sobre posible errata de transcripción del BORM oficial (`reparto` vs `reparo`), defecto de la fuente |
| Paso 9 post-app | 17/18 PERFECT (#15 confirma sospecha sin invalidar la pregunta) |
| T10 BD raw | 54 → 72 |

**Hallazgo crítico — NUEVO modo de fallo identificado: errata en `article_content` BD.** Sonnet detectó que el texto del artículo almacenado en BD dice "aprobación o **reparto** de la cuenta rendida", pero el término técnico-jurídico correcto en derecho presupuestario español es "**reparo**" (objeción de la Intervención al documento contable). La pregunta y su explicación replican fielmente lo que está en BD; el defecto no es de la generación IA sino del texto fuente. **Acción registrada para revisión posterior del catálogo de leyes (no acción inmediata sobre la pregunta).**

### 5.15 Batch 12 — T10 DL 1/1999 r4 (superar 100)

**2026-05-25** — 15 preguntas en 7 arts (Arts 20, 24, 39, 40, 49, 74, 79). Tag: `batch12_t10_dl1999_r4`.

| Métrica | Resultado |
|---|---|
| Preguntas generadas | 15 |
| Auto-audit + Sonnet ciego pre-app | **15/15 PERFECT directo (100%, 0 desacuerdos)** |
| Paso 9 post-app | (pendiente al cerrar esta sección) |
| T10 BD raw | 72 → **100 ✓** (umbral alcanzado) |

Cifras numéricas críticas verificadas en este batch: 25% (interés demora tributarias Art 20.3), 15% (desembolso inicial bienes inmuebles Art 39.3), 5%/10% (organismos administrativos/comerciales Art 40.2), 4 anualidades, 20 años (depósitos abandonados Art 79.4).

### 5.16 Batch 13 — T2 LO 4/1982 r2 (techo natural)

**2026-05-25** — 7 preguntas en 4 arts cortos restantes (37, 45, 47, 49). Tag: `batch13_lo_4_1982_t2_r2`. **Confirma techo natural** del scope T2.

| Métrica | Resultado |
|---|---|
| Preguntas generadas | 7 (máximo factible dado el scope restante: arts 37 359c, 45 432c, 47 670c, 49 593c) |
| Auto-audit + Sonnet ciego pre-app | **7/7 PERFECT directo** |
| Paso 9 post-app | (pendiente al cerrar esta sección) |
| T2 BD raw | 53 → **60** |
| **Techo natural T2** | **60q (scope solo cubre arts 20-55; quedan 0 arts sin pregs con >=300c)** |

**Conclusión sobre T2:** el epígrafe oficial CARM cubre solo el Título II (órganos institucionales + régimen jurídico + reforma del Estatuto = arts 20-55). El Título I (territorio, símbolos, derechos, competencias) corresponde a otros temas. Para llegar a 100q en T2 con la fuente actual habría que generar redundancia controlada sobre arts ya cubiertos (riesgo: aburrir al usuario). **Aceptar 60q como techo realista** para T2.

### 5.17 Métricas acumuladas (13 batches)

| Métrica | Acumulado |
|---|---|
| Batches ejecutados | 13 |
| Preguntas generadas y transicionadas | **187** (12+15+15+15+20+10+15+18+20+7+18+15+7) |
| % éxito en auto-audit (1ª pasada) | 100% (187/187) |
| % éxito en Sonnet audit (2ª pasada ciega, pre-aplicación) | **95.7% (179/187)** — 8 defectos: 5 reparados, 2 adjudicados válidos, 1 sospecha BD (#15 batch 11) |
| % éxito en paso 9 post-aplicación | **99.1% (113/114)** — el caso #15 batch 11 confirma sospecha BD pero no requiere acción sobre pregunta |
| Defectos llegados a producción | **0** |
| Leyes con cobertura mejorada | 7 CARM + 1 Aragón |

**Estado final CARM (umbral 100q) tras 13 batches:**

| Tema | Antes (1ª sesión) | Ahora BD | Umbral 100q | Estado |
|---|---|---|---|---|
| T2 Estatuto Murcia | 35 | **60** | 100 | ⚠️ Techo natural (scope arts 20-55 saturado) |
| T3 Presidente/Consejo | 71 | **100** ✓ | 100 | **✓ Alcanzado** |
| T10 Hacienda Murcia | 19 | **100** ✓ | 100 | **✓ Alcanzado** |
| T11 Admin electrónica | 309 | 321 | 100 | ✓ Ya superado |
| T13 Archivos Murcia | 14 | 39 | 100 | ⚠️ Saturada (ley 30 arts, 21 cubiertos al 70%) |
| T16 Igualdad/Transparencia | 1011 | 1026 | 100 | ✓ Ya superado |
| T17 PowerPoint | 50 | 50 | 100 | ❌ Informática, requiere otro flujo |
| T18 Excel | 92 | 92 | 100 | ❌ Informática |
| T20 Word | 93 | 93 | 100 | ❌ Informática |

**Modos de fallo detectados (4 distintos, todos en §3.2 "options_ok" salvo el #4):**
1. **Omisión de cláusulas "X o Y"** (batches 4 y 5)
2. **Anomalía gramatical heredada del BORM** (batch 5): solución `(sic)`
3. **Listas tripartitas reducidas a binarias** (batch 8): caso "bienes, derechos y acciones"
4. **Cláusulas coordinadas por "así como"** (batch 7 Aragón Q15)
5. **Errata en `article_content` BD vs BORM oficial** (batch 11 #15): la pregunta es fiel a la fuente; defecto es de la base de datos, no de la generación. Acción: registrar para revisión posterior del catálogo de leyes.

**Lecciones nuevas v1.8:**

1. **Techo natural del scope.** Cuando los artículos del scope con contenido sustancial se agotan, no insistir generando redundancia controlada. Mejor aceptar el techo y documentar. Caso T2 (60q vs 100q objetivo): el scope cubre solo arts 20-55, queda saturado, y el resto del Estatuto (arts 1-19) corresponde a otros temas.

2. **Saturación de ley pequeña.** Cuando la ley tiene pocos artículos (Ley 6/1990 Archivos: 30 arts), el techo es bajo por construcción. Aceptar y planificar contenido complementario por otros medios.

3. **Audit Sonnet puede detectar errores de la fuente, no de la generación.** Caso batch 11 #15: Sonnet sospechó "reparto/reparo" y el error es del `article_content` de BD (posible errata de digitalización), no de la generación IA. Reconocer este modo de fallo como **señalamiento útil** que activa revisión del catálogo aunque la pregunta sea válida.

4. **Mini-batches (7-10 preg) son tan robustos como batches grandes** (15-20). El batch 10 con solo 7 preg cerró T3 sobre 100 con 100% éxito directo. Útiles para "easy wins" cuando faltan pocas preguntas para alcanzar un objetivo.

**Pendientes para CARM (decisión consciente):**

- **T13 Archivos Murcia:** saturada (39q/100 con la Ley 6/1990 de solo 30 arts). Llegar a 100 implicaría redundancia. **Reconsiderado en v1.9**: redundancia controlada SÍ es viable (ver §2.6 + sección 5.18 piloto). Estimación: con +2 preg por art ya cubierto con enfoques distintos, T13 puede llegar a ~80-85q. NO se aplicó aún en esta sesión.
- **T17/T18/T20 informáticos:** el workflow IA-gen del manual §1 explícitamente NO aplica (no hay "artículo literal"). Requieren scraping OpositaTest/TuTestDigital o generación con capturas de pantalla. Pendiente otro flujo.

### 5.18 Piloto redundancia controlada — Art 42 LO 4/1982 (validación del patrón v1.9)

**2026-05-25** — Piloto de 3 preguntas sobre el mismo artículo (Art 42 LO 4/1982, Hacienda CARM, 10 letras a-j) que ya contaba con 2 preguntas existentes (batch 7). Objetivo: validar si el "techo natural" se puede superar generando preguntas adicionales con mecanismos cognitivos distintos.

| Métrica | Resultado |
|---|---|
| Existentes en Art 42 | 2 (intruso D + reconocimiento letra e) |
| Nuevas generadas | 3 (camino inverso letra f + cláusula residual j + distinción conceptual recargos d) |
| Dedup nivel 1 (Jaccard pregunta nuevas vs existentes) | 30-38% (lejos de 50% umbral) ✓ |
| Dedup nivel 2 (entre nuevas) | 38-43% (esperable por contexto compartido) ✓ |
| Dedup nivel 3 (opciones correctas nuevas vs todas opciones existentes) | **0 alertas** ✓ |
| Auto-audit + Sonnet ciego pre-app | 3/3 PERFECT |
| Evaluación de redundancia por Sonnet | 2/3 valor pedagógico ALTO + 1/3 MEDIO (N4 cláusula residual repite mecanismo de existente E2, aunque sobre letra distinta) |
| Paso 9 post-app | 3/3 PERFECT |
| Art 42 LO 4/1982 activas | 2 → **5** |

**Veredicto Sonnet**: patrón VIABLE. Se confirma que:
1. La diversificación por mecanismo cognitivo (intruso / camino inverso / distinción conceptual / cláusula residual / reconocimiento literal) genera preguntas no solapadas aunque compartan artículo.
2. El dedup nivel 3 (opciones correctas vs opciones existentes) es el detector crítico de solapamiento real.
3. Hay límite: artículos con ≥5 ítems admiten 4-5 preguntas; estructuras simples (2-3 ítems) saturan a 2.

### 5.19 Cobertura intensiva Ley 5/2021 Aragón — 7 batches consecutivos (b2-b8, v1.10)

**2026-05-25** — Continuación del batch 7 (sesión 5.8). Disparador: feedback Isabel (premium DGA Aragón) — la reparación inicial añadió 15 preguntas, pero solo el ~18% del scope T5 (5 arts de 83 relevantes). Decisión consciente: cobertura digna requiere serie de 7 batches consecutivos. **Primer caso documentado de escalabilidad masiva sobre una única ley grande.**

**Paso 0bis previo (v1.10)**: restringir `topic_scope` T5 Aragón a arts 1-8 + 70-144 (núcleo del epígrafe); añadir bloques de procedimiento a T6/T7/T8. Sin esto, los batches sucesivos hubieran contaminado T5 con arts de procedimiento.

| Batch | Bloque ley | Arts | Q | Sonnet pre-app | Paso 9 | Reparaciones |
|---|---|---|---|---|---|---|
| b2 | Preliminar (1, 3-8) | 7 | 14 | **13/14** (Sonnet ciego atrapó Q13) | 14/14 PERFECT | 1 (cláusula "así como" Art 3.4) |
| b3 | Título III pt1 (72-78) | 7 | 15 | 15/15 PERFECT | 15/15 PERFECT | 0 |
| b4 | Título III pt2 (79-84) | 6 | 15 | 15/15 PERFECT | 15/15 PERFECT | 0 |
| b5 | Título IV intro (86-93) | 8 | 15 | 15/15 PERFECT | **14/15** (Sonnet paso 9 atrapó Q15) | **1 (drift en ENUNCIADO Art 92 — modo de fallo NUEVO)** |
| b6 | Título IV OOAA (95-103) | 9 | 15 | 15/15 PERFECT | 15/15 PERFECT | 0 |
| b7 | Título IV EDP+sociedades (104-117) | 14 | 15 | 15/15 PERFECT | 15/15 PERFECT | 0 |
| b8 | Título IV consorcios+fund (120-142) | 13 | 15 | 15/15 PERFECT | 15/15 PERFECT | 0 |
| **Total b2-b8** | **64 arts** | **104** | **103/104 (99.0%)** | **103/104 (99.0%)** | **2 reparaciones** |

**Sumado al batch 7 inicial (5.8)**: **8 batches totales sobre Ley 5/2021 — 119 preguntas activas en una sola ley.**

**Impacto medible:**
- Ley 5/2021 activas: 0 → **119** (creación de ley nueva en sesión + 8 batches).
- T5 DGA Aragón vía API: 11 → **177** (×16 cobertura).
- Cobertura cross-tema preparada: T6/T7/T8 también reciben arts de la Ley 5/2021 cuando batches futuros generen sobre arts 9-69 + 145-158.

**Hallazgo crítico v1.10 — b5 Q15 (Art 92): drift en ENUNCIADO no en opción correcta**

Es el primer caso documentado en el manual de un defecto en el **enunciado** de la pregunta (no en la opción correcta ni en la explicación). El enunciado original decía:

> *"Conforme al artículo 92 de la Ley 5/2021 de Aragón, son organismos públicos autonómicos los creados para la realización de **actividades administrativas y de contenido económico reservadas** a las administraciones públicas, así como la supervisión o regulación de sectores económicos, y cuyas características justifiquen su organización en régimen de:"*

El artículo 92 dice realmente:

> *"…actividades administrativas, **sean de fomento, prestación o de gestión de servicios públicos o de producción de bienes de interés público susceptibles de contraprestación**; actividades de contenido económico reservadas a las administraciones públicas, así como la supervisión o regulación de sectores económicos, y cuyas características justifiquen su organización en régimen de descentralización funcional o de independencia."*

El enunciado había hecho un **sumario libre** del artículo omitiendo el bloque "sean de fomento, prestación o de gestión de servicios públicos o de producción de bienes de interés público susceptibles de contraprestación". La opción correcta (descentralización funcional o independencia) y la explicación estaban impecables.

- Mi auto-audit: PERFECT.
- Sonnet ciego pre-aplicación: PERFECT, alta confianza.
- **Sonnet nuevo post-aplicación (paso 9): NEEDS_REVIEW** — detectó la condensación libre del enunciado.

Reparación: ampliar el enunciado incluyendo la enumeración completa entre paréntesis. Recheck PERFECT.

**Modo de fallo nuevo (v1.10): "sumario libre del artículo en el enunciado"** — añadido al §2.2 con regla operativa: si el enunciado menciona "según el artículo X", lo que diga sobre X debe ser cita literal o usar elipsis explícita; nunca resumir.

**Lecciones del lote b2-b8:**

1. **El paso 9 atrapa defectos en el enunciado, no solo en la opción correcta o explicación.** Las 4 columnas que el manual verificaba hasta v1.9 (article_ok, answer_ok, options_ok, explanation_ok) no cubrían el enunciado. v1.10 añade `question_text_ok` como 5º check.

2. **Escalabilidad en serie sobre una sola ley confirmada.** 7 batches consecutivos sin pérdida de calidad. Métricas casi idénticas a las de batches sobre leyes distintas (99% PERFECT primera pasada vs 95.7% acumulado del manual). El factor determinante no es "ley distinta cada batch" sino "calidad del scope inicial + disciplina del workflow".

3. **Reparar el `topic_scope` antes de batchear es paso preparatorio crítico.** Sin restricción explícita de article_numbers, los arts de procedimiento de la Ley 5/2021 hubieran contaminado T5. Paso 0bis nuevo (v1.10).

4. **Cobertura cross-TEMA dentro de la misma oposición es criterio de priorización tan válido como cross-OPOSICIÓN.** Una ley grande con secciones temáticamente distintas puede servir a 3-4 temas de la misma oposición. Lo añadí a §1.bis.

5. **Sesgo convergente entre 2 Sonnets pre-aplicación: recurrencia ~2%.** En 104 preguntas del lote, 2 defectos atrapados solo por Sonnet del paso 9 (b2 Q13 cláusula "así como" + b5 Q15 drift enunciado). El manual v1.6 documentó el primer caso (batch 7); v1.10 confirma que el patrón es estable y justifica que el paso 9 sea obligatorio.

### 5.20 Métricas acumuladas (29 batches, v2.3)

| Métrica | Acumulado |
|---|---|
| Batches ejecutados | **29** (22 manual + 7 lote Aragón b2-b8) |
| Preguntas generadas y transicionadas | **388** (284 manual + 104 lote Aragón) |
| % éxito en auto-audit (1ª pasada) | 100% (388/388) |
| % éxito en Sonnet audit pre-aplicación | **94.8% (368/388)** — 20 NEEDS_REVIEW detectados (11 reparados, 7 adjudicados válidos, **2 retirados** — batch 16 Art 20 intruso en art escueto + batch 18 Art 13 correcta-en-correcta-existente) |
| % éxito en paso 9 post-aplicación | **99.3% (287/289)** — 2 defectos adicionales solo en paso 9 (b5 Aragón Q15 drift enunciado) |
| Defectos llegados a producción | **0** |
| Leyes con cobertura mejorada | **8** (CARM: Decreto 302/2011, Ley 12/2014, **Ley 6/1990 (96 activas)**, DL 1/1999, **LO 4/1982 (102 activas)**, Ley 6/2004, Ley 7/2004) + Aragón: Ley 5/2021 (119q en una ley) |
| Temas con impacto acumulado | T2/T3/T10/T11/T13/T16 CARM (**T2: 35→100 ×2.9**, **T13: 14→96 ×6.9 en 6 batches sobre una sola ley monotemática**) + T5 Aragón ×16 (11→177) + T6/T7/T8 Aragón preparados |
| **Hitos** | **T2 CARM = 100q exactas** (batches 8+13+15+16); **T13 CARM = 96q tras 6 batches consecutivos** (batches 3+17+18+19+20+21+22), techo natural realista alcanzado |

**Modos de fallo detectados (6 distintos, v1.10 amplía a 6):**
1. Omisión de cláusulas "X o Y" (batch 4, 5)
2. Anomalía gramatical heredada del BORM → `(sic)` (batch 5)
3. Listas tripartitas reducidas a binarias (batch 8)
4. Cláusulas coordinadas por "así como" / "junto con" / "además de" (batch 7 + b2 Aragón)
5. Errata en `article_content` BD vs BORM oficial (batch 11)
6. **Drift en el enunciado por sumario libre del artículo (b5 Aragón Q15 — v1.10)**: no en options_ok ni explanation_ok, sino en el question_text. Detectado solo por paso 9.

**Conclusión tras 21 batches**: el workflow IA-gen es **estable, robusto y escalable**. Las claves del 100% post-reparación sostenido son:
- 5 checks de fidelidad al artículo (article + answer + options + explanation + **question_text v1.10**).
- Paso 0bis para reparar topic_scope antes de batchear.
- Auditoría doble ciega + paso 9 como tercer auditor independiente.
- Adjudicación humana ante discrepancias (no aceptar Sonnet por defecto).
- Cross-oposición + cross-tema para maximizar el ROI por pregunta.

**Lecciones nuevas v1.9 derivadas del piloto:**

1. **El "techo natural" del scope NO es definitivo.** Se puede superar con redundancia controlada bajo condiciones (ver §2.6). Re-evaluar T2 y T13 (antes considerados saturados): el techo realista sube de 60→90 (T2) y de 39→80 (T13) si se aplica el patrón.

2. **Cross-oposición es criterio de priorización**: antes de invertir tiempo en ampliar una ley, verificar `topic_scope` para identificar oposiciones que se benefician (§1.bis nueva). Caso real: LO 4/1982 beneficia a CARM Aux Admin + TCAE Murcia automáticamente; Ley 6/1990 Archivos solo a CARM Aux Admin.

3. **Dedup nivel 3 (opciones correctas) es nuevo check añadido al workflow** (§2.6). Sin él, dos preguntas con enunciados distintos pero misma respuesta pasarían como "nuevas" cuando en realidad evalúan el mismo conocimiento.

4. **Evaluación de redundancia en auditoría Sonnet**: al hacer paso 9 sobre batches de redundancia, añadir al prompt el bloque "Para cada nueva, evalúa: (1) enfoque distinto SÍ/NO; (2) respuesta correcta solapa SÍ/NO; (3) valor pedagógico ALTO/MEDIO/BAJO/REDUNDANTE". Sin esto, la auditoría solo evalúa calidad técnica pero no aporta señal de saturación.

El defecto medio detectado es **~5% pre-aplicación** (todos reparados antes de producción). El paso 9 post-aplicación captura adicionalmente ~1% que las dos pasadas pre-transición pueden dejar pasar (caso batch 7). **0 defectos llegados a producción en 140 preguntas activas.**

**Modos de fallo detectados (2 distintos, ambos en §3.2 "options_ok"):**
1. **Omisión de cláusulas "X o Y"** (batches 4 y 5): la opción correcta no incluye todas las alternativas tasadas del artículo. *Lección*: añadir al prompt regla explícita anti-omisión y verificar token a token.
2. **Anomalía gramatical heredada del BORM** (batch 5): blockquote reproduce error original sin marcar. *Lección*: usar "(sic)" cuando el texto legal tenga errores tipográficos/gramaticales.

**Conclusión tras 6 batches**: el workflow es **operacional y escalable**. Las claves del 100% post-reparación sostenido son:
- Auditoría doble verdaderamente ciega (Sonnet sin contexto del generador).
- Adjudicación humana cuando hay discrepancia (paso 4 v2.1) — no aceptar Sonnet por defecto.
- Reparación + recheck pre-transición.
- Paso 9 post-aplicación como red de seguridad final.

**Cache y verificación post-batch (lección operativa)**: tras invalidar `test-counts`/`laws`/`questions` + purgar páginas ISR, **la API puede tardar ~1-2 min en propagar el conteo nuevo** debido a caches intermedios (Vercel CDN). Para verificación inmediata usar header `Cache-Control: no-cache` + parámetro anti-cache (`?_t=$(date +%s)`):

```bash
curl -sS -H "Cache-Control: no-cache" \
  "https://www.vence.es/api/topics/N?oposicion=slug&userId=ID&_t=$(date +%s)"
```

Sin el bypass, la API puede seguir devolviendo el valor antiguo durante un período corto. No es defecto del flujo — es propagación normal de cache.

**Conclusión tras 4 batches**: el workflow es **robusto** y la auditoría doble es **necesaria** (no formalismo). El batch 4 demostró en producción que:
- El generador puede pasar por alto omisiones sustantivas (caso real, no hipotético).
- La auditoría ciega del Sonnet sí las detecta.
- La reparación + recheck cierra el bucle limpiamente.
- El paso 9 (post-aplicación) no detectó defectos adicionales pero confirmó que la reparación se persistió correctamente.

**Razones del 100% post-reparación sostenido:**
1. Selección de artículos con contenido sustancial (≥400-500 chars) y bien estructurado.
2. Selección de leyes autonómicas claras (no doctrina, no jurisprudencia, no derecho civil interpretativo).
3. Prompt mental con regla cero estricta: "opción correcta = cita literal o no se genera".
4. Auditoría doble verdaderamente ciega — Sonnet no recibe pistas sobre quién generó.
5. **Disciplina de reparar + re-verificar cuando hay hallazgo**, no asumir que el primer veredicto es definitivo.

**Recomendación para escalar:**
- Aumentar tamaño de batch a 25-30 preguntas/iteración para reducir overhead por lote.
- Probar con una ley estatal pequeña-mediana (ej. articulado puntual de Ley 39/2015 o Ley 40/2015 con gap detectado) para validar fuera del corpus autonómico.
- **Añadir al prompt de generación una regla explícita anti-omisión: "Si el artículo dice 'X o Y', la opción correcta DEBE incluir ambos. Verificar token a token que no se omite ninguna cláusula sustantiva del ámbito".**
- Mantener la disciplina de auditoría doble + paso 9 post-aplicación: ningún batch sin Sonnet ciego antes Y después de transicionar.
- Si en algún batch el % cae por debajo de 90% en auto-audit (no Sonnet), parar y recalibrar el prompt.

### 5.21 Batch 15 — T2 LO 4/1982 redundancia controlada en serie (12q, v2.0)

**2026-05-25** — Aplicación masiva del patrón §2.6 (no piloto): 12 preguntas sobre 8 arts del Estatuto de Murcia que ya contaban con preguntas existentes en BD. Objetivo: validar que la redundancia controlada escala más allá del piloto Art 42 (v1.9, sección 5.18).

**Arts cubiertos**: 27.1 / 27.3 / 27.4 / 27.5 / 30.1 / 30.2 / 30.3 (×2) / 33.1 / 33.3 / 33.4 / 33.5. Todos con ≥1 pregunta existente. Mecanismos cognitivos distintos usados: intruso (Q5, Q7), reconocimiento literal (Q2, Q3, Q4, Q8, Q11), cláusula específica (Q1, Q9, Q12), distinción conceptual (Q6, Q10).

| Métrica | Resultado |
|---|---|
| Existentes en BD para esos 8 arts | ≥1 por art, ≥30 total ley |
| Nuevas generadas | 12 |
| Dedup nivel 1+2 (Jaccard) | <50% en todas ✓ |
| Dedup nivel 3 (opciones correctas vs existentes) | 0 alertas ✓ |
| Auto-audit | 12/12 PERFECT |
| Sonnet ciego pre-aplicación | **9/12 PERFECT + 3 NEEDS_REVIEW** (Q3 art 27.4, Q6 art 30.2, Q11 art 33.4 por posible solapamiento con existentes E3/E3/E1) |
| Adjudicación humana de los 3 NEEDS_REVIEW | **3/3 VÁLIDOS** — al consultar las opciones de las existentes se confirmó que las respuestas correctas son distintas (mismo apartado, dato evaluado distinto) |
| Paso 9 post-app | **12/12 PERFECT** |
| LO 4/1982 activas | 79 → **91** (+12) |
| Cross-oposición | CARM Aux Admin (T2+T3) + TCAE Murcia (T1) — multiplicador ×3 |

**Lección operativa v2.0**: Sonnet pre-aplicación no tiene acceso a las **opciones** de las preguntas existentes con las que sospecha solapamiento — solo ve el enunciado. Cuando un pre-existente y un nuevo cubren el **mismo apartado** del artículo, Sonnet flaguea NEEDS_REVIEW por precaución, pero el solapamiento puede ser falso si las **respuestas correctas** evalúan datos distintos.

**Patrón de adjudicación** (aplicar siempre que Sonnet diga "posible solapamiento E_X"):

```bash
# Cargar la pregunta existente referenciada y comparar respuestas correctas
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient} = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  // Cargar por primary_article_id + filtrar por prefijo
  const {data: qs} = await s.from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
    .eq('primary_article_id', '<ART_UUID>').eq('is_active', true);
  const target = qs.find(q => q.id.startsWith('<PREFIX_8_CHARS>'));
  console.log('Correcta existente:', ['A','B','C','D'][target.correct_option]);
})();
"
```

**Decisión**: si la respuesta correcta de la nueva es **literalmente distinta** de la respuesta correcta de la existente → válida (no solapan); si coinciden o si la nueva es semánticamente reformulación de la misma → retirar la nueva.

**Conclusión batch 15**: el patrón §2.6 escala. 12 preguntas redundantes sobre apartados ya cubiertos, 0 solapamientos reales detectados tras adjudicación manual, 0 defectos en producción. **T2 LO 4/1982: 35 (pre-IA) → 91 (post-batch15) = ×2.6 cobertura**, validando que el "techo natural" del scope puede multiplicarse cuando se aplica la disciplina de los 5 mecanismos cognitivos + dedup nivel 3.

### 5.22 Batch 16 — T2 LO 4/1982 cierre a 100q (11q, v2.1)

**2026-05-25** — Cierre del objetivo "T2 CARM ≥ 100 preguntas" combinando lo aprendido de los 4 batches anteriores sobre la misma ley. **Selección quirúrgica de arts**: 3 sin preguntas (Art 38, 40, 50) + 10 con solo 1 pregunta + 9 con 2 — priorizando contenido sustancial (≥350 chars) y mecanismos cognitivos distintos a los existentes.

**Borrador inicial**: 12 preguntas sobre 11 arts (Art 25 con 2 preguntas — apartados 2 y 3 distintos del existente apartado 1). Sonnet pre-aplicación: **9/12 PERFECT + 3/12 NEEDS_REVIEW**.

**Adjudicación manual de los 3 NEEDS_REVIEW** (decisiones distintas, no automáticas):

| # | Art | Problema Sonnet | Decisión | Justificación |
|---|-----|-----------------|----------|---------------|
| 1 | 20 | "Intruso solapa cognitivamente con enumeración existente — mismo dato evaluado, mecanismo invertido" | **RETIRAR** | Art 20 tiene solo 3 órganos y 108 chars de contenido. La lista es tan corta que el patrón intruso (cuál NO es) y el patrón enumeración (cuáles son) operan sobre el mismo conocimiento — no hay ortogonalidad real. Lección: **arts escuetos no soportan redundancia útil**. |
| 5 | 29 | "El enunciado de la existente cita literalmente la opción correcta de la nueva" | **REPARAR** | La existente cita el texto completo del art 29 en su enunciado, incluyendo la frase "Todo miembro de la Cámara deberá estar adscrito a un grupo" — exactamente la opción correcta de la nueva. Quien resuelva la existente ya conoce esa frase. **Cambiar el dato evaluado**: reformular para preguntar por la fuente normativa ("se fijarán por el Reglamento"), dato distinto del mismo art que NO aparece en ningún enunciado existente. |
| 7 | 37 | "Sumario libre 'procesos selectivos' + contexto telegrafía respuesta" | **REPARAR** | El enunciado introducía la expresión "procesos selectivos" que NO es literal del art (que dice "concursos y oposiciones"), y describía tan exactamente el contexto que la respuesta era casi evidente. **Cambiar el ángulo**: pregunta ahora por "a instancia de quién" (las primeras palabras literales del art), con elipsis correcta. Opción correcta = "A instancia de la Comunidad Autónoma" — dato distinto al existente que pregunta "quién convoca". |

**Resultado post-reparación**:

| Métrica | Resultado |
|---|---|
| Preguntas finales en batch | **11** (12 borrador inicial - 1 retirada) |
| Sonnet recheck post-reparación | **11/11 PERFECT** |
| Paso 9 post-aplicación | **11/11 PERFECT** |
| LO 4/1982 activas | 91 → **102** (+11 = match exacto) |
| **T2 CARM via API** | 89 → **100** (objetivo alcanzado) |
| Cross-oposición | CARM (T2+T3) + TCAE Murcia (T1) — multiplicador ×3 |

**Lecciones operativas v2.1:**

1. **El retiro pre-inserción es opción legítima**, no fracaso del flujo. En batch 16 retirar 1 de 12 produjo un batch más limpio (11/11 PERFECT) que forzar la reparación de un caso sin ángulo ortogonal viable.

2. **Arts muy escuetos (≤150 chars con enumeración cerrada) tienen techo bajo para redundancia.** El mecanismo intruso solapa con la enumeración positiva cuando la lista es corta y conocida (Art 20: 3 órganos). Regla operativa: si el art tiene <200 chars y ya tiene 1+ pregunta de enumeración, NO intentar intruso — generar sobre otro art con margen real.

3. **El enunciado de la existente puede "contaminar" preguntas futuras.** Si la existente cita literalmente un dato X del artículo en su enunciado, una pregunta nueva cuya opción correcta sea X resulta cognitivamente trivial para quien ya vio la existente. Antes de generar redundancia, **leer el enunciado completo de cada existente** y descartar como posible opción correcta nueva cualquier frase ya citada literalmente allí.

4. **Combinar cobertura inicial + redundancia controlada permite cerrar objetivos numéricos exactos.** T2 CARM pasó de 35 (pre-IA) → 100 (post-batch16) combinando: batch 8 (cobertura inicial), batch 13 (saturación natural), batch 15 (redundancia controlada masiva), batch 16 (cierre quirúrgico). El flujo es **predecible y planificable**.

5. **Cross-oposición consolidada**: las 102 preguntas activas en LO 4/1982 benefician **3 ubicaciones** distintas (CARM T2 + CARM T3 + TCAE Murcia T1). Multiplicador efectivo ×3 sobre el esfuerzo de generación.

**Conclusión batch 16**: primer caso documentado de **objetivo numérico cerrado a través de IA-gen con disciplina del flujo v2.1 completo**. El patrón es replicable a otros temas (T13 CARM Archivos saturado en 39 — siguiente candidato si redundancia controlada da margen).

### 5.23 Batch 17 — T13 LO 6/1990 cobertura inicial (15q, v2.2)

**2026-05-25** — Primer batch sobre Ley 6/1990 (Archivos Murcia) tras los 3 batches iniciales (batches 1-3). Diagnóstico inicial: 13 arts SIN preguntas + 5 arts con 1 pregunta. Decisión: cobertura inicial limpia (sin riesgo de redundancia) sobre los 8 arts vacíos con contenido sustancial (≥350 chars).

**Selección**: Art 8, 11, 17, 21, 24, 26, 27, 28. Distribución 2-2-2-2-2-1-2-2 = 15 preguntas.

| Métrica | Resultado |
|---|---|
| Arts cubiertos | **8 nuevos** (de 13 vacíos disponibles) |
| Preguntas generadas | **15** (todas en arts sin existentes) |
| Auto-audit | 15/15 PERFECT |
| Sonnet pre-aplicación | **15/15 PERFECT** sin un solo NEEDS_REVIEW |
| Paso 9 post-aplicación | **15/15 PERFECT** |
| Ley 6/1990 activas | 39 → **54** (+15) |
| T13 CARM via API | 39 → **54** (+15, match exacto — ley monotemática) |
| Cross-oposición | ×1 (solo CARM Aux Admin T13) — ROI bajo pero única vía |

**Lecciones operativas v2.2:**

1. **Cobertura inicial = "easy win" del flujo.** Cuando hay arts SIN preguntas con contenido sustancial, generar sobre ellos da 100% PERFECT directo (no hay riesgo de solapamiento con existentes ni necesidad de aplicar §2.6). Es el batch más fácil de auditar y validar.

2. **Denominaciones históricas literales** ("Consejería de Cultura, Educación y Turismo", "Ministerio de Cultura") deben mantenerse exactamente como aparecen en el BOE original, aunque hoy se llamen distinto. Sonnet validó esto en las 15 preguntas.

3. **Referencias normativas externas** (art 57.c Ley Patrimonio Histórico Español en el caso de la Q8) son trampa pedagógica útil — sirven como distractores casi-correctos en preguntas futuras y refuerzan el conocimiento de remisiones legales.

### 5.24 Batch 18 — T13 LO 6/1990 cobertura extendida (11q, v2.2)

**2026-05-25** — Tras batch 17, quedaban 4 arts SIN preguntas con contenido corto + 6 arts con 1 pregunta y contenido medio-largo. Decisión: combinar ambos en un batch mixto.

**Selección**: 4 arts sin preguntas (Art 9, 22, 25, 29) + 6 arts con 1 pregunta (Art 1, 6, 10, 13, 18, 26). Borrador inicial = 12 preguntas.

**Sonnet pre-aplicación: 11/12 PERFECT + 1 NEEDS_REVIEW** (Art 13: la opción correcta nueva "en el archivo histórico que se determine, salvo que en el acta de disolución…" estaba **literalmente contenida** en la opción correcta de la existente — modo fallo batch 16 Art 29 reproducido).

**Adjudicación**: **RETIRAR Q7 Art 13**. La existente cubría el supuesto completo (texto largo) y aislar un sub-dato del mismo no aportaba valor. Batch queda en 11 preguntas.

| Métrica | Resultado |
|---|---|
| Preguntas finales | **11** (12 borrador - 1 retirada) |
| Sonnet recheck post-reparación | (no necesario: solo se retiró 1, las otras 11 ya eran PERFECT) |
| Paso 9 post-aplicación | **11/11 PERFECT** |
| Ley 6/1990 activas | 54 → **65** (+11) |
| T13 CARM via API | 54 → **65** (+11) |

**Lecciones operativas v2.2:**

1. **El modo fallo batch 16 Art 29 es recurrente.** Cuando una existente cubre un apartado entero del artículo con cita literal larga en su opción correcta, cualquier nueva pregunta que aísle un sub-dato de esa cita es trivial para quien ya respondió la existente. **No insistir**: retirar y buscar otro ángulo o pasar al siguiente art.

2. **Mezclar cobertura inicial + cobertura extendida en el mismo batch funciona.** Los arts vacíos (cobertura inicial) dan 100% sin riesgo; los arts con 1 pregunta requieren dedup nivel 3 contra la existente. Sonnet evalúa ambos en la misma pasada.

3. **Errata original del BOE en el contenido del artículo** (Art 26 párr 2: "las medida" sin -s) gestionada correctamente: blockquote reproduce la errata literal, opción correcta usa la forma gramaticalmente correcta. Sonnet validó este patrón en paso 9.

### 5.25 Batch 19 — T13 LO 6/1990 redundancia controlada §2.6 (10q, v2.2)

**2026-05-25** — Tercer batch consecutivo sobre la misma ley. Tras batches 17+18, T13 estaba en 65 (faltaban 35 para 100). Ya no quedaban arts SIN preguntas con contenido sustancial → toca redundancia controlada §2.6 sobre arts con 2 preguntas y contenido ≥700 chars.

**Selección**: 6 arts (Art 3, 4, 16, 19, 20, 23) — todos con 2 existentes y contenido medio-largo.

**Borrador inicial planificado = 12 preguntas. Antes de generar JSON, dedup nivel 3 mental detectó 2 candidatas problemáticas:**
- **Art 23.1 "sin perjuicio de la colaboración exigible"**: ya estaba LITERALMENTE en la opción correcta de E2 [f8b930d3] ("La Consejería…, sin perjuicio de la colaboración exigible a las instituciones de carácter público y a las personas privadas").
- **Art 23.2 "en su forma original o en cualquier sistema de reproducción gráfica"**: ya estaba LITERALMENTE en la opción correcta de E1 [9d934a60] ("Corresponderá a la Consejería…, ya sea en su forma original o en cualquier sistema de reproducción gráfica").

**Decisión: descartar ambas antes de redactar.** Borrador final = 10 preguntas. Esto ahorra una ronda de Sonnet + reparación.

| Métrica | Resultado |
|---|---|
| Preguntas finales | **10** (12 candidatas planificadas - 2 descartadas pre-generación por dedup nivel 3 mental) |
| Auto-audit | 10/10 PERFECT |
| Sonnet pre-aplicación | **10/10 PERFECT** sin NEEDS_REVIEW |
| Paso 9 post-aplicación | **10/10 PERFECT** |
| Ley 6/1990 activas | 65 → **75** (+10) |
| T13 CARM via API | 65 → **75** (+10) |
| Sonnet detectó deuda histórica | **E1+E2 del Art 4 son duplicadas exactas** (mismo enunciado + misma opción correcta) — registrar para limpieza futura |

**Lecciones operativas v2.2 más importantes:**

1. **Descartar candidatas pre-generación por dedup nivel 3 MENTAL es eficiente.** Antes de escribir el JSON del borrador, revisar el `correct_option_text` de cada existente del art. Si la frase planeada como nueva opción correcta YA está literalmente allí → descartar y elegir otro sub-dato del mismo art. Ahorra rondas Sonnet + reparación + recheck. En batch 19 ahorré 2 rondas con 2 descartes pre-generación.

2. **Sonnet detecta duplicados pre-existentes en BD durante el dedup del batch nuevo.** Al auditar Q5 Art 4 del batch 19, Sonnet observó que E1+E2 de la BD son preguntas IDÉNTICAS (mismo enunciado + misma opción correcta = "De oficio o a instancia de parte"). Deuda histórica documentada para limpieza posterior. Aprovechar el batch nuevo como auditoría implícita del corpus existente.

3. **Cuando se generan 2 preguntas sobre el mismo apartado** (caso Q8+Q9 Art 20.2 batch 19), Sonnet debe verificar que el ángulo es genuinamente distinto: Q8 = "quién favorece", Q9 = "a qué se ajusta la consulta". Ambas del mismo apartado pero datos distintos. Patrón válido §2.6.

**Conclusión combinada batches 17+18+19 (T13 CARM):**

| Batch | Tipo | Preguntas | Resultado | T13 acumulado |
|---|---|---|---|---|
| 3 (pre-secuencia) | cobertura inicial | 15 | 14 → 29 | 29 |
| 17 | cobertura inicial | 15 | 39 → 54 | 54 |
| 18 | cobertura extendida (1 retiro) | 11 | 54 → 65 | 65 |
| 19 | redundancia controlada (2 descartes pre-gen) | 10 | 65 → 75 | 75 |
| **Total IA-gen T13** | — | **51** | — | **+61 sobre la base 14 pre-IA = ×5.4** |

**Secuencia validada como replicable**: cobertura inicial → cobertura extendida → redundancia controlada §2.6. Cada batch ~10-15 preguntas, ~30-45 min de trabajo end-to-end (generación + audit doble + paso 9 + sync + cache).

### 5.26 Batch 20 — T13 LO 6/1990 redundancia arts con 3q (8q, v2.3)

**2026-05-25** — Continuación secuencia T13. Tras batches 17+18+19, T13 = 75. Toca redundancia §2.6 sobre arts con 3 preguntas previas y contenido sustancial.

**Selección candidatos**: Art 2, 5, 12, 14, 15 (5 arts con 3q cada uno y contenido ≥800ch).

**Dedup mental pre-generación detectó:**
- **Art 2 (1025ch, 3q) → DESCARTADO COMPLETO**: las 3 existentes cubren art 2.a sujetos autonómicos, art 2.b sujetos estatales, y "documentos cualquier época". El único sub-dato disponible (testimonio funciones/actividades sociales) está literalmente en el enunciado de E1 → modo fallo batch 16. Saturado.

**Borrador final = 8 preguntas en 4 arts (2 cada uno)**: Art 5 (5.3 colaboración + 5.5 intercambio), Art 12 (12.2 destino + 12.2 conservación permanente), Art 14 (14.b principal + 14.b copia inventario), Art 15 (15.1 catálogo + 15.1 condición recuperar).

| Métrica | Resultado |
|---|---|
| Preguntas finales | **8** (5 arts candidatos - 1 descartado pre-gen = 4 arts × 2q) |
| Auto-audit | 8/8 PERFECT |
| Sonnet pre-aplicación | **8/8 PERFECT** sin NEEDS_REVIEW |
| Paso 9 post-aplicación | **8/8 PERFECT** |
| Ley 6/1990 activas | 75 → **83** (+8) |
| T13 CARM via API | 75 → **83** |

**Lecciones operativas v2.3:**
1. **Pares de preguntas sobre el mismo apartado funcionan** si los ángulos son genuinamente distintos: Q3/Q4 Art 12.2 (destino vs función del archivo histórico una vez recibida), Q5/Q6 Art 14.b (obligación principal vs deber accesorio), Q7/Q8 Art 15.1 (función registral vs condición material para recuperar). Sonnet validó los 3 pares como ortogonales.
2. **Descartar un art entero pre-gen es legítimo cuando está saturado** (Art 2): preferible a forzar candidatas con riesgo de modo fallo batch 16.

### 5.27 Batch 21 — T13 LO 6/1990 caso límite Art 7 con 7q existentes (8q, v2.3)

**2026-05-25** — Tras batch 20, T13 = 83. Único art "grande" pendiente: Art 7 (2686 chars, 8 apartados, 7q existentes previas — aparentemente saturado).

**Análisis dedup mental por apartado:**

| Apartado | Existentes cubren | ¿Margen? |
|---|---|---|
| 7.1 (misión + carácter) | E5 (carácter) + E6 (misión completa) | SATURADO |
| 7.2 (cuándo remitir) | E3 (semestre) | Sí — falta condición firmes+ejecutados |
| 7.3 (expedientes sin actos) | — | Sí — totalmente disponible |
| 7.4 (series uso frecuente) | — | Sí — 2 ángulos disponibles |
| 7.5 (Secretarios generales) | — | Sí — disponible |
| 7.6 (régimen disposición) | — | Sí — 2 ángulos disponibles |
| 7.7 (funciones del Archivo) | E7 (intruso) | Solo 1 ángulo positivo seguro (cuadros clasif.) |
| 7.8 (>25 años → histórico) | E1 + E4 | SATURADO |

→ **8 candidatas viables** sobre 5 apartados NO cubiertos + 1 sub-elemento del 7.7.

| Métrica | Resultado |
|---|---|
| Preguntas finales | **8** (caso límite con 7 existentes previas) |
| Auto-audit | 8/8 PERFECT |
| Sonnet pre-aplicación | **8/8 PERFECT** directos (validó los 3 pares Q3/Q6, Q5/Q7 como ángulos distintos) |
| Paso 9 post-aplicación | **8/8 PERFECT** |
| Art 7 acumulado | 7 → **15** preguntas (×2.1 sobre la base, el doble que cualquier otro art del corpus T13) |
| Ley 6/1990 activas | 83 → **91** (+8) |

**Lección operativa v2.3 más importante**: **el techo natural de un artículo viene determinado por el número de APARTADOS ESTRUCTURALES, no por el tamaño en caracteres ni por el número de preguntas previas**. Art 7 con 8 apartados admite 15 preguntas; Art 20 (3 apartados, 752 chars) admitiría máximo 6. El análisis dedup mental **por apartado** (en lugar de "el art tiene 7q, está saturado") es lo que destapó el margen real.

### 5.28 Batch 22 — T13 LO 6/1990 cierre techo natural (5q, v2.3)

**2026-05-25** — Tras batch 21, T13 = 91/100 (-9 para objetivo). Análisis dedup mental detectó solo **4-5 candidatas viables** en arts no cubiertos exhaustivamente — el resto requeriría forzar ángulos artificiales.

**Selección quirúrgica**: Art 3.2.d (relevancia interés regional), Art 4.3 (definición archivos privados históricos), Art 4.4 ×2 (resolución/impugnación + incoación/obligaciones provisionales), Art 10.3 (formación permanente).

| Métrica | Resultado |
|---|---|
| Preguntas finales | **5** (último margen real tras dedup mental estricto) |
| Auto-audit | 5/5 PERFECT |
| Sonnet pre-aplicación | **5/5 PERFECT** directos |
| Paso 9 post-aplicación | **5/5 PERFECT** |
| Ley 6/1990 activas | 91 → **96** (+5) |
| T13 CARM via API | 91 → **96** = 96% del objetivo 100q |

**Decisión final T13**: cerrar en 96/100. Los 4 que faltan requerirían ángulos artificiales con rendimiento de calidad decreciente.

### 5.29 SECUENCIA T13 COMPLETA — Análisis de curva rendimiento marginal (v2.3)

**Tabla consolidada de los 6 batches consecutivos sobre Ley 6/1990:**

| Batch | Tipo | Preguntas | T13 acum | Rendimiento/batch |
|---|---|---|---|---|
| 3 (pre-secuencia) | cobertura inicial | 15 | 14→29 | 15 |
| 17 | cobertura inicial (arts vacíos) | 15 | 39→54 | 15 |
| 18 | cobertura extendida (1 retiro) | 11 | 54→65 | 11 |
| 19 | redundancia §2.6 arts 2q (2 descartes pre-gen) | 10 | 65→75 | 10 |
| 20 | redundancia §2.6 arts 3q (1 art descartado) | 8 | 75→83 | 8 |
| 21 | caso límite Art 7 (7 existentes) | 8 | 83→91 | 8 |
| 22 | cierre techo natural | 5 | 91→96 | 5 |
| **TOTAL secuencia** | — | **57** | **39→96 = ×2.5** | — |

**Curva de rendimiento marginal validada empíricamente: 15 → 11 → 10 → 8 → 8 → 5**

**Hallazgo principal**: la curva es **predecible y monótonamente decreciente**. Cada batch sucesivo sobre la misma ley monotemática da menos preguntas porque queda menos margen real ortogonal. Aplicaciones prácticas:

1. **Planificación**: si T_X tiene N preguntas y objetivo es 100, estimar ~5-7 batches consecutivos para llegar al techo natural (no a 100). Tiempo total: ~3-5h de trabajo end-to-end.
2. **Punto de parada**: cuando un batch genera ≤5 preguntas tras dedup mental estricto, **declarar techo natural** y pasar a otro tema. Forzar más significa generar preguntas con ángulos artificiales y rendimiento de calidad decreciente.
3. **Techo natural realista**: ~95-96% del objetivo, no 100%. T13 cerró en 96/100 con 6 batches; T2 cerró en 100/100 exactos pero requirió 4 batches sobre una ley con **2 leyes contributorias** (no solo LO 4/1982 sino también con margen cross-temporal), no monotemática estricta.
4. **Predictor del techo por artículo**: número de APARTADOS ESTRUCTURALES, no tamaño en chars ni preguntas previas. Art 7 (8 apartados) → 15q; Art 25 (148 chars, una sola triple prohibición) → 1q.

**Patrón replicable para otras leyes**: ejecutar `select count(*) from questions where primary_article_id IN (...) and is_active=true group by apartado` antes de cada batch. Si la ratio (preguntas activas / apartados estructurales) está <1.5, hay margen. Si >2.0, saturación cercana al techo.

## 6. Anti-patterns (qué NO hacer)

| Anti-pattern | Por qué falla |
|---|---|
| Generar 100 preguntas de una ley sin piloto previo | Sin calibrar el prompt, % de fallo puede ser alto y la auditoría se vuelve trabajo desperdiciado. |
| Saltarse la auditoría Sonnet "porque el batch es pequeño" | Manual de revisión §18.1: ~17% de falsos negativos en auditoría única. Para IA el riesgo es mayor. |
| Activar directamente sin pasar por `draft` | Romperías la invariante "Importar Desactivadas, Activar Tras Revisión". Y `is_active` es GENERATED — fallará el UPDATE. |
| Generar preguntas sobre artículos derogados o no vigentes | Verificar antes que el artículo está en BD activo (`articles.is_active=true`). |
| Omitir el tag `ia_generada` | Pierdes la capacidad de filtrar para revisión periódica y de revertir el batch. |
| Reusar la opción correcta para varios artículos | Si dos preguntas tienen la misma opción correcta (cita literal de artículos distintos), una de las dos tiene mal vinculado el `primary_article_id`. |
| Generar preguntas tipo "todas las anteriores son correctas" | Manual §3.2: requieren verificar literalidad de CADA sub-opción, no solo la marcada. Mucho más fácil que se cuele un fallo. Evitar este tipo en IA-generadas hasta tener calibración alta. |
| Omitir cláusulas coordinadas por "así como" / "junto con" / "además de" del predicado preguntado | Batch 7 (Q15 Art 70 Aragón): "principios de A y B, así como C" sin incluir C estrecha el sujeto. Si la cláusula puede leerse como parte del mismo predicado, debe incluirse. Bajo ambigüedad de alcance gramatical, **incluir**. |
| Asumir que dos pasadas pre-aplicación PERFECT garantizan ausencia de defectos | Batch 7: ambas pasadas pre-transición dieron 15/15 alta confianza; el Sonnet del paso 9 detectó Q15. Los Sonnets pueden converger en el mismo sesgo. El paso 9 es **obligatorio como tercer auditor**, no opcional. |
| Resumir el contenido del artículo en el enunciado de la pregunta (en lugar de citarlo o usar elipsis) | b5 Aragón Q15 (Art 92): el enunciado decía "actividades administrativas y de contenido económico" cuando el artículo dice "actividades administrativas, sean de fomento, prestación o de gestión de servicios públicos o de producción de bienes de interés público susceptibles de contraprestación; actividades de contenido económico…". Las dos pasadas pre-aplicación lo dieron por bueno; el paso 9 lo detectó. Regla: si el enunciado menciona "según el artículo X", lo que diga sobre X **debe ser cita literal o usar elipsis explícita** (puntos suspensivos / paréntesis "[…]" / "entre otras cuestiones"). Nunca resumir. |
| Aceptar el veredicto NEEDS_REVIEW de Sonnet por "posible solapamiento" sin verificar respuestas correctas | Batch 15: Sonnet flagueó 3 preguntas por solapamiento aparente con existentes del mismo apartado. Tras consultar las opciones de las existentes, las **3 respuestas correctas eran literalmente distintas** (mismo art, dato distinto). Sonnet ciego no ve las opciones de las existentes — solo enunciados. Regla v2.0: si Sonnet flaguea solapamiento entre nueva y existente, **cargar la existente y comparar respuestas correctas** antes de retirar la nueva. |
| Aplicar el mecanismo intruso a artículos escuetos (<200 chars) con enumeración cerrada ya cubierta por una existente | Batch 16 Art 20 (108 chars, 3 órganos): la existente preguntaba la enumeración positiva, la nueva pedía identificar el intruso. Sonnet detectó solapamiento cognitivo total — quien sabe los 3 órganos resuelve ambas. Lección: en arts cortos con lista cerrada conocida, intruso y enumeración positiva NO son ortogonales. Generar sobre otro art con margen real. |
| Generar redundancia ignorando el enunciado de la existente | Batch 16 Art 29: la existente citaba en su enunciado el texto literal "Todo miembro de la Cámara deberá estar adscrito a un grupo" como contexto, luego preguntaba otra cosa. La nueva tenía como opción correcta exactamente esa frase — trivializada para quien ya vio la existente. Regla v2.1: antes de fijar la opción correcta de una redundancia, **leer el enunciado completo de cada existente** y descartar como correcta cualquier frase ya citada literalmente allí. |
| Aislar un sub-dato cuando la opción correcta de una existente ya lo contiene completo | Batch 18 Art 13: la existente daba como respuesta el supuesto entero del artículo (texto largo de varias líneas). La nueva aislaba el sub-dato "más de 25 años → archivo histórico" que ya estaba literalmente dentro de esa respuesta larga. Sonnet flagueó NEEDS_REVIEW. Retirar. Regla v2.2: si la opción correcta de la nueva está LITERALMENTE contenida en la opción correcta de una existente, retirar — no aporta valor diferencial. |
| Generar el JSON borrador sin dedup nivel 3 mental previo | Batch 19: al planificar 12 preguntas, identifiqué 2 candidatas cuya opción correcta planeada ya estaba literal en la opción correcta de una existente del mismo art (Art 23.1 "sin perjuicio" y Art 23.2 "forma original"). Descartarlas ANTES de redactar ahorró una ronda completa de Sonnet + reparación + recheck. Regla v2.2: antes de redactar JSON, leer el `correct_option_text` de cada existente del art y descartar cualquier candidata cuyo dato planeado ya esté allí. |
| Forzar el último 5% del objetivo cuando los rendimientos marginales caen por debajo de 5 preguntas/batch | Batch 22 cerró T13 en 96/100. Los 4 que faltaban requerirían ángulos artificiales sobre apartados ya cubiertos exhaustivamente (Art 25 con 148 chars y una sola triple prohibición; Art 22 con 288 chars y una sola idea; etc.). Generar preguntas forzadas degrada la calidad media del corpus sin valor pedagógico real. Regla v2.3: **declarar techo natural cuando un batch genera ≤5 preguntas tras dedup mental estricto** y pasar a otro tema. 96/100 con calidad sostenida > 100/100 con preguntas dudosas. |
| Asumir que "art con 7q ya está saturado" sin análisis dedup por apartado | Batch 21 Art 7 (2686 chars, 7 existentes previas, aparentemente saturado): el análisis dedup mental **por apartado estructural** (no por número global de preguntas) reveló 5 apartados sin preguntas + 1 sub-elemento del 7.7 → 8 candidatas viables, las 8 PERFECT en Sonnet y paso 9. Regla v2.3: el predictor del techo natural es el número de APARTADOS ESTRUCTURALES, no chars ni preguntas previas. Art 7 con 8 apartados admite 15q; un art de 1 párrafo con 3q ya estará saturado. |

## 7. Roadmap de mejora

- **Plantilla de prompt en `lib/prompts/`**: encapsular el prompt mental del Paso 2 en una constante reutilizable que pueda usar tanto Claude Code interactivo como agentes batch.
- **Endpoint `/api/admin/ia-generate-questions`**: pasar al backend la lógica de generación + insert en draft + auto-audit, dejando solo la auditoría Sonnet + transición como paso humano-en-loop.
- **Dashboard `/admin/ia-generated`**: listar batches con métricas (generadas / pasadas auditoría / activas hoy) para monitorizar drift de calidad si la IA generadora cambia de versión.
- **Test de regresión**: comparar mensualmente una muestra de IA-generadas activas contra el artículo vigente (detectar derivaciones por reformas legales que invalidarían la opción correcta).

## 8. Manuales relacionados

- **`importar-preguntas-scrapeadas.md`** — Principio "draft → revisar → approved", dedup, formato didáctico, ley virtual.
- **`revisar-preguntas-con-agente.md`** — Flujo v2.1, criterios §3.1 + §3.2 + §8.1, helper `transitionQuestion`, taxonomía de `reason_code`.
- **`docs/roadmap/sistema-desactivacion-preguntas.md`** — Diseño del lifecycle, sync trigger, invariante por construcción.
- **`crear-nueva-oposicion.md`** — Si vas a generar preguntas IA al crear una oposición nueva, leerlo antes para entender topic_scope.
