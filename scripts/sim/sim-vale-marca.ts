#!/usr/bin/env npx tsx
/**
 * Simulación: qué pinta la tarjeta de «Mis vales» para los vales REALES de la base.
 *
 * No es un test de texto: importa el MISMO `toVoucherDTO` que usan los dos endpoints y lo corre
 * sobre las filas de `reward_payouts` de RDS. Nace de T-591 (05/08/2026): la tarjeta etiquetaba
 * como «Amazon.es» y enlazaba a Amazon TODOS los vales, incluidos los tres de Nike España recién
 * comprados. Aquí se ve, vale a vale, la marca y el destino que le tocan.
 *
 * Uso:  npx tsx --env-file=.env.local scripts/sim/sim-vale-marca.ts [--email <correo>]
 */
import postgres from 'postgres'
import { toVoucherDTO } from '../../lib/referrals/voucherView'

const arg = (n: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const EMAIL = arg('--email')

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

async function main() {
  const rows = await sql<Array<Record<string, unknown>>>`
    SELECT p.amount, p.giftcard_ref, p.purchased_via, p.method, p.paid_at, p.reason, u.email
      FROM reward_payouts p
      JOIN user_profiles u ON u.id = p.beneficiary_user_id
     WHERE p.status = 'paid' AND p.giftcard_ref IS NOT NULL
       AND coalesce(p.purchased_via,'') <> 'bitrefill_dryrun'
       ${EMAIL ? sql`AND u.email = ${EMAIL}` : sql``}
     ORDER BY p.paid_at DESC`

  console.log(`\n🎁 ${rows.length} vale(s) servibles — lo que ve el usuario en «Mis vales»\n`)

  let sinDestino = 0
  for (const r of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = toVoucherDTO(r as any)
    const destino = v.brand.redeemUrl ? `${v.brand.redeemCta} → ${v.brand.redeemUrl}` : '⚠️ SIN destino (marca no registrada)'
    if (!v.brand.redeemUrl) sinDestino++
    console.log(`  ${String(v.amount).padStart(5)} € · ${v.brand.label.padEnd(14)} │ ${String(r.email).slice(0, 28).padEnd(28)} │ ${String(r.reason)}`)
    console.log(`         código ${v.code}${v.pin ? ` · PIN ${v.pin}` : ''}`)
    console.log(`         ${destino}`)
    console.log(`         «${v.brand.redeemHint}»${v.brand.balanceUrl ? ` · saldo: ${v.brand.balanceUrl}` : ''}`)
  }

  // El fallo que motivó todo: un vale con la marca de OTRA tienda.
  const nike = rows.filter(r => String(r.giftcard_ref).includes('nike-spain') || r.method === 'nike_giftcard')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nikeMalEtiquetados = nike.filter(r => toVoucherDTO(r as any).brand.label !== 'Nike España')
  console.log(`\n── Veredicto ──`)
  console.log(`   vales Nike: ${nike.length} · mal etiquetados: ${nikeMalEtiquetados.length} ${nikeMalEtiquetados.length ? '❌' : '✅'}`)
  console.log(`   vales sin destino de canje: ${sinDestino} ${sinDestino ? '(marca por registrar)' : '✅'}`)

  await sql.end()
  process.exit(nikeMalEtiquetados.length ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
