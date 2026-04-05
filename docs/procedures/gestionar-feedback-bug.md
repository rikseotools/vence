# Gestionar Feedback de Bug

Procedimiento cuando un usuario reporta un bug vía soporte o feedback.

## 1. Identificar al usuario

El feedback tiene `user_id`. Obtener perfil:

```js
const { data: profile } = await supabase.from('user_profiles')
  .select('id, email, full_name, plan_type, target_oposicion')
  .eq('id', userId).single();
```

## 2. Verificar versión del deploy

Los error logs incluyen `[v:xxx]` con la versión del cliente y `deploy_version` con la del servidor.

```js
// Errores recientes del usuario
const { data: errors } = await supabase.from('validation_error_logs')
  .select('created_at, error_type, error_message, deploy_version')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });
```

**Si `deploy_version` es viejo** → el usuario tiene código cacheado. Desde abril 2026, el hook `useVersionCheck` fuerza recarga al volver de background. Si aún tiene versión vieja, no ha recargado.

**Commit actual de producción:**
```bash
git log --oneline -1
```

## 3. Reconstruir journey

Seguir **docs/procedures/investigar-journey-usuario.md**. Resumen rápido:

```js
// Timeline completa del usuario
const { data } = await supabase.from('user_interactions')
  .select('event_type, action, element_text, page_url, created_at')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA_INICIO')
  .order('created_at', { ascending: true });
```

**Qué buscar:**
- Páginas visitadas (`page_view`)
- Respuestas seleccionadas (`test_answer_selected`, `psycho_answer_selected`)
- Tests completados (`test_test_completed`, `psycho_test_completed`)
- Navegación entre temas sin recargar (posible bug de sesión)

## 4. Verificar tests guardados vs interacciones

Comparar lo que el usuario hizo (interacciones) con lo que se guardó (tests + test_questions):

```js
// Tests del usuario hoy
const { data: tests } = await supabase.from('tests')
  .select('id, score, total_questions, is_completed, created_at, test_type')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });

// Para cada test, contar respuestas guardadas
for (const t of tests) {
  const { count } = await supabase.from('test_questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', t.id);
  // Si count < total_questions → respuestas perdidas
}

// Comparar con interacciones
const { count: interactions } = await supabase.from('user_interactions')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('event_type', 'test_answer_selected')
  .gte('created_at', 'FECHA');
// Si interactions > 0 pero tests = 0 → sesión no se creó
```

## 5. Verificar errores API

```js
const { data: errors } = await supabase.from('validation_error_logs')
  .select('*')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA')
  .order('created_at', { ascending: false });
```

**Tipos de error comunes:**
| Error | Causa | Solución |
|-------|-------|----------|
| Watchdog timeout 12s | Código viejo sin optimistic UI | Usuario debe recargar |
| FK violation test_id | Sesión no creada o ID incorrecto | Bug de sesión |
| Validación Zod 400 | sessionId null | Sesión no se creó antes de responder |
| Network/Load failed | Red del usuario inestable | No es nuestro bug |

## 5b. Diagnóstico fallo silencioso de sesión (desde 05/04/2026)

Si el usuario reporta "mi test no se guardó" y cuadra: 0 tests en BD + N respuestas en interactions + 0 errores API, **ya no es silencioso** — desde abril 2026 `createDetailedTestSession` loguea en `validation_error_logs` cuando falla.

**Causas esperadas (endpoint = `createDetailedTestSession`):**

| error_message | Causa | Acción |
|---------------|-------|--------|
| "userId es requerido" | Auth context no cargado al montar TestLayout | Bug de timing client-side |
| "Zod validation failed" | Datos preguntas malformados | Verificar topic_scope |
| "0 preguntas disponibles" | topic_scope vacío o todas preguntas desactivadas | Revisar datos tema |
| "Supabase session expired (no access_token)" | Token caducado durante el test | User debe re-loguear |
| "Supabase INSERT error 42501" | RLS bloquea el insert | Bug policy BD |
| "Supabase INSERT error 23503" | FK rota (user_id no existe) | Corrupción datos |
| "Supabase INSERT returned empty data" | Bug cliente Supabase | Investigar |

**Query diagnóstica:**

```js
// Errores de creación de sesión de un usuario específico
const { data } = await supabase.from('validation_error_logs')
  .select('created_at, endpoint, error_message, deploy_version')
  .eq('user_id', userId)
  .eq('endpoint', 'createDetailedTestSession')
  .order('created_at', { ascending: false });
```

## 5c. Verificar versión del cliente al fallar (desde 05/04/2026)

`user_interactions` y `tests` ahora incluyen `deploy_version` (hash commit 8 chars). Permite trazar qué versión del JS tenía el usuario al fallar.

```js
// ¿Qué versión tenía el usuario en sus interacciones del día del bug?
const { data } = await supabase.from('user_interactions')
  .select('deploy_version, created_at')
  .eq('user_id', userId)
  .gte('created_at', 'FECHA_INICIO')
  .not('deploy_version', 'is', null)
  .limit(1);

// Si deploy_version viejo → cache del navegador con versión anterior
// Si deploy_version actual → bug en el código, investigar esa versión
```

## 6. Clasificar el bug

| Situación | Diagnóstico | Acción |
|-----------|-------------|--------|
| deploy_version viejo + watchdog timeouts | Código cacheado | Pedir que recargue |
| 0 tests pero >0 interacciones | Sesión no se creó | Investigar TestLayout |
| Tests con saved:0 | enqueueAnswer no envió | Verificar sessionId en cola |
| Tests con saved parcial (ej: 5/25) | Cola se detuvo a mitad | Investigar flush de cola |
| Exámenes con preguntas faltantes | Preguntas en blanco no guardadas | Revisar ExamLayout |
| "No me muestra Premium" | Perfil no cargó a tiempo | Bug de AuthContext |
| "No me cuenta preguntas" | daily_question_usage no registra premiums | Por diseño (premiums no cuentan) |

## 7. Responder al usuario

**Si es versión vieja:**
> Hemos detectado que tu navegador tenía una versión anterior. Cierra la pestaña y vuelve a abrir Vence (o pulsa Ctrl+Shift+R). El problema debería resolverse.

**Si es bug real (arreglado):**
> Hemos detectado y arreglado un problema técnico que afectaba a [descripción]. El arreglo ya está aplicado. Sentimos las molestias.

**Si es bug real (pendiente):**
> Hemos identificado el problema y estamos trabajando en la solución. Te avisaremos cuando esté arreglado.

**Si no es un bug:**
> [Explicar el comportamiento esperado]. Si necesitas ayuda, aquí estamos.

## 8. Marcar como revisado

```js
await supabase.from('user_feedback')
  .update({ status: 'resolved', admin_response: 'RESPUESTA' })
  .eq('id', feedbackId);
```

## Script rápido

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userId = 'PONER_USER_ID_AQUI';
const fecha = '2026-04-04T00:00:00';

(async () => {
  // 1. Perfil
  const { data: profile } = await supabase.from('user_profiles')
    .select('email, full_name, plan_type').eq('id', userId).single();
  console.log('Perfil:', JSON.stringify(profile));

  // 2. Tests
  const { data: tests } = await supabase.from('tests')
    .select('id, score, total_questions, is_completed, created_at')
    .eq('user_id', userId).gte('created_at', fecha)
    .order('created_at', { ascending: false });
  for (const t of tests || []) {
    const { count } = await supabase.from('test_questions')
      .select('*', { count: 'exact', head: true }).eq('test_id', t.id);
    console.log(\`[\${t.created_at}] score:\${t.score}/\${t.total_questions} saved:\${count}\`);
  }

  // 3. Interacciones
  const { count } = await supabase.from('user_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('event_type', 'test_answer_selected')
    .gte('created_at', fecha);
  console.log('Respuestas (interactions):', count);

  // 4. Errores
  const { data: errors } = await supabase.from('validation_error_logs')
    .select('created_at, error_type, error_message, deploy_version')
    .eq('user_id', userId).gte('created_at', fecha);
  console.log('Errores:', errors?.length);
  for (const e of errors || []) {
    console.log(\`  \${e.error_type}: \${e.error_message?.slice(0,80)} [deploy:\${e.deploy_version}]\`);
  }

  // 5. Impugnaciones del usuario
  const { data: disputes } = await supabase.from('question_disputes')
    .select('id, question_id, dispute_type, description, status, created_at, admin_response')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
  console.log('\\nImpugnaciones:', disputes?.length);
  for (const d of disputes || []) {
    console.log(\`  [\${d.created_at}] \${d.status} - \${d.description?.slice(0,80)}\`);
  }

  // 6. Impugnaciones psicotécnicas
  const { data: psicoDisputes } = await supabase.from('psychometric_question_disputes')
    .select('id, question_id, dispute_type, description, status, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(5);
  if (psicoDisputes?.length) {
    console.log('Impugnaciones psicotécnicas:', psicoDisputes?.length);
    for (const d of psicoDisputes || []) {
      console.log(\`  [\${d.created_at}] \${d.status} - \${d.description?.slice(0,80)}\`);
    }
  }
})();
"
```

## Manuales relacionados

- **Investigar journey de usuario:** `docs/procedures/investigar-journey-usuario.md` — Timeline completa de interacciones, tests, sesiones, errores.
- **Resolver impugnaciones:** `docs/maintenance/impugnaciones-claude-code.md` — Flujo completo para analizar, corregir y cerrar impugnaciones. **NUNCA cerrar sin aprobación explícita.**
- **Revisar chat IA:** `docs/maintenance/revisar-chat-ai.md` — Analizar conversaciones del chat IA, detectar fallos de routing y mejorar prompts.
- **Verificar epígrafe vs topic_scope:** `docs/maintenance/verificar-epigrafe-topic-scope.md` — Cuando el usuario reporta que "los títulos no coinciden con el contenido" o "falta ley X en un tema". Incluye flujo manual (1 tema) y con agentes (bulk).
