/**
 * LOS TESTS DE TU OPOSICIÓN PERSONALIZADA, EN UN NAVEGADOR DE VERDAD. (T-327)
 *
 * ── POR QUÉ EXISTE ESTA SIMULACIÓN ──────────────────────────────────────────────────────────
 *
 * Porque comprobar con `curl` que la ruta devuelve **HTTP 200** dio por buena una pantalla que
 * en el navegador decía **«404 · Tema No Encontrado»** (01/08/2026, lo vio Manuel). Y no era un
 * despiste raro: estas páginas son cascarones que cargan sus datos por API desde el cliente, así
 * que **el 200 lo devuelve el cascarón** y el fallo ocurre después. Medir el código HTTP aquí es
 * medir lo único que no puede fallar.
 *
 * Lo que se comprueba, entonces, es lo que el usuario VE:
 *   · el hub lista sus temas con el nombre público correcto;
 *   · entrar en un tema NO dice «no encontrado»;
 *   · y llega a haber preguntas de verdad — que es el punto de todo esto.
 *
 * Uso: npx tsx --env-file=.env.local scripts/sim/sim-tests-oposicion-personalizada.ts [--url=…]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'

const URL_BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'
const MARCA = `sim-t327-tests-${Date.now()}`

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
  const { sessionCookieNameFor, cookieForPlaywright, CLAIM_SIMULACION } = await import(
    '../../lib/sim/session'
  )
  const { guardarOposicionPersonalizada } = await import(
    '../../lib/api/oposicionPersonalizada/guardar'
  )
  const { positionTypeDe } = await import('../../lib/api/oposicionPersonalizada/plan')

  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()

  console.log(`\n══ Los tests de tu oposición personalizada (T-327) ═══════════════════════`)
  console.log(`   navegador real contra ${URL_BASE}\n`)

  // Una ley con preguntas DE VERDAD: si se cogiera una cualquiera, el tema podría salir a cero y
  // la simulación daría verde sin haber probado lo que importa.
  const { rows: leyes } = await c.query(`
    SELECT l.id, l.short_name, count(q.id)::int AS preguntas
      FROM laws l
      JOIN articles a ON a.law_id = l.id AND a.is_active = true
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
     WHERE l.is_active = true
     GROUP BY l.id, l.short_name
     HAVING count(q.id) > 20
     ORDER BY count(q.id) DESC
     LIMIT 1
  `)
  if (!leyes.length) throw new Error('no hay ninguna ley con preguntas suficientes')
  const ley = leyes[0]

  const { rows: u } = await c.query(
    `INSERT INTO user_profiles (id, email, full_name) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`${MARCA}@sim.vence.es`, 'Sim Tests'],
  )
  const userId = u[0].id
  let opId: string | null = null
  const navegador = await chromium.launch()

  try {
    const res = await guardarOposicionPersonalizada(
      userId,
      {
        nombre: `Oposición ${MARCA}`,
        temas: [{ titulo: 'Tema con preguntas', articulos: [{ lawId: ley.id, articleNumber: null }] }],
      },
      'Sim Tests',
    )
    if (!res.ok) throw new Error(`no se pudo crear: ${res.detalle ?? res.motivo}`)
    opId = res.id!
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

    // ── 1. El hub ──────────────────────────────────────────────────────────────────────────
    console.log('1) El hub de tus tests')
    await p.goto(`${URL_BASE}/oposicion-personalizada/${idLimpio}/test`, {
      waitUntil: 'domcontentloaded',
    })
    const textoHub = (await p.locator('body').innerText()).slice(0, 4000)
    anota(
      'enseña el nombre público de TU oposición',
      textoHub.includes(`Oposición ${MARCA}`) && textoHub.includes('by Sim'),
      textoHub.split('\n').find((l) => l.includes(MARCA))?.trim() ?? '(no aparece)',
    )
    anota(
      'lista el tema con preguntas de verdad (no a cero)',
      /\d+ pregunta\(s\)/.test(textoHub) && !/sin preguntas todavía/.test(textoHub),
      textoHub.split('\n').find((l) => l.includes('pregunta(s)'))?.trim() ?? '(sin línea de preguntas)',
    )

    // ── 2. Entrar en el tema ───────────────────────────────────────────────────────────────
    //
    // AQUÍ es donde el `curl` mentía: la página responde 200 y luego pinta «Tema No Encontrado».
    console.log('\n2) Entrar en el tema (lo que el HTTP 200 no puede ver)')
    await p.goto(`${URL_BASE}/oposicion-personalizada/${idLimpio}/test/tema/1`, {
      waitUntil: 'domcontentloaded',
    })
    await p.waitForTimeout(4000) // carga sus datos por API tras montar
    const textoTema = (await p.locator('body').innerText()).slice(0, 4000)

    anota(
      'NO dice «Tema no encontrado»',
      !/tema no encontrado/i.test(textoTema),
      /tema no encontrado/i.test(textoTema)
        ? '⚠️ sigue diciendo que no existe'
        : 'la pantalla del tema carga',
    )
    anota(
      'y trae el título del tema que creé',
      textoTema.includes('Tema con preguntas'),
      textoTema.split('\n').slice(0, 12).join(' · ').slice(0, 200),
    )

    // ── 3. Que la pantalla sea SUYA, no una genérica ───────────────────────────────────────
    //
    // Todo lo de aquí venía del config del catálogo y caía a valores por defecto: nombre y
    // subgrupo INVENTADOS, migas que no dicen de qué oposición son, y el título repetido. Nada
    // de eso da error — simplemente le enseña a la persona una oposición que no es la suya.
    console.log('\n3) La pantalla del tema es la de TU oposición, no una genérica')

    anota(
      'la chapa lleva el nombre de TU oposición, no «Oposicion (C2)»',
      textoTema.includes(`Oposición ${MARCA}`) && !/Oposicion \(C2\)/.test(textoTema),
      /Oposicion \(C2\)/.test(textoTema)
        ? '⚠️ sigue enseñando el nombre y el subgrupo por defecto'
        : 'aparece el nombre propio',
    )
    anota(
      'NO se inventa un subgrupo (una personalizada no tiene C1/C2)',
      !/\((?:C1|C2|A1|A2|E)\)/.test(textoTema),
      'sin subgrupo inventado',
    )
    anota(
      'las migas de pan dicen de qué oposición es y llevan de vuelta',
      textoTema.includes('Mis oposiciones') && textoTema.includes(`Oposición ${MARCA}`),
      textoTema.split('\n').slice(0, 6).join(' · ').slice(0, 160),
    )
    anota(
      'el título no se repite («Tema 1: Tema 1» y debajo otra vez)',
      (textoTema.match(/Tema con preguntas/g) || []).length <= 2,
      `«Tema con preguntas» aparece ${(textoTema.match(/Tema con preguntas/g) || []).length} vez/veces`,
    )
    anota(
      'no queda ningún separador apuntando a nada (el «›» del bloque inexistente)',
      !/›\s*$/m.test(textoTema),
      'sin separadores huérfanos',
    )
  } finally {
    await navegador.close()
    if (opId) {
      const pt = positionTypeDe(opId)
      await c.query(
        `DELETE FROM topic_scope WHERE topic_id IN (SELECT id FROM topics WHERE position_type = $1)`,
        [pt],
      )
      await c.query(`DELETE FROM topics WHERE position_type = $1`, [pt])
    }
    await c.query(`DELETE FROM custom_oposiciones WHERE user_id = $1`, [userId])
    const { rowCount } = await c.query(`DELETE FROM user_profiles WHERE id = $1`, [userId])
    console.log(`\n🧹 limpieza: ${rowCount} usuario(s) efímero(s) y su temario borrados`)
    await c.end()
  }

  const fallos = casos.filter((x) => !x.ok)
  console.log('\n' + '═'.repeat(72))
  if (fallos.length === 0) {
    console.log('✅ SIMULACIÓN VERDE — se puede estudiar de verdad con tu propio temario')
    return
  }
  console.log(`❌ SIMULACIÓN ROJA — ${fallos.length} de ${casos.length}`)
  for (const f of fallos) console.log(`   · ${f.nombre}: ${f.detalle}`)
  process.exit(1)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
