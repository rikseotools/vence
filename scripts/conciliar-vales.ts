#!/usr/bin/env npx tsx
/**
 * CONCILIACIÓN de vales: lo comprado en Bitrefill ↔ lo anotado en `reward_payouts`.
 *
 * ## Por qué existe (30/07/2026)
 *
 * El 28/07 se compraron 210 € en vales para el propietario y se anotaron como `accumulated`, es
 * decir, indistinguibles de una recompensa a un embajador. Nadie lo detectó: **no había nada que
 * comparase el gasto real del proveedor con lo registrado en la base**. Se descubrió por casualidad
 * al ver un saldo pagable de −210 € y preguntarse de dónde salía.
 *
 * Esto es lo que impide que vuelva a pasar: si se compra un vale y no se anota (o al revés), sale
 * aquí. Es la diferencia entre «creemos que cuadra» y «cuadra».
 *
 * ## Qué compara, y por qué en ese sentido
 *
 * Recorre los invoices ENTREGADOS de Bitrefill y busca cada uno en `giftcard_ref`. Los dos fallos
 * posibles son asimétricos y por eso se listan aparte:
 *   - **Comprado y NO anotado** → dinero que salió y no figura en ninguna cuenta. Es el grave.
 *   - **Anotado y NO comprado** → una fila sin respaldo real (o comprado fuera de esta cuenta).
 *
 * NO ESCRIBE NADA. Solo lee Bitrefill y la base.
 *
 * Uso:  npx tsx scripts/conciliar-vales.ts [--limite 50]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : d
}
const LIMITE = Number(arg('--limite', '50'))

// Un trabajador autónomo no ejecuta esto: consulta compras de vales con dinero real y no hay
// nadie delante. Ver lib/sessions/dinero.cjs.
const { exigirPersonaParaDinero } = require('../lib/sessions/dinero.cjs')
if (!exigirPersonaParaDinero('vales')) process.exit(4)

const TOKEN = process.env.BITREFILL_API_TOKEN
const DB = process.env.DATABASE_URL
if (!TOKEN) { console.error('❌ falta BITREFILL_API_TOKEN'); process.exit(2) }
if (!DB) { console.error('❌ falta DATABASE_URL'); process.exit(2) }

const sql = postgres(DB, { ssl: { rejectUnauthorized: false }, max: 2 })

interface Compra { id: string; eur: number; cuando: string; estado: string; code?: string }

async function comprasBitrefill(): Promise<Compra[]> {
  const r = await fetch(`https://api.bitrefill.com/v2/invoices?limit=${LIMITE}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const j = (await r.json()) as { data?: unknown[] }
  const out: Compra[] = []
  for (const inv of (j.data ?? []) as Array<Record<string, unknown>>) {
    const orders = (inv.orders ?? []) as Array<Record<string, unknown>>
    for (const o of orders) {
      const prod = (o.product ?? {}) as Record<string, unknown>
      out.push({
        id: String(inv.id),
        eur: Number(prod.value ?? 0),
        cuando: String(inv.created_time ?? '').slice(0, 16).replace('T', ' '),
        estado: String(o.status ?? inv.status ?? '?'),
        code: String(((o.redemption_info ?? {}) as Record<string, unknown>).code ?? ''),
      })
    }
  }
  return out
}

async function main() {
  console.log(`\n🧾 Conciliación de vales — últimos ${LIMITE} invoices de Bitrefill\n`)

  const compras = await comprasBitrefill()
  // Solo GIFT CARDS: los invoices de recarga traen `value` en BTC (0,0078…), que no es un vale y
  // ensuciaba la lista de «comprado y no anotado» con céntimos. Un vale de Amazon.es nunca baja de 5 €.
  const entregadas = compras
    .filter(c => c.estado === 'delivered' || c.estado === 'all_delivered')
    .filter(c => c.eur >= 5)
  console.log(`Comprados y ENTREGADOS en Bitrefill: ${entregadas.length} vale(s), ${entregadas.reduce((n, c) => n + c.eur, 0)} €`)

  const anotados = await sql<Array<{ ref: string; amount: string; reason: string; email: string | null }>>`
    SELECT p.giftcard_ref AS ref, p.amount::text AS amount, p.reason, u.email
      FROM reward_payouts p
      LEFT JOIN user_profiles u ON u.id = p.beneficiary_user_id
     WHERE p.status <> 'void'`
  console.log(`Anotados en reward_payouts:          ${anotados.length} pago(s), ${anotados.reduce((n, a) => n + Number(a.amount), 0)} €\n`)

  // El invoice id vive dentro del JSON de `giftcard_ref` (clave `_invoice_id`), así que se busca
  // por contenido: es lo que ata una fila de la base con una compra real del proveedor.
  const refTexto = anotados.map(a => String(a.ref ?? ''))
  // Se ata por invoice id… y si no, por CÓDIGO del vale. Las filas anteriores al 14/07 guardaban
  // solo `code/pin/serial` sin `_invoice_id`, así que buscar únicamente por invoice daba un falso
  // positivo por cada una: la misma compra aparecía a la vez como «no anotada» y como «anotada sin
  // invoice». Medido el 30/07: los 5 € del 11/07 de flor7687 eran exactamente eso.
  const codigoDe = new Map<string, string>()  // invoice id → code, para el cruce inverso
  for (const c of entregadas) codigoDe.set(c.id, c.code ?? '')
  const ata = (c: Compra) => refTexto.some(r => r.includes(c.id) || (c.code && r.includes(c.code)))
  const sinAnotar = entregadas.filter(c => !ata(c))

  console.log('── 🔴 COMPRADO y NO anotado (dinero que salió sin figurar) ──')
  if (!sinAnotar.length) console.log('   ninguno ✅')
  else for (const c of sinAnotar) console.log(`   ${c.cuando} · ${c.eur} € · invoice ${c.id.slice(0, 8)}`)

  console.log('\n── 🟠 ANOTADO sin invoice reconocible ──')
  const idsEntregados = entregadas.map(c => c.id)
  const codigos = entregadas.map(c => c.code).filter(Boolean) as string[]
  const huerfanos = anotados.filter(a => {
    const t = String(a.ref ?? '')
    return t.length > 0 && !idsEntregados.some(id => t.includes(id)) && !codigos.some(cd => t.includes(cd))
  })
  if (!huerfanos.length) console.log('   ninguno ✅')
  else for (const h of huerfanos) console.log(`   ${h.amount} € · ${h.reason} · ${h.email ?? '(sin email)'}`)

  console.log('\n── Desglose por motivo (lo que separa el coste del programa de las retiradas) ──')
  const porMotivo = await sql`
    SELECT reason, count(*)::int AS n, sum(amount)::float AS eur
      FROM reward_payouts WHERE status <> 'void' GROUP BY 1 ORDER BY 3 DESC`
  console.table(porMotivo)
  console.log('   `owner_withdrawal` NO es coste del programa de embajadores: es el propietario')
  console.log('   comprándose vales con el saldo de Bitrefill. Ver el runbook de recompensas.')

  await sql.end()
}

main().catch(e => { console.error('❌', e); process.exit(1) })
