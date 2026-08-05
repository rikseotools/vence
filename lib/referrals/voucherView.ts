// lib/referrals/voucherView.ts
// Cómo se lee una fila de `reward_payouts` para pintarla como VALE en «Mis vales».
// Núcleo PURO (sin BD, sin red): lo consumen `/api/referrals/vouchers` (lo que ve el embajador) y
// `/api/admin/embajadores/[userId]/panel` (la vista de admin «ver como el usuario»).
//
// POR QUÉ EXISTE (05/08/2026, T-591). La tarjeta decía **«{importe} € · Amazon.es»** y enlazaba a
// `amazon.es/gc/redeem` **fuera cual fuera la marca**, porque hasta entonces todos los vales eran de
// Amazon.es y la marca estaba escrita a mano en el JSX. Al comprar los tres primeros vales de **Nike
// España** (retirada del propietario, invoice `74cc3d9b…`), esos vales salían etiquetados como
// Amazon con un enlace de canje que no sirve para canjearlos: la tarjeta mentía en la marca Y en el
// destino.
//
// Las dos reglas que fija este módulo:
//   1. **La marca se DERIVA del vale**, no se supone. Sale de `_product` (el `product_id` de
//      Bitrefill que ya guardamos por trazabilidad) y, si falta, de `reward_payouts.method`.
//   2. **Una marca desconocida NO hereda el enlace de Amazon.** Se queda sin destino y lo dice
//      ("sigue las instrucciones del proveedor"). Un enlace equivocado es peor que ninguno: manda a
//      un sitio donde el código no funciona y parece que el vale está roto.
//
// Los enlaces de aquí están VERIFICADOS con navegador real (Nike responde 403 a fetch por WAF):
//   nike.com/es/help/a/canjear-tarjeta-de-regalo → «¿Cómo puedo utilizar mi tarjeta de regalo Nike?»
//   nike.com/es/orders/gift-card-lookup          → «Comprueba el saldo restante de tu tarjeta…»
// NUNCA añadas una marca con una URL que no hayas abierto.

/** Lo que la tarjeta necesita saber de la marca del vale. */
export interface VoucherBrand {
  /** Etiqueta que se pinta junto al importe: «Amazon.es», «Nike España». */
  label: string
  /** Dónde se canjea/usa. `null` = no lo sabemos → la tarjeta NO inventa enlace. */
  redeemUrl: string | null
  /** Texto del enlace. `null` cuando no hay `redeemUrl`. */
  redeemCta: string | null
  /** Instrucción corta del proveedor. Va SIEMPRE, haya enlace o no. */
  redeemHint: string
  /** Consulta de saldo, si la marca la ofrece. */
  balanceUrl: string | null
}

const AMAZON: VoucherBrand = {
  label: 'Amazon.es',
  redeemUrl: 'https://www.amazon.es/gc/redeem',
  redeemCta: 'Canjear en Amazon',
  redeemHint: 'pega el código en «Canjear tarjeta regalo»',
  balanceUrl: null,
}

// Nike NO tiene página de canje: la tarjeta se aplica AL PAGAR, con número + PIN. Por eso el enlace
// va a las instrucciones oficiales y no a un formulario que no existe (Bitrefill lo confirma en sus
// términos del producto: «Nike gift cards can be redeemed online for products on Nike.com»).
const NIKE: VoucherBrand = {
  label: 'Nike España',
  redeemUrl: 'https://www.nike.com/es/help/a/canjear-tarjeta-de-regalo',
  redeemCta: 'Cómo usar tu tarjeta Nike',
  redeemHint: 'introduce el número y el PIN al pagar en Nike.com',
  balanceUrl: 'https://www.nike.com/es/orders/gift-card-lookup',
}

/** Marca sin registrar: se sirve el código y se dice la verdad — no sabemos dónde se canjea. */
const DESCONOCIDA: VoucherBrand = {
  label: 'Tarjeta regalo',
  redeemUrl: null,
  redeemCta: null,
  redeemHint: 'sigue las instrucciones de canje del proveedor de la tarjeta',
  balanceUrl: null,
}

/**
 * Registro de marcas. Las claves son las DOS formas en que un vale dice de qué marca es:
 * el `product_id` de Bitrefill (`_product`) y el `method` de la fila.
 * Añadir una marca = una entrada por cada clave, con enlaces verificados a mano.
 */
const POR_CLAVE: Record<string, VoucherBrand> = {
  'amazon_es-spain': AMAZON,
  amazon_giftcard: AMAZON,
  'nike-spain': NIKE,
  nike_giftcard: NIKE,
}

/**
 * Deriva la marca de un vale. `product` (el `_product` del `giftcard_ref`) manda sobre `method`
 * porque es el id exacto del proveedor; `method` es el respaldo para las filas antiguas, que se
 * crearon con el DEFAULT `amazon_giftcard` cuando no había otra marca posible.
 */
export function brandForVoucher(product?: string | null, method?: string | null): VoucherBrand {
  const p = (product ?? '').trim().toLowerCase()
  if (p && POR_CLAVE[p]) return POR_CLAVE[p]
  const m = (method ?? '').trim().toLowerCase()
  if (m && POR_CLAVE[m]) return POR_CLAVE[m]
  return DESCONOCIDA
}

export interface VoucherRow {
  amount: number | string
  giftcard_ref: string
  purchased_via?: string | null
  method?: string | null
  paid_at?: string | Date | null
}

export interface VoucherDTO {
  amount: number
  code: string
  pin: string | null
  serial: string | null
  fallbackLink: string | null
  via: string | null
  date: string | null
  brand: VoucherBrand
}

/**
 * `giftcard_ref` puede ser JSON `{code,pin,serial,_*}` (compras nuevas) o texto plano con el código
 * (filas legacy). Las claves `_*` son trazabilidad interna y NO salen al usuario… salvo
 * `_fallback_link`, que sí es suyo porque lo necesita para canjear.
 */
export function parseGiftcardRef(raw: string): {
  code: string; pin: string | null; serial: string | null; fallbackLink: string | null; product: string | null
} {
  try {
    const j = JSON.parse(raw)
    if (j && typeof j === 'object' && j.code) {
      const fb = typeof j._fallback_link === 'string' && j._fallback_link.startsWith('http') ? j._fallback_link : null
      return {
        code: String(j.code),
        pin: j.pin || null,
        serial: j.serial || null,
        fallbackLink: fb,
        product: typeof j._product === 'string' ? j._product : null,
      }
    }
  } catch { /* texto plano */ }
  return { code: raw, pin: null, serial: null, fallbackLink: null, product: null }
}

/** Fila de BD → vale listo para la tarjeta. ÚNICO mapeo: lo usan los dos endpoints. */
export function toVoucherDTO(row: VoucherRow): VoucherDTO {
  const p = parseGiftcardRef(String(row.giftcard_ref))
  return {
    amount: Number(row.amount),
    code: p.code,
    pin: p.pin,
    serial: p.serial,
    fallbackLink: p.fallbackLink,
    via: row.purchased_via || null,
    date: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    brand: brandForVoucher(p.product, row.method),
  }
}
