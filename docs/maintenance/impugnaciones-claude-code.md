# Manual: Resolver Impugnaciones con Claude Code

## Resumen

Este manual documenta cómo resolver impugnaciones de preguntas usando Claude Code como agente. Es más rápido que el proceso manual y permite verificar artículos directamente en la base de datos.

## 1. Ver Impugnaciones Pendientes

```
mira a ver si hay impugnaciones abiertas
```

Claude ejecutará:
```javascript
supabase
  .from('question_disputes')
  .select('id, question_id, user_id, dispute_type, description, status, created_at')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

**Resultado:** Lista de impugnaciones con ID, tipo y descripción.

## 2. Analizar una Impugnación

```
analiza la impugnación [número] - qué pregunta es y qué artículo tiene vinculado
```

Claude obtendrá:
- Texto completo de la pregunta
- Opciones A, B, C, D
- Respuesta marcada como correcta
- Explicación actual
- Artículos vinculados (si hay)

## 3. Buscar el Artículo Correcto

Si la explicación es incorrecta o falta el artículo:

```
busca en nuestra BD el artículo que habla de [tema de la pregunta]
```

Claude buscará en la tabla `articles` por contenido relevante.

**Ejemplo:**
```
busca el artículo 16 de la Ley 39/2015
```

## 4. Diagnosticar Por Qué Falló la Verificación

Antes de corregir, es importante entender **por qué** la pregunta tiene errores:

```
¿esta pregunta fue verificada? muéstrame su estado de verificación
```

Claude consultará:

### 4.1 Estado de la pregunta
```javascript
supabase
  .from('questions')
  .select('verified_at, verification_status, topic_review_status, topic_id')
  .eq('id', questionId);
```

### 4.2 Resultados de verificación AI
```javascript
supabase
  .from('ai_verification_results')
  .select('*')
  .eq('question_id', questionId);
```

### 4.3 Posibles causas de fallo

| Causa | Síntoma | Solución |
|-------|---------|----------|
| **Artículo incorrecto vinculado** | AI verificó contra artículo equivocado | Vincular artículo correcto |
| **Modelo AI poco preciso** | Usado Haiku en vez de Opus/Sonnet | Re-verificar con mejor modelo |
| **Sin topic_id** | Pregunta no asignada a ningún tema | Asignar al topic correcto |
| **Sin artículo vinculado** | `question_articles` vacío | Buscar y vincular artículo |
| **Verificación no ejecutada** | `verified_at: null` | Ejecutar verificación |
| **AI dio conclusión errónea** | `answer_ok: false` pero respuesta es correcta | Corregir manualmente |

### 4.4 Ejemplo de diagnóstico real

```
=== RESULTADO AI ===
Article ID: b7186672...        ← Artículo INCORRECTO (prórrogas)
Answer OK: false               ← AI dijo que D era incorrecta
Explanation OK: false          ← Detectó explicación errónea
Model: claude-3-haiku          ← Modelo pequeño, menos preciso

Análisis: "según el artículo, los documentos presentados en forma
diferente se tendrán por presentados..." ← INCORRECTO
```

**Diagnóstico:** El AI verificó contra el artículo equivocado (6.6 prórrogas) en vez del correcto (16.8 registros), y además usó Haiku que es menos preciso para verificación legal.

**Acción:** Documentar este caso para mejorar el sistema de verificación:
- Asegurar que las preguntas tengan el artículo correcto ANTES de verificar
- Usar modelos más capaces (Sonnet/Opus) para verificación legal
- Revisar preguntas sin `topic_id` ya que pueden tener datos incompletos

---

## 5. Corregir la Pregunta

Una vez identificado el problema:

```
corrige la pregunta pero no cierres la impugnación
```

Claude actualizará:

### 4.1 Explicación (tabla `questions`)
```javascript
supabase
  .from('questions')
  .update({ explanation: nuevaExplicacion })
  .eq('id', questionId);
```

### 4.2 Vincular artículo (tabla `question_articles`)
```javascript
supabase
  .from('question_articles')
  .insert({ question_id: questionId, article_id: articleId });
```

### 4.3 Actualizar verificación AI (tabla `ai_verification_results`)
```javascript
supabase
  .from('ai_verification_results')
  .update({
    article_id: correctArticleId,
    article_ok: true,
    answer_ok: true,
    explanation_ok: true,
    confidence: 'alta',
    ai_provider: 'claude_code',
    ai_model: 'claude-opus-4-5',
    verified_at: new Date().toISOString(),
    explanation: 'Verificación corregida...',
    article_quote: 'Cita del artículo...'
  })
  .eq('question_id', questionId);
```

## 6. Cerrar la Impugnación

Antes de cerrar, pedir el mensaje personalizado:

```
cierra la impugnación pero antes dime qué le vas a poner al usuario
```

**Formato del mensaje:**
```
Hola [Nombre],

[Confirmación del problema reportado]

[Explicación de la corrección aplicada]

Gracias por el reporte. Mucho ánimo con la oposición!
```

Una vez aprobado:

```javascript
supabase
  .from('question_disputes')
  .update({
    status: 'resolved',
    admin_response: mensaje,
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

## 7. Tablas Involucradas

| Tabla | Uso |
|-------|-----|
| `question_disputes` | Impugnaciones de usuarios |
| `questions` | Preguntas y explicaciones |
| `question_articles` | Relación pregunta-artículo (tabla de unión) |
| `articles` | Artículos de leyes |
| `ai_verification_results` | Resultados de verificación AI |
| `user_profiles` / `auth.users` | Datos del usuario para personalizar mensaje |

### 7.1 Dos formas de vincular artículos

Las preguntas pueden tener artículos vinculados de **dos formas**:

| Campo | Ubicación | Uso |
|-------|-----------|-----|
| `primary_article_id` | Columna en `questions` | Artículo principal (directo) |
| `question_articles` | Tabla de unión | Artículos adicionales (múltiples) |

**Importante:** Al investigar una pregunta, verificar AMBOS:

```javascript
// 1. Artículo principal
const { data: q } = await supabase
  .from('questions')
  .select('primary_article_id')
  .eq('id', questionId);

// 2. Artículos adicionales
const { data: qa } = await supabase
  .from('question_articles')
  .select('article_id')
  .eq('question_id', questionId);
```

Si `primary_article_id` apunta al artículo incorrecto, corregirlo:

```javascript
await supabase
  .from('questions')
  .update({ primary_article_id: correctArticleId })
  .eq('id', questionId);
```

## 8. Columnas de `question_disputes`

| Columna | Descripción |
|---------|-------------|
| `id` | UUID de la impugnación |
| `question_id` | UUID de la pregunta |
| `user_id` | UUID del usuario |
| `dispute_type` | Tipo: `otro`, `no_literal`, `respuesta_incorrecta`, etc. |
| `description` | Descripción del usuario |
| `status` | `pending` / `resolved` / `rejected` |
| `admin_response` | Respuesta al usuario |
| `resolved_at` | Fecha de resolución |

## 9. Flujo Completo

```
1. "mira si hay impugnaciones abiertas"
   ↓
2. "analiza la impugnación 1"
   ↓
3. "¿fue verificada? ¿por qué falló?"  ← DIAGNÓSTICO
   ↓
4. "busca el artículo correcto en nuestra BD"
   ↓
5. "corrige la pregunta pero no cierres la impugnación"
   ↓
6. "actualiza el registro AI"
   ↓
7. "cierra la impugnación, dime antes qué mensaje le pondrás"
   ↓
8. Aprobar mensaje → Claude cierra la impugnación
```

## 10. Ejemplo Real

**Impugnación:** "La explicación no se corresponde con la pregunta"

**Diagnóstico realizado:**
- `verified_at`: null (nunca verificada correctamente)
- `topic_id`: null (sin asignar a tema)
- AI verification existía pero con artículo incorrecto
- Modelo usado: Haiku (poco preciso para legal)
- AI concluyó erróneamente que respuesta C era correcta

**Problema encontrado:**
- Pregunta sobre Art. 16.8 (documentos en forma diferente)
- Explicación hablaba de Art. 6.6 (prórrogas de poderes)
- Artículo vinculado era incorrecto
- AI verificó contra artículo equivocado → conclusiones erróneas

**Correcciones:**
1. Nueva explicación basada en Art. 16.8
2. Vinculado artículo 16 de Ley 39/2015
3. Actualizado `ai_verification_results`
4. Cerrada con mensaje personalizado

**Mensaje enviado:**
```
Hola Nila,

Efectivamente, la explicación no correspondía con la pregunta.
Hablaba de "prórrogas de poderes con validez de 5 años" (Art. 6.6)
cuando la pregunta trata sobre documentos presentados en forma
diferente a su régimen especial.

Se ha corregido la explicación con el artículo correcto
(Art. 16.8 Ley 39/2015).

Gracias por el reporte. Mucho ánimo con la oposición!
```

## 11. Obtener Nombre del Usuario

Para personalizar el mensaje:

```javascript
const { data: { user } } = await supabase.auth.admin.getUserById(userId);
const nombre = user.user_metadata?.name || user.user_metadata?.full_name || 'Usuario';
```

**Nota:** Requiere `SUPABASE_SERVICE_ROLE_KEY` para acceder a `auth.admin`.

## 12. Consejos

- **Siempre verificar** el artículo correcto en nuestra BD antes de corregir
- **No cerrar** la impugnación hasta aprobar el mensaje
- **Personalizar** el mensaje con el nombre del usuario
- **Actualizar** `ai_verification_results` para que la verificación quede correcta
- Si la pregunta **no tiene topic_id**, considerar asignarla al tema correcto
