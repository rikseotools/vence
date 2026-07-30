/**
 * scripts/sim/sim-precio-heredado.ts — SIMULACIÓN de «recupera el precio que tenías»
 * (T-341), contra un servidor real y datos reales.
 *
 * ## Qué comprueba y por qué existe
 *
 * Al vaciar la cuenta de cobro antigua, ~200 suscripciones se pusieron en «no renovar» y se
 * fueron apagando solas. A esas personas se les había dicho *«se renueva sola, no tienes que
 * hacer nada»*: hicieron lo que les pedimos y se quedaron sin premium. El botón del perfil
 * les devuelve **su precio** —no su suscripción, que no se puede mover de cuenta— creando la
 * oferta en la cuenta que hoy cobra.
 *
 * Es un camino que **mueve dinero y escribe en Stripe**, así que no basta con que "responda
 * 200": lo que se verifica es que la oferta creada dice la tarifa correcta, que un segundo
 * clic no crea una segunda, y que quien no debe recibir oferta no la recibe.
 *
 * **Cada caso que debe fallar va emparejado con el que debe pasar.** Sin ese contraste, un
 * endpoint roto que no creara ofertas nunca se leería como un éxito.
 *
 * ## Qué escribe (y cómo se limpia)
 *
 * Crea en Stripe un price (idempotente por `lookup_key`, compartido con el CLI) y un Payment
 * Link, más una fila en `user_price_offers`. Al terminar **revoca la fila y desactiva los
 * enlaces que ha creado**: un Payment Link vivo sin fila detrás es dinero que puede entrar
 * sin que sepamos por qué, y en Stripe no caducan solos. El price se queda —es el mismo que
 * usará la persona cuando pulse su botón— y no cobra nada por existir.
 *
 * Uso (con el servidor levantado):
 *   set -a && . ./.env.local && . ./.env.development.local && set +a
 *   npx tsx scripts/sim/sim-precio-heredado.ts [--url=http://localhost:3000]
 */
import { encode } from 'next-auth/jwt'
import { Client } from 'pg'
import Stripe from 'stripe'

const BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'

const fallos: string[] = []
function linea(ok: boolean, texto: string) {
  console.log(`${ok ? '✅' : '❌'} ${texto}`)
  if (!ok) fallos.push(texto)
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL!.split('?')[0], ssl: { rejectUnauthorized: false } })
  await c.connect()

  // Una afectada real: quedó en la cuenta antigua, hoy en free, con cliente en Stripe.
  const afectada = (
    await c.query(`SELECT id, email FROM user_profiles
                    WHERE payment_account = 'manuel' AND plan_type = 'free' AND stripe_customer_id IS NOT NULL
                    ORDER BY updated_at DESC LIMIT 1`)
  ).rows[0]
  // Alguien que YA está en la cuenta de altas nuevas: no arrastra precio y no debe recibir nada.
  const alDia = (await c.query(`SELECT id, email FROM user_profiles WHERE payment_account = 'nila' LIMIT 1`)).rows[0]
  // Y alguien premium de la cuenta antigua, para el bloqueo de «reactivar».
  const premiumAntiguo = (
    await c.query(`SELECT id, email FROM user_profiles
                    WHERE payment_account = 'manuel' AND plan_type = 'premium' AND stripe_customer_id IS NOT NULL
                    ORDER BY updated_at DESC LIMIT 1`)
  ).rows[0]

  if (!afectada || !alDia || !premiumAntiguo) {
    console.error('No hay datos para simular (falta afectada, contraste o premium antiguo).')
    process.exit(1)
  }

  const secret = process.env.AUTH_SECRET!
  const now = Math.floor(Date.now() / 1000)
  const tokenDe = async (id: string, email: string) => {
    const cookie = await encode({
      token: { appUserId: id, email, sub: id, iat: now, exp: now + 3600 },
      secret,
      salt: 'authjs.session-token',
      maxAge: 3600,
    })
    const r = await fetch(`${BASE}/api/auth/token`, { headers: { Cookie: `authjs.session-token=${cookie}` } })
    return (await r.json()).accessToken as string
  }
  const recuperar = async (id: string, email: string) => {
    const t = await tokenDe(id, email)
    const r = await fetch(`${BASE}/api/v2/premium/recuperar-precio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    })
    return { status: r.status, body: (await r.json()) as Record<string, any> }
  }

  console.log(`\n— afectada: ${afectada.email} · al día: ${alDia.email} · premium antiguo: ${premiumAntiguo.email}\n`)

  // 1) Sin token no se crea nada. Esto escribe en Stripe: no puede ser público.
  const anon = await fetch(`${BASE}/api/v2/premium/recuperar-precio`, { method: 'POST' })
  linea(anon.status === 401, `1) sin sesión → ${anon.status} (esperado 401)`)

  // 2) La afectada recupera su precio.
  const a1 = await recuperar(afectada.id, afectada.email)
  const of1 = a1.body?.ofertas?.[0]
  linea(
    a1.status === 200 && a1.body.tieneOferta === true && a1.body.creada === true && !!of1,
    `2) recupera su precio → ${a1.status} · oferta ${of1 ? `${of1.importe} ${of1.periodicidad}` : 'NINGUNA'}`
  )

  // 3) La tarifa es una del catálogo del vaciado, no un importe inventado.
  const TARIFAS: Record<string, number> = { mensual: 2000, trimestral: 3500, semestral: 5900 }
  linea(
    !!of1 && TARIFAS[of1.intervalo] === of1.importeCentimos,
    `3) la tarifa es del catálogo → ${of1?.intervalo} ${of1?.importeCentimos}c (esperado ${of1 ? TARIFAS[of1.intervalo] : '—'}c)`
  )

  // 4) Un segundo clic NO crea una segunda oferta (dos pestañas, doble toque, reintento).
  const a2 = await recuperar(afectada.id, afectada.email)
  const filas = await c.query(
    `SELECT id, stripe_price_id, stripe_account, importe_centimos, intervalo, creado_por, payment_link_url
       FROM user_price_offers WHERE user_id = $1 AND revoked_at IS NULL AND redeemed_at IS NULL`,
    [afectada.id]
  )
  linea(
    a2.status === 200 && a2.body.creada === false && filas.rowCount === 1,
    `4) segundo clic → creada=${a2.body.creada} · filas vivas en BD = ${filas.rowCount} (esperado 1)`
  )

  // 5) La fila guardada es la que se le va a cobrar, y está en la cuenta que HOY cobra.
  const fila = filas.rows[0]
  linea(
    !!fila && fila.stripe_account === 'nila' && fila.creado_por === 'auto_vaciado' && !!fila.payment_link_url,
    `5) en BD: cuenta=${fila?.stripe_account} · por=${fila?.creado_por} · enlace=${fila?.payment_link_url ? 'sí' : 'NO'}`
  )

  // 6) CONTRASTE — quien ya está en la cuenta nueva no recibe oferta. Sin este caso, un
  //    endpoint que no creara ofertas jamás pasaría los anteriores por casualidad.
  const b = await recuperar(alDia.id, alDia.email)
  linea(
    b.status === 200 && b.body.tieneOferta === false && b.body.motivo === 'no_es_de_la_cuenta_antigua',
    `6) contraste, ya en la cuenta nueva → ${b.status} · motivo=${b.body.motivo} (esperado no_es_de_la_cuenta_antigua)`
  )

  // 7) «Reactivar» deja de renovar en la cuenta antigua: ahí no se puede volver a cobrar.
  const tokenPrem = await tokenDe(premiumAntiguo.id, premiumAntiguo.email)
  const react = await fetch(`${BASE}/api/stripe/reactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrem}` },
    body: JSON.stringify({ userId: premiumAntiguo.id }),
  })
  const reactBody = await react.json().catch(() => ({}))
  linea(
    react.status === 400 && reactBody.error === 'cuenta_antigua',
    `7) reactivar en la cuenta antigua → ${react.status} · error=${reactBody.error} (esperado cuenta_antigua)`
  )

  // ── Limpieza: la oferta y los enlaces de la prueba no se quedan vivos ────────────────
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_NILA!, { apiVersion: '2025-02-24.acacia' as any })
  const revocadas = await c.query(
    `UPDATE user_price_offers SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL AND creado_por = 'auto_vaciado' RETURNING id`,
    [afectada.id]
  )
  let apagados = 0
  const links = await stripe.paymentLinks.list({ limit: 100 })
  for (const l of links.data) {
    const m = l.metadata as Record<string, string>
    if (l.active && m?.creado_por === 'auto_vaciado' && m?.supabase_user_id === afectada.id) {
      await stripe.paymentLinks.update(l.id, { active: false })
      apagados++
    }
  }
  console.log(`\n🧹 limpieza: ${revocadas.rowCount} oferta(s) revocada(s) · ${apagados} enlace(s) desactivado(s)`)
  await c.end()

  console.log(
    fallos.length
      ? `\n❌ ${fallos.length} fallo(s) — el precio heredado NO está listo.`
      : `\n✅ 7/7 — recuperan su precio, un solo clic cuenta, y quien no debe no recibe nada.`
  )
  process.exit(fallos.length ? 1 : 0)
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
