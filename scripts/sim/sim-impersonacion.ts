/**
 * scripts/sim/sim-impersonacion.ts — SIMULACIÓN de la suplantación (T-289) contra un
 * servidor real, con navegador real.
 *
 * Comprueba las cuatro cosas que tienen que ser ciertas para que «ver la app como un
 * usuario» sea seguro, y las comprueba CONTRASTANDO con una sesión normal — sin ese
 * contraste, un 403 puede venir de cualquier otra causa y parecer que el candado funciona:
 *
 *   1. la sesión suplantada tiene la identidad del USUARIO (si no, no vemos su pantalla);
 *   2. lleva la marca de quién mira, y esa marca llega hasta el access token;
 *   3. **escribir con ella se rechaza** (403) y **leer funciona** (200);
 *   4. la misma escritura con una sesión NORMAL no da 403 → el 403 es del candado;
 *   5. **se puede SALIR**. Esto no estaba y por poco se despliega roto: la salida vivía en
 *      `/api/admin/*`, cuyo guard exige token de admin — y durante la suplantación el token
 *      es el del usuario, así que devolvía 401 y dejaba atrapado dentro de la cuenta ajena
 *      hasta que caducara sola. Un ciclo a medias no prueba el ciclo.
 *   6. **se TERMINA sola** (T-335, 30/07/2026). Esto tampoco estaba, y era el hueco de
 *      verdad: los puntos 1-5 comprueban que la suplantación empieza bien y que se puede
 *      cerrar A MANO, no que caduque. No caducaba — `exp` lo reescribía Auth.js en cada
 *      rotación— así que duraba días, y encima sin franja, porque la cookie que la pinta sí
 *      expiraba a los 30 minutos. Se comprueba con el plazo YA vencido: ni se acuña token ni
 *      se sirve la cuenta. Incluye la variante «sin reloj», que es lo que quedó en los
 *      navegadores de antes del arreglo.
 *
 * Uso (requiere el dev server arriba y AUTH_SECRET del entorno real):
 *   AUTH_SECRET=… npx tsx scripts/sim/sim-impersonacion.ts [userId] [--url http://localhost:3000]
 *
 * No escribe nada: el POST de prueba usa un id inexistente a propósito.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'

const URL_BASE = (process.argv.find((a) => a.startsWith('--url'))?.split('=')[1]) || 'http://localhost:3000'
const OBJETIVO = process.argv[2]?.match(/^[0-9a-f-]{36}$/i) ? process.argv[2] : null

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.error('❌ Falta AUTH_SECRET (sácalo de SSM: /vence-frontend/AUTH_SECRET).')
    process.exit(1)
  }
  const { payloadSesionImpersonada, TTL_IMPERSONACION_SEG } = await import('../../lib/admin/impersonacion')
  // Import diferido como los de al lado: este fichero carga `.env.local` ANTES de tocar
  // nada que lea el entorno.
  const { sessionCookieNameFor, cookieForPlaywright } = await import('../../lib/sim/session')
  const { Client } = await import('pg')
  const c = new Client({ connectionString: process.env.DATABASE_URL!.split('?')[0], ssl: { rejectUnauthorized: false } })
  await c.connect()
  const { rows } = OBJETIVO
    ? await c.query('select id, email from user_profiles where id=$1', [OBJETIVO])
    : await c.query("select id, email from user_profiles where plan_type='premium' order by created_at desc limit 1")
  await c.end()
  if (!rows.length) { console.error('❌ Sin usuario objetivo.'); process.exit(1) }
  const { id: uid, email } = rows[0]
  const now = Math.floor(Date.now() / 1000)
  // Nombre y salt de la cookie según el host (`lib/sim/session.ts`): sobre https lleva
  // prefijo `__Secure-` y ese nombre es también el salt. Fijarlo a mano deja la sim ciega
  // contra producción, que es donde justamente hay que comprobar que el plazo caduca.
  const COOKIE = sessionCookieNameFor(new URL(URL_BASE).hostname)
  console.log(`🎭 Simulando sobre ${email} (${uid}) contra ${URL_BASE}\n`)

  const cookie = async (suplantada: boolean) => {
    const token: Record<string, unknown> = suplantada
      ? payloadSesionImpersonada({ objetivoUserId: uid, objetivoEmail: email, adminEmail: 'sim@vence.es', nowSec: now })
      : { appUserId: uid, email, sub: uid, iat: now, exp: now + TTL_IMPERSONACION_SEG, jti: `sim-${now}` }
    return encode({ token, secret, salt: COOKIE, maxAge: TTL_IMPERSONACION_SEG })
  }

  /**
   * Cookies que reproducen las DOS formas en que una suplantación sobrevivía a su plazo
   * (T-335). Se acuñan con `maxAge` de 30 días —no de 30 minutos— porque es justo lo que
   * deja una rotación de Auth.js: el `exp` largo es el síntoma, no un atajo del simulador.
   *
   *  · `rotada`: el plazo (`impExp`) ya pasó, pero el token sigue siendo válido para Auth.js.
   *  · `legacy`: acuñada antes del arreglo, sin reloj ninguno. Es lo que hay AHORA MISMO en
   *    el navegador de cualquier admin que suplantara estos días.
   */
  const MES = 30 * 24 * 3600
  const cookieRotada = async (variante: 'vencida' | 'legacy' | 'viva') => {
    const base = { appUserId: uid, email, sub: uid, imp: 'sim@vence.es', iat: now, exp: now + MES }
    const token =
      variante === 'vencida' ? { ...base, impExp: now - 60 }
      : variante === 'viva' ? { ...base, impExp: now + TTL_IMPERSONACION_SEG }
      : base // legacy: sin reloj
    return encode({ token, secret, salt: COOKIE, maxAge: MES })
  }

  const b = await chromium.launch()
  const fallos: string[] = []
  const res: Record<string, { imp: string | null; post: number; get: number; franja?: boolean }> = {}

  for (const suplantada of [true, false]) {
    const ctx = await b.newContext()
    const host = new URL(URL_BASE).hostname
    const cookies = [cookieForPlaywright(await cookie(suplantada), host)]
    // La cookie-marca la pone el endpoint real junto a la sesión, y es la que hace que la
    // franja se muestre sin preguntar al servidor en cada página. Si la simulación acuña la
    // sesión a mano y se la salta, mide un escenario que no existe.
    // El flag `secure` se hereda del descriptor de la sesión en vez de fijarlo: sobre https
    // una cookie sin él viaja distinto que la real, y aquí se está midiendo lo que ve el
    // navegador de un admin de verdad.
    if (suplantada) cookies.push({ ...cookies[0], name: 'vence_imp', value: '1', httpOnly: false })
    await ctx.addCookies(cookies)
    const p = await ctx.newPage()
    const tj = await (await p.request.get(`${URL_BASE}/api/auth/token`)).json().catch(() => ({}))
    const access = (tj as Record<string, string>)?.accessToken || (tj as Record<string, string>)?.access_token
    const imp = access ? (JSON.parse(Buffer.from(access.split('.')[1], 'base64').toString()).imp ?? null) : null
    const w = await p.request.post(`${URL_BASE}/api/v2/question-favorites`, {
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      data: { questionId: '11111111-1111-1111-1111-111111111111' },
    })
    const r = await p.request.get(`${URL_BASE}/api/v2/question-favorites`, { headers: { Authorization: `Bearer ${access}` } })
    const clave = suplantada ? 'suplantada' : 'normal'
    res[clave] = { imp, post: w.status(), get: r.status() }
    if (suplantada) {
      await p.goto(`${URL_BASE}/perfil`, { waitUntil: 'networkidle', timeout: 120000 })
      await p.waitForTimeout(2500)
      res[clave].franja = (await p.innerText('body')).includes('Estás viendo la cuenta de')
    }
    await ctx.close()
  }
  // ¿Se puede salir? Se comprueba con la sesión SUPLANTADA puesta, que es la situación real.
  const ctxSalida = await b.newContext()
  const hostSalida = new URL(URL_BASE).hostname
  await ctxSalida.addCookies([
    cookieForPlaywright(await cookie(true), hostSalida),
    { name: 'vence_imp', value: '1', domain: hostSalida, path: '/', httpOnly: false, sameSite: 'Lax' },
  ])
  const pSalida = await ctxSalida.newPage()
  const rSalida = await pSalida.request.post(`${URL_BASE}/api/impersonacion/salir`)
  const salida = { ok: rSalida.ok(), status: rSalida.status() }
  await ctxSalida.close()

  // ¿Y CUÁNDO EL PLAZO YA PASÓ? (T-335) — la parte que esta simulación no miraba, y donde
  // estaba el fallo: se comprobaba que la suplantación empezaba bien y que se podía salir,
  // nunca que terminaba sola. Con el plazo vencido, la app no puede acuñar token ni servir
  // la cuenta: da igual que la cookie siga siendo criptográficamente válida.
  //
  // La variante `viva` es el CONTRASTE, y no es opcional: las tres cookies se acuñan igual
  // (rotadas, con `exp` de 30 días) y solo se diferencian en el reloj. Si la viva pasara y
  // las vencidas también, o si fallaran las tres, el 401 no probaría nada — igual que el 403
  // del candado no prueba nada sin el caso 5.
  const caducadas: Record<string, { token: number; lectura: number }> = {}
  for (const variante of ['vencida', 'legacy', 'viva'] as const) {
    const ctx = await b.newContext()
    await ctx.addCookies([
      cookieForPlaywright(await cookieRotada(variante), new URL(URL_BASE).hostname),
    ])
    const p = await ctx.newPage()
    const rt = await p.request.get(`${URL_BASE}/api/auth/token`)
    const tj = await rt.json().catch(() => ({}))
    const access = (tj as Record<string, string>)?.accessToken || ''
    // Si aun así hubiera acuñado, se comprueba que la LECTURA con ese token tampoco pasa:
    // el 401 tiene que venir del reloj, no de que el token esté vacío.
    const rl = await p.request.get(`${URL_BASE}/api/v2/question-favorites`, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
    })
    caducadas[variante] = { token: rt.status(), lectura: rl.status() }
    await ctx.close()
  }
  await b.close()

  const s = res.suplantada, n = res.normal
  const linea = (ok: boolean, txt: string) => `${ok ? '✅' : '❌'} ${txt}`
  console.log(linea(!!s.imp, `1) la marca del admin llega al access token (imp=${s.imp})`))
  console.log(linea(!!s.franja, '2) la franja de aviso se ve en la pantalla'))
  console.log(linea(s.post === 403, `3) escribir suplantando se rechaza (POST ${s.post})`))
  console.log(linea(s.get === 200, `4) leer suplantando funciona (GET ${s.get})`))
  console.log(linea(n.post !== 403, `5) con sesión NORMAL el mismo POST no da 403 (POST ${n.post}) → el 403 es del candado`))
  console.log(linea(salida.ok, `6) se puede SALIR de la suplantación (POST /api/impersonacion/salir → ${salida.status})`))
  console.log(linea(caducadas.vencida.token === 401, `7) con el plazo vencido NO se acuña token (vencida → ${caducadas.vencida.token})`))
  console.log(linea(caducadas.vencida.lectura === 401, `8) …y tampoco se puede LEER la cuenta (vencida → ${caducadas.vencida.lectura})`))
  console.log(linea(caducadas.legacy.token === 401, `9) una suplantación sin reloj (anterior al arreglo) tampoco vale (legacy → ${caducadas.legacy.token})`))
  console.log(linea(caducadas.viva.token === 200, `10) la MISMA cookie rotada pero DENTRO de plazo sí funciona (viva → ${caducadas.viva.token}) → el 401 es del reloj`))
  if (!s.imp) fallos.push('la marca no llega al token')
  if (!s.franja) fallos.push('no se ve la franja')
  if (s.post !== 403) fallos.push(`escritura NO bloqueada (${s.post})`)
  if (s.get !== 200) fallos.push(`lectura rota (${s.get})`)
  if (n.post === 403) fallos.push('la sesión normal también da 403 → la prueba no distingue')
  if (!salida.ok) fallos.push(`no se puede salir de la suplantación (${salida.status})`)
  if (caducadas.vencida.token !== 401) fallos.push(`plazo vencido y AÚN acuña token (${caducadas.vencida.token})`)
  if (caducadas.vencida.lectura !== 401) fallos.push(`plazo vencido y AÚN sirve la cuenta (${caducadas.vencida.lectura})`)
  if (caducadas.legacy.token !== 401) fallos.push(`suplantación sin reloj aceptada (${caducadas.legacy.token})`)
  if (caducadas.viva.token !== 200) fallos.push(`la suplantación EN plazo tampoco funciona (${caducadas.viva.token}) → la prueba no distingue`)

  console.log(fallos.length ? `\n❌ ${fallos.length} fallo(s): ${fallos.join(' · ')}` : '\n✅ La suplantación es de solo lectura, visible y contrastada.')
  process.exit(fallos.length ? 1 : 0)
}
main()
