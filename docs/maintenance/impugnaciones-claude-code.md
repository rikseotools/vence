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
  .in('status', ['pending', 'appealed'])
  .order('created_at', { ascending: false });
```

**Resultado:** Lista de impugnaciones pendientes y con alegación (ambas requieren atención).

## 2. Analizar una Impugnación a Fondo

```
analiza la impugnación [número] a fondo
```

Claude debe obtener y verificar **todos** estos elementos:

### 2.1 Datos de la pregunta
- Texto completo de la pregunta
- Opciones A, B, C, D
- Respuesta marcada como correcta (índice 0-3)
- Explicación didáctica actual

### 2.2 Artículo vinculado
- `primary_article_id` → Artículo principal
- Ley a la que pertenece (short_name)
- Contenido completo del artículo
- **Nota:** Solo se puede vincular UN artículo principal

### 2.3 Verificación de cada opción
Crear una tabla analizando cada opción:

| Opción | Fundamento Legal | ¿Correcta? |
|--------|------------------|------------|
| A | Art. X dice... | ✅/❌ |
| B | Art. Y dice... | ✅/❌ |
| C | Art. Z dice... | ✅/❌ |
| D | ... | ✅/❌ |

### 2.4 Preguntas clave a responder
1. **¿La respuesta marcada es correcta?** - Verificar contra el artículo
2. **¿El artículo vinculado es el correcto?** - ¿Responde la pregunta?
3. **¿La explicación es didáctica?** - ¿Explica POR QUÉ cada opción es correcta/incorrecta?
4. **¿La explicación solo transcribe?** - Si solo copia el artículo sin explicar, hay que mejorarla

### 2.5 Verificación AI existente
Consultar `ai_verification_results`:
- `answer_ok`: ¿La respuesta es correcta?
- `explanation_ok`: ¿La explicación es correcta?
- `article_ok`: ¿El artículo vinculado es correcto?
- `ai_model`: Qué modelo verificó
- `explanation`: Análisis del modelo

### 2.6 Diagnóstico final
Crear tabla resumen:

| Aspecto | Estado | Acción |
|---------|--------|--------|
| Respuesta correcta | ✅/❌ | Corregir si es necesario |
| Explicación | ✅/⚠️/❌ | Mejorar si no es didáctica |
| Artículo vinculado | ✅/❌ | Cambiar si es incorrecto |
| Impugnación | Válida/Falso positivo | Resolver/Rechazar |

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

### 5.1 Formato de Explicaciones

Las explicaciones deben tener formato markdown con saltos de línea para ser legibles:

**Formato correcto:**
```
La respuesta correcta es X.

Según el artículo Y de la Ley Z:

**A) INCORRECTA** - Razón...

**B) CORRECTA** - El artículo dice literalmente...

**C) INCORRECTA** - Razón...

**D) INCORRECTA** - Razón...
```

**Evitar:** Texto corrido sin saltos de línea ni formato.

### 5.2 Explicación (tabla `questions`)
```javascript
supabase
  .from('questions')
  .update({
    explanation: nuevaExplicacion,
    verification_status: 'verified',
    verified_at: new Date().toISOString()
  })
  .eq('id', questionId);
```

### 5.3 Vincular artículo (tabla `question_articles`)
```javascript
supabase
  .from('question_articles')
  .insert({ question_id: questionId, article_id: articleId });
```

### 5.4 Actualizar verificación AI (tabla `ai_verification_results`)
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
    ai_model: 'claude-opus-4-6',
    verified_at: new Date().toISOString(),
    explanation: 'Verificación corregida...',
    article_quote: 'Cita del artículo...'
  })
  .eq('question_id', questionId);
```

## 6. Cerrar la Impugnación

> **IMPORTANTE:**
> - NUNCA cerrar la impugnación sin aprobación explícita del mensaje.
> - SIEMPRE obtener el nombre del usuario ANTES de proponer el mensaje, para dirigirse a él por su nombre.
> - Claude debe mostrar el mensaje propuesto y esperar confirmación antes de ejecutar cualquier cambio en `question_disputes`.

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

Equipo de Vence
```

**Notas:** Siempre firmar con "Equipo de Vence" al final.

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

> **El email se envía automáticamente.** Al hacer el UPDATE, un trigger PostgreSQL (`send_dispute_email_notification`) detecta el cambio de status y envía el email al usuario via `/api/send-dispute-email`. No hace falta llamar a ninguna API adicional. Ver sección 15 para más detalles.

## 7. Tablas Involucradas

| Tabla | Uso |
|-------|-----|
| `question_disputes` | Impugnaciones de preguntas legislativas |
| `psychometric_question_disputes` | Impugnaciones de preguntas psicotécnicas |
| `questions` | Preguntas legislativas y explicaciones |
| `psychometric_questions` | Preguntas psicotécnicas |
| `question_articles` | Relación pregunta-artículo (tabla de unión) |
| `articles` | Artículos de leyes |
| `ai_verification_results` | Resultados de verificación AI |
| `user_profiles` / `auth.users` | Datos del usuario para personalizar mensaje |

### 7.0 Dos Tablas de Impugnaciones

**IMPORTANTE:** Las impugnaciones están en DOS tablas diferentes:

| Tabla | Tipo de Pregunta | Campos Principales |
|-------|------------------|-------------------|
| `question_disputes` | Legislativas | `question_id` → `questions` |
| `psychometric_question_disputes` | Psicotécnicas | `question_id` → `psychometric_questions` |

**Para ver TODAS las impugnaciones pendientes:**

```javascript
// 1. Impugnaciones legislativas pendientes (incluye alegaciones)
const { data: legDisputes } = await supabase
  .from('question_disputes')
  .select('id, question_id, user_id, dispute_type, description, status, created_at')
  .in('status', ['pending', 'appealed'])
  .order('created_at', { ascending: true });

// 2. Impugnaciones psicotécnicas pendientes
const { data: psyDisputes } = await supabase
  .from('psychometric_question_disputes')
  .select('id, question_id, user_id, dispute_type, description, status, created_at')
  .in('status', ['pending', 'appealed'])
  .order('created_at', { ascending: true });

console.log('Legislativas:', legDisputes?.length || 0);
console.log('Psicotécnicas:', psyDisputes?.length || 0);
```

**Para corregir preguntas psicotécnicas:**

```javascript
// Actualizar pregunta psicotécnica
await supabase
  .from('psychometric_questions')
  .update({
    explanation: nuevaExplicacion,
    correct_option: nuevoIndice  // 0=A, 1=B, 2=C, 3=D
  })
  .eq('id', questionId);

// Cerrar impugnación psicotécnica
await supabase
  .from('psychometric_question_disputes')
  .update({
    status: 'resolved',  // o 'rejected'
    admin_response: mensaje,
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

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
| `status` | `pending` / `resolved` / `rejected` / `appealed` |
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
7. Claude obtiene el NOMBRE del usuario (sección 11)
   ↓
8. Claude propone mensaje personalizado con nombre
   ↓
9. Usuario aprueba mensaje → Claude cierra la impugnación
```

## 10. Ejemplo Real #1: Impugnación Válida (Corregir)

**Impugnación:** "La explicación no se corresponde con la pregunta"

**Diagnóstico realizado:**
- `verified_at`: null (nunca verificada correctamente)
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

---

## 10.1 Ejemplo Real #2: Falso Positivo (Rechazar)

**Impugnación auto-detectada:** "La respuesta B es incorrecta según Art. 67.1 CE"

**Pregunta:** "El cargo de Senador es compatible con el cargo de:"
- A) Diputado de las Cortes Generales
- B) Miembro de una Asamblea de CCAA ← Marcada correcta
- C) Miembro de una Junta Electoral
- D) Con ninguno de los anteriores

**Análisis de cada opción:**

| Opción | Fundamento Legal | ¿Correcta? |
|--------|------------------|------------|
| A | Art. 67.1: "Nadie podrá ser miembro de las dos Cámaras simultáneamente" | ❌ |
| B | Art. 67.1: prohíbe acumular Asamblea CCAA con **Diputado**, NO con Senador | ✅ |
| C | Art. 70.1.f: miembros de Juntas Electorales son inelegibles | ❌ |
| D | Falso, B sí es compatible | ❌ |

**Diagnóstico:**
- La IA auto-detectora leyó mal el Art. 67.1 CE
- El artículo dice "Diputado al Congreso", no "Senador"
- Verificación Opus 4.5 confirmó: "B correcta"
- La pregunta ES CORRECTA

**Problema de la explicación:**
- Solo transcribía los artículos sin explicar didácticamente
- No explicaba POR QUÉ cada opción era correcta/incorrecta

**Acciones:**
1. Rechazar impugnación (la pregunta es correcta)
2. Mejorar explicación didáctica (opcional pero recomendado)

**Explicación mejorada:**
```
La respuesta correcta es B) Miembro de una Asamblea de CCAA.

Según el artículo 67.1 CE: "Nadie podrá ser miembro de las dos
Cámaras simultáneamente, ni acumular el acta de una Asamblea de
Comunidad Autónoma con la de Diputado al Congreso."

A) INCORRECTA - Art. 67.1 prohíbe ser de ambas Cámaras.
B) CORRECTA - La prohibición solo afecta a Diputados, no Senadores.
C) INCORRECTA - Art. 70.1.f hace inelegibles a miembros de Juntas Electorales.
D) INCORRECTA - B sí es compatible.

La clave: el art. 67.1 dice "Diputado al Congreso", no "Senador".
```

**Mensaje de rechazo:**
```
Esta impugnación fue generada automáticamente por IA, pero tras
revisión manual se confirma que la pregunta es CORRECTA.

El Art. 67.1 CE prohíbe acumular Asamblea de CCAA con "Diputado
al Congreso", pero NO menciona a los Senadores. Por tanto, un
Senador SÍ puede ser miembro de una Asamblea de CCAA.

Se ha mejorado la explicación didáctica de la pregunta.
```

## 11. Obtener Nombre del Usuario

Para personalizar el mensaje, hay dos opciones:

### Opción 1: Desde `user_profiles` (recomendada)
```javascript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('full_name, email')
  .eq('id', userId)
  .single();

const nombre = profile?.full_name?.split(' ')[0] || 'Usuario';
```

### Opción 2: Desde `auth.users` (requiere service role)
```javascript
const { data: { user } } = await supabase.auth.admin.getUserById(userId);
const nombre = user.user_metadata?.name || user.user_metadata?.full_name || 'Usuario';
```

**Nota:** La opción 2 requiere `SUPABASE_SERVICE_ROLE_KEY` para acceder a `auth.admin`.

## 12. Rechazar una Impugnación

A veces el usuario está equivocado y la pregunta es correcta. En ese caso:

```
rechaza la impugnación explicando por qué la pregunta es correcta
```

Claude actualizará:
```javascript
supabase
  .from('question_disputes')
  .update({
    status: 'rejected',
    admin_response: 'Hola [Nombre],\n\nHemos revisado tu impugnación...\n\n[Explicación de por qué la pregunta es correcta]\n\nGracias por tu interés en mejorar la plataforma.',
    resolved_at: new Date().toISOString()
  })
  .eq('id', disputeId);
```

**Importante:** Siempre explicar con detalle por qué se rechaza, citando el artículo relevante.

---

## 13. Consejos

- **CRÍTICO: Siempre pedir aprobación explícita** del mensaje antes de cerrar la impugnación. Mostrar el texto y esperar "sí" o "ok" del usuario.
- **CRÍTICO: Siempre obtener el nombre del usuario** antes de proponer el mensaje. Usar la consulta de la sección 11 para obtenerlo.
- **Siempre verificar** el artículo correcto en nuestra BD antes de corregir
- **No cerrar** la impugnación hasta aprobar el mensaje
- **Personalizar** el mensaje con el nombre del usuario (nunca "Hola," genérico)
- **Actualizar** `ai_verification_results` para que la verificación quede correcta
- **Actualizar** `verification_status` y `verified_at` en la pregunta
- Si la pregunta **no tiene topic_id**, considerar asignarla al tema correcto

---

## 14. Gestión de Feedbacks (Chat de Soporte)

Los feedbacks de usuarios usan un sistema de **3 tablas** diferente a las impugnaciones:

### 14.1 Tablas del Sistema de Feedback

| Tabla | Uso |
|-------|-----|
| `user_feedback` | Feedback inicial del usuario (mensaje, status) |
| `feedback_conversations` | Conversación asociada (puede haber varias por feedback) |
| `feedback_messages` | Mensajes individuales de la conversación |

### 14.2 Ver Feedbacks Pendientes

```javascript
// Feedbacks que necesitan respuesta
const { data: feedbacks } = await supabase
  .from('user_feedback')
  .select('id, message, status, user_id, created_at')
  .in('status', ['pending', 'in_progress'])
  .order('created_at', { ascending: true });
```

### 14.3 Responder a un Feedback

**IMPORTANTE:** Para que el mensaje aparezca en el UI, hay que insertarlo en `feedback_messages`, NO en `user_feedback.admin_response`.

```javascript
// 1. Buscar la conversación del feedback
const { data: conv } = await supabase
  .from('feedback_conversations')
  .select('id')
  .eq('feedback_id', feedbackId)
  .single();

// 2. Obtener un sender_id de admin válido
const { data: adminMsg } = await supabase
  .from('feedback_messages')
  .select('sender_id')
  .eq('is_admin', true)
  .limit(1)
  .single();

// 3. Insertar el mensaje
await supabase
  .from('feedback_messages')
  .insert({
    conversation_id: conv.id,
    sender_id: adminMsg.sender_id,
    is_admin: true,
    message: 'Hola [Nombre],\n\n[Tu respuesta]\n\nEquipo de Vence'
  });
```

> **Email y campana se envían automáticamente.** Al insertar un mensaje con `is_admin: true`, un trigger PostgreSQL (`send_feedback_notification`) crea la notificación de campana y envía email al usuario via `/api/send-support-email`. No hace falta llamar a ninguna API adicional. Ver sección 15 para más detalles.

### 14.4 Cerrar un Feedback

**⚠️ IMPORTANTE:** NO cerrar la conversación manualmente. El sistema la cierra automáticamente si el usuario no responde en unos días.

Después de responder:
1. La conversación queda en `waiting_user`
2. Si el usuario responde, vuelve a aparecer como pendiente
3. Si no responde en X días, se cierra automáticamente

```javascript
// Solo actualizar el feedback si es necesario (opcional)
await supabase
  .from('user_feedback')
  .update({ status: 'resolved' })
  .eq('id', feedbackId);

// ❌ NO HACER: cerrar conversación manualmente
// await supabase
//   .from('feedback_conversations')
//   .update({ status: 'closed' })
//   .eq('feedback_id', feedbackId);
```

### 14.5 Corregir Fechas (si se alteraron)

Si el `updated_at` se actualizó y las conversaciones aparecen desordenadas:

```javascript
// Restaurar updated_at al valor original (created_at)
await supabase
  .from('user_feedback')
  .update({ updated_at: originalCreatedAt })
  .eq('id', feedbackId);
```

### 14.6 Estados de Conversación

| Estado | Significado |
|--------|-------------|
| `open` | Conversación activa |
| `waiting_user` | Admin respondió, esperando usuario |
| `closed` | Conversación cerrada |

### 14.7 El UI muestra "X por responder" cuando:

- La conversación NO está cerrada (`status != 'closed'`)
- Y el último mensaje NO es del admin (`is_admin = false`)
- O la conversación está vacía (sin mensajes)

### 14.8 Flujo Completo para Responder Feedback

```
1. "revisar si hay nuevas impugnaciones pendientes o feedback"
   ↓
2. Claude muestra feedbacks pendientes con resumen
   ↓
3. "investiga el feedback de [usuario]"
   ↓
4. Claude obtiene: user_id, mensaje, URL, user_agent (móvil/PC)
   ↓
5. Claude investiga eventos del usuario si es necesario
   ↓
6. Claude propone respuesta personalizada
   ↓
7. Usuario aprueba → Claude inserta en feedback_messages y cierra
```

### 14.9 Ejemplo Real: Usuario no puede guardar PDF

**Feedback recibido:**
```
Usuario: Osruben 7 (osruben75@gmail.com)
Plan: FREE
Mensaje: "Hola.como se guarda el PDF no me deja gracias"
URL: /tramitacion-procesal/temario/tema-6
User Agent: Android 10 / Chrome Mobile
```

**Investigación:**
- Usuario registrado hace 3 minutos (nuevo)
- Estaba en la página del temario
- Usa móvil Android

**Diagnóstico:**
- El PDF está disponible para usuarios FREE (no hay restricción)
- En móvil, `window.print()` abre diálogo del sistema
- Hay que elegir "Guardar como PDF" en vez de impresora

**Respuesta enviada:**
```
Hola Ruben,

Para guardar el PDF desde el móvil:
1. Pulsa el botón "Imprimir PDF"
2. En el diálogo que aparece, elige "Guardar como PDF" (en vez de una impresora)
3. Se descargará a tu carpeta de descargas

Un saludo,
Equipo de Vence
```

**Código ejecutado:**
```javascript
const conversationId = "97dc13f3-c103-4a01-8a35-81ef14b79949";
const adminId = "2fc60bc8-1f9a-42c8-9c60-845c00af4a1f"; // Admin que responde

// 1. Insertar mensaje en la conversación
await supabase
  .from("feedback_messages")
  .insert({
    conversation_id: conversationId,
    sender_id: adminId,
    is_admin: true,
    message: mensaje
  });

// 2. Actualizar timestamp de la conversación (NO cerrar)
await supabase
  .from("feedback_conversations")
  .update({
    status: "waiting_user",  // Esperando respuesta del usuario
    last_message_at: new Date().toISOString()
  })
  .eq("id", conversationId);

// ❌ NO cerrar manualmente - el sistema lo hace automáticamente
```

### 14.10 Cómo Investigar al Usuario

Para entender mejor el contexto del feedback:

```javascript
// 1. Datos del feedback
const { data: feedback } = await supabase
  .from("user_feedback")
  .select("*")
  .eq("id", feedbackId)
  .single();

// user_agent revela: móvil vs PC, navegador, sistema operativo
console.log("User Agent:", feedback.user_agent);
// Ej: "Mozilla/5.0 (Linux; Android 10; K)..." = Móvil Android

// 2. Perfil del usuario
const { data: profile } = await supabase
  .from("user_profiles")
  .select("full_name, email, plan_type, created_at, target_oposicion")
  .eq("id", feedback.user_id)
  .single();

// 3. Eventos recientes (si existen)
const { data: events } = await supabase
  .from("user_events")
  .select("event_type, page_url, created_at")
  .eq("user_id", feedback.user_id)
  .gte("created_at", fechaHoy)
  .order("created_at", { ascending: true });
```

### 14.11 Obtener Admin ID para Respuestas

El `sender_id` debe ser un admin válido. Para obtenerlo:

```javascript
// Buscar un admin que haya respondido antes
const { data: adminMsg } = await supabase
  .from("feedback_messages")
  .select("sender_id")
  .eq("is_admin", true)
  .limit(1)
  .single();

const adminId = adminMsg.sender_id;
// Resultado: "2fc60bc8-1f9a-42c8-9c60-845c00af4a1f" (Manuel)
```

---

## 15. Sistema de Notificaciones Automáticas (Triggers PostgreSQL)

Las notificaciones al usuario (email y campana) se envían **automáticamente** mediante triggers de PostgreSQL que usan la extensión `http` para llamar a las APIs de la app. Esto garantiza que las notificaciones se envíen independientemente de cómo se haga la operación (panel admin, Claude Code, o consulta SQL directa).

### 15.1 Trigger de Impugnaciones

**Trigger:** `trigger_send_dispute_email` en tabla `question_disputes`
**Función:** `send_dispute_email_notification()`
**Evento:** `AFTER UPDATE`

**Comportamiento:**
- Se activa cuando el `status` cambia a `resolved` o `rejected`
- Envía los datos de la disputa directamente en el payload (no re-lee de BD)
- Llama a `/api/send-dispute-email` via `http_post()`
- El endpoint envía email al usuario con la respuesta del admin

**Payload enviado:**
```json
{
  "disputeId": "uuid",
  "status": "resolved",
  "adminResponse": "Hola...",
  "resolvedAt": "2026-02-24T...",
  "userId": "uuid",
  "questionId": "uuid"
}
```

**Endpoint:** `/api/send-dispute-email` acepta 3 formatos:
1. **Trigger PG** (este): `{ disputeId, status, adminResponse, userId, questionId }`
2. **Supabase Webhook**: `{ record: { id, user_id, ... } }`
3. **Admin panel**: `{ disputeId }` (solo ID, datos se leen de BD)

### 15.2 Trigger de Feedbacks

**Trigger:** `trigger_send_feedback_notification` en tabla `feedback_messages`
**Función:** `send_feedback_notification()`
**Evento:** `AFTER INSERT`

**Comportamiento:**
- Se activa cuando se inserta un mensaje con `is_admin = true`
- Busca el `user_id` desde `feedback_conversations`
- Crea notificación de **campana** en `notification_logs`
- Envía **email** via `/api/send-support-email`
- El email se omite si el usuario está navegando activamente (lógica en el endpoint)

**Acciones del trigger:**
1. **Campana:** Inserta en `notification_logs` con preview del mensaje
2. **Email:** Llama a `/api/send-support-email` con `{ userId, adminMessage, conversationId }`

### 15.3 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│ Acción (Panel Admin / Claude Code / SQL directo)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL Trigger (AFTER UPDATE/INSERT)                     │
│  - Disputa: status → resolved/rejected                       │
│  - Feedback: is_admin = true                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ http_post()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ API Endpoint (Vercel)                                        │
│  - /api/send-dispute-email                                   │
│  - /api/send-support-email                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ sendEmailV2()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Resend (email) + notification_logs (campana)                 │
└─────────────────────────────────────────────────────────────┘
```

### 15.4 Dependencia: Extensión `http`

Los triggers usan la extensión PostgreSQL `http` para hacer llamadas HTTP. Esta extensión debe estar habilitada en Supabase:

```sql
-- Verificar que la extensión está habilitada
SELECT * FROM pg_extension WHERE extname = 'http';
```

### 15.5 Verificar que los Triggers Existen

```sql
-- Listar triggers en question_disputes
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'question_disputes';

-- Listar triggers en feedback_messages
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'feedback_messages';
```

### 15.6 URL Base de los Triggers

Los triggers usan `current_setting('app.base_url', true)` con fallback a `https://www.vence.es`. Si se necesita cambiar la URL (ej: staging):

```sql
-- Cambiar URL base (solo para la sesión actual)
SET app.base_url = 'https://staging.vence.es';
```

### 15.7 Debugging de Triggers

Si un email no se envía, verificar:

1. **¿El trigger existe?** → Consulta de sección 15.5
2. **¿La extensión `http` funciona?** → `SELECT status FROM http_get('https://httpbin.org/get');`
3. **¿El endpoint está desplegado?** → `curl https://www.vence.es/api/send-dispute-email` (debe devolver 400, no 404)
4. **¿Hay errores en los logs?** → Los triggers usan `RAISE WARNING` para errores, visible en logs de PostgreSQL
