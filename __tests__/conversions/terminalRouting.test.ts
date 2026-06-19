/**
 * Enrutado terminal vs reintentable en el worker de conversiones (incidente 19/06).
 *
 * Bug: el worker trataba CUALQUIER `!ok` (incl. `no_identifier` — venta sin
 * click-ID, NO atribuible) como fallo REINTENTABLE → reintentos infinitos → DLQ
 * → alerta en bucle. Fix: `DeliveryResult.terminal` lo clasifica; el worker
 * marca `skipped` (sin reintento) los terminales, y deja retry/DLQ para los
 * reintentables (red/OAuth/5xx). Cada destino clasifica sus verdictos.
 */

import { classifyDeliveryOutcome } from '@/lib/conversions/outcome'
import { uploadPurchaseConversion } from '@/lib/services/googleAds/conversions'
import { sendGa4Purchase } from '@/lib/services/ga4/conversions'

describe('classifyDeliveryOutcome (pura)', () => {
  test('ok → deliver', () => {
    expect(classifyDeliveryOutcome({ ok: true }, false)).toBe('deliver')
    expect(classifyDeliveryOutcome({ ok: true }, true)).toBe('deliver')
  })
  test('terminal en modo real → skip (NO reintenta)', () => {
    expect(classifyDeliveryOutcome({ ok: false, terminal: true }, false)).toBe('skip')
  })
  test('terminal en dryRun → retry (validación no consume la fila)', () => {
    expect(classifyDeliveryOutcome({ ok: false, terminal: true }, true)).toBe('retry')
  })
  test('reintentable (red/OAuth) → retry', () => {
    expect(classifyDeliveryOutcome({ ok: false, terminal: false }, false)).toBe('retry')
    expect(classifyDeliveryOutcome({ ok: false }, false)).toBe('retry') // terminal undefined = reintentable
  })
})

describe('Google Ads: clasificación de verdictos (sin red)', () => {
  test('sin click-ID ni email → no_identifier TERMINAL (no llama a la API)', async () => {
    const res = await uploadPurchaseConversion({
      gclid: null, gbraid: null, wbraid: null, emailSha256: null,
      valueEur: 35, currency: 'EUR', orderId: 'order_x', occurredAt: '2026-06-18T18:59:00Z',
      dryRun: false,
    })
    expect(res.ok).toBe(false)
    expect(res.detail).toBe('no_identifier')
    expect(res.terminal).toBe(true)
  })
})

describe('GA4: clasificación de verdictos (sin red)', () => {
  const OLD = process.env
  afterEach(() => { process.env = OLD })

  test('falta api_secret → terminal', async () => {
    process.env = { ...OLD, GA4_API_SECRET: '' }
    const res = await sendGa4Purchase({ clientId: 'c1', valueEur: 10, currency: 'EUR', transactionId: 't1', dryRun: true } as never)
    expect(res.ok).toBe(false)
    expect(res.terminal).toBe(true)
  })

  test('falta client_id → terminal', async () => {
    process.env = { ...OLD, GA4_API_SECRET: 'secret' }
    const res = await sendGa4Purchase({ clientId: '', valueEur: 10, currency: 'EUR', transactionId: 't1', dryRun: true } as never)
    expect(res.ok).toBe(false)
    expect(res.detail).toBe('no_client_id')
    expect(res.terminal).toBe(true)
  })
})
