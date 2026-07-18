/**
 * Guardrail: la idempotencia del settlement por stripe_invoice_id no debe caerse.
 *
 * Bug 07/07/2026 (flip a cuenta Nila): un alta nueva emite DOS eventos de webhook
 * (checkout.session.completed + invoice.payment_succeeded) para el mismo pago. El
 * guard iba por stripe_payment_intent_id, que llega NULL en el checkout de
 * suscripción → no deduplicaba → filas de settlement duplicadas (inflaba ventas
 * ~32% en volumen, ~40% en €). NO era doble cobro (Stripe cobra una vez).
 *
 * Fix: unique parcial por stripe_invoice_id (migración 20260718) + upsert por
 * invoice en recordPaymentSettlement. Si alguien quita el índice del schema o el
 * ON CONFLICT del webhook, este test falla ANTES de que vuelvan los duplicados.
 * Detección en runtime: scripts/canary-settlement-duplicates.cjs.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const schema = readFileSync(join(ROOT, 'db/schema.ts'), 'utf-8')
const webhook = readFileSync(join(ROOT, 'app/api/stripe/webhook/route.ts'), 'utf-8')
const migration = readFileSync(
  join(ROOT, 'supabase/migrations/20260718_payment_settlements_invoice_unique.sql'),
  'utf-8',
)

describe('settlement idempotente por factura — no perder el fix del duplicado', () => {
  it('db/schema.ts declara el unique parcial por stripe_invoice_id', () => {
    expect(schema).toMatch(/uniqueIndex\("payment_settlements_stripe_invoice_id_key"\)/)
    expect(schema).toMatch(/stripe_invoice_id IS NOT NULL/)
  })

  it('el webhook hace upsert idempotente por factura (ON CONFLICT stripe_invoice_id)', () => {
    expect(webhook).toMatch(/ON CONFLICT \(stripe_invoice_id\)/)
    // y enriquece la fila con el charge cuando llega el evento completo
    expect(webhook).toMatch(/EXCLUDED\.stripe_charge_id/)
  })

  it('la migración limpia duplicados y crea el índice único parcial', () => {
    expect(migration).toMatch(/DELETE FROM public\.payment_settlements/)
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS payment_settlements_stripe_invoice_id_key/)
    expect(migration).toMatch(/WHERE stripe_invoice_id IS NOT NULL/)
  })
})
