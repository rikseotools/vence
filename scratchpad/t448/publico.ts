// T-448 — ¿a cuánta gente y en qué fechas llegaría el aviso? Solo lee.
import 'dotenv/config'
import { Client } from 'pg'
import { debeAvisarFinSuscripcion, fechaLimiteRetorno, fechaLarga } from '../../lib/api/premium/finSuscripcion'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  const r = await c.query(`
    SELECT p.email, s.current_period_end
      FROM user_subscriptions s JOIN user_profiles p ON p.id = s.user_id
     WHERE p.payment_account = 'manuel' AND s.cancel_at_period_end = true
       AND s.current_period_end > now()
     ORDER BY s.current_period_end`)
  await c.end()

  const hoy = new Date()
  const avisablesHoy = r.rows.filter((x) =>
    debeAvisarFinSuscripcion({ enCuentaAntigua: true, seApaga: true, finPeriodo: x.current_period_end }, hoy),
  )
  console.log(`suscripciones apagándose con acceso vivo: ${r.rows.length}`)
  console.log(`a las que tocaría avisar HOY (vencen en ~3 días): ${avisablesHoy.length}`)

  // Reparto por mes, para ver el goteo que va a producir el cron
  const porMes = new Map<string, number>()
  for (const x of r.rows) {
    const k = new Date(x.current_period_end).toISOString().slice(0, 7)
    porMes.set(k, (porMes.get(k) ?? 0) + 1)
  }
  console.log('\nvencimientos por mes (cuántos avisos saldrán cada mes):')
  console.table([...porMes.entries()].map(([mes, n]) => ({ mes, avisos: n })))

  console.log('\nlos 5 más próximos, con lo que diría su email:')
  console.table(
    r.rows.slice(0, 5).map((x) => ({
      vence: fechaLarga(x.current_period_end),
      limite_para_volver: fechaLarga(fechaLimiteRetorno(x.current_period_end)),
    })),
  )
})()
