// scripts/sim/sim-baja-emails.ts
//
// SIMULACIÓN de la baja de emails (T-369) contra la BD REAL.
//
// Los tests unitarios mockean Drizzle, así que NO ejercen lo único que aquí puede
// fallar de verdad: el UPDATE de `email_preferences` se construye con nombres de
// columna DINÁMICOS (`sql.identifier(k)`), y una clave que no exista o un tipo que
// no case revienta en ejecución con los tests en verde. Esto lo ejerce de verdad.
//
// Y comprueba la propiedad que motivó la tarea, extremo a extremo: quien se da de
// baja de TODOS los emails **sigue recibiendo la respuesta a lo que él nos escribe**,
// salvo que marque la casilla — porque `email_soporte_disabled` es también la puerta
// del aviso de renovación (`recordatorio_renovacion` es categoría 'soporte').
//
// Usa usuarios efímeros que crea y borra él mismo — nunca datos de un cliente.
// Es seguro correrlo contra producción.
//
//   npm run sim:baja-emails
//
// (El shim de `server-only` es obligatorio: sin él, el módulo `.server.ts` se niega a
// cargar fuera del runtime de Next. Va dentro del script de npm.)
import postgres from 'postgres'
import { processUnsubscribeByToken } from '../../lib/emails/emailService.server'
import { canSendEmail } from '../../lib/api/emails'

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  max: 2,
})

const PREFIJO = 'sim-baja-emails'
let fallos = 0

function comprobar(nombre: string, ok: boolean, detalle = '') {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  if (!ok) fallos++
}

/** Crea usuario + preferencias por defecto + token de baja vivo, y devuelve el token. */
async function nuevoCaso(slug: string, emailType: string) {
  const email = `${PREFIJO}-${slug}@vence.es`
  const [u] = await sql`
    INSERT INTO user_profiles (id, email, full_name, plan_type)
    VALUES (gen_random_uuid(), ${email}, 'Sim Baja Emails', 'free')
    ON CONFLICT (email) DO UPDATE SET full_name = 'Sim Baja Emails'
    RETURNING id`
  const userId = u.id as string

  await sql`
    INSERT INTO email_preferences (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE
      SET unsubscribed_all = false,
          email_newsletter_disabled = false,
          email_soporte_disabled = false`

  const token = `${PREFIJO}-${slug}-${Date.now()}`
  await sql`
    INSERT INTO email_unsubscribe_tokens (user_id, token, email, email_type, expires_at)
    VALUES (${userId}, ${token}, ${email}, ${emailType}, NOW() + INTERVAL '1 day')`

  return { userId, email, token }
}

async function prefs(userId: string) {
  const [p] = await sql`
    SELECT unsubscribed_all, email_newsletter_disabled, email_soporte_disabled
    FROM email_preferences WHERE user_id = ${userId}`
  return p as {
    unsubscribed_all: boolean
    email_newsletter_disabled: boolean
    email_soporte_disabled: boolean
  }
}

async function main() {
  try {
    // ── 1. Botón rojo SIN marcar la casilla (el caso que rompía) ────────────────
    // Entra por el enlace de una newsletter, que es el camino real de la mayoría.
    const a = await nuevoCaso('nuclear', 'newsletter')
    const rA = await processUnsubscribeByToken(a.token, null, true, null)
    const pA = await prefs(a.userId)
    comprobar('baja masiva: aplica', rA.success === true, rA.error ?? '')
    comprobar('baja masiva: corta lo automático', pA.unsubscribed_all === true && pA.email_newsletter_disabled === true)
    comprobar(
      'baja masiva: NO corta las respuestas a lo que él escribe',
      pA.email_soporte_disabled === false
    )

    // La prueba que de verdad importa: ¿le llegaría nuestra contestación?
    const respuestaImpugnacion = await canSendEmail(a.userId, 'impugnacion_respuesta')
    const respuestaSoporte = await canSendEmail(a.userId, 'soporte_respuesta')
    const avisoRenovacion = await canSendEmail(a.userId, 'recordatorio_renovacion')
    const marketing = await canSendEmail(a.userId, 'reactivacion')
    const boletin = await canSendEmail(a.userId, 'newsletter')
    comprobar('→ recibe la respuesta a su impugnación', respuestaImpugnacion.canSend === true, JSON.stringify(respuestaImpugnacion))
    comprobar('→ recibe la respuesta de soporte', respuestaSoporte.canSend === true, JSON.stringify(respuestaSoporte))
    comprobar('→ recibe el aviso de renovación (paga)', avisoRenovacion.canSend === true, JSON.stringify(avisoRenovacion))
    comprobar('→ ya NO recibe marketing', marketing.canSend === false, JSON.stringify(marketing))
    comprobar('→ ya NO recibe la newsletter', boletin.canSend === false, JSON.stringify(boletin))

    // ── 2. Botón rojo MARCANDO la casilla (sigue siendo posible cortarlo todo) ──
    const b = await nuevoCaso('nuclear-soporte', 'newsletter')
    const rB = await processUnsubscribeByToken(b.token, null, true, null, true)
    const pB = await prefs(b.userId)
    comprobar('baja masiva + casilla: aplica', rB.success === true, rB.error ?? '')
    comprobar('baja masiva + casilla: corta TAMBIÉN las respuestas', pB.email_soporte_disabled === true)
    const respuestaB = await canSendEmail(b.userId, 'impugnacion_respuesta')
    comprobar('→ NO recibe la respuesta a su impugnación', respuestaB.canSend === false, JSON.stringify(respuestaB))

    // ── 3. La newsletter por categoría: el camino que NO se ha tocado ───────────
    // Es lo que el usuario avisó de no romper: el enlace del boletín sigue igual.
    const c = await nuevoCaso('categoria-newsletter', 'newsletter')
    const rC = await processUnsubscribeByToken(c.token, null, false, ['newsletter'])
    const pC = await prefs(c.userId)
    comprobar('baja por categoría newsletter: aplica', rC.success === true, rC.error ?? '')
    comprobar('baja por categoría newsletter: corta el boletín', pC.email_newsletter_disabled === true)
    comprobar('baja por categoría newsletter: NO corta nada más', pC.unsubscribed_all === false && pC.email_soporte_disabled === false)
    const marketingC = await canSendEmail(c.userId, 'reactivacion')
    comprobar('→ el que solo deja el boletín sigue recibiendo el resto', marketingC.canSend === true, JSON.stringify(marketingC))

    // ── 4. Categoría 'soporte': la vía explícita de siempre ────────────────────
    const d = await nuevoCaso('categoria-soporte', 'impugnacion_respuesta')
    await processUnsubscribeByToken(d.token, null, false, ['soporte'])
    const pD = await prefs(d.userId)
    comprobar('categoría soporte: sigue cortando las respuestas', pD.email_soporte_disabled === true)

    // ── 5. El token se consume (no se puede reusar el enlace) ──────────────────
    const rReuso = await processUnsubscribeByToken(a.token, null, true, null)
    comprobar('el enlace de baja no se puede reusar', rReuso.success === false && rReuso.errorCode === 'invalid_token')
  } finally {
    await sql`DELETE FROM email_unsubscribe_tokens WHERE email LIKE ${PREFIJO + '%'}`
    await sql`DELETE FROM email_preferences WHERE user_id IN (
      SELECT id FROM user_profiles WHERE email LIKE ${PREFIJO + '%'})`
    await sql`DELETE FROM user_profiles WHERE email LIKE ${PREFIJO + '%'}`
    await sql.end()
  }

  console.log(fallos === 0 ? '\n✅ SIMULACIÓN OK' : `\n❌ ${fallos} comprobación(es) fallidas`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('❌ Simulación abortada:', e)
  process.exit(1)
})
