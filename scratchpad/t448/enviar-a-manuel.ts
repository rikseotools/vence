// T-448 — Enviar a Manuel el MISMO correo que recibieron las 4 personas reales.
//
// No reconstruyo el email a mano: llamo a `sendEmailV2` con el MISMO `customData` que arma
// `avisoFinSuscripcion.ts` en producción (líneas 171-185). Si lo montara yo, estaría probando
// mi cableado y no el suyo, que es justo lo que se quería comprobar.
//
// Único cambio deliberado: la `idempotencyKey` lleva prefijo `prueba:` para NO colisionar con
// la real (`fin-susc:<userId>:<finPeriodo>`). Si usara la de producción y este usuario entrara
// algún día en la campaña, el envío de verdad se saltaría por idempotente.
import 'dotenv/config'
import { sendEmailV2 } from '@/lib/api/emails'
import { fechaLarga, fechaLimiteRetorno } from '@/lib/api/premium/finSuscripcion'

const USER_ID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f' // manueltrader@gmail.com
const EMAIL = 'manueltrader@gmail.com'
const CTA_URL = 'https://www.vence.es/premium/personal'

// Datos de ejemplo con la FORMA real: fin de periodo dentro de 12 días, precio de fidelidad.
const finPeriodo = new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString()

;(async () => {
  console.log('Enviando a', EMAIL)
  console.log('  fechaFin :', fechaLarga(finPeriodo))
  console.log('  límite   :', fechaLarga(fechaLimiteRetorno(finPeriodo).toISOString()), '← que el correo NO menciona')

  const envio = await sendEmailV2({
    userId: USER_ID,
    emailType: 'fin_suscripcion_precio_heredado',
    idempotencyKey: `prueba:fin-susc:${USER_ID}:${Date.now()}`,
    customData: {
      to: EMAIL,
      userName: 'Manuel',
      fechaFin: fechaLarga(finPeriodo),
      importe: '29,99€',
      periodicidad: 'al año',
      ctaUrl: CTA_URL,
    },
  })

  console.log('\nresultado:', JSON.stringify(envio))
  process.exit(envio.success ? 0 : 1)
})().catch((e) => {
  console.error('ERR', e?.message || e)
  process.exit(1)
})
