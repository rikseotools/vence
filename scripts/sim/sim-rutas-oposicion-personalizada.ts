/**
 * RASTREA TODAS LAS RUTAS de una oposición personalizada y busca las que están rotas. (T-327)
 *
 * ── POR QUÉ UN RASTREADOR Y NO MÁS CASOS A MANO ─────────────────────────────────────────────
 *
 * Porque comprobando pantalla por pantalla se me escaparon varias, y Manuel lo dijo con razón:
 * *«pincha en todos los botones, te falta muchos por comprobar»*. Una lista de casos escrita a
 * mano solo cubre lo que uno se acordó de mirar — y lo que falta es, por definición, lo que uno
 * no pensó.
 *
 * La que más dolió: el botón de EMPEZAR el test llevaba a `…/test/tema/1/test-personalizado`,
 * que no existía. O sea que se podía armar el temario, entrar en el tema… y no llegar a
 * estudiar, que es el punto de todo esto. No lo vio ninguna prueba porque nadie había pulsado
 * ese botón.
 *
 * Así que esto **descubre** las rutas en vez de declararlas: parte del hub, sigue cada enlace
 * que encuentra dentro de la oposición, y marca las que dan 404 o pintan «no encontrado».
 *
 * ── QUÉ CUENTA COMO ROTO ────────────────────────────────────────────────────────────────────
 *
 * No basta el código HTTP: estas páginas son cascarones que cargan por API, así que devuelven
 * 200 y luego pintan el error. Se mira **el texto renderizado**, que es lo que ve la persona.
 *
 * Uso: npx tsx --env-file=.env.local scripts/sim/sim-rutas-oposicion-personalizada.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium, type Page } from 'playwright'
import { encode } from 'next-auth/jwt'

const URL_BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'
const MARCA = `sim-t327-rutas-${Date.now()}`
/** Techo de páginas: un rastreo sin freno puede irse por toda la app. */
const MAX_PAGINAS = 25

/** Señales de que la persona está viendo una pantalla rota, no la que pidió. */
const ROTO = [
  /tema no encontrado/i,
  /tema no v[áa]lido/i,
  /404/,
  /esta p[áa]gina no existe/i,
  /application error/i,
  /something went wrong/i,
  /oposicion \(c2\)/i, // identidad del catálogo colada en una personalizada
]

interface Visita {
  ruta: string
  estado: number
  roto: string | null
  desde: string
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

  console.log(`\n══ Rastreo de rutas — oposición personalizada (T-327) ════════════════════`)
  console.log(`   navegador real contra ${URL_BASE}\n`)

  // Una ley con preguntas de verdad: con uno cualquiera los temas saldrían a cero y el rastreo
  // no llegaría a las pantallas de test, que es donde estaban los agujeros.
  const { rows: leyes } = await c.query(`
    SELECT l.id FROM laws l
      JOIN articles a ON a.law_id = l.id AND a.is_active = true
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
     WHERE l.is_active = true
     GROUP BY l.id HAVING count(q.id) > 20
     ORDER BY count(q.id) DESC LIMIT 1
  `)
  if (!leyes.length) throw new Error('no hay ley con preguntas suficientes')

  const { rows: u } = await c.query(
    `INSERT INTO user_profiles (id, email, full_name) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`${MARCA}@sim.vence.es`, 'Sim Rutas'],
  )
  const userId = u[0].id
  let opId: string | null = null
  const navegador = await chromium.launch()
  const visitas: Visita[] = []

  try {
    const res = await guardarOposicionPersonalizada(
      userId,
      {
        nombre: `Oposición ${MARCA}`,
        temas: [{ titulo: 'Tema con preguntas', articulos: [{ lawId: leyes[0].id, articleNumber: null }] }],
      },
      'Sim Rutas',
    )
    if (!res.ok) throw new Error(`no se pudo crear: ${res.detalle ?? res.motivo}`)
    opId = res.id!
    const idLimpio = opId.replace(/-/g, '')
    const raiz = `/oposicion-personalizada/${idLimpio}`

    // Se fija como objetivo para que el Header apunte a ella (así el rastreo cubre también los
    // iconos de la cabecera, que es por donde entra el usuario de verdad).
    await c.query(
      `UPDATE user_profiles SET target_oposicion = $1, target_oposicion_data = $2::jsonb WHERE id = $3`,
      [
        `personalizada_${idLimpio}`,
        JSON.stringify({ id: `personalizada_${idLimpio}`, name: `Oposición ${MARCA} by Sim R.`, nombre: `Oposición ${MARCA} by Sim R.` }),
        userId,
      ],
    )

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
    const p: Page = await ctx.newPage()

    const pendientes: Array<{ ruta: string; desde: string }> = [
      { ruta: `${raiz}/test`, desde: '(entrada)' },
      // Estas dos NO salen de ningún enlace del hub, pero son a donde llevan el icono 📚 del
      // Header y el botón de empezar el test — o sea, por donde pasa el usuario de verdad.
      { ruta: `${raiz}/temario`, desde: 'icono 📚 del Header' },
      { ruta: `${raiz}/test/tema/1/test-personalizado`, desde: 'botón «empezar test»' },
      { ruta: `${raiz}/test/tema/1/test-examen`, desde: 'botón «empezar test» (modo examen)' },
    ]
    const vistas = new Set<string>()

    while (pendientes.length && vistas.size < MAX_PAGINAS) {
      const { ruta, desde } = pendientes.shift()!
      if (vistas.has(ruta)) continue
      vistas.add(ruta)

      const resp = await p.goto(`${URL_BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
      // Las pantallas cargan sus datos tras montar: sin esta espera se leería el cascarón.
      await p.waitForTimeout(3500)
      const texto = await p.locator('body').innerText().catch(() => '')
      const roto = ROTO.find((re) => re.test(texto))?.source ?? null
      visitas.push({ ruta, estado: resp?.status() ?? 0, roto, desde })

      // Descubrir a dónde se puede seguir DESDE aquí, dentro de la propia oposición.
      const enlaces = await p
        .locator(`a[href^="${raiz}"]`)
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''))
        .catch(() => [] as string[])
      for (const href of enlaces) {
        const limpia = href.split('?')[0].split('#')[0]
        if (limpia && !vistas.has(limpia)) pendientes.push({ ruta: limpia, desde: ruta })
      }
    }

    console.log(`Rutas visitadas: ${visitas.length}\n`)
    for (const v of visitas) {
      console.log(`   ${v.roto ? '❌' : '✅'} ${v.ruta}`)
      console.log(`      HTTP ${v.estado}${v.roto ? ` · ROTA (${v.roto})` : ''} · desde: ${v.desde}`)
    }
  } finally {
    await navegador.close()
    if (opId) {
      const pt = positionTypeDe(opId)
      await c.query(
        `DELETE FROM topic_scope WHERE topic_id IN (SELECT id FROM topics WHERE position_type = $1)`,
        [pt],
      )
      await c.query(`DELETE FROM topics WHERE position_type = $1`, [pt])
      await c.query(`DELETE FROM oposicion_bloques WHERE position_type = $1`, [pt])
    }
    await c.query(`DELETE FROM custom_oposiciones WHERE user_id = $1`, [userId])
    const { rowCount } = await c.query(`DELETE FROM user_profiles WHERE id = $1`, [userId])
    console.log(`\n🧹 limpieza: ${rowCount} usuario(s) efímero(s) y su temario borrados`)
    await c.end()
  }

  const rotas = visitas.filter((v) => v.roto)
  console.log('\n' + '═'.repeat(72))
  if (rotas.length === 0) {
    console.log(`✅ RASTREO VERDE — ${visitas.length} ruta(s) y ninguna rota`)
    return
  }
  console.log(`❌ RASTREO ROJO — ${rotas.length} de ${visitas.length} rota(s):`)
  for (const r of rotas) console.log(`   · ${r.ruta} (llega desde: ${r.desde})`)
  process.exit(1)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
