# Manual - Resolución de Impugnaciones de Usuarios

## Proceso para Resolver Impugnaciones (question_disputes)

### PASO 1: Ver Impugnaciones Pendientes
```sql
SELECT 
    qd.id as dispute_id,
    qd.question_id,
    qd.user_id,
    qd.dispute_reason,
    qd.user_comment,
    qd.created_at,
    q.question_text,
    'A) ' || q.option_a as opcion_a,
    'B) ' || q.option_b as opcion_b,
    'C) ' || q.option_c as opcion_c,
    'D) ' || q.option_d as opcion_d,
    q.correct_option,
    q.explanation
FROM question_disputes qd
JOIN questions q ON qd.question_id = q.id
WHERE qd.status = 'pending'
ORDER BY qd.created_at DESC;
```

### PASO 2: Analizar la Impugnación
1. **Leer cuidadosamente** el comentario del usuario
2. **Verificar** si la impugnación es válida
3. **Revisar** la pregunta, opciones y respuesta correcta
4. **Consultar** el artículo/BOE si es necesario

### PASO 3: Aplicar Corrección (Si es necesaria)
Seguir el proceso del `README-revision-preguntas-problematicas.md` para:
- Corregir respuesta incorrecta
- Mejorar explicación
- Clarificar opciones
- Reasignar artículo

### PASO 4: Cerrar Impugnación con Mensaje Motivador

#### A) Si la impugnación es VÁLIDA (usuario tenía razón):
```sql
UPDATE question_disputes
SET status = 'resolved',
    admin_response = '¡Muchísimas gracias [NOMBRE]! 🎯 Tenías toda la razón. Hemos corregido la pregunta:

✅ [DESCRIPCIÓN ESPECÍFICA DE LA CORRECCIÓN REALIZADA]
✅ [DETALLE DE CAMBIOS APLICADOS]
✅ [RESULTADO FINAL]

Tu aportación ha mejorado la calidad del contenido para todos 🙌

Te animo a que sigas reportando cualquier error que encuentres, y si te animas, ¡también puedes colaborar sugiriendo mejoras! 📚

¡Mucho ánimo con tu preparación! 💪',
    resolved_at = NOW()
WHERE id = 'DISPUTE_ID';
```

#### B) Si la impugnación NO es válida (pregunta estaba correcta):
```sql
UPDATE question_disputes
SET status = 'resolved',
    admin_response = '¡Hola [NOMBRE]! 👋 Gracias por reportar esta pregunta.

Tras revisar cuidadosamente tu consulta, confirmamos que la pregunta está correcta:

📋 [EXPLICACIÓN DETALLADA DE POR QUÉ ES CORRECTA]
📖 [REFERENCIA AL ARTÍCULO/LEY ESPECÍFICA]
💡 [CONSEJO PARA RECORDAR O ENTENDER MEJOR]

Tu atención al detalle es muy valiosa, ¡sigue así! 🔍

Recuerda que si tienes dudas sobre cualquier tema, también puedes consultar nuestros artículos explicativos. 📚

¡Mucho ánimo con tu preparación! 💪',
    resolved_at = NOW()
WHERE id = 'DISPUTE_ID';
```

## Templates de Respuesta

### Template IMPUGNACIÓN VÁLIDA:
```
¡Muchísimas gracias [NOMBRE]! 🎯 Tenías toda la razón. Hemos corregido la pregunta:

✅ [Cambio específico 1]
✅ [Cambio específico 2] 
✅ [Resultado final claro]

Tu aportación ha mejorado la calidad del contenido para todos 🙌

Te animo a que sigas reportando cualquier error que encuentres, y si te animas, ¡también puedes colaborar sugiriendo mejoras! 📚

¡Mucho ánimo con tu preparación! 💪
```

### Template IMPUGNACIÓN NO VÁLIDA:
```
¡Hola [NOMBRE]! 👋 Gracias por reportar esta pregunta.

Tras revisar cuidadosamente tu consulta, confirmamos que la pregunta está correcta:

📋 [Explicación clara del por qué]
📖 [Referencia específica]
💡 [Consejo útil para recordar]

Tu atención al detalle es muy valiosa, ¡sigue así! 🔍

Recuerda que si tienes dudas sobre cualquier tema, también puedes consultar nuestros artículos explicativos. 📚

¡Mucho ánimo con tu preparación! 💪
```

## Obtener Nombre del Usuario
```sql
-- Opción 1: Desde user_profiles
SELECT display_name, email 
FROM user_profiles 
WHERE id = 'USER_ID';

-- Opción 2: Desde auth.users (si no hay display_name)
SELECT 
    COALESCE(
        up.display_name, 
        split_part(au.email, '@', 1),
        'Usuario'
    ) as nombre_a_usar
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE au.id = 'USER_ID';
```

## Verificar Cierre
```sql
SELECT 
    id,
    status,
    admin_response,
    resolved_at
FROM question_disputes 
WHERE id = 'DISPUTE_ID';
```

## Reglas Importantes
- **SIEMPRE** agradecer al usuario por reportar
- **PERSONALIZAR** el mensaje con el nombre del usuario
- **SER ESPECÍFICO** sobre qué se corrigió o por qué está correcto
- **MANTENER TONO POSITIVO** y motivador
- **INCLUIR EMOJIS** para hacer el mensaje más amigable
- **ANIMAR** a seguir colaborando y estudiando
- **NO DEFENDER ERRORES** - si está mal, reconocerlo y agradecer