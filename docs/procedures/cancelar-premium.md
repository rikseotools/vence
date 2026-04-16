# Cancelar Suscripción Premium (manual / admin)

> **Fecha:** 2026-04-16
> **Autor:** Manual creado tras caso Almudena Martos (15/04/2026)

Este manual explica cómo cancelar una suscripción Premium cuando el usuario no puede hacerlo por sí mismo (bug del modal, solicitud por email, obligación legal, etc.). La app ya ofrece auto-cancelación en `/perfil → Suscripción → Cancelar suscripción` (1 clic desde el refactor del 15/04/2026). Este procedimiento es **solo para admin** cuando el usuario no lo consigue.

## Cuándo cancelar manualmente

| Caso | Acción |
|---|---|
| Bug del flujo UI (el usuario lo intentó y no pudo) | Cancelar y avisar + investigar el bug |
| Solicitud por email/WhatsApp del usuario | Cancelar y confirmar por el mismo canal |
| Solicitud legal (RGPD, Ley Consumo — derecho de desistimiento) | Cancelar inmediatamente y registrar el motivo |
| Fraude, abuso, chargeback | Cancelar + marcar la cuenta (ver reglas antifraude) |
| Cancelación + reembolso | Cancelar primero, ver `docs/procedures/reembolsos.md` |

**Importante:** cancelar **NO** elimina la cuenta. El usuario mantiene su historial y puede reactivar antes de que termine su período actual. Para borrado RGPD, ver `docs/procedures/borrar-usuario.md` (si existe).

## Paso 1: Identificar al usuario y recoger datos

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const email = 'EMAIL_DEL_USUARIO';
  const { data: prof } = await s.from('user_profiles').select('id, email, full_name, plan_type, stripe_customer_id').eq('email', email).single();
  console.log('perfil:', prof);
  const { data: subs } = await s.from('user_subscriptions').select('*').eq('user_id', prof.id).order('created_at',{ascending:false});
  for (const sub of subs||[]) {
    console.log('---');
    console.log('stripe_subscription_id:', sub.stripe_subscription_id);
    console.log('status:', sub.status, '| plan:', sub.plan_type);
    console.log('period_end:', sub.current_period_end);
    console.log('cancel_at_period_end:', sub.cancel_at_period_end);
  }
})();
"
```

**Anotar:**
- `userId`
- `stripe_subscription_id` (`sub_…`)
- `status` (debe ser `active`)
- `cancel_at_period_end` (si ya es `true`, está cancelada — no hace falta ninguna acción)
- `current_period_end` (fecha hasta la que tendrá Premium tras cancelar)

## Paso 2: Cancelar vía API oficial

Usar el mismo endpoint que usa la UI. Idempotente, audita en `cancellation_feedback`, marca `cancel_at_period_end=true` en Stripe.

```bash
curl -X POST https://www.vence.es/api/stripe/cancel \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_AQUÍ"}'
```

**Respuesta esperada:**

```json
{"success":true,"periodEnd":"2026-04-23T19:21:52.000Z","message":"Subscription cancelled successfully"}
```

**Si falla:**
- `404`: no hay suscripción activa en Stripe (probablemente ya cancelada o expiró).
- `5xx`: error transitorio, reintentar. Si persiste, usar CLI de Stripe directamente (`stripe subscriptions update sub_xxx --cancel-at-period-end=true`).

## Paso 3: Verificar estado post-cancelación

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const uid = 'USER_ID_AQUÍ';
  const { data: sub } = await s.from('user_subscriptions').select('status, cancel_at_period_end, current_period_end, canceled_at').eq('user_id', uid).single();
  console.log('sub:', sub);
  const { data: cf } = await s.from('cancellation_feedback').select('*').eq('user_id', uid).order('created_at',{ascending:false}).limit(1);
  console.log('cancellation_feedback:', cf[0]);
})();
"
```

**Debe verse:**
- `user_subscriptions.cancel_at_period_end: true`
- `user_subscriptions.status: active` (sigue siendo active hasta que venza)
- `cancellation_feedback`: 1 fila nueva con `reason: 'pending_feedback'` y `cancellation_type: 'self_service'`

## Paso 4: Comunicar al usuario

**Plantilla (ajustar tono según canal y caso):**

```
Hola [NOMBRE],

Hemos cancelado tu suscripción Premium según tu solicitud.

- Mantendrás acceso Premium hasta el [FECHA_FIN_PERIODO].
- No se te realizará ningún cobro adicional.
- Si cambias de opinión antes de esa fecha, puedes reactivarla desde tu perfil (/perfil → Suscripción).

[Si es caso por bug del modal, añadir:]
Disculpa los problemas técnicos que te impidieron cancelar por tu cuenta.
Ya hemos corregido el flujo para que no vuelva a pasar.

Un saludo,
Equipo Vence
```

## Paso 5: (Si aplica) Gestionar feedback post-cancelación

El registro queda con `reason='pending_feedback'`. Si el usuario ha indicado un motivo en su mensaje, podemos actualizarlo llamando al endpoint:

```bash
curl -X POST https://www.vence.es/api/stripe/cancel/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "feedback": { "reason": "exam_done", "reasonDetails": "Ya hizo el examen" }
  }'
```

Reasons válidas: `approved`, `not_presenting`, `exam_done`, `too_expensive`, `prefer_other`, `missing_features`, `no_progress`, `hard_to_use`, `other`.

## Qué NO hacer

- **No eliminar la cuenta** a no ser que el usuario lo pida expresamente (distinto del derecho de cancelación). Ver procedimiento de borrado RGPD.
- **No forzar `status='canceled'` en la tabla** ni tocar Stripe directamente sin usar el endpoint — eso salta las auditorías en `cancellation_feedback`.
- **No reembolsar automáticamente.** Los reembolsos siguen otro criterio: `docs/procedures/reembolsos.md`.

## Manuales relacionados

- `docs/procedures/gestionar-feedback-bug.md` — si el usuario nos llega vía feedback de soporte.
- `docs/procedures/reembolsos.md` — si además hay que devolver dinero.
- `docs/procedures/investigar-journey-usuario.md` — si sospechas que el bug del flujo persiste (verificar otros usuarios afectados).

## Incidentes reales

### 2026-04-15 — Almudena Martos Garcia

- **Reporte:** email directo *"He intentado realizar la baja a través de su plataforma en varias ocasiones, pero el proceso se detiene en el paso donde se solicita el motivo de cancelación, sin permitir continuar."*
- **Diagnóstico:** el modal `CancellationFlow` tenía `overflow-hidden` sin `max-h-[90vh] overflow-y-auto`, el botón "Continuar" (paso 2) quedaba oculto sin scroll en ventanas de altura reducida.
- **Fix inmediato:** cancelar manualmente via endpoint.
- **Fix estructural:** refactor a 1 clic + feedback opcional + scroll en modal (commits `bd1d6d82`, `de29773b` — 15/04/2026).
