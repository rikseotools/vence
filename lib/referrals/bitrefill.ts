// lib/referrals/bitrefill.ts
// Cliente de Bitrefill para comprar gift cards de Amazon.es con el saldo (cripto) de la cuenta.
//
// ⚠️ DINERO REAL — GUARDARRAÍL ANTI-GASTO POR CONSTRUCCIÓN:
// La compra REAL solo ocurre si process.env.BITREFILL_LIVE === '1'. Por DEFECTO es DRY-RUN:
// NO llama a la API de Bitrefill, NO gasta ni un céntimo, y devuelve un código SIMULADO marcado
// ("DRYRUN-…"). Así todo el flujo (registro del payout, panel de vales del usuario) funciona
// end-to-end sin dinero, y la compra real se habilita conscientemente (flag + primera prueba
// controlada por Manuel). El código de la API real está escrito según docs.bitrefill.com pero
// queda PENDIENTE de verificación en la primera compra real (por eso arranca OFF).

const BASE = process.env.BITREFILL_API_BASE || 'https://api.bitrefill.com/v2'
const PRODUCT_ID = process.env.BITREFILL_AMAZON_ES_PRODUCT || 'amazon_es-spain'

export interface GiftCardPurchase {
  ok: boolean
  dryRun: boolean
  code: string | null // código/enlace de canje de Amazon.es
  ref: string | null // id de invoice/order (trazabilidad)
  error?: string
}

/** true solo si la compra REAL está habilitada (flag explícito). Sin él → dry-run. */
export function bitrefillLive(): boolean {
  return process.env.BITREFILL_LIVE === '1'
}

async function readCode(base: string, token: string, invoiceId: string): Promise<string | null> {
  // Tras crear+pagar, el código puede tardar un instante → poll corto de la invoice.
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${base}/invoices/${invoiceId}`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json().catch(() => ({}))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = Array.isArray((d as any)?.orders) ? (d as any).orders[0] : null
    const info = order?.redemption_info
    if (info && (order?.redemption_available ?? true)) {
      const code = info.code || info.link || info.url || null
      if (code) return info.pin ? `${code} (PIN ${info.pin})` : String(code)
    }
    await new Promise((res) => setTimeout(res, 1500))
  }
  return null
}

/**
 * Compra una gift card de Amazon.es del importe (€) indicado. DRY-RUN salvo BITREFILL_LIVE=1.
 * NUNCA lanza: devuelve { ok:false, error } ante cualquier fallo — el caller decide qué hacer
 * (importante: si ok=false NO se debe registrar el payout, para no descuadrar el saldo).
 */
export async function purchaseAmazonGiftCard(amountEur: number): Promise<GiftCardPurchase> {
  // Guardarraíl: sin el flag, JAMÁS toca la API ni gasta dinero.
  if (!bitrefillLive()) {
    return { ok: true, dryRun: true, code: `DRYRUN-AMZ-${amountEur}EUR`, ref: `dryrun-${Date.now?.() ?? 'x'}` }
  }
  const token = process.env.BITREFILL_API_TOKEN
  if (!token) return { ok: false, dryRun: false, code: null, ref: null, error: 'no_token' }
  try {
    const res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        products: [{ product_id: PRODUCT_ID, value: amountEur, quantity: 1 }],
        payment_method: 'balance',
        auto_pay: true,
      }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, dryRun: false, code: null, ref: data?.id ?? null, error: `http_${res.status}` }
    const invoiceId = data?.id ?? data?.orders?.[0]?.id ?? null
    const order = Array.isArray(data?.orders) ? data.orders[0] : null
    const ri0 = order?.redemption_info
    let code: string | null = ri0 ? (ri0.pin ? `${ri0.code || ri0.link} (PIN ${ri0.pin})` : (ri0.code || ri0.link)) : null
    if (!code && invoiceId) code = await readCode(BASE, token, String(invoiceId))
    return { ok: !!code, dryRun: false, code, ref: invoiceId ? String(invoiceId) : null, error: code ? undefined : 'no_code_yet' }
  } catch (e) {
    return { ok: false, dryRun: false, code: null, ref: null, error: (e as Error).message }
  }
}
