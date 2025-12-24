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


si puedes para investigar, hazlo todo con una sql, no te compliquess: 

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


importante, a veces La explicaciónes están afirmando cosas que no aparecen en el artículo vinculado. Puede que sean verdad (en otros artículos), habria que actualizar estas preguntas como perfectas, pero tienes que confirmarlo :

-- Marcar como correcta (la IA se equivocó, es un falso positivo)
UPDATE questions
SET topic_review_status = 'perfect',
    verified_at = NOW()
WHERE id = '6547cff0-5db1-4577-bcf6-b5eee63948f8';

-- Descartar el resultado de verificación IA
UPDATE ai_verification_results
SET discarded = true,
    discarded_at = NOW()
WHERE question_id = '6547cff0-5db1-4577-bcf6-b5eee63948f8';
