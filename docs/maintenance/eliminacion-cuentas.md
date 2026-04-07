# Manual: Eliminación de Cuentas de Usuario

Este documento describe el proceso para eliminar cuentas de usuario cuando lo solicitan (GDPR compliance).

## Resumen del Proceso

1. **Investigar al usuario** - Entender por qué se va
2. **Cerrar feedbacks relacionados** - Limpiar tickets
3. **Eliminar via API** - Borrar todos los datos (incluye `deleted_users_log` para evitar FK)
4. **Registrar en `deleted_users_log`** - Re-insertar después de eliminar auth.users

## 1. Investigar al Usuario (IMPORTANTE)

Antes de eliminar, investigar el comportamiento del usuario para aprender y mejorar.

> **IMPORTANTE:** Seguir el procedimiento completo de `docs/procedures/investigar-journey-usuario.md` para reconstruir el journey del usuario: `user_interactions` (clicks, page views), sesiones, tests, errores del servidor, etc. El journey revela *por qué* se va, no solo *qué* hizo.

```javascript
const userId = 'UUID_DEL_USUARIO';

// 1. Perfil y origen
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single();

console.log('Email:', profile.email);
console.log('Plan:', profile.plan_type);
console.log('Registrado:', profile.created_at);
console.log('Fuente:', profile.registration_source);
console.log('Funnel:', profile.registration_funnel);
console.log('URL registro:', profile.registration_url);
console.log('Ciudad:', profile.ciudad);

// 2. Actividad
const { count: testCount } = await supabase
  .from('test_sessions')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId);

const { count: chatCount } = await supabase
  .from('ai_chat_logs')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId);

console.log('Tests realizados:', testCount);
console.log('Mensajes chat:', chatCount);

// 3. Onboarding
console.log('Saltó onboarding:', profile.onboarding_skip_count > 0 ? 'Sí' : 'No');
console.log('Completó onboarding:', profile.onboarding_completed ? 'Sí' : 'No');
```

### Preguntas clave a responder:

| Pregunta | Por qué importa |
|----------|-----------------|
| ¿Cuánto tiempo estuvo activo? | Si fue < 10 min, algo falló en el onboarding |
| ¿Completó el onboarding? | Si lo saltó, quizás es muy largo |
| ¿Hizo algún test? | Si no, no entendió el producto |
| ¿De dónde vino? | Para evaluar calidad del tráfico |
| ¿Qué URL de registro? | Identifica páginas con mala conversión |

### Investigar el journey paso a paso (CRÍTICO)

**El valor de investigar no es solo saber por qué se fue — es descubrir bugs y mala UX que afectan a TODOS los usuarios.**

Reconstruir el journey completo con `user_interactions`:

```javascript
const { data: interactions } = await supabase
  .from('user_interactions')
  .select('event_type, page_url, created_at, metadata')
  .eq('user_id', userId)
  .order('created_at')

// Reconstruir cronología paso a paso:
// - page_view: a dónde navegó
// - click: qué pulsó (y cuántos clicks frustrados = confusión)
// - page_exit: cuándo salió
// - test_answer_selected: respondió una pregunta
// - test_navigation_next: pasó a la siguiente
// - test_test_completed: completó un test
```

**Señales de frustración a buscar:**
- Muchos clicks en la misma página en poco tiempo (no encuentra lo que busca)
- Ida y vuelta entre páginas (está perdido)
- page_exit sin test_test_completed (abandonó un test a medias)
- Visita a /test-recuperado sin test pendiente (redirect confuso)
- Visita a /perfil justo antes de pedir eliminación (buscaba cómo irse)

**Señales de bugs a buscar:**
- `test_test_completed` en user_interactions pero 0 registros en `tests` o `user_test_sessions` → respuestas no se guardaron
- Redirect a /test-recuperado cuando el usuario ya estaba logueado → el auth callback redirigió sin necesidad
- Muchos clicks en una página que debería ser simple → UI confusa o elementos que no responden

### Ejemplo Real: Tania (07-Abr-2026) — 3 bugs descubiertos

**Journey reconstruido:**
```
09:49 — Hizo 2 preguntas de LO 3/2018 sin registro (pre-registro)
09:52 — Se registró con Google
09:53 — Redirigida a /test-recuperado → recuperó 2 preguntas → "Test recuperado - Tema 0"
09:53 — 10+ clicks frustrados en /test-recuperado (nombre confuso, no entendía)
09:54 — Fue a /leyes/lo-3-2018, navegó la ley
09:55 — Empezó test avanzado de 25 preguntas
10:04 — Completó el test (test_test_completed en interacciones)
10:04 — Clicks buscando resultados/cómo salir
10:05 — Entró a otro test, salió sin completar
10:06 — Botón atrás del navegador → /test-recuperado (otra vez)
10:06 — Fue a /perfil → pidió eliminar cuenta
```

**Bugs descubiertos:**
1. **"Test recuperado - Tema 0"** — nombre inútil. Tests de leyes tienen tema=0. Fix: consultar ley de la primera pregunta en BD → "Test recuperado - LO 3/2018"
2. **25 respuestas PERDIDAS** — completó 25 preguntas pero 0 se guardaron en BD. Causa: `!tema` bloqueaba `tema=0` al crear la sesión de test. Sin sesión, `enqueueAnswer` no guardaba. Fix: `!tema` → `tema == null`
3. **Doble redirect a /test-recuperado** — el auth callback usaba `location.href` que dejaba /test-recuperado en el historial del navegador. El botón atrás la llevaba de vuelta. Fix: `location.replace()` para no dejar rastro en historial

**Impacto:** Estos 3 bugs afectaban a TODOS los tests de leyes (/leyes/X/avanzado), no solo a Tania. Sin la investigación del journey, nunca los habríamos descubierto.

### Documentar el motivo

Antes de eliminar, anotar en `deletion_reason` un resumen que incluya los hallazgos del journey:

```
// Ejemplos de motivos:
"Usuario nuevo (0 tests). Se registró, saltó onboarding, pidió eliminar en 6 min. Posible problema de UX."
"Usuario premium canceló. 45 tests en 3 meses. Motivo: cambió a otra plataforma."
"Usuario free inactivo 60 días. Solicitó eliminación por email."
"PSX Sergas custom. Completó 25 preguntas LO 3/2018 pero respuestas perdidas (bug tema=0). Frustración con redirect /test-recuperado. 14 min activa."
```

## 2. Registrar en deleted_users_log

**SIEMPRE** registrar antes de eliminar para estadísticas y GDPR:

```javascript
await supabase
  .from('deleted_users_log')
  .insert({
    original_user_id: userId,
    email: profile.email,
    full_name: profile.full_name,
    plan_type: profile.plan_type,
    target_oposicion: profile.target_oposicion,
    registered_at: profile.created_at,
    days_active: Math.floor((Date.now() - new Date(profile.created_at)) / 86400000),
    total_tests: testCount || 0,
    total_payments: 0, // Consultar tabla payments si aplica
    deletion_reason: 'DESCRIBIR MOTIVO Y COMPORTAMIENTO',
    requested_via: 'feedback' // o 'email', 'admin', etc.
  });
```

### Campos de deleted_users_log

| Campo | Descripción |
|-------|-------------|
| `original_user_id` | UUID original del usuario |
| `email` | Email para referencia |
| `full_name` | Nombre completo |
| `plan_type` | free/premium |
| `target_oposicion` | Qué oposición estudiaba |
| `registered_at` | Cuándo se registró |
| `days_active` | Días entre registro y eliminación |
| `total_tests` | Tests realizados (engagement) |
| `total_payments` | Total pagado (para análisis de churn) |
| `deletion_reason` | **IMPORTANTE**: Describir comportamiento y posible causa |
| `requested_via` | Cómo solicitó la eliminación |

## 3. Cerrar Feedbacks Relacionados

Si la solicitud vino por feedback:

```javascript
await supabase
  .from('user_feedback')
  .update({
    status: 'resolved',
    resolved_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('type', 'account_deletion');
```

## 4. Eliminar Usuario via API

```javascript
const response = await fetch('http://localhost:3000/api/admin/delete-user', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId })
});

const result = await response.json();
console.log(result.success ? '✅ Eliminado' : '❌ Error:', result.error);
```

### Tablas que limpia la API

La API `/api/admin/delete-user` elimina datos de:

1. `pwa_events`
2. `pwa_sessions`
3. `notification_events`
4. `email_events`
5. `email_preferences`
6. `user_notification_metrics`
7. `user_question_history`
8. `user_streaks`
9. `ai_chat_logs`
10. `detailed_answers`
11. `test_questions`
12. `tests`
13. `test_sessions`
14. `user_sessions`
15. `user_subscriptions`
16. `conversion_events`
17. `user_feedback`
18. `question_disputes`
19. `deleted_users_log`
20. `user_roles`
21. `user_profiles`
22. `auth.users`

> **IMPORTANTE:** `deleted_users_log` se elimina ANTES de `auth.users` para evitar FK constraint. El log debe registrarse DESPUÉS de la eliminación si se quiere preservar (re-insertar sin FK).

## 5. Verificación

Confirmar que el usuario fue eliminado:

```javascript
const { data: check } = await supabase
  .from('user_profiles')
  .select('id')
  .eq('id', userId);

console.log(check?.length === 0 ? '✅ Usuario eliminado' : '❌ Aún existe');
```

## Ejemplo Completo: Proceso con Claude Code

```
1. "hay feedbacks de eliminación de cuenta?"
   ↓
2. Claude lista las solicitudes pendientes
   ↓
3. "investiga al usuario [nombre]"
   ↓
4. Claude muestra:
   - Perfil completo
   - Fuente de registro
   - Actividad (tests, chat, etc.)
   - Tiempo activo
   - Comportamiento antes de pedir eliminación
   ↓
5. Claude propone motivo para deletion_reason
   ↓
6. "aplicar eliminación"
   ↓
7. Claude ejecuta los 4 pasos y confirma
```

## Ejemplo Real: Ana María (07-Feb-2026)

**Investigación:**
- Se registró a las 17:49 con Google
- Saltó el onboarding
- 6 minutos después pidió eliminar cuenta (2 veces, doble clic)
- 0 tests, 0 chat, 0 pagos
- Vino de página de test personalizado (orgánico)
- Ciudad: Boadilla del Monte

**Motivo registrado:**
```
Usuario nuevo (0 tests). Se registró, saltó onboarding, pidió eliminar en 6 min.
Posible problema de UX o expectativas no cumplidas.
```

**Aprendizaje:**
- El botón de eliminar cuenta no tenía feedback visual → Fix implementado
- Usuarios que saltan onboarding tienen mayor tasa de abandono

## Análisis Periódico

Consultar `deleted_users_log` mensualmente para identificar patrones:

```sql
-- Usuarios que se fueron en menos de 1 día
SELECT deletion_reason, COUNT(*)
FROM deleted_users_log
WHERE days_active < 1
GROUP BY deletion_reason;

-- Por fuente de registro
SELECT
  requested_via,
  AVG(days_active) as avg_days,
  AVG(total_tests) as avg_tests,
  COUNT(*) as total
FROM deleted_users_log
GROUP BY requested_via;
```
