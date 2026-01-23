# Manual - Resolución de Impugnaciones de Usuarios

## Proceso para Resolver Impugnaciones (question_disputes)

### PASO 1: Ver Impugnaciones Pendientes
```sql
SELECT 
    qd.id as dispute_id,
    qd.question_id,
    qd.user_id,
    qd.dispute_type,
    qd.description,
    qd.created_at,
    qd.is_read,
    -- Datos del usuario
    COALESCE(up.nickname, up.full_name, split_part(au.email, '@', 1), 'Usuario') as nombre_usuario,
    au.email as email_usuario,
    -- Datos de la pregunta
    q.question_text,
    'A) ' || q.option_a as opcion_a,
    'B) ' || q.option_b as opcion_b,
    'C) ' || q.option_c as opcion_c,
    'D) ' || q.option_d as opcion_d,
    q.correct_option,
    q.explanation
FROM question_disputes qd
JOIN questions q ON qd.question_id = q.id
LEFT JOIN auth.users au ON qd.user_id = au.id
LEFT JOIN user_profiles up ON qd.user_id = up.id
WHERE qd.status = 'pending'
ORDER BY qd.created_at DESC;
```

### PASO 2: Consultar los Artículos Relevantes ⭐ **OBLIGATORIO**

**NUNCA corrijas una pregunta sin verificar primero el contenido oficial del artículo.**

#### Consultar el artículo principal:
```sql
-- Ejemplo: Si la pregunta es sobre el Art. 33 CE
SELECT 
    a.id,
    a.article_number,
    a.title,
    a.content,
    l.short_name as ley,
    l.name as ley_completa
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE a.article_number = '33'
AND l.short_name = 'CE';
```

#### Consultar artículos relacionados si es necesario:
```sql
-- Ejemplo: Si la pregunta habla de recurso de amparo, consultar Art. 53 CE
SELECT 
    a.id,
    a.article_number,
    a.title,
    a.content
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE a.article_number = '53'
AND l.short_name = 'CE';
```

#### Consultar múltiples artículos de una ley:
```sql
-- Ejemplo: Si necesitas verificar varios artículos de la misma ley
SELECT 
    a.article_number,
    a.title,
    a.content
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE a.article_number IN ('14', '53', '161')
AND l.short_name = 'CE'
ORDER BY a.article_number::integer;
```

### PASO 3: Analizar la Impugnación
1. **Leer cuidadosamente** el comentario del usuario (`description`)
2. **Verificar** el contenido oficial del artículo en la base de datos
3. **Consultar artículos relacionados** si la pregunta hace referencia a otros
4. **Comparar** la pregunta/opciones con el texto oficial del BOE
5. **Decidir** si la impugnación es válida o no

### PASO 4: Aplicar Corrección (Si es necesaria)

#### A) Si hay que corregir la pregunta:
```sql
-- 1. Corregir la pregunta/opciones Y marcar como verificada
UPDATE questions
SET option_c = 'TEXTO CORREGIDO SEGÚN ARTÍCULO OFICIAL',
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'QUESTION_ID';

-- 2. Verificar el cambio
SELECT
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation,
    verified_at,
    verification_status
FROM questions
WHERE id = 'QUESTION_ID';
```

#### B) Si la pregunta estaba correcta (solo marcar como verificada):
```sql
UPDATE questions
SET verified_at = NOW(),
    verification_status = 'ok'
WHERE id = 'QUESTION_ID';
```

> **IMPORTANTE**: Siempre que revises una pregunta (corrijas o no), marca `verified_at` y `verification_status = 'ok'`. Esto indica que un humano ha verificado la pregunta.

### PASO 5: Cerrar Impugnación con Mensaje Motivador

#### A) Si la impugnación es VÁLIDA (usuario tenía razón):
```sql
UPDATE question_disputes
SET status = 'resolved',
    admin_response = '¡Muchísimas gracias [NOMBRE]! 🎯 Tenías toda la razón. Hemos corregido la pregunta:

✅ [DESCRIPCIÓN ESPECÍFICA DE LA CORRECCIÓN REALIZADA]
✅ [DETALLE DE CAMBIOS APLICADOS]

📖 **Fundamento legal**: [CITA EL ARTÍCULO OFICIAL QUE CONSULTASTE]
   [TEXTO RELEVANTE DEL ARTÍCULO]

✅ [RESULTADO FINAL]

Te animo a que sigas reportando cualquier error que encuentres, y también sugerencias de mejora de Vence.es! 📚

¡Mucho ánimo con tu preparación! 💪',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'DISPUTE_ID';
```

#### B) Si la impugnación NO es válida (pregunta estaba correcta):
```sql
UPDATE question_disputes
SET status = 'resolved',
    admin_response = '¡Hola [NOMBRE]! 👋 Gracias por reportar esta pregunta.

Tras revisar cuidadosamente tu consulta, confirmamos que la pregunta está correcta:

📋 [EXPLICACIÓN DETALLADA DE POR QUÉ ES CORRECTA]

📖 **Fundamento legal**: [CITA EL ARTÍCULO OFICIAL]
   [TEXTO RELEVANTE DEL ARTÍCULO QUE CONFIRMA LA CORRECCIÓN]

💡 [CONSEJO PARA RECORDAR O ENTENDER MEJOR]

Recuerda que si tienes dudas sobre cualquier tema, también puedes consultar nuestros artículos explicativos, y siempre puedes enviar sugerencias de mejora de Vence.es! 📚

¡Mucho ánimo con tu preparación! 💪',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'DISPUTE_ID';
```

## Estructura Real de la Tabla `question_disputes`

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Identificador único |
| `question_id` | uuid | YES | null | Pregunta impugnada |
| `user_id` | uuid | YES | null | Usuario que impugna |
| `dispute_type` | text | NO | null | Tipo de impugnación |
| `description` | text | NO | null | Descripción del problema |
| `status` | text | YES | 'pending' | Estado: pending/resolved |
| `admin_response` | text | YES | null | Respuesta del admin |
| `admin_user_id` | uuid | YES | null | Admin que resolvió |
| `created_at` | timestamp | YES | now() | Fecha de creación |
| `resolved_at` | timestamp | YES | null | Fecha de resolución |
| `updated_at` | timestamp | YES | now() | Última actualización |
| `is_read` | boolean | YES | false | Si fue leída por admin |
| `appeal_text` | text | YES | null | Texto de apelación |
| `appeal_submitted_at` | timestamp | YES | null | Fecha de apelación |

## Templates de Respuesta

### Template IMPUGNACIÓN VÁLIDA:
```
¡Muchísimas gracias [NOMBRE]! 🎯 Tenías toda la razón. Hemos corregido la pregunta:

✅ [Cambio específico 1]
✅ [Cambio específico 2] 

📖 **Fundamento legal**: [Artículo oficial consultado]
   [Texto relevante del artículo]

✅ [Resultado final claro]

Te animo a que sigas reportando cualquier error que encuentres, y también sugerencias de mejora de Vence.es! 📚

¡Mucho ánimo con tu preparación! 💪
```

### Template IMPUGNACIÓN NO VÁLIDA:
```
¡Hola [NOMBRE]! 👋 Gracias por reportar esta pregunta.

Tras revisar cuidadosamente tu consulta, confirmamos que la pregunta está correcta:

📋 [Explicación clara del por qué]

📖 **Fundamento legal**: [Artículo oficial]
   [Texto relevante del artículo]

💡 [Consejo útil para recordar]

Recuerda que si tienes dudas sobre cualquier tema, también puedes consultar nuestros artículos explicativos, y siempre puedes enviar sugerencias de mejora de Vence.es! 📚

¡Mucho ánimo con tu preparación! 💪
```

## Impugnaciones Auto-Detectadas por IA

Las impugnaciones con `dispute_type = 'ai_detected_error'` son generadas automáticamente por el chat de IA cuando detecta un posible error.

### Características:
- El usuario NO las creó manualmente
- La descripción contiene `[AUTO-DETECTADO POR IA]`
- Pueden ser falsos positivos (la IA se equivocó)

### Procedimiento:
1. Revisar si la pregunta realmente tiene un error
2. Si es **falso positivo** (pregunta correcta): cerrar SIN notificar al usuario
3. Si hay **error real**: corregir y cerrar normalmente

### Cerrar SIN notificar al usuario:

Al cerrar, usar `is_read: true` para que el usuario NO reciba notificación:

```sql
UPDATE question_disputes
SET
    status = 'resolved',
    admin_response = 'Revisado. La pregunta y respuesta son correctas.',
    resolved_at = NOW(),
    is_read = true  -- NO notifica al usuario
WHERE id = 'DISPUTE_ID';
```

### Con Supabase JS:
```javascript
await supabase
  .from('question_disputes')
  .update({
    status: 'resolved',
    admin_response: 'Revisado. La pregunta y respuesta son correctas.',
    resolved_at: new Date().toISOString(),
    is_read: true  // NO notifica al usuario
  })
  .eq('id', disputeId);
```

> **IMPORTANTE**: Solo usar `is_read: true` para impugnaciones auto-detectadas por IA que son falsos positivos. Las impugnaciones creadas por usuarios SIEMPRE deben notificarse (`is_read: false` o no incluir el campo).

---

## Ejemplo Real de Caso Resuelto

### Impugnación recibida:
- **Usuario**: Ismael Abdeselam Toledo (ismaelceuta@gmail.com)
- **Tipo**: otro
- **Descripción**: "Creo que está mal redactada la opción c"
- **Pregunta**: Art. 33 CE - Propiedad privada

### Verificación realizada:
```sql
-- 1. Consultar Art. 33 CE
SELECT article_number, title, content 
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE article_number = '33' AND l.short_name = 'CE';

-- 2. Consultar Art. 53 CE (recurso de amparo)
SELECT article_number, title, content 
FROM articles a
JOIN laws l ON a.law_id = l.id
WHERE article_number = '53' AND l.short_name = 'CE';
```

### Hallazgo:
- **Art. 53.2 CE**: Solo tienen amparo arts. 14, 15-29 (Sección 1ª) y 30.2
- **Art. 33 CE**: Está en Sección 2ª → **NO tiene amparo**
- **Opción C original**: "Tiene tutela mediante recurso de amparo..." ❌
- **Opción C corregida**: "NO tiene tutela mediante recurso de amparo..." ✅

### Corrección aplicada:
```sql
UPDATE questions
SET option_c = 'NO tiene tutela mediante recurso de amparo ante el Tribunal Constitucional.',
    updated_at = NOW()
WHERE id = '65313a59-63af-4cc9-b338-5835319a904d';
```

### Respuesta al usuario:
```sql
UPDATE question_disputes
SET status = 'resolved',
    admin_response = '¡Muchísimas gracias Ismael! 🎯 Tenías toda la razón...',
    resolved_at = NOW(),
    is_read = false
WHERE id = '52ec0bb9-6b0b-4b28-9536-e1a7d34b43b5';
```

## Verificar Cierre
```sql
SELECT 
    id,
    status,
    admin_response,
    resolved_at,
    is_read
FROM question_disputes 
WHERE id = 'DISPUTE_ID';
```

## Reglas Importantes
- **SIEMPRE consultar el artículo oficial** antes de corregir
- **SIEMPRE marcar como verificada** (`verified_at`, `verification_status = 'ok'`) cualquier pregunta que revises
- **SIEMPRE agradecer** al usuario por reportar
- **PERSONALIZAR** el mensaje con el nombre del usuario
- **SER ESPECÍFICO** sobre qué se corrigió o por qué está correcto
- **CITAR el artículo oficial** consultado como fundamento
- **MANTENER TONO POSITIVO** y motivador
- **INCLUIR EMOJIS** para hacer el mensaje más amigable
- **ANIMAR** a seguir colaborando y estudiando
- **NO DEFENDER ERRORES** - si está mal, reconocerlo y agradecer
- **VERIFICAR siempre** la corrección antes de cerrar la impugnación

## Campos de verificación en `questions`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `verified_at` | timestamptz | Fecha de última verificación (IA o humano) |
| `verification_status` | text | `'ok'` = correcta, `'problem'` = con errores, `NULL` = sin verificar |

> Las preguntas con `verified_at = NULL` aparecen como "pendientes de verificar" en el panel de admin.

---

# Reparar Preguntas (Verificación IA)

**Ubicación:** `/admin/verificar-articulos/[lawId]` → Tab "Reparar"

## ⚠️ DOS SISTEMAS DE VERIFICACIÓN

Existen **dos sistemas** de verificación IA con propósitos diferentes:

### Sistema 1: Verificar Artículos (Cambios BOE)
- **Panel:** `/admin/verificar-articulos/[lawId]`
- **Campo clave:** `ai_verification_results.is_correct`
- **Estados:** `true/false`
- **Propósito:** Detectar preguntas afectadas por **cambios en artículos del BOE**
- **Uso:** Cuando una ley se modifica, verificar si las preguntas siguen siendo válidas

### Sistema 2: Revisión de Temas (Verificación IA) ⭐ PRINCIPAL
- **Panel:** `/admin/revision-temas/[topicId]`
- **Campo clave:** `questions.topic_review_status`
- **Estados:** 12 estados (8 legales + 4 técnicos)
- **Variables:** `article_ok`, `answer_ok`, `explanation_ok`
- **Propósito:** Verificar calidad de preguntas con IA (respuesta, explicación, artículo vinculado)
- **Uso:** Revisión sistemática de preguntas por tema/oposición

---

## 🆕 Revisión de Temas: Consultar preguntas con problemas

### PASO 1: Ver preguntas con problemas (completo) ⭐

```sql
-- PREGUNTAS CON PROBLEMAS: pregunta + respuesta + explicación + artículo completo
SELECT
    -- Identificación
    q.id,
    q.topic_review_status,
    l.short_name as ley,

    -- LA PREGUNTA
    q.question_text,
    'A) ' || q.option_a as opcion_a,
    'B) ' || q.option_b as opcion_b,
    'C) ' || q.option_c as opcion_c,
    'D) ' || q.option_d as opcion_d,
    CASE q.correct_option
        WHEN 0 THEN 'A' WHEN 1 THEN 'B'
        WHEN 2 THEN 'C' WHEN 3 THEN 'D'
    END as respuesta_marcada,
    q.explanation as explicacion_actual,

    -- EL ARTÍCULO VINCULADO (para verificar manualmente contra BOE)
    'Art. ' || a.article_number || ' - ' || COALESCE(a.title, '') as articulo,
    a.content as contenido_articulo,

    -- LO QUE DICE LA IA
    av.article_ok as ia_articulo_ok,
    av.answer_ok as ia_respuesta_ok,
    av.explanation_ok as ia_explicacion_ok,
    av.correct_option_should_be as ia_respuesta_correcta,
    av.explanation_fix as ia_problema_explicacion,
    av.correct_article_suggestion as ia_articulo_sugerido

FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
LEFT JOIN ai_verification_results av ON q.id = av.question_id
WHERE q.topic_review_status IN (
    'bad_explanation', 'bad_answer', 'bad_answer_and_explanation',
    'wrong_article', 'wrong_article_bad_explanation',
    'wrong_article_bad_answer', 'all_wrong',
    'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation'
)
AND q.is_active = true
ORDER BY l.short_name, a.article_number;
```

**Esta consulta te da TODO para analizar cada pregunta:**
- 📋 Pregunta completa con sus 4 opciones
- ✅ Respuesta marcada como correcta
- 📖 Explicación actual
- 📜 **Artículo vinculado COMPLETO** (para verificar contra el BOE)
- 🤖 Opinión de la IA y sugerencias de corrección

### Significado de los estados:

| Estado | article_ok | answer_ok | explanation_ok | Descripción |
|--------|------------|-----------|----------------|-------------|
| `perfect` | ✅ | ✅ | ✅ | Todo correcto |
| `bad_explanation` | ✅ | ✅ | ❌ | Solo explicación mal |
| `bad_answer` | ✅ | ❌ | ✅ | Solo respuesta mal |
| `bad_answer_and_explanation` | ✅ | ❌ | ❌ | Respuesta y explicación mal |
| `wrong_article` | ❌ | ✅ | ✅ | Artículo vinculado incorrecto |
| `wrong_article_bad_explanation` | ❌ | ✅ | ❌ | Artículo mal + explicación mal |
| `wrong_article_bad_answer` | ❌ | ❌ | ✅ | Artículo mal + respuesta mal |
| `all_wrong` | ❌ | ❌ | ❌ | Todo mal |

> Los estados `tech_*` son equivalentes para leyes virtuales/técnicas (informática, ofimática).

### Resumen por estado:
```sql
SELECT topic_review_status, COUNT(*) as total
FROM questions
WHERE topic_review_status IS NOT NULL
GROUP BY topic_review_status
ORDER BY total DESC;
```

### PASO 3: Corregir pregunta y actualizar estado ⭐

**IMPORTANTE:** Después de corregir, SIEMPRE actualizar `topic_review_status = 'perfect'` para que desaparezca de la lista de problemas.

#### A) Si hay que corregir la pregunta:
```sql
-- 1. Corregir la pregunta Y cambiar estado a 'perfect'
UPDATE questions
SET
    -- Corregir lo que esté mal:
    -- correct_option = 1,  -- 0=A, 1=B, 2=C, 3=D (si respuesta mal)
    -- explanation = 'Nueva explicación...',  -- (si explicación mal)

    -- SIEMPRE poner estos campos:
    topic_review_status = 'perfect',  -- o 'tech_perfect' para leyes virtuales
    verified_at = NOW(),
    updated_at = NOW()
WHERE id = 'QUESTION_ID';

-- 2. Marcar verificación IA como aplicada
UPDATE ai_verification_results
SET fix_applied = true,
    fix_applied_at = NOW()
WHERE question_id = 'QUESTION_ID';
```

#### B) Si la IA se equivocó (falso positivo):
```sql
-- 1. Marcar como perfecta (no hay nada que corregir)
UPDATE questions
SET topic_review_status = 'perfect',  -- o 'tech_perfect' para leyes virtuales
    verified_at = NOW()
WHERE id = 'QUESTION_ID';

-- 2. Descartar el resultado de verificación IA
UPDATE ai_verification_results
SET discarded = true,
    discarded_at = NOW(),
    discarded_reason = 'Falso positivo - verificación manual'
WHERE question_id = 'QUESTION_ID';
```

### PASO 4: Verificar que se aplicó correctamente
```sql
SELECT
    q.id,
    q.topic_review_status,  -- Debe ser 'perfect'
    q.verified_at,          -- Debe tener fecha reciente
    av.fix_applied,         -- Debe ser true (o discarded = true)
    av.explanation_ok       -- Este campo NO cambia (es histórico de la IA)
FROM questions q
LEFT JOIN ai_verification_results av ON q.id = av.question_id
WHERE q.id = 'QUESTION_ID';
```

> **NOTA:** Los campos `article_ok`, `answer_ok`, `explanation_ok` en `ai_verification_results` son **históricos** - guardan lo que detectó la IA originalmente. NO se actualizan al corregir. Lo importante es que `topic_review_status = 'perfect'` y `fix_applied = true`.

---

## 📦 Sistema Cambios BOE: Preguntas afectadas por modificaciones de ley

> Este sistema detecta preguntas que pueden estar desactualizadas por cambios en el BOE.

```sql
WITH verificacion AS (
  SELECT
    v.question_id,
    v.article_id,
    v.is_correct,
    v.correct_option_should_be,
    a.article_number,
    a.title as article_title,
    a.content as article_content,
    l.short_name as ley,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.correct_option as opcion_correcta_actual,
    q.explanation,
    q.primary_article_id
  FROM ai_verification_results v
  LEFT JOIN articles a ON v.article_id = a.id
  LEFT JOIN laws l ON a.law_id = l.id
  LEFT JOIN questions q ON v.question_id = q.id
  WHERE v.is_correct = false
    AND (v.fix_applied IS NULL OR v.fix_applied = false)
    AND (v.discarded IS NULL OR v.discarded = false)
  ORDER BY l.short_name, a.article_number::integer
)
SELECT * FROM verificacion;
```

## Verificar cada pregunta

1. **¿Artículo correcto vinculado?** Comparar `article_id` con `primary_article_id`
2. **¿Explicación completa?** Debe citar el artículo y ser didáctica
3. **¿Respuesta correcta?** Comparar `opcion_correcta_actual` con `correct_option_should_be` y verificar contra `article_content`

## Aplicar corrección y marcar como verificada

```sql
-- Corregir pregunta Y marcar como verificada por humano
UPDATE questions
SET correct_option = 'b',  -- o la opción correcta
    explanation = 'Nueva explicación didáctica...',
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'QUESTION_ID';

-- Marcar como reparada en ai_verification_results
UPDATE ai_verification_results
SET fix_applied = true,
    fix_applied_at = NOW()
WHERE question_id = 'QUESTION_ID';
```

## Si la pregunta estaba bien (falso positivo de IA)

```sql
-- Solo marcar como verificada (la IA se equivocó)
UPDATE questions
SET verified_at = NOW(),
    verification_status = 'ok'
WHERE id = 'QUESTION_ID';

-- Descartar el resultado de verificación IA
UPDATE ai_verification_results
SET discarded = true,
    discarded_at = NOW(),
    discarded_reason = 'Falso positivo - pregunta correcta'
WHERE question_id = 'QUESTION_ID';
```

> **IMPORTANTE**: Siempre que revises una pregunta en reparaciones, marca `verified_at` y `verification_status = 'ok'`. Esto asegura que las preguntas revisadas por humanos no vuelvan a aparecer como pendientes. 

## ⚠️ CRÍTICO: Sistema de Centinelas - Prevención de Reimportación de Preguntas Incorrectas

### ¿Qué es un centinela?

Un **centinela** es una copia desactivada de una pregunta INCORRECTA que guardamos en la base de datos para evitar que esa misma versión incorrecta se reimporte en el futuro.

Cuando corriges una pregunta (enunciado, opciones o respuesta), creas dos versiones:
1. **Pregunta corregida** (is_active = true) → Los usuarios la ven
2. **Centinela** (is_active = false) → Copia de la versión incorrecta que actúa como detector

### ¿Para qué sirve?

El sistema de detección de duplicados compara el `content_hash` de las preguntas nuevas con TODAS las preguntas de la base de datos (activas e inactivas).

Si en el futuro:
- Se importan preguntas de un nuevo banco
- Se actualiza contenido desde fuentes externas
- Se añaden preguntas de exámenes oficiales

Y alguna de esas preguntas coincide EXACTAMENTE con una versión incorrecta que ya corregiste, el centinela la detectará y evitará que se añada de nuevo.

**Sin centinela**: La versión incorrecta podría reimportarse y sobrescribir tu corrección.
**Con centinela**: El sistema detecta el duplicado y lo rechaza automáticamente.

---

## ¿Cuándo crear centinela?

### ✅ SÍ crear centinela cuando corrijas:

- El **enunciado** de la pregunta (question_text)
- Las **opciones** (option_a, option_b, option_c, option_d)


**Motivo**: Estos cambios modifican el `content_hash` de la pregunta. Necesitas el centinela para detectar si esa versión incorrecta intenta reimportarse.

### ❌ NO crear centinela cuando corrijas:

- Solo la **explicación** (explanation)
- Cuando cambia solo la respuesta correcta,  la opcion correcta
- Campos de **metadatos** (difficulty, tags, exam_source, verified_at, etc.)

**Motivo**: Estos cambios NO afectan al `content_hash` (content_hash = hash(enunciado + opciones). La pregunta sigue siendo la misma, solo mejoras información adicional o cambias la respuesta correcta

---

## Procedimiento CON centinela (pregunta/opciones/respuesta)

Usa este procedimiento cuando corrijas el enunciado, las opciones o la respuesta correcta.

### PASO 1: Crear copia centinela de la versión INCORRECTA

```sql
-- Insertar copia exacta de la pregunta INCORRECTA original
-- ⚠️ NO incluir content_hash para evitar error de duplicado
INSERT INTO questions (
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation,
    primary_article_id,
    difficulty,
    question_type,
    tags,
    is_active,
    is_official_exam,
    exam_source,
    exam_date,
    exam_entity,
    exam_position,
    official_difficulty_level,
    created_at,
    updated_at
)
SELECT 
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option,
    explanation,
    primary_article_id,
    difficulty,
    question_type,
    tags,
    false,  -- ⚠️ IMPORTANTE: Desactivada (centinela)
    is_official_exam,
    exam_source,
    exam_date,
    exam_entity,
    exam_position,
    official_difficulty_level,
    NOW(),
    NOW()
FROM questions
WHERE id = 'QUESTION_ID_INCORRECTA';
```

**Puntos clave:**
- `is_active = false` → El centinela NUNCA se muestra a los usuarios
- NO copiar `content_hash` → Evita error de clave duplicada en este momento
- Copiar todos los demás campos para mantener contexto

### PASO 2: Corregir la pregunta original

```sql
-- Ahora SÍ corregir la pregunta original
UPDATE questions
SET 
    question_text = 'Texto corregido...',    -- Si cambias enunciado
    option_c = 'Opción corregida...',        -- Si cambias opciones
    correct_option = 3,                       -- Si cambias respuesta (0=A, 1=B, 2=C, 3=D)
    explanation = 'Explicación actualizada...', -- Opcionalmente
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'QUESTION_ID_INCORRECTA';
```

**Puntos clave:**
- Corriges la pregunta ORIGINAL (mantiene su ID)
- Los usuarios ven inmediatamente la versión corregida
- Marcas como verificada para que no aparezca en pendientes

### PASO 3: Cerrar la impugnación

```sql
UPDATE question_disputes
SET 
    status = 'resolved',
    admin_response = '¡Gracias! Hemos corregido la pregunta...',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'DISPUTE_ID';
```

### Resultado final:

| ID | Pregunta | Opciones | Respuesta | is_active | Uso |
|----|----------|----------|-----------|-----------|-----|
| Original | CORREGIDA | CORREGIDAS | CORRECTA | true | Los usuarios la ven |
| Nueva (centinela) | INCORRECTA | INCORRECTAS | INCORRECTA | false | Detecta duplicados |

---

## Procedimiento SIN centinela (solo explicación/metadatos)

Usa este procedimiento cuando solo mejores la explicación o actualices metadatos.

### PASO 1: Mejorar directamente

```sql
-- Solo mejorar la explicación (sin centinela)
UPDATE questions
SET 
    explanation = 'Explicación mejorada y más clara...',
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'QUESTION_ID';
```

### PASO 2: Cerrar la impugnación

```sql
UPDATE question_disputes
SET 
    status = 'resolved',
    admin_response = '¡Gracias! Hemos mejorado la explicación...',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'DISPUTE_ID';
```

**Mucho más simple**: Un solo UPDATE, sin necesidad de crear copia.

---

## Ejemplos completos

### Ejemplo 1: CON centinela (cambio de respuesta correcta)

**Impugnación**: Correo electrónico - Usuario reporta que la respuesta correcta es D, no B

```sql
-- PASO 1: Crear centinela (copia de versión con respuesta B incorrecta)
INSERT INTO questions (
    question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, primary_article_id,
    difficulty, question_type, tags, is_active,
    is_official_exam, exam_source, exam_date, exam_entity,
    exam_position, official_difficulty_level,
    created_at, updated_at
)
SELECT 
    question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, primary_article_id,
    difficulty, question_type, tags, false,  -- Desactivada
    is_official_exam, exam_source, exam_date, exam_entity,
    exam_position, official_difficulty_level,
    NOW(), NOW()
FROM questions
WHERE id = 'a825413d-4903-4c15-bbc4-58b0d62ea61e';

-- PASO 2: Corregir respuesta de B a D
UPDATE questions
SET 
    correct_option = 3,  -- D = 3 (0=A, 1=B, 2=C, 3=D)
    explanation = 'Los tres elementos mínimos obligatorios son: Destinatario, Sender/Remitente y Mensaje. El Asunto NO es obligatorio...',
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'a825413d-4903-4c15-bbc4-58b0d62ea61e';

-- PASO 3: Cerrar impugnación
UPDATE question_disputes
SET 
    status = 'resolved',
    admin_response = '¡Muchísimas gracias! Tenías toda la razón. Hemos corregido la respuesta de B a D...',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'abe951da-a573-4c5f-8caa-011be6e2b6a8';
```

**Resultado:**
- Pregunta original: Respuesta D (correcta), activa → usuarios la ven
- Centinela: Respuesta B (incorrecta), desactivada → evita reimportación

---

### Ejemplo 2: CON centinela (reformulación completa de pregunta)

**Impugnación**: CE Art. 82 - Pregunta confusa, hay que reformularla completamente

```sql
-- PASO 1: Crear centinela (copia de pregunta confusa)
INSERT INTO questions (
    question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, primary_article_id,
    difficulty, question_type, tags, is_active,
    is_official_exam, exam_source, exam_date, exam_entity,
    exam_position, official_difficulty_level,
    created_at, updated_at
)
SELECT 
    question_text, option_a, option_b, option_c, option_d,
    correct_option, explanation, primary_article_id,
    difficulty, question_type, tags, false,
    is_official_exam, exam_source, exam_date, exam_entity,
    exam_position, official_difficulty_level,
    NOW(), NOW()
FROM questions
WHERE id = 'd7d74778-70bf-41b8-b6a5-b21bc3bdd8ab';

-- PASO 2: Reformular pregunta completamente
UPDATE questions
SET 
    question_text = 'Conforme al artículo 82 de la Constitución Española, ¿sobre qué materias NO pueden las Cortes Generales delegar en el Gobierno la potestad legislativa?',
    option_a = 'Materias reservadas a Ley Orgánica.',
    option_b = 'Materias de ley ordinaria.',
    option_c = 'Materias de competencia autonómica.',
    option_d = 'Las Cortes pueden delegar sobre todas las materias.',
    explanation = 'La respuesta correcta es A). Según el artículo 82.1 CE, las Cortes Generales podrán delegar sobre materias determinadas NO INCLUIDAS EN EL ARTÍCULO ANTERIOR...',
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'd7d74778-70bf-41b8-b6a5-b21bc3bdd8ab';

-- PASO 3: Cerrar impugnación
UPDATE question_disputes
SET 
    status = 'resolved',
    admin_response = '¡Hola Nila! Tenías toda la razón - la pregunta estaba muy confusa. La hemos reformulado completamente...',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'f7eb49bc-95a0-42ee-bb3e-1e7a3036ffa8';
```

**Resultado:**
- Pregunta original: Reformulada y clara, activa → usuarios la ven
- Centinela: Versión confusa, desactivada → evita reimportación

---

### Ejemplo 3: SIN centinela (mejora de explicación)

**Impugnación**: CE Art. 168 - La explicación no se corresponde / no ayuda

```sql
-- PASO 1: Mejorar explicación directamente (sin centinela)
UPDATE questions
SET 
    explanation = 'La respuesta correcta es D). El artículo 168 CE establece que el referéndum es OBLIGATORIO cuando la reforma afecte a:
- Título Preliminar (arts. 1-9)
- Capítulo segundo, Sección primera del Título I (arts. 14-29)
- Título II (arts. 56-65)

El Art. 11.2 está en el Capítulo I del Título I, por tanto NO requiere Art. 168...',
    verified_at = NOW(),
    verification_status = 'ok',
    updated_at = NOW()
WHERE id = 'f3522871-cda6-4e74-a99e-5051235111bb';

-- PASO 2: Cerrar impugnación
UPDATE question_disputes
SET 
    status = 'resolved',
    admin_response = '¡Hola Cristina! Tienes toda la razón - la explicación anterior no era buena. La hemos mejorado completamente...',
    resolved_at = NOW(),
    is_read = false
WHERE id = '922fa500-b623-4e76-af1f-dcbe49751cc3';
```

**Resultado:**
- Pregunta: Misma pregunta, explicación mejorada, activa → usuarios la ven
- NO hay centinela: La pregunta no cambió, solo mejoró su explicación

---

## Resumen visual

### Tabla de decisión:

| Qué corriges | ¿Centinela? | Motivo | Ejemplo |
|-------------|-------------|--------|---------|
| Enunciado (question_text) | ✅ SÍ | Cambia content_hash | "¿pueden delegar?" → "¿sobre qué NO pueden?" |
| Opciones (option_a/b/c/d) | ✅ SÍ | Cambia content_hash | Cambiar texto de una opción |
| Respuesta (correct_option) | ✅ SÍ | Cambia content_hash | Cambiar de B a D |
| Explicación (explanation) | ❌ NO | NO cambia content_hash | Mejorar redacción explicativa |
| Metadatos (tags, difficulty) | ❌ NO | NO cambia content_hash | Ajustar dificultad, añadir tags |

### Flujo de trabajo:

```
┌─────────────────────────────┐
│   Usuario reporta error     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Verificar con artículo     │
│  oficial del BOE            │
└──────────┬──────────────────┘
           │
           ▼
    ¿Qué hay que corregir?
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐   ┌──────────┐
│Pregunta │   │  Solo    │
│Opciones │   │explicac. │
│Respuesta│   │          │
└────┬────┘   └────┬─────┘
     │             │
     ▼             ▼
┌─────────┐   ┌──────────┐
│ SÍ      │   │ NO       │
│centinela│   │centinela │
└────┬────┘   └────┬─────┘
     │             │
     ▼             ▼
┌─────────────────────────────┐
│  1. INSERT copia (false)    │
│  2. UPDATE original         │
│  3. Cerrar impugnación      │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  1. UPDATE original         │
│  2. Cerrar impugnación      │
└─────────────────────────────┘
```

---

## Advertencias importantes

### ⚠️ SIEMPRE crear centinela ANTES de corregir

```sql
-- ❌ MAL: Corregir primero
UPDATE questions SET correct_option = 3 WHERE id = 'xxx';  -- Perdiste la versión incorrecta
INSERT INTO questions SELECT ... WHERE id = 'xxx';         -- Ya está corregida, no sirve

-- ✅ BIEN: Centinela primero
INSERT INTO questions SELECT ..., false, ... WHERE id = 'xxx';  -- Guardas versión incorrecta
UPDATE questions SET correct_option = 3 WHERE id = 'xxx';       -- Ahora corriges
```

### ⚠️ NO incluir content_hash en el INSERT del centinela

```sql
-- ❌ MAL: Incluir content_hash
INSERT INTO questions (..., content_hash, ...)
SELECT ..., content_hash, ...  -- ERROR: duplicate key

-- ✅ BIEN: NO incluir content_hash
INSERT INTO questions (..., created_at, updated_at)  -- Sin content_hash
SELECT ..., NOW(), NOW()  -- Se autogenerará uno nuevo al INSERT
```

### ⚠️ Verificar que is_active = false en centinela

```sql
-- Siempre verificar después de crear centinela
SELECT id, question_text, is_active 
FROM questions 
WHERE primary_article_id = 'xxx'
ORDER BY created_at DESC 
LIMIT 2;

-- Deberías ver:
-- ID1 (antiguo): is_active = true  (pregunta corregida que ven usuarios)
-- ID2 (nuevo):   is_active = false (centinela que no se muestra)
```

---

## Preguntas frecuentes

**P: ¿Los centinelas ocupan mucho espacio en la base de datos?**
R: No. Son solo registros inactivos. El beneficio de prevenir reimportaciones incorrectas supera ampliamente el costo de almacenamiento.

**P: ¿Puedo eliminar centinelas antiguos?**
R: NO se recomienda. Aunque sean antiguos, siguen protegiendo contra reimportaciones. Solo elimínalos si estás 100% seguro de que esa fuente nunca volverá a importarse.

**P: ¿Qué pasa si olvido crear el centinela?**
R: La pregunta quedará corregida, pero si en el futuro se importa la versión incorrecta, podría sobrescribir tu corrección. Intenta siempre crear el centinela cuando corresponda.

**P: ¿Cómo sé si una pregunta tiene centinela?**
R: Busca preguntas inactivas con contenido muy similar:
```sql
SELECT id, question_text, is_active, created_at
FROM questions
WHERE primary_article_id = 'ARTICLE_ID'
ORDER BY created_at DESC;
```

**P: ¿El centinela afecta a los usuarios?**
R: NO. Los centinelas tienen `is_active = false`, por lo que NUNCA se muestran a los usuarios. Solo existen en la base de datos como detectores de duplicados.

---

## Regla de oro

> ⚠️ **REGLA SIMPLE**: 
> - ¿Cambias pregunta, opciones? → **SÍ centinela** (ANTES de corregir)
> - ¿Solo mejoras explicación o metadatos? → **NO centinela** (corrección directa)

-------------

En las explicaciones o mensaje al usuario, no usar asteriscos **. Queda feo

---

## Resolución con Claude Code (Mensajes Personalizados)

Cuando uses Claude Code para resolver impugnaciones, sigue este flujo:

### Proceso obligatorio:

1. **Analizar la impugnación** - Consultar pregunta, artículo y datos del usuario
2. **Redactar mensaje personalizado** - Incluir:
   - Saludo con nombre del usuario
   - Explicación clara citando el artículo
   - Despedida: "Cualquier consulta no dudes en contactar. Equipo de Vence"
3. **MOSTRAR el mensaje** - Claude debe mostrar cómo quedará el mensaje ANTES de enviarlo
4. **Esperar confirmación** - Solo enviar cuando el usuario apruebe el texto
5. **Enviar** - Actualizar `question_disputes` con el mensaje aprobado

### Ejemplo de flujo:

```
Usuario: "analiza la primera impugnación"
Claude: [analiza pregunta y artículo]

Usuario: "prepara el mensaje de cierre"
Claude: "Aquí está el mensaje propuesto:

---
Hola [Nombre],

[Explicación personalizada citando el artículo]

Cualquier consulta no dudes en contactar.

Equipo de Vence
---

¿Lo enviamos?"

Usuario: "sí, envíalo"
Claude: [actualiza la BD con el mensaje]
```

### Campos a actualizar:

```javascript
await supabase
  .from('question_disputes')
  .update({
    status: 'resolved',
    admin_response: textoAprobado,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('question_id', questionId)
  .eq('status', 'pending');
```

### Regla de oro:

> ⚠️ **NUNCA enviar un mensaje sin mostrarlo primero al administrador para su aprobación**

---

# Manual - Impugnaciones de Psicotécnicos

## Ver Impugnaciones Pendientes
```sql
SELECT 
    pqd.id as dispute_id,
    pqd.question_id,
    pqd.description,
    COALESCE(up.nickname, up.full_name, split_part(au.email, '@', 1), 'Usuario') as nombre_usuario,
    pq.question_text,
    pq.correct_option,
    ps.display_name as section_name
FROM psychometric_question_disputes pqd
JOIN psychometric_questions pq ON pqd.question_id = pq.id
LEFT JOIN auth.users au ON pqd.user_id = au.id
LEFT JOIN user_profiles up ON pqd.user_id = up.id
LEFT JOIN psychometric_sections ps ON pq.section_id = ps.id
WHERE pqd.status = 'pending'
ORDER BY pqd.created_at DESC;
```

## Consultar Pregunta Completa
```sql
SELECT id, question_text, content_data, option_a, option_b, option_c, option_d, 
       correct_option, explanation
FROM psychometric_questions
WHERE id = 'QUESTION_ID';
```

**IMPORTANTE**: `content_data` contiene:
- `original_text`: Frase a analizar (ortografía)
- `error_count`: Número esperado de errores
- `pattern_type`: Tipo de patrón (series)

## Corregir Pregunta

### Cambiar respuesta + content_data + explicación:
```sql
UPDATE psychometric_questions
SET 
    correct_option = X,  -- 0=A, 1=B, 2=C, 3=D
    content_data = jsonb_set(content_data, '{error_count}', 'VALOR'),
    explanation = 'NUEVA EXPLICACIÓN',
    is_verified = true,
    updated_at = NOW()
WHERE id = 'QUESTION_ID';
```

### Solo mejorar explicación:
```sql
UPDATE psychometric_questions
SET 
    explanation = 'NUEVA EXPLICACIÓN',
    is_verified = true,
    updated_at = NOW()
WHERE id = 'QUESTION_ID';
```

## Cerrar Impugnación

```sql
UPDATE psychometric_question_disputes
SET 
    status = 'resolved',
    admin_response = 'Hola [NOMBRE]! ...mensaje...',
    resolved_at = NOW(),
    is_read = false
WHERE id = 'DISPUTE_ID';
```

## Diferencias con Preguntas Normales

| Aspecto | Normales | Psicotécnicos |
|---------|----------|---------------|
| Tabla preguntas | `questions` | `psychometric_questions` |
| Tabla impugnaciones | `question_disputes` | `psychometric_question_disputes` |
| Campo extra | - | `content_data` (jsonb) |
| **Centinelas** | ✅ Sí | ❌ **NO** |
| Verificación | `verified_at`, `verification_status` | `is_verified` |

## REGLA DE ORO

> ⚠️ **NO se usan centinelas** en psicotécnicos (no hay sistema de importación masiva)

