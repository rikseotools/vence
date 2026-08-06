#!/usr/bin/env node
/**
 * T-601 — ¿Quién lleva días intentando pagarnos y no puede?
 *
 * Busca en TODAS las cuentas de Stripe a los clientes **atascados comprando**: los que acumulan
 * suscripciones `incomplete` con cargos FALLIDOS y **nunca han llegado a pagar**. Es ingreso que
 * no entra y que hoy no vigila nada — el caso que originó esto llevaba **18 días** así, y lo único
 * que sonó fue una alerta que nombraba el endpoint de cancelar.
 *
 * ⚠️ NO confundir con `stripe:pago-fallido-falsos` (T-594), que es lo CONTRARIO: allí el pago va
 * bien y el defecto es nuestro correo. Aquí el pago falla de verdad.
 *
 * **El corte descarta el abandono, que es lo que lo hace usable.** Medido el 06/08/2026 sobre 60
 * días de las dos cuentas: 26 clientes con alguna `incomplete`, de los que **8 nunca pagaron**…
 * pero **6 de esos 8 no tienen ni un cargo** — abrieron el checkout y se fueron, que es el embudo
 * normal de cualquier tienda y no un defecto. Exigir **≥1 cargo fallido** deja **2**, que son las
 * personas que de verdad estaban peleándose con el pago. Contar los 8 como «359 € perdidos» sería
 * engañarse.
 *
 *   node scripts/stripe/compras-atascadas.cjs [--dias 60]
 *   node scripts/stripe/compras-atascadas.cjs --rescatar cus_XXXX   # expira sus checkouts abiertos
 *
 * Sin `--rescatar` SOLO LEE. El rescate expira las sesiones `open` (lo mismo que hace ya solo el
 * endpoint de cancelar desde T-601) para que la persona pueda cancelar o volver a intentarlo.
 */
require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

const arg = (n, def) => {
  const i = process.argv.indexOf(n)
  return i > -1 ? process.argv[i + 1] : def
}
const DIAS = Number(arg('--dias', 60))
const RESCATAR = arg('--rescatar', null)

/** Las cuentas vivas. Añadir una = una fila (mismo criterio que `lib/stripe.ts`). */
const CUENTAS = [
  ['manuel', process.env.STRIPE_SECRET_KEY],
  ['nila', process.env.STRIPE_SECRET_KEY_NILA],
].filter(([, k]) => !!k)

/** Estados en los que el cliente SÍ consiguió comprar: si hay uno, no está atascado. */
const COMPRO = new Set(['active', 'trialing', 'past_due'])

async function subsIncompletas(sc, desde) {
  const porCliente = new Map()
  for (const status of ['incomplete', 'incomplete_expired']) {
    const params = { status, limit: 100, created: { gte: desde } }
    let page
    do {
      page = await sc.subscriptions.list(params)
      for (const sub of page.data) {
        const cid = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        if (!cid) continue
        if (!porCliente.has(cid)) porCliente.set(cid, [])
        porCliente.get(cid).push(sub)
      }
      if (page.has_more) params.starting_after = page.data[page.data.length - 1].id
    } while (page.has_more)
  }
  return porCliente
}

;(async () => {
  if (RESCATAR) return rescatar()

  const desde = Math.floor(Date.now() / 1000) - DIAS * 86400
  const atascados = []
  let abandonos = 0

  for (const [cuenta, key] of CUENTAS) {
    const sc = new Stripe(key)
    for (const [cid, subs] of await subsIncompletas(sc, desde)) {
      const todas = await sc.subscriptions.list({ customer: cid, status: 'all', limit: 20 })
      if (todas.data.some((s) => COMPRO.has(s.status))) continue // acabó comprando

      const cargos = await sc.charges.list({ customer: cid, limit: 20 })
      if (cargos.data.some((c) => c.status === 'succeeded')) continue // pagó por otra vía

      // Sin un solo cargo no se peleó con el pago: abrió el checkout y se fue.
      const fallidos = cargos.data.filter((c) => c.status === 'failed')
      if (fallidos.length === 0) { abandonos++; continue }

      const cliente = await sc.customers.retrieve(cid)
      const sesiones = await sc.checkout.sessions.list({ customer: cid, limit: 20 })
      const abiertas = sesiones.data.filter((s) => s.status === 'open')
      const precio = subs[0].items?.data?.[0]?.price?.unit_amount
      atascados.push({
        cuenta,
        cliente: cid,
        email: cliente.email,
        intentos: subs.length,
        cargos_fallidos: fallidos.length,
        metodos: [...new Set(fallidos.map((c) => c.payment_method_details?.type ?? '?'))].join(','),
        motivo: [...new Set(fallidos.map((c) => c.failure_code ?? '?'))].join(','),
        eur: precio ? precio / 100 : null,
        checkout_abierto: abiertas.length,
        desde: new Date(Math.min(...subs.map((s) => s.created)) * 1000).toISOString().slice(0, 10),
        ultimo: new Date(Math.max(...subs.map((s) => s.created)) * 1000).toISOString().slice(0, 10),
      })
    }
  }

  atascados.sort((a, b) => b.cargos_fallidos - a.cargos_fallidos)

  console.log(`\n🧾 COMPRAS ATASCADAS — últimos ${DIAS} días, ${CUENTAS.length} cuenta(s)\n`)
  if (atascados.length === 0) {
    console.log('✅ Nadie atascado: ningún cliente con cargos fallidos y sin llegar a pagar.')
  } else {
    console.table(atascados)
    const dias = (d) => Math.round((Date.now() - Date.parse(d)) / 86400000)
    for (const a of atascados) {
      console.log(
        `  · ${a.email} lleva ${dias(a.desde)} días · ${a.intentos} intentos · método ${a.metodos}` +
        (a.checkout_abierto ? `  ⚠️ ${a.checkout_abierto} checkout ABIERTO (le impide cancelar)` : ''),
      )
    }
    console.log(`\n  desatascar a alguien:  node scripts/stripe/compras-atascadas.cjs --rescatar <cus_id>`)
  }
  console.log(
    `\nℹ️ ${abandonos} cliente(s) más abrieron un checkout y no volvieron SIN intentar pagar: eso es` +
    ` abandono normal del embudo, no un fallo. No se cuentan.`,
  )
  process.exit(atascados.length > 0 ? 1 : 0)
})().catch((e) => { console.error('❌', e.message); process.exit(2) })

/**
 * Espejo de `sesionesAExpirar` de `lib/stripe/cancelCheckoutAbierto.ts`.
 *
 * Está copiado y no importado porque este script es CommonJS y aquello es TypeScript. Es el mismo
 * arreglo que `benignSignals` (frontend/backend), con el mismo riesgo: que uno se toque y el otro
 * no. Lo impide `__tests__/guardrails/compraAtascadaParidad.test.ts`, que exige que los dos
 * expiren SOLO las `open` — expirar una sesión ya cerrada da error de Stripe, y expirar una
 * `complete` sería cancelarle la compra a quien acaba de pagar.
 */
function sesionesAExpirar(sesiones) {
  return (sesiones ?? [])
    .filter((s) => s && s.id && s.status === 'open')
    .map((s) => s.id)
}

async function rescatar() {
  for (const [cuenta, key] of CUENTAS) {
    const sc = new Stripe(key)
    let cliente
    try { cliente = await sc.customers.retrieve(RESCATAR) } catch { continue }
    if (!cliente || cliente.deleted) continue
    const sesiones = await sc.checkout.sessions.list({ customer: RESCATAR, limit: 20 })
    const aExpirar = sesionesAExpirar(sesiones.data)
    console.log(`Cuenta ${cuenta} · ${cliente.email} · ${aExpirar.length} sesión(es) abierta(s)`)
    for (const id of aExpirar) {
      await sc.checkout.sessions.expire(id)
      console.log(`  ✅ expirada ${id}`)
    }
    if (aExpirar.length === 0) console.log('  (nada que expirar: ya puede cancelar)')
    return
  }
  console.error(`❌ Cliente ${RESCATAR} no encontrado en ninguna cuenta`)
  process.exit(2)
}
