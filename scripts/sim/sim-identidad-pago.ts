/**
 * scripts/sim/sim-identidad-pago.ts — SIMULACIÓN del control de identidad en los endpoints
 * que mueven dinero (T-340), contra un servidor real.
 *
 * ## Qué comprueba y por qué existe
 *
 * Hasta el 30/07/2026 `/api/stripe/{cancel,reactivate,subscription,create-checkout}` sacaban
 * el `userId` del **cuerpo o de la query**, sin token: con el UUID de otra persona se le
 * podía cancelar la suscripción, **reactivársela** (volver a cobrarle), leer su facturación o
 * abrirle el portal de Stripe. Se descubrió porque un clic en «Reactivar» durante una
 * suplantación de solo lectura se ejecutó de verdad sobre la cuenta de una usuaria.
 *
 * Cada rechazo va emparejado con el caso que SÍ debe pasar (casos 8, 9 y 10). Sin ese
 * contraste, un endpoint roto que devolviera 403 a todo el mundo se leería como un éxito.
 *
 * NO escribe nada en Stripe: todas las llamadas que modificarían algo son las que deben ser
 * rechazadas, y la única legítima que se ejerce (caso 10) abre un portal de facturación, que
 * no cobra ni cambia estado.
 *
 * Uso (con el servidor levantado y AUTH_SECRET + DATABASE_URL del entorno):
 *   set -a && . ./.env.development.local && set +a
 *   npx tsx scripts/sim/sim-identidad-pago.ts [--url http://localhost:3000]
 */
import { encode } from 'next-auth/jwt'
import { Client } from 'pg'
import { payloadSesionImpersonada } from '../../lib/admin/impersonacion'

const BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL!.split('?')[0], ssl: { rejectUnauthorized: false } })
  await c.connect()
  const victima = (await c.query("select id, email from user_profiles where email='daluamva@gmail.com'")).rows[0]
  const otro = (await c.query("select id, email from user_profiles where plan_type='free' and email <> $1 order by updated_at desc limit 1", [victima.email])).rows[0]
  await c.end()

  const secret = process.env.AUTH_SECRET!
  const now = Math.floor(Date.now() / 1000)
  const cookieDe = async (uid: string, email: string) =>
    encode({ token: { appUserId: uid, email, sub: uid, iat: now, exp: now + 3600 }, secret, salt: 'authjs.session-token', maxAge: 3600 })
  const cookieSuplantando = async (uid: string, email: string) =>
    encode({ token: payloadSesionImpersonada({ objetivoUserId: uid, objetivoEmail: email, adminEmail: 'sim@vence.es', nowSec: now }), secret, salt: 'authjs.session-token', maxAge: 1800 })

  const tokenCon = async (cookie: string) => {
    const r = await fetch(`${BASE}/api/auth/token`, { headers: { Cookie: `authjs.session-token=${cookie}` } })
    const j = await r.json().catch(() => ({}))
    return j.accessToken as string | undefined
  }

  const post = async (ruta: string, body: unknown, token?: string) => {
    const r = await fetch(`${BASE}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    return r.status
  }

  const fallos: string[] = []
  const linea = (ok: boolean, txt: string) => console.log(`${ok ? '✅' : '❌'} ${txt}`)

  // 1) SIN token, con el userId de otra persona en el cuerpo — el ataque original.
  const s1 = await post('/api/stripe/reactivate', { userId: victima.id })
  linea(s1 === 401, `1) reactivar la suscripción de otro SIN token → ${s1} (esperado 401)`)
  if (s1 !== 401) fallos.push(`reactivate sin token devolvió ${s1}`)

  const s2 = await post('/api/stripe/cancel', { userId: victima.id, reason: 'test' })
  linea(s2 === 401, `2) cancelar la suscripción de otro SIN token → ${s2} (esperado 401)`)
  if (s2 !== 401) fallos.push(`cancel sin token devolvió ${s2}`)

  const r3 = await fetch(`${BASE}/api/stripe/subscription?userId=${victima.id}`)
  linea(r3.status === 401, `3) leer la facturación de otro SIN token → ${r3.status} (esperado 401)`)
  if (r3.status !== 401) fallos.push(`subscription sin token devolvió ${r3.status}`)

  const s4 = await post('/api/stripe/subscription', { userId: victima.id })
  linea(s4 === 401, `4) abrir el PORTAL de facturación de otro SIN token → ${s4} (esperado 401)`)
  if (s4 !== 401) fallos.push(`portal sin token devolvió ${s4}`)

  // 5) CON token propio pero pidiendo actuar sobre OTRO usuario.
  const tokenOtro = await tokenCon(await cookieDe(otro.id, otro.email))
  const s5 = await post('/api/stripe/cancel', { userId: victima.id, reason: 'test' }, tokenOtro)
  linea(s5 === 403, `5) usuario autenticado pidiendo cancelar la de OTRO → ${s5} (esperado 403)`)
  if (s5 !== 403) fallos.push(`cancel con id ajeno devolvió ${s5}`)

  // 6) SUPLANTACIÓN (solo lectura): escribir tiene que estar prohibido…
  const tokenImp = await tokenCon(await cookieSuplantando(victima.id, victima.email))
  const s6 = await post('/api/stripe/reactivate', { userId: victima.id }, tokenImp)
  linea(s6 === 403, `6) suplantando: reactivar → ${s6} (esperado 403) ← el clic de esta noche`)
  if (s6 !== 403) fallos.push(`reactivate suplantando devolvió ${s6}`)

  const s7 = await post('/api/stripe/cancel', { userId: victima.id, reason: 'test' }, tokenImp)
  linea(s7 === 403, `7) suplantando: cancelar → ${s7} (esperado 403)`)
  if (s7 !== 403) fallos.push(`cancel suplantando devolvió ${s7}`)

  // 8) …pero LEER sí: es para lo que existe la suplantación (contraste).
  const r8 = await fetch(`${BASE}/api/stripe/subscription?userId=${victima.id}`, { headers: { Authorization: `Bearer ${tokenImp}` } })
  linea(r8.status === 200, `8) suplantando: LEER su suscripción → ${r8.status} (esperado 200) → el 403 es del candado, no de la ruta`)
  if (r8.status !== 200) fallos.push(`lectura suplantando devolvió ${r8.status}`)

  // 9) Y el dueño legítimo puede seguir operando (sin esto, "todo 403" parecería un éxito).
  const tokenVictima = await tokenCon(await cookieDe(victima.id, victima.email))
  const r9 = await fetch(`${BASE}/api/stripe/subscription?userId=${victima.id}`, { headers: { Authorization: `Bearer ${tokenVictima}` } })
  linea(r9.status === 200, `9) la propia usuaria lee SU suscripción → ${r9.status} (esperado 200)`)
  if (r9.status !== 200) fallos.push(`la dueña no puede leer lo suyo: ${r9.status}`)

  // 10) CONTRASTE de escritura: el dueño legítimo puede seguir operando. Se usa el portal
  //     de facturación porque es la única escritura que no cobra ni cambia el estado de nada.
  const s10 = await post('/api/stripe/subscription', { userId: victima.id }, tokenVictima)
  linea(s10 === 200, `10) la propia usuaria abre SU portal de facturación → ${s10} (esperado 200) → la guarda no rompe lo legítimo`)
  if (s10 !== 200) fallos.push(`la dueña no puede abrir su portal: ${s10}`)

  console.log(fallos.length ? `\n❌ ${fallos.length} fallo(s): ${fallos.join(' · ')}` : '\n✅ La identidad ya no la pone el cliente.')
  process.exit(fallos.length ? 1 : 0)
}
main()
