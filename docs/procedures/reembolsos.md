# Procedimiento de Reembolsos

> **Fecha:** 2026-02-08
> **Autor:** Manual creado tras caso Damarys Gómez

## Resumen

Cuando un usuario solicita un reembolso, hay que realizar **3 pasos** porque el webhook de Stripe no maneja automáticamente el evento `charge.refunded`.

## Pasos del Procedimiento

### 1. Procesar Reembolso en Stripe

1. Ir a [Stripe Dashboard → Payments](https://dashboard.stripe.com/payments)
2. Buscar el pago del usuario
3. Click en "Refund" → Seleccionar monto (total o parcial)
4. Confirmar reembolso

**Nota:** El reembolso tarda 5-10 días hábiles en aparecer en la cuenta del usuario.

### 2. Cancelar Suscripción en Stripe

1. Ir a [Stripe Dashboard → Subscriptions](https://dashboard.stripe.com/subscriptions)
2. Buscar la suscripción del usuario (por email o customer ID)
3. Click en "Cancel subscription"
4. Seleccionar "Cancel immediately" (no "at end of period")
5. Confirmar cancelación

**Verificar:** El status debe cambiar a `canceled`

### 3. Degradar Usuario en Base de Datos

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

## Checklist de Verificación

- [ ] Reembolso procesado en Stripe
- [ ] Suscripción cancelada en Stripe (status: `canceled`)
- [ ] `user_profiles.plan_type` = `free`
- [ ] `user_subscriptions.status` = `canceled`

## Opcional: Registrar en cancellation_feedback

Si quieres mantener un registro de la cancelación con motivo:

```sql
INSERT INTO cancellation_feedback (user_id, reason, refund_amount_cents, created_at)
SELECT id, 'Reembolso solicitado por usuario', 2900, NOW()
FROM user_profiles WHERE email = 'email@del-usuario.com';
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
