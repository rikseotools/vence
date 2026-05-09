# Procedimiento de Reembolsos

> **Fecha:** 2026-02-08
> **Autor:** Manual creado tras caso Damarys Gómez

## Resumen

Cuando un usuario solicita un reembolso, hay que realizar **4 pasos** porque el webhook de Stripe no maneja automáticamente el evento `charge.refunded`.

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

## Mejora Futura (TODO)

Añadir handler para `charge.refunded` en `/app/api/stripe/webhook/route.ts`:

```typescript
case 'charge.refunded':
  await handleChargeRefunded(event.data.object, supabase)
  break
```

Esto automatizaría los pasos 2 y 3.
