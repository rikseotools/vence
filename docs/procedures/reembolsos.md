# Procedimiento de Reembolsos

> **Fecha:** 2026-02-08 (actualizado 2026-05-09)
> **Autor:** Manual creado tras caso Damarys Gómez. Sección "TRAMPAS" y "Reembolso como compensación" añadidas tras caso Lucía Ortega 2026-05-09.

## Decision tree — qué tipo de reembolso es

```
¿El usuario quiere abandonar el servicio (cancelar sub)?
├─ SÍ → Reembolso clásico (4 pasos: refund + cancel sub + downgrade + cancellation_feedback)
│       Ver "Pasos del Procedimiento" más abajo
│
└─ NO (compensación por incidente, error nuestro, fidelización...)
        → Reembolso como compensación (sub sigue activa)
        Ver sección "Reembolso como Compensación" más abajo
```

## ⚠️ TRAMPAS — leer ANTES de tocar Stripe

### TRAMPA #1 — `trial_end` push NO es "extender días gratis"

**Lo que parece**: aplicar `trial_end: <future_ts>` a una sub activa para "regalar N días"
**Lo que realmente hace**: pone la sub en estado `trialing` Y **mueve el `billing_cycle_anchor`**, cambiando permanentemente el día de cobro mensual

**Caso real Lucía 2026-05-09**: trial_end push +7d en una sub activa con period_end=6 jun:
- Stripe pasó la sub a `trialing`
- Generó upcoming invoice 0€
- Pero al revertir con `trial_end: 'now'` (intentando "deshacer"): **GENERÓ CARGO INMEDIATO** 18€ ❌
- Efecto colateral: billing_cycle_anchor cambió de día 6 → día 9, **el usuario perdió el último mes del cupón loyalty_10** porque su renovación cayó 3 días después de que expirara

**Reglas**:
- **NUNCA** uses `trial_end: 'now'` para revertir un trial — genera cargo inmediato
- **SIEMPRE** corre `stripe.invoices.createPreview()` ANTES de aplicar cambios a una sub activa
- **Para "regalar N días"**: usa `customer.balance` crédito (más limpio, reversible) en lugar de trial_end push
- Si necesitas hacer trial_end push, prepara plan de revert SIN tocar trial_end

### TRAMPA #2 — Stripe SDK 18+ cambió ubicación de `current_period_end`

A partir del SDK Stripe 18 (API 2025-06-30+):
- `subscription.current_period_end` (root) → **undefined** ❌
- `subscription.items.data[0].current_period_end` → ahí vive ahora ✓

Implicación:
- Al hacer trial_end push, calcula desde `items[0].current_period_end`
- Webhook ya parcheado (commit `76e2c67d`) con fallback explícito

### TRAMPA #3 — "Anulado" vs "Reembolsado" en Stripe Dashboard

| Estado dashboard | Lo que pasó | Efecto cliente |
|---|---|---|
| **Anulado** | Auth reversal (refund antes de settle, charge aún en pending) | El cargo **probablemente NO aparece en su extracto bancario** |
| **Reembolsado** | Refund tras settle (ya estaba liquidado) | El cargo **SÍ aparece en extracto** + reembolso aparece como operación separada 5-10 días después |

Stripe lo decide automáticamente según el tiempo entre charge y refund:
- Refund en primeras horas + charge aún pending → reversal (Anulado)
- Refund con charge ya settled → refund completo (Reembolsado)

Verificar tipo via API: `refund.destination_details.card.type === 'reversal'` indica auth reversal.

### TRAMPA #4 — `charge` field puede venir undefined al hacer refund

Para refundear:
- ❌ MAL: `stripe.refunds.create({ charge: invoice.charge })` — el campo `charge` en invoice puede ser undefined en SDK nuevos
- ✅ BIEN: usar `payment_intent` desde `invoice.payments.data[0].payment.payment_intent`
- O mejor: `stripe.charges.list({ customer })` para obtener el charge_id real

### TRAMPA #5 — Verifica charges en Dashboard, no solo invoices

Las invoices tienen `created_at` (cuando se creó), pero el charge pudo venir DÍAS después por retries de tarjeta:

**Caso Lucía**: factura del 6 may por 18€ FALLÓ (insufficient_funds), Stripe reintentó automáticamente y cobró el 9 may. Si solo miras invoices, parece que pagó el 6 may; si miras charges, ves que pagó el 9 may.

Comando recomendado para diagnóstico:
```js
const charges = await stripe.charges.list({ customer: 'cus_XXX', limit: 10 })
charges.data.forEach(ch => console.log(ch.created, ch.amount, ch.status, ch.outcome?.seller_message))
```

## Resumen (caso clásico — usuario quiere abandonar)

Cuando un usuario solicita un reembolso PARA CANCELAR, hay que realizar **4 pasos** porque el webhook de Stripe no maneja automáticamente el evento `charge.refunded`.

## Pasos del Procedimiento

### 0. Investigar Journey del Usuario (Claude Code)

Antes de procesar nada, Claude investiga al usuario para tener contexto:

```
investiga el journey de [usuario] — tests, puntuaciones, URLs visitadas
```

Claude ejecutará:

```javascript
const userId = 'UUID';

// 1. Perfil: plan, oposición, fecha registro
const { data: profile } = await supabase.from('user_profiles')
  .select('full_name, email, plan_type, target_oposicion, created_at')
  .eq('id', userId).single();

// 2. Suscripción: fecha pago, stripe IDs
const { data: sub } = await supabase.from('user_subscriptions')
  .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);

// 3. Tests realizados + puntuaciones
const { data: tests } = await supabase.from('tests')
  .select('id, score, total_questions, is_completed, created_at, test_type')
  .eq('user_id', userId).order('created_at', { ascending: false });

// 4. Páginas visitadas (journey)
const { data: pages } = await supabase.from('user_interactions')
  .select('page_url, created_at')
  .eq('user_id', userId).eq('event_type', 'page_view')
  .order('created_at', { ascending: true });
```

**Datos clave a reportar:**
- Fecha de pago (de `user_subscriptions.current_period_start`)
- Días desde el pago (¿dentro de garantía 15 días?)
- Cuántos tests hizo y puntuación media
- Si visitó `/cancelacion-y-devoluciones` antes (señal de duda)
- Motivo que da el usuario

**La garantía de 15 días se cuenta desde la fecha de PAGO, no desde el registro.**

### 1. Procesar Reembolso en Stripe

#### Opción A: Desde Claude Code (recomendado)

```bash
node -e "
const Stripe = require('/home/manuel/Documentos/github/vence/node_modules/stripe').default;
require('dotenv').config({ path: '.env.local' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  const refund = await stripe.refunds.create({
    charge: 'ch_XXXXX',           // <-- CAMBIAR: ID del cargo a reembolsar
    reason: 'requested_by_customer',
  });
  console.log('Refund:', refund.id, refund.amount / 100, refund.currency, refund.status);
})();
"
```

#### Opción B: Desde Stripe Dashboard (Manuel)

1. Ir a [Stripe Dashboard → Payments](https://dashboard.stripe.com/payments)
2. Buscar el pago del usuario
3. Click en "Refund" → Seleccionar monto (total o parcial)
4. Confirmar reembolso

**Nota:** El reembolso tarda 5-10 días hábiles en aparecer en la cuenta del usuario.

### 2. Cancelar Suscripción en Stripe

#### Opción A: Desde Claude Code (recomendado)

```bash
node -e "
const Stripe = require('/home/manuel/Documentos/github/vence/node_modules/stripe').default;
require('dotenv').config({ path: '.env.local' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  const canceled = await stripe.subscriptions.cancel('sub_XXXXX');  // <-- CAMBIAR
  console.log('Status:', canceled.status, '| Canceled at:', new Date(canceled.canceled_at * 1000).toISOString());
})();
"
```

#### Opción B: Desde Stripe Dashboard (Manuel)

1. Ir a [Stripe Dashboard → Subscriptions](https://dashboard.stripe.com/subscriptions)
2. Buscar la suscripción del usuario (por email o customer ID)
3. Click en "Cancel subscription"
4. Seleccionar "Cancel immediately" (no "at end of period")
5. Confirmar cancelación

**Verificar:** El status debe cambiar a `canceled`

### Caso real: Ana María Delgado (09/05/2026)

- Suscripción trimestral 35€, renovación automática 31,50€ (con descuento fidelidad)
- Refund `re_3TUrSXIeJQ31GiEC2dCmvimp` procesado via Stripe API (opción A)
- Suscripción `sub_1Sya4mIeJQ31GiEChf3hI3eM` cancelada inmediatamente via API
- Usuaria no recibió email de aviso de renovación (bug: `user_subscriptions` desincronizada con Stripe, test de integridad añadido)

### 3. Degradar Usuario en Base de Datos (Claude Code)

Ejecutar este script en la terminal del proyecto:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL = 'email@del-usuario.com';  // <-- CAMBIAR
const SUBSCRIPTION_ID = 'sub_xxxxx';     // <-- CAMBIAR (obtener de Stripe)

(async () => {
  // Degradar a free
  const { data: user, error: e1 } = await supabase
    .from('user_profiles')
    .update({ plan_type: 'free' })
    .eq('email', EMAIL)
    .select('id, email, plan_type');

  if (e1) console.error('Error:', e1.message);
  else console.log('user_profiles:', user);

  // Actualizar suscripción
  const { error: e2 } = await supabase
    .from('user_subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', SUBSCRIPTION_ID);

  if (e2) console.error('Error:', e2.message);
  else console.log('user_subscriptions: canceled');
})();
"
```

### 4. Registrar Reembolso en Base de Datos (Claude Code)

**IMPORTANTE:** Este paso es necesario para que aparezca el badge 🔴 en el panel de admin/feedback.

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL = 'email@del-usuario.com';           // <-- CAMBIAR
const SUBSCRIPTION_ID = 'sub_xxxxx';              // <-- CAMBIAR
const STRIPE_CUSTOMER_ID = 'cus_xxxxx';           // <-- CAMBIAR
const REFUND_AMOUNT_CENTS = 2900;                 // <-- CAMBIAR (en céntimos)
const REASON = 'Usuario solicitó devolución';    // <-- CAMBIAR si es necesario

(async () => {
  // Obtener user_id
  const { data: user } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', EMAIL)
    .single();

  if (!user) { console.error('Usuario no encontrado'); return; }

  // Insertar registro de reembolso
  const { data, error } = await supabase
    .from('cancellation_feedback')
    .insert({
      user_id: user.id,
      user_email: EMAIL,
      stripe_customer_id: STRIPE_CUSTOMER_ID,
      subscription_id: SUBSCRIPTION_ID,
      reason: 'guarantee_refund',
      reason_details: REASON,
      cancellation_type: 'manual_refund',  // <-- IMPORTANTE: debe ser 'manual_refund'
      refund_amount_cents: REFUND_AMOUNT_CENTS,
      requested_via: 'support_ticket',
      admin_notes: 'Reembolso procesado vía Stripe Dashboard',
      processed_by: 'manuel'
    })
    .select();

  if (error) console.error('Error:', error.message);
  else console.log('✅ Registro creado:', data[0]?.id);
})();
"
```

## Checklist de Verificación

- [ ] Reembolso procesado en Stripe
- [ ] Suscripción cancelada en Stripe (status: `canceled`)
- [ ] `user_profiles.plan_type` = `free`
- [ ] `user_subscriptions.status` = `canceled`
- [ ] Registro en `cancellation_feedback` con `cancellation_type = 'manual_refund'`
- [ ] Badge 🔴 visible en admin/feedback

## Flujo Resumen

```
1. Usuario solicita devolución (feedback/soporte/email)
   ↓
2. Claude investiga: perfil, fecha pago, días, tests, actividad, ¿dentro de garantía?
   ↓
3. Manuel aprueba el reembolso
   ↓
4. Claude ejecuta TODO via Stripe API + Supabase:
   - Refund en Stripe (stripe.refunds.create)
   - Cancelar suscripción en Stripe (stripe.subscriptions.cancel)
   - user_profiles → free
   - user_subscriptions → canceled
   - cancellation_feedback → insert
   ↓
5. Claude propone borrador de respuesta → Manuel aprueba → Claude envía
```

## Comunicación con el Usuario

Después de procesar el reembolso, enviar mensaje al usuario confirmando:

> Hemos procesado tu reembolso. El importe aparecerá en tu cuenta en 5-10 días hábiles. Tu cuenta ha sido cambiada al plan gratuito. Si tienes alguna pregunta, no dudes en contactarnos.

## Casos Especiales

### Reembolso Parcial
Si solo se reembolsa parte del pago, evaluar si el usuario debe mantener acceso premium por el tiempo proporcional pagado.

### Usuario con Múltiples Pagos
Verificar historial de pagos en Stripe antes de procesar. Puede haber renovaciones anteriores.

### Disputa/Chargeback
Si es un chargeback (no reembolso voluntario), Stripe enviará evento `charge.dispute.created`. Actualmente tampoco está manejado en el webhook.

---

## Reembolso como Compensación (sub sigue activa)

> **Cuándo usar**: usuario reporta bug/incidente repetido y queremos compensar PERO la sub sigue activa (no quiere abandonar)
> **Diferencias clave vs caso clásico**:
> - NO se cancela la sub
> - NO se degrada `plan_type` a `free`
> - NO se inserta en `cancellation_feedback`
> - SÍ se inserta en **`subscription_adjustments`** (audit trail con link al `user_feedback`)
> - El timeline en `/perfil` lo mostrará como `💸 Reembolso procesado` con monto y motivo

### Tabla de audit: `subscription_adjustments`

Schema completo en `supabase/migrations/20260509_subscription_adjustments.sql`. Campos clave:

| Campo | Valores | Uso |
|---|---|---|
| `adjustment_type` | `time_extension` / `credit` / `refund` / `discount` | tipo de operación Stripe |
| `amount_value` + `amount_unit` | `7+'days'` / `18+'eur'` / `10+'percent'` | cuanto se da |
| `reason_code` | `incident_compensation` / `goodwill` / `churn_prevention` / `support_resolution` / `manual_admin` | clasificación |
| `reason_detail` | texto libre | "Reembolso por incidentes recurrentes (28 abr, 30 abr, 9 may)" |
| `related_feedback_id` | UUID → `user_feedback` | vincula al ticket que motivó la compensación |
| `applied_by_user_id` | UUID → `user_profiles` | admin que aplicó |
| `stripe_event_id` | `re_xxx` / `cus_xxx` / `coup_xxx` | evidencia cruzada en Stripe |

### Helper centralizado

`lib/api/subscription/adjustments.ts` exporta `applySubscriptionAdjustment()` para tipos `time_extension`, `credit`, `discount`. Para `refund` el helper devuelve error explícito (out of scope) — usar el flujo manual de abajo.

### Pasos para reembolso como compensación

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');
const { Client } = require('pg');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  // 1. Refund Stripe (usar charge_id verificado vía stripe.charges.list)
  const refund = await stripe.refunds.create({
    charge: 'ch_XXXX',                // <-- ID del charge específico
    reason: 'requested_by_customer',
    metadata: {
      reason_code: 'incident_compensation',
      reason_detail: 'CONTEXTO',
      related_feedback_id: 'UUID_DEL_FEEDBACK',
      admin_user_id: 'UUID_ADMIN',
    },
  });
  console.log('Refund:', refund.id, refund.status);

  // 2. INSERT audit en subscription_adjustments
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(\\\`
    INSERT INTO public.subscription_adjustments (
      user_id, stripe_subscription_id, adjustment_type,
      amount_value, amount_unit,
      reason_code, reason_detail, related_feedback_id,
      applied_by_user_id, stripe_event_id
    ) VALUES (
      \$1::uuid, \$2, 'refund',
      \$3, 'eur',
      \$4, \$5, \$6::uuid,
      \$7::uuid, \$8
    )
    RETURNING id\\\`,
    [USER_ID, SUB_ID, AMOUNT_EUR, REASON_CODE, REASON_DETAIL, FEEDBACK_ID, ADMIN_ID, refund.id]);
  console.log('Audit row:', r.rows[0].id);
  await c.end();
})();
"
```

3. **Enviar respuesta al feedback** vía `/api/v2/feedback/respond` con `finalStatus: 'resolved'` y mensaje explicando la compensación. Ver manual `gestionar-feedback-bug.md` paso 10.

### Caso real: Lucía Ortega (09/05/2026)

- Feedback `64ce6f8a-8f3b-47c2-8151-6a03058e794d`: 3 incidentes recurrentes (28 abr, 30 abr, 9 may), 2h22min con pestaña esperando sin que cargara `/api/questions/filtered` POST
- Refund 18€ aplicado vía `stripe.refunds.create` sobre `ch_3TUA4gIeJQ31GiEC1kRxKECp` (renovación legítima)
- Audit row insertado en `subscription_adjustments` con `reason_code='incident_compensation'`, `related_feedback_id` apuntando al feedback
- Sub continuó activa (próximo cobro 9 jun)
- Mensaje enviado y feedback cerrado como `resolved`
- **Lección importante**: hubo un intento previo de aplicar `trial_end push +7 días` antes del refund, que resultó en cargo erróneo de 18€ adicional (auth reversal aplicado, ver TRAMPA #1). Por eso el refund se hizo via `stripe.refunds.create` sobre el charge legítimo del 9 may, NO mediante manipulación de la sub
- **Efecto colateral**: el billing_cycle_anchor cambió de día 6 → día 9, lo que hizo que el cupón `loyalty_10` (válido hasta 6 jun) expirara antes de su 2ª renovación (9 jun), perdiendo 2€ de descuento. Decisión: aceptar la pérdida (compensación de 18€ ya cubre con margen)

---

## Mejora Futura (TODO)

Añadir handler para `charge.refunded` en `/app/api/stripe/webhook/route.ts`:

```typescript
case 'charge.refunded':
  await handleChargeRefunded(event.data.object, supabase)
  break
```

Esto automatizaría los pasos 2 y 3.
