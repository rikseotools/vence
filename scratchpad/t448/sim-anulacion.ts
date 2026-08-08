import 'dotenv/config'
import { anularOfertasCaducadas } from '../../lib/api/premium/avisoFinSuscripcion'
import { debeAnularOferta, fechaLimiteRetorno } from '../../lib/api/premium/finSuscripcion'
;(async () => {
  const r = await anularOfertasCaducadas({ dryRun: true })
  console.log(`=== barrido de anulación EN SECO: candidatas=${r.candidatas} abortado=${r.abortado}`)
  if (r.detalle.length) console.table(r.detalle)
  else console.log('  (ninguna oferta ha superado su mes todavía — correcto: la más vieja es del 29/07)')
  console.log('\n=== contraste del criterio (que no anula antes de tiempo)')
  const fin = new Date('2026-07-04T09:00:00Z')
  console.log('  el último día NO se anula:', debeAnularOferta(fin, new Date('2026-08-04T08:00:00Z')) === false ? '✅' : '❌')
  console.log('  pasado el mes SÍ:         ', debeAnularOferta(fin, new Date('2026-08-05T09:00:00Z')) === true ? '✅' : '❌')
  console.log('  límite para un fin el 04/07:', fechaLimiteRetorno(fin).toISOString().slice(0, 10))
})()
