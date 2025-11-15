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
-- 1. Corregir la pregunta/opciones
UPDATE questions
SET option_c = 'TEXTO CORREGIDO SEGÚN ARTÍCULO OFICIAL',
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
    explanation
FROM questions 
WHERE id = 'QUESTION_ID';
```

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
- **SIEMPRE agradecer** al usuario por reportar
- **PERSONALIZAR** el mensaje con el nombre del usuario
- **SER ESPECÍFICO** sobre qué se corrigió o por qué está correcto
- **CITAR el artículo oficial** consultado como fundamento
- **MANTENER TONO POSITIVO** y motivador
- **INCLUIR EMOJIS** para hacer el mensaje más amigable
- **ANIMAR** a seguir colaborando y estudiando
- **NO DEFENDER ERRORES** - si está mal, reconocerlo y agradecer
- **VERIFICAR siempre** la corrección antes de cerrar la impugnación