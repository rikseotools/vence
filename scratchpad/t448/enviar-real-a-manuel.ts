// T-448 — Reenviar a Manuel el correo de UNA PERSONA REAL, con SUS datos.
//
// El intento anterior fue un error de método: puse a mano `29,99€ / al año` como ejemplo. No solo
// no probaba nada (probaba mi invención, no el sistema) sino que era una combinación IMPOSIBLE:
// no existe ni una oferta anual en la BD. Un test con datos fabricados no puede decir si lo que
// recibe la gente es correcto.
//
// Aquí NO se escribe ni una cifra: importe, periodicidad y fecha de fin salen de la misma consulta
// que usa el cron, para un destinatario real de los 4 del 01/08. Lo único que cambia es a qué
// buzón se entrega.
import 'dotenv/config'
import { Client } from 'pg'
import { pgConfig } from '@/lib/db/pgSsl.cjs'
import { sendEmailV2 } from '@/lib/api/emails'
import { fechaLarga, fechaLimiteRetorno } from '@/lib/api/premium/finSuscripcion'
import { formatearImporte, ETIQUETA_INTERVALO } from '@/lib/api/premium/ofertas'

const BUZON = 'manueltrader@gmail.com'
const CTA_URL = 'https://www.vence.es/premium/personal'
// Uno de los 4 que recibieron el correo el 01/08 a las 09:00.
const DESTINATARIO_REAL = '69e5ae4b-8e5b-4dce-a3f6-3bd37e7371a8'

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()

  const { rows } = await c.query(
    `SELECT p.email, p.full_name,
            o.importe_centimos, o.intervalo,
            (SELECT max(current_period_end) FROM user_subscriptions s
              WHERE s.user_id = o.user_id) AS fin_periodo
       FROM user_price_offers o
       JOIN user_profiles p ON p.id = o.user_id
      WHERE o.user_id = $1 AND o.revoked_at IS NULL`,
    [DESTINATARIO_REAL],
  )
  await c.end()

  if (!rows.length) { console.error('sin oferta viva para ese usuario'); process.exit(1) }
  const r = rows[0]

  const importe = formatearImporte(Number(r.importe_centimos))
  const periodicidad = ETIQUETA_INTERVALO[r.intervalo as keyof typeof ETIQUETA_INTERVALO]
  const fechaFin = fechaLarga(r.fin_periodo)

  console.log('DATOS REALES (ninguno escrito a mano):')
  console.log('  persona      :', r.email)
  console.log('  importe      :', importe)
  console.log('  periodicidad :', periodicidad, `(intervalo en BD: ${r.intervalo})`)
  console.log('  fechaFin     :', fechaFin)
  console.log('  límite real  :', fechaLarga(fechaLimiteRetorno(r.fin_periodo).toISOString()), '← el correo NO lo menciona')
  console.log('\n→ entregando a', BUZON)

  const envio = await sendEmailV2({
    userId: DESTINATARIO_REAL,
    emailType: 'fin_suscripcion_precio_heredado',
    idempotencyKey: `prueba-real:${DESTINATARIO_REAL}:${Date.now()}`,
    customData: {
      to: BUZON, // único cambio: el buzón de entrega
      userName: (r.full_name as string) || 'Manuel',
      fechaFin,
      importe,
      periodicidad,
      ctaUrl: CTA_URL,
    },
  })

  console.log('\nresultado:', JSON.stringify(envio))
  process.exit(envio.success ? 0 : 1)
})().catch((e) => { console.error('ERR', e?.message || e); process.exit(1) })
