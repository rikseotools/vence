/**
 * lib/api/premium/ofertaHeredada.ts — recuperar el precio que alguien YA tenía, sin que
 * tenga que reclamarlo (T-341).
 *
 * ## Por qué existe
 *
 * Al vaciar la cuenta Stripe antigua se pusieron ~200 suscripciones en «no renovar» y se
 * fueron apagando solas. A esas personas se les había dicho antes que *"se renovará
 * automáticamente, no tienes que hacer nada"*: hicieron lo que les pedimos —nada— y se
 * quedaron sin premium. Medido en la cuenta antigua el 31/07/2026: **181 ya apagadas** y
 * **186 activas marcadas «no renueva»**, que caen solas entre ahora y enero de 2027.
 *
 * Hasta ahora el precio se les mantenía **una a una y solo si reclamaban**, con el CLI
 * `scripts/stripe/precio-heredado.cjs` (caso Rocío). Esto hace lo mismo para todas, en el
 * momento en que vuelven: derivar su tarifa anterior y dejarle la oferta preparada.
 *
 * ## Por qué NO se puede «reactivar» y ya está
 *
 * Una suscripción vive en la cuenta de Stripe donde nació y no hay forma de moverla: son
 * cuentas distintas, sin clientes ni tarjetas compartidas. Reactivar la suya la mantendría
 * en la cuenta que estamos vaciando. Así que lo que se recupera es **el precio**, no la
 * suscripción: se contrata de nuevo en la cuenta actual, a la tarifa que tenía.
 *
 * ## Decisiones (son de dinero, y están tomadas a propósito)
 *
 *  - **El importe es el de su PRICE** (20 €/mes · 35 €/trim. · 59 €/sem.), no lo último
 *    facturado: son tres tarifas limpias que dos personas comparten, mientras que lo
 *    facturado puede llevar un cupón encima y generaría un precio distinto por persona.
 *  - **La oferta se crea cuando la persona la pide**, no en un lote de 377: quien no
 *    vuelve no genera nada, y quien vuelva dentro de tres meses la tendrá igual.
 *  - **Si no se puede derivar con certeza, no hay oferta.** La alternativa es la tarifa
 *    normal; inventarse un importe es peor que no ofrecer nada.
 */
import 'server-only'
import Stripe from 'stripe'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { getStripeFor, newSignupAccount, resolveAccount, type StripeAccount } from '@/lib/stripe'
import {
  derivarPrecioHeredado,
  lookupKeyPrecioHeredado,
  nombreProductoHeredado,
  metadataHeredado,
  RECURRENCIA,
  type PrecioDerivado,
  type SuscripcionAnterior,
} from '@/lib/stripe/precioHeredado'
import { getOfertasActivas, type OfertaPrecio } from '@/lib/api/premium/ofertas'
import { emitFireAndForget } from '@/lib/observability/emit'

export type MotivoSinOferta =
  /** No estaba en la cuenta antigua: su sitio es la tarifa normal. */
  | 'no_es_de_la_cuenta_antigua'
  /** Nunca llegó a tener cliente/suscripción allí. */
  | 'sin_historico'
  /** Tenía histórico, pero no se puede deducir una tarifa del catálogo. */
  | 'sin_precio_derivable'

export type ResultadoOferta =
  | { ok: true; ofertas: OfertaPrecio[]; creada: boolean }
  | { ok: false; motivo: MotivoSinOferta }

/** Motivo que se guarda en la oferta y viaja a Stripe: explica el precio a los seis meses. */
export const MOTIVO_VACIADO =
  'suscripción apagada al cambiar de cuenta de cobro: se le mantiene el precio que tenía'

/**
 * Deja lista la oferta con el precio anterior de esta persona. Idempotente: si ya tiene una
 * viva, la devuelve sin tocar nada (dos clics no crean dos ofertas).
 */
export async function asegurarOfertaHeredada(userId: string): Promise<ResultadoOferta> {
  // 1) ¿Ya tiene? Entonces no hay nada que decidir.
  const yaTiene = await getOfertasActivas(userId)
  if (yaTiene.length > 0) return { ok: true, ofertas: yaTiene, creada: false }

  const db = getAdminDb()
  const filas = await db.execute(sql`
    SELECT id, email, full_name, plan_type, stripe_customer_id, payment_account
      FROM user_profiles WHERE id = ${userId} LIMIT 1
  `)
  const perfil = filasDe(filas)[0]
  if (!perfil) return { ok: false, motivo: 'no_es_de_la_cuenta_antigua' }

  const cuentaAntigua = resolveAccount(perfil.payment_account as string | null)
  const cuentaNueva = newSignupAccount()
  // Quien ya está en la cuenta de altas nuevas no arrastra nada: su precio es el vigente.
  if (cuentaAntigua === cuentaNueva) return { ok: false, motivo: 'no_es_de_la_cuenta_antigua' }

  const customerId = perfil.stripe_customer_id as string | null
  if (!customerId) return { ok: false, motivo: 'sin_historico' }

  // 2) Su histórico REAL en la cuenta antigua. La tarifa se lee de Stripe, no de la BD:
  //    `user_profiles` no guarda cuánto pagaba, y suponerlo sería inventar un importe.
  const stripeAntigua = getStripeFor(cuentaAntigua)
  let subs: Stripe.Subscription[] = []
  try {
    const lista = await stripeAntigua.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
    subs = lista.data
  } catch {
    return { ok: false, motivo: 'sin_historico' }
  }
  if (subs.length === 0) return { ok: false, motivo: 'sin_historico' }

  const derivado = derivarPrecioHeredado(subs.map(aResumen))
  if (!derivado) return { ok: false, motivo: 'sin_precio_derivable' }

  // 3) La oferta se crea en la cuenta que HOY cobra. Es el punto entero de esto: recupera
  //    el precio, no la suscripción vieja.
  const ofertas = await crearOfertaEnCuentaNueva({
    userId,
    email: String(perfil.email ?? ''),
    cuenta: cuentaNueva,
    precio: derivado,
  })
  return { ok: true, ofertas, creada: true }
}

/**
 * Filas de un `db.execute`, venga el driver como venga (`{rows}` en unos, array en otros).
 * Con `RETURNING` esto es lo que distingue «insertado» de «lo hizo otro antes».
 */
function filasDe(res: unknown): Record<string, unknown>[] {
  const r = (res as { rows?: unknown[] })?.rows
  return (Array.isArray(r) ? r : Array.isArray(res) ? res : []) as Record<string, unknown>[]
}

/** Suscripción de Stripe → lo que necesita el núcleo puro para decidir. */
function aResumen(s: Stripe.Subscription): SuscripcionAnterior {
  const price = s.items.data[0]?.price
  return {
    estado: s.status,
    centimos: price?.unit_amount ?? null,
    intervalo: (price?.recurring?.interval as 'month' | 'year' | undefined) ?? null,
    intervalCount: price?.recurring?.interval_count ?? null,
    creadaEn: s.created,
  }
}

async function crearOfertaEnCuentaNueva(params: {
  userId: string
  email: string
  cuenta: StripeAccount
  precio: PrecioDerivado
}): Promise<OfertaPrecio[]> {
  const { userId, email, cuenta, precio } = params
  const stripe = getStripeFor(cuenta)

  // Price idempotente por lookup_key — el MISMO criterio que el CLI, así que las personas
  // con la misma tarifa comparten price en vez de generar uno por cabeza.
  const lk = lookupKeyPrecioHeredado(precio.intervalo, precio.centimos)
  const existentes = await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 })
  let price = existentes.data[0]
  if (!price) {
    const producto = await stripe.products.create({
      name: nombreProductoHeredado(precio.intervalo),
      metadata: { tipo: 'precio_heredado', intervalo: precio.intervalo },
    })
    price = await stripe.prices.create({
      product: producto.id,
      currency: 'eur',
      unit_amount: precio.centimos,
      recurring: RECURRENCIA[precio.intervalo],
      lookup_key: lk,
      metadata: { tipo: 'precio_heredado' },
    })
  }

  // Payment Link de respaldo: si no puede entrar en su cuenta, se le manda este enlace y
  // el webhook le activa el premium igual (lleva su id en la metadata de la suscripción).
  const metadata = metadataHeredado({
    userId,
    email,
    motivo: MOTIVO_VACIADO,
    creadoPor: 'auto_vaciado',
  })
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    after_completion: { type: 'redirect', redirect: { url: 'https://www.vence.es/premium/success' } },
  })

  // `ON CONFLICT DO NOTHING`: dos clics seguidos (o dos pestañas) no pueden dejar dos
  // ofertas del mismo precio. El árbitro es el índice `user_price_offers_una_por_precio`,
  // que es **PARCIAL** (`WHERE redeemed_at IS NULL AND revoked_at IS NULL`) — una oferta ya
  // canjeada o revocada no debe bloquear la siguiente. Por eso hay que repetir aquí su
  // predicado: sin él Postgres no reconoce el índice y **falla el INSERT entero** (42P10),
  // que es exactamente lo que pasó en la primera prueba contra datos reales.
  const db = getAdminDb()
  const insertado = await db.execute(sql`
    INSERT INTO user_price_offers
      (user_id, stripe_price_id, stripe_account, importe_centimos, intervalo,
       motivo, creado_por, payment_link_url)
    VALUES (${userId}, ${price.id}, ${cuenta}, ${precio.centimos}, ${precio.intervalo},
            ${MOTIVO_VACIADO}, 'auto_vaciado', ${link.url})
    ON CONFLICT (user_id, stripe_price_id) WHERE redeemed_at IS NULL AND revoked_at IS NULL
      DO NOTHING
    RETURNING id
  `)

  // Si otra petición ganó la carrera, el enlace que acabamos de crear no lo va a usar
  // nadie: se desactiva. Un Payment Link vivo y sin fila que lo respalde es dinero que
  // puede entrar sin que sepamos por qué, y en Stripe no caducan solos.
  if (filasDe(insertado).length === 0) {
    await stripe.paymentLinks.update(link.id, { active: false }).catch(() => {})
  }

  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'legacy_price_link_created',
    endpoint: '/api/v2/premium/recuperar-precio',
    userId,
    metadata: {
      email,
      cuenta,
      intervalo: precio.intervalo,
      importe_centimos: precio.centimos,
      price_id: price.id,
      payment_link: link.id,
      motivo: MOTIVO_VACIADO,
      creado_por: 'auto_vaciado',
    },
  })

  return getOfertasActivas(userId)
}
