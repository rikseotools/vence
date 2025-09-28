# Manual Conciso - Revisión Sistemática de Preguntas Problemáticas

## Proceso en 6 Pasos

### PASO 1: Análisis SQL Inicial
```sql
SELECT 
    'PREGUNTA PROBLEMÁTICA' as categoria,
    q.question_text,
    'A) ' || q.option_a as opcion_a,
    'B) ' || q.option_b as opcion_b,
    'C) ' || q.option_c as opcion_c,
    'D) ' || q.option_d as opcion_d,
    q.correct_option as numero_respuesta,
    CASE q.correct_option
        WHEN 0 THEN 'A) ' || q.option_a
        WHEN 1 THEN 'B) ' || q.option_b
        WHEN 2 THEN 'C) ' || q.option_c
        WHEN 3 THEN 'D) ' || q.option_d
    END as respuesta_marcada,
    q.explanation,
    'Art. ' || a.article_number || ' - ' || l.short_name as articulo,
    a.content as contenido_articulo
FROM questions q
JOIN articles a ON q.primary_article_id = a.id
JOIN laws l ON a.law_id = l.id
WHERE q.id = 'ID_PREGUNTA';
```

### PASO 2: Verificar Tracking
```sql
SELECT status, resolution_action, admin_notes
FROM problematic_questions_tracking 
WHERE question_id = 'ID_PREGUNTA';
```

### PASO 3: Análisis Lógico
1. **Coherencia pregunta-artículo**: ¿Corresponde el contenido?
2. **Respuesta correcta**: ¿Es realmente correcta según el artículo?
3. **Opciones**: ¿Son claras y sin ambigüedades?
4. **Explicación**: ¿Justifica adecuadamente la respuesta?

### PASO 4: Verificar BOE (Si es necesario)
Si hay dudas sobre el contenido del artículo, solicitar texto oficial BOE.

### PASO 5: Aplicar Corrección
**A) Mejorar explicación** (pregunta correcta):
```sql
UPDATE questions 
SET explanation = 'Explicación mejorada con análisis por descarte...',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

**B) Corregir respuesta** (respuesta incorrecta):
```sql
UPDATE questions 
SET correct_option = X, -- 0=A, 1=B, 2=C, 3=D
    explanation = 'Nueva explicación justificando la respuesta correcta...',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

**C) Reasignar artículo** (asignación incorrecta):
```sql
UPDATE questions 
SET primary_article_id = 'NUEVO_ARTICLE_ID',
    updated_at = NOW()
WHERE id = 'ID_PREGUNTA';
```

### PASO 6: Cerrar Tracking
```sql
INSERT INTO problematic_questions_tracking (
    question_id,
    detection_type,
    failure_rate,
    abandonment_rate,
    users_affected,
    total_attempts,
    status,
    resolution_action,
    admin_notes,
    resolved_by,
    resolved_at
) VALUES (
    'ID_PREGUNTA',
    'high_abandonment', -- o 'high_failure'
    XX.XX, -- porcentaje error
    XX.XX, -- porcentaje abandono
    X, -- usuarios afectados
    X, -- intentos totales
    'resolved',
    'ACCIÓN_REALIZADA', -- explanation_improved, correct_answer_changed, etc.
    'DESCRIPCIÓN_DETALLADA_DE_LA_CORRECCIÓN',
    auth.uid(),
    NOW()
);
```

## Tipos de Resolución

| Problema | Acción | resolution_action |
|----------|--------|-------------------|
| Explicación insuficiente | Mejorar explicación | `explanation_improved` |
| Respuesta incorrecta | Cambiar respuesta | `correct_answer_changed` |
| Artículo mal asignado | Reasignar artículo | `article_reassigned` |
| Bug frontend | Sin cambios BD | `no_changes_needed` |
| Redacción confusa | Mejorar opciones | `options_clarified` |

## Sistema de Respuestas
**OBLIGATORIO**: 0=A, 1=B, 2=C, 3=D

## Reglas Importantes
- **NUNCA eliminar preguntas** como solución
- **SIEMPRE** verificar con BOE si hay dudas
- **SIEMPRE** actualizar explicación para ser educativa
- **SIEMPRE** registrar en tracking la resolución
- **SIEMPRE** incluir análisis por descarte

## Template de Explicación Mejorada
```
ESTRUCTURA/CONTEXTO:
- Información relevante del artículo/tema

ANÁLISIS DE OPCIONES:
A) INCORRECTA/CORRECTA: Razón específica
B) INCORRECTA/CORRECTA: Razón específica  
C) INCORRECTA/CORRECTA: Razón específica
D) INCORRECTA/CORRECTA: Razón específica

CLAVE: Punto fundamental para recordar
```

## Verificación Final
```sql
-- Confirmar corrección aplicada
SELECT explanation, correct_option, updated_at
FROM questions WHERE id = 'ID_PREGUNTA';

-- Confirmar tracking cerrado
SELECT status, resolved_at FROM problematic_questions_tracking 
WHERE question_id = 'ID_PREGUNTA';
```