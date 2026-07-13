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
  pin: string | null // PIN si el vale lo trae (algunos lo exigen)
  serial: string | null
  ref: string | null // id de invoice/order (trazabilidad)
  error?: string
}

/** true solo si la compra REAL está habilitada (flag explícito). Sin él → dry-run. */
export function bitrefillLive(): boolean {
  return process.env.BITREFILL_LIVE === '1'
}

interface Redemption { code: string | null; pin: string | null; serial: string | null }
const EMPTY_RED: Redemption = { code: null, pin: null, serial: null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRedemption(info: any): Redemption {
  const code = info?.code || info?.link || info?.url || null
  if (!code) return EMPTY_RED
  return { code: String(code), pin: info.pin ? String(info.pin) : null, serial: info.extra_fields?.['Serial Number'] || info.serial || null }
}
async function readRedemption(base: string, token: string, invoiceId: string): Promise<Redemption> {
  // Tras crear+pagar, el código puede tardar un instante → poll corto de la invoice.
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${base}/invoices/${invoiceId}`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json().catch(() => ({}))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = Array.isArray((d as any)?.orders) ? (d as any).orders[0] : null
    if (order?.redemption_info && (order?.redemption_available ?? true)) {
      const red = extractRedemption(order.redemption_info)
      if (red.code) return red
    }
    await new Promise((res) => setTimeout(res, 1500))
  }
  return EMPTY_RED
}

/**
 * Compra una gift card de Amazon.es del importe (€) indicado. DRY-RUN salvo BITREFILL_LIVE=1.
 * NUNCA lanza: devuelve { ok:false, error } ante cualquier fallo — el caller decide qué hacer
 * (importante: si ok=false NO se debe registrar el payout, para no descuadrar el saldo).
 */
export async function purchaseAmazonGiftCard(amountEur: number): Promise<GiftCardPurchase> {
  // Guardarraíl: sin el flag, JAMÁS toca la API ni gasta dinero.
  if (!bitrefillLive()) {
    return { ok: true, dryRun: true, code: `DRYRUN-AMZ-${amountEur}EUR`, pin: null, serial: null, ref: `dryrun-${Date.now?.() ?? 'x'}` }
  }
  const token = process.env.BITREFILL_API_TOKEN
  if (!token) return { ok: false, dryRun: false, code: null, pin: null, serial: null, ref: null, error: 'no_token' }
  try {
    const res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        // ⚠️ `value` es un STRING en EUROS ('5','10',…), la denominación del producto.
        // value:5 (número) o value:500 (céntimos) dan `wrong_value` (verificado 13/07,
        // 1ª compra real). Las denominaciones válidas = packages[].value del producto.
        products: [{ product_id: PRODUCT_ID, value: String(amountEur), quantity: 1 }],
        payment_method: 'balance',
        auto_pay: true,
      }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, dryRun: false, code: null, pin: null, serial: null, ref: data?.id ?? null, error: `http_${res.status}` }
    const invoiceId = data?.id ?? data?.orders?.[0]?.id ?? null
    const order = Array.isArray(data?.orders) ? data.orders[0] : null
    let red = order?.redemption_info ? extractRedemption(order.redemption_info) : EMPTY_RED
    if (!red.code && invoiceId) red = await readRedemption(BASE, token, String(invoiceId))
    return { ok: !!red.code, dryRun: false, code: red.code, pin: red.pin, serial: red.serial, ref: invoiceId ? String(invoiceId) : null, error: red.code ? undefined : 'no_code_yet' }
  } catch (e) {
    return { ok: false, dryRun: false, code: null, pin: null, serial: null, ref: null, error: (e as Error).message }
  }
}
