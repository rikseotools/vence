/**
 * scripts/premium/crear-ofertas-fidelidad.ts — crea POR ADELANTADO el precio de fidelidad de
 * quien tiene la suscripción apagándose en la cuenta de cobro antigua. (T-448)
 *
 * ## Por qué por adelantado y no al pulsar el botón
 *
 * Hasta hoy la oferta nacía en el clic (`/api/v2/premium/recuperar-precio`). Funciona, pero deja
 * tres cabos que solo se ven en el peor momento, el de decidir:
 *
 *  1. **El botón no puede decir el precio** si la oferta todavía no existe, y el precio ES el
 *     argumento entero (20 € frente a 29 €). Con la oferta creada, el perfil enseña la cifra.
 *  2. **Crear la oferta habla con Stripe en vivo.** Si Stripe tarda o falla, el perfil hace
 *     `tieneOferta ? '/premium/personal' : '/premium'` y la persona acaba viendo la TARIFA NUEVA.
 *     Un tropiezo de red le cuesta su precio.
 *  3. **No se sabía a cuántos les saldría.** Medido antes de escribir nada: **189 de 189**
 *     (84 a 35 € trimestral, 73 a 59 € semestral, 32 a 20 € mensual). Cero excepciones.
 *
 * `asegurarOfertaHeredada` es idempotente (price por `lookup_key`, fila con `ON CONFLICT DO
 * NOTHING`), así que repetir esto no duplica nada.
 *
 * Uso:
 *   NODE_OPTIONS="--require ./scripts/sim/stubs/server-only-shim.cjs" \
 *     npx tsx --env-file=.env.local scripts/premium/crear-ofertas-fidelidad.ts [--apply] [--limite N]
 *
 * Sin `--apply` NO escribe nada: dice a quién se le crearía y con qué precio.
 */
import 'dotenv/config'
import { Client } from 'pg'
import { asegurarOfertaHeredada } from '../../lib/api/premium/ofertaHeredada'
import { getOfertaActiva, formatearImporte, ETIQUETA_INTERVALO } from '../../lib/api/premium/ofertas'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--apply')
const LIMITE = Number(process.argv.find((a) => a.startsWith('--limite'))?.split('=')[1] ?? 0) || 0

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  // Quien se apaga y TODAVÍA tiene acceso: a quien ya venció se le decide aparte (su plazo de un
  // mes corre desde otra fecha y puede haberse pasado ya).
  const { rows } = await c.query(`
    SELECT DISTINCT p.id, p.email, s.current_period_end
      FROM user_subscriptions s JOIN user_profiles p ON p.id = s.user_id
     WHERE p.payment_account = 'manuel' AND s.cancel_at_period_end = true
       AND s.current_period_end > now()
     ORDER BY s.current_period_end`)
  await c.end()

  const objetivo = LIMITE ? rows.slice(0, LIMITE) : rows
  console.log(`${objetivo.length} persona(s) con la suscripción apagándose${APLICAR ? '' : '  [SIMULACRO — no se escribe nada]'}\n`)

  const cuenta = { yaTenia: 0, creada: 0, fallo: 0 }
  const motivos: Record<string, number> = {}
  const precios: Record<string, number> = {}

  for (const [i, u] of objetivo.entries()) {
    const previa = await getOfertaActiva(u.id)
    if (previa) {
      cuenta.yaTenia++
      const k = `${formatearImporte(previa.importeCentimos)} ${ETIQUETA_INTERVALO[previa.intervalo]}`
      precios[k] = (precios[k] ?? 0) + 1
      continue
    }
    if (!APLICAR) {
      cuenta.creada++
      continue
    }
    const r = await asegurarOfertaHeredada(u.id)
    if (!r.ok) {
      cuenta.fallo++
      motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1
      console.log(`   ⚠️ ${u.email}: ${r.motivo}`)
      continue
    }
    cuenta.creada++
    const nueva = await getOfertaActiva(u.id)
    if (nueva) {
      const k = `${formatearImporte(nueva.importeCentimos)} ${ETIQUETA_INTERVALO[nueva.intervalo]}`
      precios[k] = (precios[k] ?? 0) + 1
    }
    if ((i + 1) % 25 === 0) console.log(`   … ${i + 1}/${objetivo.length}`)
  }

  console.log('\n=== resultado')
  console.table([{ ya_tenia: cuenta.yaTenia, creadas: cuenta.creada, fallos: cuenta.fallo }])
  if (Object.keys(precios).length) {
    console.log('=== precios recuperados')
    console.table(Object.entries(precios).sort((a, b) => b[1] - a[1]).map(([precio, n]) => ({ precio, personas: n })))
  }
  if (Object.keys(motivos).length) {
    console.log('=== motivos de los que no salieron')
    console.table(Object.entries(motivos).map(([motivo, n]) => ({ motivo, personas: n })))
  }
  if (!APLICAR) console.log('\n(simulacro: nada escrito. Para hacerlo de verdad, añade --apply)')
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
