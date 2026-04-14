# Gestionar Feedback de Bug

**Este manual es una METODOLOGÍA DE INVESTIGACIÓN genérica.** No intenta diagnosticar bugs — te enseña DÓNDE buscar datos para que TÚ (Claude) hagas el diagnóstico. Funciona para cualquier tipo de bug: tests no guardados, contenido incorrecto, UI rota, errores de pago, etc.

**Principio: recopilar datos primero, diagnosticar después.** Ejecuta TODOS los pasos antes de sacar conclusiones.

## Paso 1: Identificar al usuario y contexto

```js
// Perfil del usuario
const { data: profile } = await supabase.from('user_profiles')
  .select('id, email, full_name, plan_type, target_oposicion')
  .eq('id', userId).single();
```

Datos clave: **plan_type** (free/premium afecta límites), **target_oposicion** (qué oposición usa).

## Paso 2: Verificar qué versión del código tiene el usuario

```js
// deploy_version en interacciones recientes
const { data } = await supabase.from('user_interactions')
  .select('deploy_version, created_at')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .not('deploy_version', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);
```

```bash
# Commit actual en producción
git log --oneline -1
```

Si el `deploy_version` del usuario NO coincide con el commit actual → tiene código cacheado. Hook `useVersionCheck` fuerza recarga al volver de background, pero si no ha cambiado de pestaña no se activa.

## Paso 3: Reconstruir el journey completo del usuario

```js
// Timeline: QUÉ hizo el usuario y CUÁNDO
const { data } = await supabase.from('user_interactions')
  .select('event_type, action, element_text, page_url, deploy_version, created_at')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA_INICIO')
  .order('created_at', { ascending: true });
```

**Qué buscar en el journey:**
- `page_view` → páginas visitadas (ruta del bug)
- `test_answer_selected` → respuestas dadas
- `test_test_completed` → tests terminados
- `page_exit` → cuándo sale de la página
- Patrones: ¿navegó entre temas sin recargar? ¿Hizo muchos tests seguidos? ¿Estuvo horas sin cerrar?

Ver también: `docs/procedures/investigar-journey-usuario.md`

## Paso 4: Comparar lo que hizo vs lo que se guardó

```js
// Tests del usuario en el periodo del bug
const { data: tests } = await supabase.from('tests')
  .select('id, score, total_questions, is_completed, created_at, test_type, deploy_version')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });

// Para cada test, contar respuestas guardadas
for (const t of tests) {
  const { count } = await supabase.from('test_questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', t.id);
  console.log(`[${t.created_at}] ${t.test_type} score:${t.score}/${t.total_questions} saved:${count} done:${t.is_completed} [v:${t.deploy_version}]`);
}

// Total interacciones de respuesta
const { count: interactions } = await supabase.from('user_interactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('event_type', 'test_answer_selected')
  .gte('created_at', 'FECHA');

// daily_question_usage
const { data: usage } = await supabase.from('daily_question_usage')
  .select('date, questions_used')
  .eq('user_id', userId)
  .gte('date', 'FECHA')
  .order('date', { ascending: false });
```

**Qué cruzar:**
- `interactions` > 0 pero `tests` = 0 → sesión de test no se creó
- `tests` con `saved:0` → respuestas no llegaron a `test_questions`
- `tests` con `saved < total_questions` → algunas respuestas se perdieron a mitad
- `daily_question_usage` null → contador de preguntas no se actualiza

## Paso 5: Buscar TODOS los errores del usuario

```js
// TODOS los errores, sin filtrar por endpoint
const { data: errors } = await supabase.from('validation_error_logs')
  .select('created_at, endpoint, error_type, error_message, deploy_version, http_status, severity')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });

// Si el userId podría no estar en el log (errores client-side anónimos),
// buscar también por endpoint + rango temporal
const { data: globalErrors } = await supabase.from('validation_error_logs')
  .select('created_at, endpoint, error_type, error_message, user_id, deploy_version')
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false })
  .limit(50);
```

**Campos clave de cada error:**
- `endpoint` → qué API o componente falló
- `error_message` → incluye `component:` si viene de client-side (answerSaveQueue, TestLayout, etc.)
- `deploy_version` → qué versión del código generó el error
- `http_status` → 400 (datos mal), 401 (auth), 500 (servidor)

## Paso 6: Verificar alcance — ¿es solo este usuario o es global?

```js
// Tests recientes con saved:0 de CUALQUIER usuario
const { data: recentTests } = await supabase.from('tests')
  .select('user_id, id, score, total_questions, is_completed, created_at')
  .gte('created_at', 'FECHA_RECIENTE')
  .eq('is_completed', true)
  .order('created_at', { ascending: false })
  .limit(50);

// Contar cuántos tienen saved:0
for (const t of recentTests) {
  const { count } = await supabase.from('test_questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', t.id);
  if (count === 0) console.log(`saved:0 → user:${t.user_id.slice(0,8)} test:${t.id.slice(0,8)}`);
}

// Errores globales recientes (sin filtrar usuario)
const { data: globalErrors } = await supabase.from('validation_error_logs')
  .select('endpoint, error_type, user_id, created_at')
  .gte('created_at', 'FECHA_RECIENTE')
  .order('created_at', { ascending: false })
  .limit(100);
```

Si afecta a 1 usuario → problema específico (auth, dispositivo, red).
Si afecta a muchos → bug de código o infraestructura.

## Paso 7: Leer el código fuente involucrado

Con los datos recopilados, TÚ (Claude) decides QUÉ código leer. No hay una lista fija — depende de lo que hayas encontrado. Ejemplos:

- Errores en `answerSaveQueue` → leer `utils/answerSaveQueue.ts`
- Sesión no creada → leer `components/TestLayout.tsx` (creación de sesión)
- Error de API → leer el endpoint en `app/api/`
- Contenido incorrecto → leer fetchers (`lib/testFetchers.ts`, `lib/lawFetchers.ts`)
- UI rota → leer componente mencionado en la URL del feedback

**Buscar en el código:**
- Catches vacíos (`catch {}`, `catch { return null }`) → puntos de fallo silencioso
- Returns sin logging → datos que se pierden sin traza
- Condiciones que asumen datos que pueden ser null

## Paso 8: Diagnosticar y proponer fix

Con datos + código, identificar:
1. **Causa raíz** (no el síntoma)
2. **Por qué no había logging** (si es fallo silencioso)
3. **Alcance** (1 usuario vs global)
4. **Fix** con código concreto
5. **Verificación** — cómo confirmar que el fix funciona

## Paso 9: Proponer borrador de respuesta al usuario

**Esperar a tener diagnóstico antes de redactar.** Proponer borrador al admin — NUNCA enviar directamente.

El borrador debe incluir:
- Qué pasó (sin tecnicismos)
- Si está arreglado o pendiente
- Qué debe hacer el usuario (recargar, esperar, nada)

## Paso 10: Enviar la respuesta y cerrar (5 pasos obligatorios — post-14/04/2026)

**No basta con actualizar `user_feedback.admin_response`.** Esa columna es solo metadato interno; el usuario no la ve. La respuesta real vive en `feedback_messages`, y el panel del admin lee de ahí.

> 🆕 **Cambio importante (14/04/2026):** se eliminó el trigger PG `send_feedback_notification` por bug de cold-start (mismo problema que impugnaciones, ver `impugnaciones-claude-code.md` §16). Ahora **TÚ debes** ejecutar manualmente el INSERT en `notification_logs` (campana) y la llamada a `/api/send-support-email` (email). Si te saltas estos pasos, el feedback queda resuelto en BD pero el usuario **no recibe nada**.

Los **5 pasos en orden**:

```js
// 1. Buscar la conversación del feedback
const { data: conv } = await supabase
  .from('feedback_conversations')
  .select('id')
  .eq('feedback_id', feedbackId)
  .single();

// 2. Insertar el mensaje del admin
const { data: msg } = await supabase.from('feedback_messages').insert({
  conversation_id: conv.id,
  sender_id: adminUserId,   // p.ej. 2fc60bc8-... (Manuel)
  is_admin: true,
  message: borradorAprobado
}).select().single();

// 3. Insertar en notification_logs (campana del usuario) — antes lo hacía el trigger
const messagePreview = borradorAprobado.length > 100
  ? borradorAprobado.slice(0, 100) + '...'
  : borradorAprobado;
await supabase.from('notification_logs').insert({
  user_id: targetUserId,            // user_id del FEEDBACK (no el admin)
  message_sent: 'El equipo de Vence: "' + messagePreview + '"',
  delivery_status: 'sent',
  context_data: {
    type: 'feedback_response',
    title: 'Nueva respuesta de Vence',
    conversation_id: conv.id,
    feedback_id: feedbackId
  }
});

// 4. Llamar a /api/send-support-email (envía email vía Resend) — antes lo hacía el trigger
await fetch('https://www.vence.es/api/send-support-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: targetUserId,           // null si feedback es de email externo no registrado
    adminMessage: borradorAprobado,
    conversationId: conv.id,
    email: emailExterno || null     // opcional, fallback para externos
  })
});

// 5. Cerrar la conversación + feedback
await supabase.from('feedback_conversations').update({
  status: 'closed',
  closed_at: new Date().toISOString(),
  last_message_at: new Date().toISOString(),
  admin_user_id: adminUserId
}).eq('id', conv.id);

await supabase.from('user_feedback').update({
  status: 'resolved',          // o 'dismissed' si es spam/ruido
  admin_response: borradorAprobado,
  resolved_at: new Date().toISOString()
}).eq('id', feedbackId);
```

**Notas:**
- **Pasos 3 y 4 son obligatorios.** Si te los saltas, no hay campana ni email. El trigger PG ya no existe.
- Si `targetUserId` es `null` (feedback de email externo no registrado), el endpoint usa `sendDirectEmail()` con el `email` del payload.
- El endpoint `/api/send-support-email` chequea `isUserActivelyBrowsing()` y skip email si el usuario tiene sesión activa <5s (ya verá la respuesta en la campana).
- Para feedbacks que no merecen respuesta (spam, pruebas propias), basta con `user_feedback.status='dismissed'` sin tocar las otras tablas (no INSERT, no notification, no email).

## Script rápido (todo en uno)

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = 'PONER_USER_ID';
const fecha = 'PONER_FECHA';  // ej: '2026-04-04T00:00:00'

(async () => {
  // 1. Perfil
  const { data: profile } = await supabase.from('user_profiles')
    .select('email, full_name, plan_type, target_oposicion').eq('id', userId).single();
  console.log('Perfil:', JSON.stringify(profile));

  // 2. Tests + saved count
  const { data: tests } = await supabase.from('tests')
    .select('id, score, total_questions, is_completed, created_at, test_type, deploy_version')
    .eq('user_id', userId).gte('created_at', fecha)
    .order('created_at', { ascending: false });
  console.log('\\nTests:', tests?.length);
  for (const t of tests || []) {
    const { count } = await supabase.from('test_questions')
      .select('*', { count: 'exact', head: true }).eq('test_id', t.id);
    console.log(\`  [\${t.created_at?.slice(0,16)}] \${t.test_type} score:\${t.score}/\${t.total_questions} saved:\${count} done:\${t.is_completed} [v:\${t.deploy_version}]\`);
  }

  // 3. Interacciones
  const { count: interactions } = await supabase.from('user_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('event_type', 'test_answer_selected')
    .gte('created_at', fecha);
  console.log('\\nRespuestas (interactions):', interactions);

  // 4. Errores (TODOS, sin filtrar endpoint)
  const { data: errors } = await supabase.from('validation_error_logs')
    .select('created_at, endpoint, error_type, error_message, deploy_version, http_status')
    .eq('user_id', userId).gte('created_at', fecha)
    .order('created_at', { ascending: false });
  console.log('\\nErrores:', errors?.length);
  for (const e of errors || []) {
    console.log(\`  [\${e.created_at?.slice(0,16)}] \${e.endpoint} | \${e.error_type}: \${e.error_message?.slice(0,100)} [v:\${e.deploy_version}] http:\${e.http_status}\`);
  }

  // 5. Daily usage
  const { data: usage } = await supabase.from('daily_question_usage')
    .select('date, questions_used').eq('user_id', userId).gte('date', fecha.slice(0,10));
  console.log('\\nDaily usage:', usage);

  // 6. Impugnaciones
  const { data: disputes } = await supabase.from('question_disputes')
    .select('id, dispute_type, description, status, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
  console.log('\\nImpugnaciones:', disputes?.length);
  for (const d of disputes || []) {
    console.log(\`  [\${d.created_at?.slice(0,10)}] \${d.status} - \${d.description?.slice(0,80)}\`);
  }
})();
"
```

## Manuales relacionados

- **Journey detallado:** `docs/procedures/investigar-journey-usuario.md`
- **Impugnaciones:** `docs/maintenance/impugnaciones-claude-code.md` — **NUNCA cerrar sin aprobación explícita.**
- **Chat IA:** `docs/maintenance/revisar-chat-ai.md`
- **Epígrafes vs topic_scope:** `docs/maintenance/verificar-epigrafe-topic-scope.md`
- **OEPs y convocatorias:** `docs/maintenance/oeps-convocatorias-seguimiento.md`
