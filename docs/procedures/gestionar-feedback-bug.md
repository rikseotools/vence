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

## Paso 10: Enviar la respuesta y cerrar — `/api/v2/feedback/respond` (post-14/04/2026)

> 🆕 **Post-refactor (14/04/2026):** usa el endpoint `POST /api/v2/feedback/respond`. Antes había que hacer 5 pasos manuales (INSERT message + INSERT notification_log + fetch send-support-email + cerrar conversation + cerrar feedback). Ahora **una sola llamada atómica** encapsula todo con garantías transaccionales.

### Casos de uso

**A) Responder al usuario con mensaje (flujo normal)**

```js
// Obtener Bearer token admin (generateLink + verifyOtp, igual que impugnaciones)
const { data: link } = await adminClient.auth.admin.generateLink({
  type: 'magiclink', email: 'manueltrader@gmail.com',
});
const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: ses } = await anonClient.auth.verifyOtp({
  token_hash: link.properties.hashed_token, type: 'magiclink',
});
const accessToken = ses.session.access_token;

const res = await fetch('https://www.vence.es/api/v2/feedback/respond', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    feedbackId,
    adminUserId,                   // 2fc60bc8-... (Manuel)
    message: borradorAprobado,
    finalStatus: 'resolved',       // default si hay mensaje
  }),
});

const result = await res.json();
// result = {
//   success: true, feedbackId, conversationId, messageId,
//   bellSent: boolean, bellSkipReason: 'external_contact' | 'send_bell_false_flag' | null,
//   emailSent: boolean, emailId: string | null, emailError: string | null,
//   emailSkipReason: 'empty_message' | 'no_user_email' | 'user_actively_browsing' | 'user_preferences' | 'send_email_false_flag' | null,
//   finalStatus: 'resolved' | 'dismissed' | null,
// }
```

**B) Cierre silencioso (spam, duplicado, prueba propia)**

```js
await fetch('https://www.vence.es/api/v2/feedback/respond', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({
    feedbackId,
    adminUserId,
    finalStatus: 'dismissed',
    // Sin message → no INSERT, no campana, no email. Solo UPDATE de status.
  }),
});
```

**C) Responder sin enviar email** (ej. usuario sin email, o notificación interna)

```js
body: JSON.stringify({
  feedbackId, adminUserId,
  message: borrador,
  sendEmail: false,    // solo campana
})
```

**D) Responder sin campana** (poco habitual)

```js
body: JSON.stringify({
  feedbackId, adminUserId,
  message: borrador,
  sendBell: false,     // solo email
})
```

### Notas

- **El endpoint requiere Bearer token admin.** Validado contra email whitelist (mismo patrón que `/api/v2/dispute/resolve`).
- **Atomicidad:** INSERT de message + campana + UPDATE de estado van en una transacción Drizzle. Si falla cualquiera, se revierte todo (excepto el email, que va después de la TX para no rollback por fallos de Resend).
- **Skip automático de campana** para contactos externos (`user_id = null`) — no se puede insertar por FK constraint. `bellSkipReason` = `'external_contact'`.
- **Skip automático de email** si:
  - No hay mensaje (`empty_message`).
  - El usuario no tiene email (`no_user_email`).
  - El usuario tiene sesión activa <5s (`user_actively_browsing`) — verá la campana.
  - El usuario optó por no recibir emails de soporte (`user_preferences`).
  - El caller pasó `sendEmail: false` (`send_email_false_flag`).
- **Fallos de email NO revierten el feedback:** la respuesta incluye `emailError` con el motivo. El feedback queda resuelto y el email puede reintentarse manualmente si hace falta.
- **Contactos externos con email:** el endpoint nuevo skippea automáticamente (emailSkipReason='no_user_email'). Para mandarles email, llamar también a `/api/send-support-email` con el email del payload — ese endpoint sigue vivo para ese caso concreto.

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
