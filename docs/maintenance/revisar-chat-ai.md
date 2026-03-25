# Revisar Conversaciones del Chat IA

Manual para revisar conversaciones del chat IA y encontrar problemas/mejoras en el sistema.

## Objetivo

Revisar sistemáticamente las conversaciones de los usuarios con el chat IA para:
- Detectar respuestas incorrectas o inventadas
- Encontrar patrones de preguntas que el sistema no maneja bien
- Identificar domains que deberían capturar ciertos mensajes pero no lo hacen
- Mejorar los system prompts basándose en conversaciones reales
- Marcar conversaciones revisadas para no repetir trabajo

## Tabla: ai_chat_logs

Cada fila es un mensaje individual. Los campos relevantes para revisión:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID único del mensaje |
| `user_id` | uuid | Usuario (null = anónimo) |
| `message` | text | Mensaje del usuario |
| `full_response` | text | Respuesta completa del sistema |
| `suggestion_used` | text | Sugerencia usada (explicar_respuesta, explicar_psico, como_voy, etc.) |
| `question_context_id` | uuid | ID de la pregunta si hay contexto |
| `question_context_law` | text | Ley asociada si hay contexto |
| `user_oposicion` | text | Oposición del usuario |
| `feedback` | text | positive/negative (dado por el usuario) |
| `had_discrepancy` | boolean | Si se detectó discrepancia con la BD |
| `had_error` | boolean | Si hubo error |
| `reviewed` | boolean | Si ya fue revisado (campo legacy) |
| `reviewed_at` | timestamptz | Fecha de revisión |
| `review_notes` | text | Notas de la revisión |

## Agrupación en "conversaciones"

No hay tabla de conversaciones. Los mensajes se agrupan por:
- **Mismo `user_id`** (o anónimo)
- **Proximidad temporal**: mensajes del mismo usuario con <10 min de diferencia = misma conversación

## Tipos de mensajes

1. **Explicaciones automáticas** (`suggestion_used = 'explicar_respuesta'` o `'explicar_psico'`):
   - Se generan al pulsar "Explícame" en un test
   - Son el grueso del tráfico
   - Revisar si la explicación es correcta respecto al artículo vinculado

2. **Chat libre** (`suggestion_used IS NULL`):
   - El usuario escribe lo que quiere
   - Son los más interesantes para detectar fallos del sistema
   - Aquí es donde se detectan problemas de routing entre domains

3. **Estadísticas** (`suggestion_used = 'como_voy'`):
   - Resumen de progreso del usuario

## Prioridad de revisión

Revisar primero (más probable que tengan problemas):

1. **Feedback negativo** (`feedback = 'negative'`)
2. **Discrepancias** (`had_discrepancy = true`)
3. **Chat libre sin contexto de pregunta** (pueden revelar fallos de routing)
4. **Conversaciones con seguimiento** (usuario envía 2+ mensajes seguidos = posible insatisfacción)
5. **Explicaciones de preguntas** (revisar calidad, último)

## Consultas útiles

### Encontrar conversaciones prioritarias

```sql
-- Mensajes con feedback negativo (no revisados)
SELECT id, user_id, message, full_response, created_at, feedback
FROM ai_chat_logs
WHERE feedback = 'negative'
  AND reviewed_at IS NULL
ORDER BY created_at DESC;

-- Mensajes con discrepancia (no revisados)
SELECT id, user_id, message, full_response, created_at, had_discrepancy
FROM ai_chat_logs
WHERE had_discrepancy = true
  AND reviewed_at IS NULL
ORDER BY created_at DESC;

-- Chat libre (no explicaciones automáticas, no revisados)
SELECT id, user_id, message, full_response, created_at, feedback
FROM ai_chat_logs
WHERE suggestion_used IS NULL
  AND message NOT LIKE 'Explícame%'
  AND reviewed_at IS NULL
ORDER BY created_at DESC;
```

### Ver conversación completa de un usuario en una fecha

```sql
SELECT id, message, full_response, suggestion_used, feedback, created_at
FROM ai_chat_logs
WHERE user_id = 'UUID_AQUI'
  AND created_at::date = '2026-03-08'
ORDER BY created_at;
```

### Marcar como revisado

```sql
UPDATE ai_chat_logs
SET reviewed_at = NOW(),
    review_notes = 'Respuesta correcta, routing OK'
WHERE id = 'UUID_DEL_MENSAJE';
```

### Marcar conversación entera como revisada

```sql
UPDATE ai_chat_logs
SET reviewed_at = NOW(),
    review_notes = 'Conv revisada: [notas aquí]'
WHERE user_id = 'UUID_USER'
  AND created_at BETWEEN '2026-03-08 07:50:00+00' AND '2026-03-08 08:00:00+00';
```

## Tabla: ai_chat_traces

Cada mensaje de chat genera traces que registran todo el flujo interno. Son la clave para entender **por qué** el sistema respondió como respondió.

Los traces se vinculan al log mediante `log_id` (= `ai_chat_logs.id`).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | ID del trace |
| `log_id` | uuid | FK al mensaje en ai_chat_logs |
| `trace_type` | text | Tipo: `routing`, `domain`, `db_query`, `llm_call` |
| `duration_ms` | int | Duración en ms |
| `input_data` | jsonb | Datos de entrada (varía por tipo) |
| `output_data` | jsonb | Datos de salida (varía por tipo) |
| `success` | boolean | Si completó sin error |
| `error_message` | text | Mensaje de error si falló |
| `sequence_number` | int | Orden del trace (1, 2, 3...) |

### Tipos de trace y qué contienen

**1. `routing`** - Qué domain capturó el mensaje
- `input_data.evaluatedDomains[]`: Lista de domains evaluados con `canHandle` y `evalTimeMs`
- `output_data.selectedDomain`: Domain que capturó el mensaje (ej: "search", "temario", "knowledge-base")
- Aquí se ve si el routing fue correcto o si otro domain debería haber capturado

**2. `domain`** - Resumen del domain que procesó
- `input_data.domain`: Nombre del domain
- `output_data.hasSources`: Si encontró artículos fuente
- `output_data.responseLength`: Longitud de la respuesta

**3. `db_query`** - Qué buscó en la base de datos
- `input_data.operation`: Tipo de operación (ej: "searchArticles")
- `input_data.contextLawName`: Ley detectada en el mensaje
- `input_data.effectiveMessage`: Mensaje procesado para búsqueda
- `output_data.articles[]`: Artículos encontrados (id, lawName, articleNumber, contentPreview)
- `output_data.searchMethod`: Método usado ("direct", "semantic", etc.)
- `output_data.articlesFound`: Cuántos artículos encontró
- Aquí se ve si encontró los artículos correctos o si la búsqueda falló

**4. `llm_call`** - Qué se envió al LLM y qué respondió
- `input_data.model`: Modelo usado (gpt-4o-mini para free, gpt-4o para premium)
- `input_data.systemPrompt`: System prompt completo
- `input_data.userPromptWithContext`: Mensaje del usuario + artículos encontrados como contexto
- `input_data.articlesInContext`: Cuántos artículos se pasaron
- `output_data.responseContent`: Respuesta generada
- `output_data.totalTokens`: Tokens consumidos
- **NOTA sobre `[TRUNCATED]`**: Los traces truncan strings largos a 2000 chars para no llenar la BD (`AITracer.ts` MAX_STRING_LENGTH=2000). Esto es **solo cosmético en los traces**, NO afecta al contenido real que recibe el LLM. Si ves `[TRUNCATED]` en `userPromptWithContext` de un trace, es el trace el que está cortado, no el prompt real. Los artículos se pasan siempre completos al LLM (`fullContent: true`).

### Consulta para obtener traces de un mensaje

```sql
SELECT sequence_number, trace_type, duration_ms, input_data, output_data, error_message
FROM ai_chat_traces
WHERE log_id = 'UUID_DEL_LOG'
ORDER BY sequence_number;
```

### Ejemplo con Supabase JS

```javascript
const { data: traces } = await supabase
  .from('ai_chat_traces')
  .select('*')
  .eq('log_id', logId)
  .order('sequence_number', { ascending: true });

for (const t of traces) {
  console.log(`#${t.sequence_number} [${t.trace_type}] ${t.duration_ms}ms`);
  console.log('INPUT:', JSON.stringify(t.input_data, null, 2));
  console.log('OUTPUT:', JSON.stringify(t.output_data, null, 2));
}
```

## Proceso de revisión con Claude Code

### Paso 1: Obtener mensajes prioritarios

```
Revisa las conversaciones del chat IA que tengan feedback negativo o discrepancias y no estén revisadas
```

### Paso 2: Analizar cada mensaje a fondo

Para cada mensaje, **obtener los traces** y analizar el flujo completo:

1. **Routing** (trace_type = `routing`):
   - ¿Qué domain capturó? ¿Era el correcto?
   - ¿Qué domains evaluaron `canHandle: false`? ¿Alguno debería haber capturado?
   - Si no, ¿qué patrón regex falta en el domain correcto?

2. **Búsqueda en BD** (trace_type = `db_query`):
   - ¿Detectó la ley correcta? (`contextLawName`)
   - ¿Encontró los artículos relevantes? (`articles[]`)
   - ¿El método de búsqueda fue adecuado? (`searchMethod`)
   - Si no encontró nada: ¿el artículo existe en la BD?

3. **Contexto al LLM** (trace_type = `llm_call`):
   - ¿El artículo se pasó completo o **truncado** (`[TRUNCATED]`)?
   - ¿El system prompt tiene las instrucciones adecuadas?
   - ¿El modelo era el adecuado? (gpt-4o-mini puede fallar en preguntas complejas)
   - ¿Se incluyó historial de conversación?

4. **Respuesta final**:
   - ¿Es correcta comparando con el artículo real de la BD?
   - ¿Inventa información que no está en el contexto proporcionado?
   - ¿Cita artículos/apartados correctos?
   - ¿Es útil y clara para un opositor?

### Paso 3: Clasificar el fallo

Después de analizar los traces, clasificar:

| Tipo de fallo | Dónde mirar | Ejemplo |
|---|---|---|
| **Routing incorrecto** | trace `routing` | Msg de temario cae en fallback |
| **Búsqueda fallida** | trace `db_query` | No encuentra artículo que sí existe |
| **Artículo truncado** | trace `llm_call` → `userPromptWithContext` | Art. largo cortado, LLM inventa |
| **LLM inventa** | trace `llm_call` → `responseContent` | Tiene el artículo pero lo interpreta mal |
| **System prompt débil** | trace `llm_call` → `systemPrompt` | No instruye a no inventar |
| **Sin contexto de pregunta** | trace `db_query` → `questionContext: null` | No se pasó el ID de pregunta |

### Paso 4: Documentar y corregir

- Si hay fallo de routing: ajustar regex en el domain correspondiente
- Si hay artículo truncado: investigar límite de caracteres en SearchDomain
- Si el LLM inventa: mejorar system prompt para que sea más cauto
- Si hay patrón recurrente: considerar crear nuevo domain o handler
- Anotar el problema en la sección "Problemas conocidos detectados" de este manual

### Principio: Soluciones escalables, no hardcodeadas

**IMPORTANTE**: Cada fix debe ser escalable. No añadir patrones hardcodeados para cada caso que falle. En su lugar, buscar cómo aprovechar los datos que ya existen en la BD.

**Ejemplo real**: Cuando "ley del gobierno" no se detectaba como Ley 50/1997:
- **MAL**: Añadir `{ pattern: /ley\s*del?\s*gobierno/i, slug: 'ley-50-1997' }` a un array de patrones. Cada ley nueva que falle requiere tocar código.
- **BIEN**: La tabla `laws` tiene un campo `name` con nombres descriptivos ("Ley 50/1997, de 27 de noviembre, del Gobierno"). Cargar ese campo en la cache y hacer keyword matching automático. Cualquier ley nueva en la BD se detecta sin tocar código.

**Regla general**:
1. Primero intentar resolver con datos de la BD (tablas `laws`, `topics`, `articles`, etc.)
2. Si la BD no tiene la info, considerar añadirla a la BD (no al código)
3. Solo hardcodear como último recurso para casos de desambiguación (ej: "transparencia" puede ser 2 leyes distintas)
4. Los patrones descriptivos mínimos (regex) son aceptables solo para abreviaturas que no están en la BD o para desambiguar entre dos leyes con el mismo keyword

### Paso 5: Marcar como revisado

Después de verificar y (opcionalmente) corregir, marcar los mensajes como revisados con notas detalladas de lo encontrado para no volver a analizarlos.

## Metodología: Revisión uno a uno con simulación

La forma más efectiva de mejorar la IA es revisar los chats **uno a uno**, analizando a fondo cada conversación y simulando el flujo para encontrar bugs accionables.

### Filosofía

- **No ir rápido**: revisar cada chat con calma, no marcar como revisado sin entender
- **Buscar mejoras accionables**: el objetivo no es triaje, es encontrar bugs que se puedan corregir en el código
- **Simular antes de arreglar**: reproducir el problema con las funciones reales antes de implementar el fix
- **Verificar después de arreglar**: simular de nuevo para confirmar que el fix funciona

### Flujo de trabajo

1. **Obtener el siguiente chat no revisado** (priorizar feedback negativo, discrepancias, chat libre)
2. **Leer el mensaje del usuario y la respuesta completa**
3. **Obtener los traces** para entender el flujo interno (routing → domain → db_query → llm_call)
4. **Identificar el problema**: ¿routing incorrecto? ¿ley no detectada? ¿LLM inventa? ¿artículo truncado?
5. **Simular el flujo** con las funciones reales del código (detectStatsQueryType, extractLawFromMessage, detectMentionedLaws, etc.)
6. **Implementar el fix** en el código
7. **Re-simular** para verificar que funciona correctamente (incluir casos positivos Y negativos)
8. **Marcar como revisado** con notas detalladas del problema y el fix aplicado

### Ejemplo de simulación

Para verificar cambios en el routing de stats vs search:

```typescript
// Simular con las funciones reales via tsx
import { extractLawFromMessage, loadLawsCache, detectStatsQueryType } from './lib/chat/domains/stats/StatsService';

await loadLawsCache();

// Simular la conversación paso a paso
const messages = [];
const msg = "Y de la LOPJ?";

const qt = detectStatsQueryType(msg);
const law = extractLawFromMessage(msg);
const isFollowUp = isStatsFollowUp(messages, msg);

console.log(`qt=${qt} law=${law} followUp=${isFollowUp}`);
// → Verificar que el domain correcto captura el mensaje
```

### Qué simular

- **Mensaje original del usuario** que causó el problema
- **Follow-ups** si la conversación tenía varios mensajes
- **Mensajes inventados similares** para verificar que no hay regresiones
- **Casos negativos**: mensajes que NO deberían activar el fix (evitar false positives)

## Problemas conocidos detectados

### 1. "EN QUÉ TEMARIO APARECE?" sin contexto
- **User**: b5523741 (2026-03-08)
- **Problema**: Primera pregunta fue "TEMA LOS BIENES..." (antes de TemarioDomain). La segunda "EN QUÉ TEMARIO APARECE?" cayó en fallback porque no tiene contexto suficiente.
- **Solución**: TemarioDomain ahora captura la primera pregunta. La segunda podría necesitar mejor manejo del historial.

### 2. CGPJ Vicepresidente (pregunta trampa)
- **User**: 2fc60bc8 (2026-03-08)
- **Problema**: El usuario preguntó por la mayoría para nombrar al vicepresidente del CGPJ. La IA respondió sin saber que el CGPJ NO tiene vicepresidente. El usuario corrigió y la IA aceptó.
- **Lección**: El sistema debería ser más cauto con preguntas que contienen premisas falsas.

### 3. LRBRL en Auxiliar Estado
- **User**: 2fc60bc8 (2026-03-08)
- **Problema**: Preguntó si la LRBRL entra en Auxiliar Estado. Feedback negativo. La respuesta no fue clara sobre si entra o no en el temario.
- **Solución**: TemarioDomain ahora podría manejar esto mejor al consultar los topics reales.

### 4. Art. 26 Ley 50/1997 - artículo truncado, LLM inventa
- **User**: anon (2026-03-03)
- **Problema**: 5 mensajes de ida y vuelta donde el usuario corregía al sistema. La IA no detectaba errores sutiles en las opciones de la pregunta.
- **Diagnóstico via traces**:
  - **Routing**: OK → SearchDomain capturó
  - **DB Query**: OK → Encontró Art. 26 correctamente (11.034 caracteres)
  - **LLM Call**: **FALLO** → El artículo se pasó **truncado** (`[TRUNCATED]`). Solo llegaron los apartados 1-2, pero la pregunta era sobre el apartado 3 (subapartados a-h de la Memoria). El LLM no tenía el texto real para comparar las opciones.
- **Causa raíz**: `formatArticlesForContext()` truncaba a 500 chars por defecto cuando `fullContent: false`. Artículos largos perdían los apartados relevantes.
- **Solución aplicada**: `fullContent: true` siempre en SearchDomain y VerificationService. Los artículos se pasan completos al LLM (el coste es negligible: incluso 5 artículos largos ~15K tokens, bien dentro de los 128K del modelo).

### 5. LECrim stats: ley no detectada + follow-ups mal enrutados
- **User**: anon (2026-03-14)
- **Problema doble**:
  1. "¿Qué artículos de la Ley de Enjuiciamiento Criminal son más preguntados?" → `extractLawFromMessage` no detectaba LECrim → `getExamStats(null)` → devolvía stats sin filtro (Windows 11, Excel)
  2. Follow-ups como "Y de la LOPJ?" no se reconocían como continuación de stats → SearchDomain los capturaba y generaba respuestas incorrectas via OpenAI
- **Causa raíz 1**: `extractLawFromMessage` solo tenía aliases hardcodeados, no consultaba la BD
- **Solución 1 (v1)**: Sistema de 3 capas: BD cache (slug→short_name) → lawMappingUtils (aliases) → patrones descriptivos (regex). Commit `367e8c50`
- **Solución 1 (v2 - escalable)**: `loadLawsCache()` ahora también carga el campo `name` de la tabla `laws` y extrae keywords descriptivos. `extractLawFromMessage` tiene un nuevo paso 5 que hace keyword matching automático contra los nombres de BD. Esto hace que "ley del gobierno" → Ley 50/1997, "subvenciones" → Ley 38/2003, "contratos del sector público" → Ley 9/2017, etc., sin código adicional. Se eliminaron los patrones hardcodeados que ahora cubre la BD (gobierno, subvenciones, procedimiento administrativo, etc.). Solo quedan patrones para abreviaturas no derivables (CE, EBEP, TFUE) y desambiguación (transparencia).
- **Causa raíz 2**: `StatsDomain.canHandle()` solo miraba `detectStatsQueryType(currentMessage)`, no el historial de conversación. `SearchDomain` (prioridad 3) capturaba antes que `StatsDomain` (prioridad 4) por detectar mención de ley
- **Solución 2**: `StatsDomain.canHandle()` ahora detecta follow-ups mirando si la última respuesta del assistant fue de stats + el mensaje actual menciona una ley. `SearchDomain.canHandle()` cede el control cuando el contexto previo era de stats. Verificado con simulación de 20 casos (4 escenarios).

### 6. ErrorDetector: falsos positivos en impugnaciones automáticas (2026-03-25)
- **Problema**: La IA creaba impugnaciones automáticas aunque su respuesta coincidía con la BD. Los patrones P5 (`contradice el/la artículo`) y P6 (`según el artículo...no es`) matcheaban frases de la IA al explicar por qué las opciones incorrectas son incorrectas (ej: "lo cual contradice el artículo 147").
- **Solución**: Eliminados P5 y P6 de `ErrorDetector.ts`. Los patrones restantes (P1-P4) detectan errores reales donde la IA usa explícitamente "POSIBLE ERROR" o "debería ser".

### 7. DynamicTest sin contexto para chat IA (2026-03-25)
- **User**: anon (2026-03-25)
- **Problema**: `DynamicTest.js` no llamaba a `setQuestionContext()`, así que el chat IA no tenía las opciones A/B/C/D. La IA respondía genéricamente "A: Si esta opción es..." sin saber qué eran. Afectaba al ~4.8% de solicitudes `explicar_respuesta` (36 de 746).
- **Solución**: Migrado `DynamicTest.js` → `DynamicTest.tsx` con `setQuestionContext` + warning en API si llega `explicar_respuesta` sin contexto.

## Resetear estadísticas tras auditoría

Las estadísticas del panel admin (`/admin/ai`) — positivos, negativos, satisfacción, tiempo de respuesta — se calculan **solo sobre logs no revisados** (`reviewed_at IS NULL`). Al marcar todos los logs como revisados tras una auditoría, las stats se resetean automáticamente.

### Cómo resetear

```javascript
// Marcar todos como revisados (resetea las stats del panel admin)
const { error } = await supabase
  .from('ai_chat_logs')
  .update({
    reviewed_at: new Date().toISOString(),
    review_notes: 'Auditoría completada YYYY-MM-DD: [resumen de hallazgos y fixes]'
  })
  .is('reviewed_at', null);
```

Esto hace que las stats del panel empiecen de cero para el siguiente ciclo de auditoría.
