// T-448 — SIMULACRO de la campaña contra datos reales. No crea ofertas ni envía nada.
import 'dotenv/config'
import { runCampanaFinSuscripcion, getPublicoFinSuscripcion } from '../../lib/api/premium/avisoFinSuscripcion'
import { debeAvisarFinSuscripcion } from '../../lib/api/premium/finSuscripcion'

;(async () => {
  console.log('=== a quién le tocaría HOY (3 días antes)')
  const hoy = await getPublicoFinSuscripcion(3)
  console.table(hoy.map((c) => ({ email: c.email, nombre: c.nombre, vence: String(c.finPeriodo).slice(0, 10) })))

  console.log('\n=== la campaña en seco')
  const r = await runCampanaFinSuscripcion({ diasAntes: 3, dryRun: true })
  console.log(`candidatos=${r.candidatos} enviaría=${r.enviados} omitidos=${r.omitidos} fallidos=${r.fallidos}`)
  console.table(r.detalle)

  // CONTRASTE: sin el contraste, una campaña que no encuentra a nadie se leería como éxito.
  console.log('\n=== contraste (que el filtro filtra de verdad)')
  const base = { enCuentaAntigua: true, seApaga: true, finPeriodo: new Date(Date.now() + 3 * 86400000) }
  const casos: Array<[string, boolean]> = [
    ['cuenta antigua + se apaga + 3 días → SÍ', debeAvisarFinSuscripcion(base)],
    ['ya está en la cuenta nueva → NO', debeAvisarFinSuscripcion({ ...base, enCuentaAntigua: false })],
    ['va a renovar sola → NO', debeAvisarFinSuscripcion({ ...base, seApaga: false })],
    ['vence dentro de 20 días → NO', debeAvisarFinSuscripcion({ ...base, finPeriodo: new Date(Date.now() + 20 * 86400000) })],
  ]
  for (const [texto, ok] of casos) console.log(`  ${ok ? '✅' : '⛔'} ${texto}`)

  // Y el público de los próximos días, para ver el goteo que producirá el cron
  console.log('\n=== goteo de los próximos 10 días')
  for (const d of [1, 2, 3, 4, 5, 7, 10]) {
    const p = await getPublicoFinSuscripcion(d)
    console.log(`  a ${String(d).padStart(2)} días vista: ${p.length} persona(s)`)
  }
})()
