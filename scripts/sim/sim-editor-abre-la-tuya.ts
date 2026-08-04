/**
 * «IR AL EDITOR DEL TEMARIO» ABRE LA TUYA, NO LA LISTA — en un navegador de verdad. [T-523]
 *
 * ── POR QUÉ NO BASTA CON EL UNITARIO NI CON `curl` ──────────────────────────────────────────
 *
 * `enlaceEditor()` tiene 8 unitarios y son buenos, pero prueban una CADENA. Que el botón lleve
 * `?editar=<id>` se ve con `curl`; que al llegar el editor **abra esa oposición** no, porque eso
 * pasa después, en el cliente, tras autenticarse y pedir la oposición por API. Es exactamente la
 * trampa que documenta `sim-tests-oposicion-personalizada.ts`: el 200 lo devuelve el cascarón.
 *
 * Aquí se comprueba lo que ve el usuario:
 *   1. la pantalla de un temario vacío ofrece el botón, y el botón lleva SU id;
 *   2. al pulsarlo, el constructor aparece con el nombre de ESA oposición dentro;
 *   3. y entrar al editor SIN el parámetro sigue enseñando la lista (no se rompe lo de antes).
 *
 * Se limpia sola: el usuario y la oposición que crea se borran al final, pase lo que pase.
 *
 * Uso: AUTH_SECRET=… npx tsx --env-file=.env.local scripts/sim/sim-editor-abre-la-tuya.ts [--url=…]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'

const URL_BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'https://www.vence.es'
const MARCA = `sim-t523-${Date.now()}`

type Caso = { nombre: string; ok: boolean; detalle: string }
const casos: Caso[] = []
const anota = (nombre: string, ok: boolean, detalle: string) => {
  casos.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}\n      ${detalle}`)
}

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.error('❌ Falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET).')
    process.exit(1)
  }
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs')
  const { Client } = await import('pg')
  const { sessionCookieNameFor, cookieForPlaywright, CLAIM_SIMULACION } = await import('../../lib/sim/session')
  // La oposición se crea con SQL y NO con `guardarOposicionPersonalizada`: esa función es
  // `server-only` y no se puede importar aquí. Además, lo que hace falta es justo lo contrario de
  // lo que ella construye — una etiqueta SIN temas, que es el estado que enseña el aviso.

  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()

  console.log(`\n══ El editor abre LA TUYA, no la lista (T-523) ══════════════════════════`)
  console.log(`   navegador real contra ${URL_BASE}\n`)

  const { rows: u } = await c.query(
    `INSERT INTO user_profiles (id, email, full_name) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`${MARCA}@sim.vence.es`, 'Sim Editor'],
  )
  const userId = u[0].id
  let opId: string | null = null
  const navegador = await chromium.launch()

  try {
    // Una oposición SIN contenido servible: es el estado que enseña el aviso. Se crea con un
    // tema sin artículos a propósito — es justo la etiqueta vacía que tienen 580 personas.
    const { rows: op } = await c.query(
      `INSERT INTO custom_oposiciones (user_id, nombre, categoria, administracion, is_active, is_public, created_by_username)
       VALUES ($1, $2, 'C2', 'Estatal', true, false, 'Sim Editor') RETURNING id`,
      [userId, `Oposición ${MARCA}`],
    )
    opId = op[0].id as string
    const idLimpio = opId.replace(/-/g, '')

    const host = new URL(URL_BASE).hostname
    const COOKIE = sessionCookieNameFor(host)
    const now = Math.floor(Date.now() / 1000)
    const cookie = await encode({
      token: {
        appUserId: userId,
        email: `${MARCA}@sim.vence.es`,
        sub: userId,
        iat: now,
        exp: now + 3600,
        jti: `sim-${now}`,
        [CLAIM_SIMULACION]: true,
      },
      secret,
      salt: COOKIE,
      maxAge: 3600,
    })
    const ctx = await navegador.newContext()
    await ctx.addCookies([cookieForPlaywright(cookie, host)])
    const p = await ctx.newPage()

    // ── 1. El aviso del temario vacío ofrece el botón, y lleva SU id ───────────────────────
    console.log('1) La pantalla del temario vacío')
    await p.goto(`${URL_BASE}/oposicion-personalizada/${idLimpio}/temario`, { waitUntil: 'domcontentloaded' })
    const boton = p.locator('a', { hasText: 'Ir al editor del temario' }).first()
    const visible = await boton.isVisible().catch(() => false)
    const href = visible ? await boton.getAttribute('href') : null
    anota(
      'ofrece el botón del editor en vez de un 404',
      visible,
      visible ? 'el botón está en pantalla' : '(no hay botón: ¿404 o pantalla distinta?)',
    )
    anota(
      'el botón lleva EL ID de esta oposición, no el editor a secas',
      href === `/oposicion-personalizada?editar=${idLimpio}`,
      `href = ${href ?? '(ninguno)'}`,
    )

    // ── 2. Lo que de verdad importa: al pulsarlo, se abre LA SUYA ──────────────────────────
    console.log('\n2) Al pulsar, el editor abre ESA oposición')
    if (visible) await boton.click()
    await p.waitForLoadState('domcontentloaded')
    // El constructor carga por API tras autenticarse: se espera al nombre, no a un timeout fijo.
    const apareció = await p
      .locator(`text=${MARCA}`)
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false)
    const texto = (await p.locator('body').innerText()).slice(0, 4000)
    anota(
      'el constructor se abre con el nombre de ESA oposición dentro',
      apareció,
      apareció
        ? texto.split('\n').find((l) => l.includes(MARCA))?.trim() ?? '(aparece)'
        : '(no aparece su nombre: el editor no la ha abierto)',
    )

    // ── 3. Sin parámetro, lo de siempre ────────────────────────────────────────────────────
    console.log('\n3) Sin parámetro, el editor sigue siendo la lista de siempre')
    await p.goto(`${URL_BASE}/oposicion-personalizada`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(3000)
    const textoLista = (await p.locator('body').innerText()).slice(0, 4000)
    anota(
      'no se rompe la entrada normal al editor',
      /Crea tu oposición|Mis oposiciones|oposici/i.test(textoLista),
      textoLista.split('\n').find((l) => l.trim().length > 3)?.trim() ?? '(pantalla vacía)',
    )
  } finally {
    await navegador.close().catch(() => {})
    // Limpieza: pase lo que pase, no se deja basura en producción.
    if (opId) {
      await c.query(`DELETE FROM topic_scope WHERE position_type = $1`, [`personalizada_${opId.replace(/-/g, '')}`]).catch(() => {})
      await c.query(`DELETE FROM topics WHERE position_type = $1`, [`personalizada_${opId.replace(/-/g, '')}`]).catch(() => {})
      await c.query(`DELETE FROM oposicion_bloques WHERE position_type = $1`, [`personalizada_${opId.replace(/-/g, '')}`]).catch(() => {})
      await c.query(`DELETE FROM custom_oposiciones WHERE id = $1`, [opId]).catch(() => {})
    }
    await c.query(`DELETE FROM user_profiles WHERE id = $1`, [userId]).catch(() => {})
    await c.end()
  }

  const fallan = casos.filter((x) => !x.ok)
  console.log(`\n${fallan.length ? '❌' : '✅'} ${casos.length - fallan.length}/${casos.length} en verde`)
  process.exit(fallan.length ? 1 : 0)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
