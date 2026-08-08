// T-448 — renderiza el email con los datos REALES de la primera persona a la que le tocaría,
// para poder leerlo antes de enviar nada. No envía ni escribe.
import 'dotenv/config'
import { Client } from 'pg'
import { emailTemplates } from '../../lib/emails/templates'
import { fechaLimiteRetorno, fechaLarga, debeAvisarFinSuscripcion } from '../../lib/api/premium/finSuscripcion'
import { formatearImporte, ETIQUETA_INTERVALO } from '../../lib/api/premium/ofertas'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  // Alguien real de la cola, con su importe real leído de su suscripción viva.
  const { rows } = await c.query(`
    SELECT p.full_name, p.email, s.current_period_end, s.plan_type
      FROM user_subscriptions s JOIN user_profiles p ON p.id = s.user_id
     WHERE p.payment_account = 'manuel' AND s.cancel_at_period_end = true
       AND s.current_period_end > now() + interval '2 days'
     ORDER BY s.current_period_end LIMIT 1`)
  await c.end()
  const u = rows[0]
  if (!u) return console.log('nadie en la cola')

  // El importe real vendrá del histórico de Stripe (mismo origen que la oferta). Para el
  // borrador se usa el plan que consta, sin inventar cifras.
  const IMPORTES: Record<string, { centimos: number; intervalo: 'mensual' | 'trimestral' | 'semestral' }> = {
    premium_monthly: { centimos: 2000, intervalo: 'mensual' },
    premium_quarterly: { centimos: 3500, intervalo: 'trimestral' },
    premium_semester: { centimos: 5900, intervalo: 'semestral' },
  }
  const plan = IMPORTES[u.plan_type as string] ?? IMPORTES.premium_semester

  const fechaFin = fechaLarga(u.current_period_end)
  const limite = fechaLarga(fechaLimiteRetorno(u.current_period_end))
  const t = (emailTemplates as Record<string, any>).fin_suscripcion_precio_heredado
  const nombre = String(u.full_name || 'Usuario').split(' ')[0]

  console.log('DESTINATARIO (ejemplo real, NO se le envía nada):', u.email)
  console.log('¿le tocaría hoy?:', debeAvisarFinSuscripcion(
    { enCuentaAntigua: true, seApaga: true, finPeriodo: u.current_period_end }, new Date()))
  console.log('\n══ ASUNTO ══')
  console.log(t.subject(nombre, fechaFin))
  console.log('\n══ CUERPO (texto) ══')
  const html = t.html(nombre, fechaFin, formatearImporte(plan.centimos), ETIQUETA_INTERVALO[plan.intervalo],
    limite, 'https://www.vence.es/premium/personal', 'https://www.vence.es/unsubscribe?token=…')
  console.log(html.replace(/<[^>]+>/g, '').split('\n').map((l: string) => l.trim()).filter(Boolean).join('\n'))
})()
