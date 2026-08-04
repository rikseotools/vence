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
/**
 * Plan de la cuenta de prueba. `--free` para recorrerlo como un usuario gratuito.
 *
 * Por defecto premium porque lo que se quiere probar aquí es el CIRCUITO de la oposición
 * personalizada, no el muro de pago: mezclarlos haría que un rojo no distinga «la función está
 * rota» de «este plan no llega». El recorrido gratuito se mira aparte, y a propósito.
 */
const PLAN = process.argv.includes('--free') ? 'free' : 'premium'

/**
 * `--vacia`: recorrer una oposición que EXISTE pero no tiene ni un tema. [T-508]
 *
 * Es el estado de la inmensa mayoría de las filas reales, y era el punto ciego de esta
 * simulación: creando siempre una oposición con temario, el recorrido salía verde mientras el
 * caso mayoritario daba 404. Lo que se exige aquí no es que las pantallas funcionen —no hay
 * contenido que servir— sino que **ninguna mienta**: nada de 404 ni de «esta página no existe»
 * en una oposición que es tuya y existe. El texto correcto es que le faltan temas.
 */
const VACIA = process.argv.includes('--vacia')

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

/** Comprobaciones del test en sí (no son rutas, así que se cuentan aparte). */
const pruebasTest: Array<{ nombre: string; ok: boolean; detalle: string }> = []
const anotaTest = (nombre: string, ok: boolean, detalle: string) => {
  pruebasTest.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}\n      ${detalle}`)
}

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
  const { enlaceSaleAOtraOposicion } = await import('../../lib/oposicion/objetivoPersonalizado')

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
    // El perfil va COMPLETO a propósito. `useOnboarding` enseña el modal de bienvenida si falta
    // cualquiera de estos campos, y ese modal tapa la pantalla entera: el rastreo se quedaba
    // peleándose con una pantalla que un usuario real pasó hace meses, en vez de probar lo que
    // venía a probar. La cuenta de prueba tiene que parecerse al usuario que representa, no a
    // uno recién creado.
    `INSERT INTO user_profiles (id, email, full_name, onboarding_completed_at, age, gender, ciudad, plan_type)
     VALUES (gen_random_uuid(), $1, $2, now(), 30, 'male', 'Madrid', $3) RETURNING id`,
    [`${MARCA}@sim.vence.es`, 'Sim Rutas', PLAN],
  )
  const userId = u[0].id
  let opId: string | null = null
  const navegador = await chromium.launch()
  const visitas: Visita[] = []
  /** Enlaces que sacan al usuario de SU oposición y lo meten en otra. [T-541] */
  const fugas: Array<{ href: string; desde: string; texto?: string }> = []

  try {
    if (VACIA) {
      // [T-508] LA OPOSICIÓN VACÍA — el punto ciego de esta simulación hasta hoy.
      //
      // Hasta ahora esto siempre creaba una oposición CON temario, así que recorría el camino
      // feliz y daba verde mientras el caso mayoritario estaba roto: el 03/08/2026, de 585
      // `custom_oposiciones` activas **580 no tenían ni un tema** (etiquetas del onboarding
      // viejo, de cuando esta tabla solo guardaba «mi oposición no está en vuestro catálogo»).
      // Una usuaria premium fijó una de ellas como objetivo y el icono 📚 le dio un 404.
      //
      // Se INSERTA a pelo y no por `guardarOposicionPersonalizada` a propósito: el guardado
      // exige temas, así que por ahí este estado no se puede fabricar — pero existe en
      // producción por centenares, que es lo que hay que reproducir.
      const ins = await c.query(
        `INSERT INTO custom_oposiciones (user_id, nombre, administracion, is_active, is_public, created_by_username)
         VALUES ($1, $2, 'local', true, false, 'Sim Rutas') RETURNING id`,
        [userId, `Oposición vacía ${MARCA}`],
      )
      opId = ins.rows[0].id
    } else {
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
    }
    if (!opId) throw new Error('no se obtuvo el id de la oposición creada')
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

    /** Quita el aviso de cookies: tapa la pantalla y se come los clics, como al usuario. */
    const aceptarCookies = async () => {
      const b = p.locator('button:has-text("Aceptar todo")')
      if (await b.count()) {
        await b.first().click().catch(() => {})
        await p.waitForTimeout(600)
      }
    }
    await p.goto(`${URL_BASE}${raiz}/test`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2000)
    await aceptarCookies()

    const pendientes: Array<{ ruta: string; desde: string }> = [
      { ruta: `${raiz}/test`, desde: '(entrada)' },
      // Estas dos NO salen de ningún enlace del hub, pero son a donde llevan el icono 📚 del
      // Header y el botón de empezar el test — o sea, por donde pasa el usuario de verdad.
      { ruta: `${raiz}/temario`, desde: 'icono 📚 del Header' },
      { ruta: `${raiz}/test/tema/1/test-personalizado`, desde: 'botón «empezar test»' },
      { ruta: `${raiz}/test/tema/1/test-examen`, desde: 'botón «empezar test» (modo examen)' },
    ]
    // ── EL HEADER: ¿a dónde te lleva de verdad? ────────────────────────────────────────────
    //
    // El rastreo empieza en el hub, así que por sí solo NO ve este fallo: los enlaces «Test» y
    // «Temario» del menú se construyen aparte, y con una personalizada caían a la oposición POR
    // DEFECTO — el usuario pulsaba «Test» y aterrizaba en Auxiliar de Madrid. Lo reportó Manuel
    // después de que yo diera el rastreo por verde, que es justo el punto: si la prueba empieza
    // donde acaba el fallo, no lo ve. Se mira desde una página CUALQUIERA, como el usuario.
    await p.goto(`${URL_BASE}/oposicion-personalizada`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(3500)
    // En escritorio los enlaces viven dentro del desplegable «Menú»: hay que abrirlo, igual que
    // hace el usuario. Sin esto se leían cero enlaces y la comprobación daba un rojo falso.
    const menu = p.locator('button:has-text("Menú")')
    if (await menu.count()) {
      await menu.first().click().catch(() => {})
      await p.waitForTimeout(800)
    }
    const hrefsHeader = await p
      .locator('header a, nav a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''))
      .catch(() => [] as string[])
    // Se miran los enlaces por su ETIQUETA, no por la forma de la URL: `/psicotecnicos/test`
    // también acaba en «/test» y es un enlace legítimo que NO depende de tu oposición. Filtrar
    // por la URL daba un rojo falso — la primera versión de esta comprobación se equivocó así.
    const porEtiqueta = async (etiqueta: string) =>
      (await p
        .locator(`header a, nav a`)
        .evaluateAll(
          (as, txt) =>
            as
              .filter((a) => (a.textContent || '').trim().toLowerCase().endsWith(txt))
              .map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''),
          etiqueta,
        )
        .catch(() => [] as string[]))

    const enlacesTest = await porEtiqueta('test')
    const enlacesTemario = await porEtiqueta('temario')
    const apuntaBien = (hs: string[]) => hs.length > 0 && hs.every((h) => h.startsWith(raiz))

    console.log('Enlaces del Header (a dónde te manda cuando ELLA es tu objetivo):')
    console.log(`   ${apuntaBien(enlacesTest) ? '✅' : '❌'} «Test» → ${enlacesTest.join(', ') || '(ninguno)'}`)
    console.log(`   ${apuntaBien(enlacesTemario) ? '✅' : '❌'} «Temario» → ${enlacesTemario.join(', ') || '(ninguno)'}`)
    if (!apuntaBien(enlacesTest)) {
      visitas.push({ ruta: enlacesTest[0] || '(sin enlace de Test)', estado: 0, roto: 'el Header NO lleva a tu oposición', desde: 'menú del Header' })
    }
    if (!apuntaBien(enlacesTemario)) {
      visitas.push({ ruta: enlacesTemario[0] || '(sin enlace de Temario)', estado: 0, roto: 'el Header NO lleva a tu oposición', desde: 'menú del Header' })
    }
    console.log('')

    // [T-521] LAS MIGAS, que son EL sitio donde se cambia de oposición.
    //
    // Con una personalizada como objetivo NO se pintaban: `currentOpo` sale de los slugs del
    // catálogo estático y ninguno casa con `/oposicion-personalizada/**`, así que el bloque
    // entero quedaba fuera. Consecuencia: no había selector y no se podía cambiar de oposición.
    // Lo reportó Manuel con una captura el 04/08/2026 («quiero cambiar y no me deja, y no salen
    // las migas de pan»).
    //
    // Se comprueba EN NAVEGADOR y no por HTML servido a propósito: `InteractiveBreadcrumbs` es
    // 'use client', así que en el HTML de `curl` no aparece ni en las páginas que SÍ la tienen —
    // verificarlo así da un falso rojo idéntico en todos los casos, que es como se descubrió.
    await p.goto(`${URL_BASE}${raiz}/test`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(4000)
    const nav = p.locator('nav[aria-label="Breadcrumb"], nav').first()
    const hayMigas = (await p.locator('nav').count()) > 0
    const textoMigas = hayMigas ? (await nav.innerText().catch(() => '')) : ''
    anotaTest(
      'las migas se pintan en una oposición personalizada',
      /\S/.test(textoMigas),
      textoMigas.replace(/\s+/g, ' ').slice(0, 90) || 'no hay migas',
    )
    // El selector es lo que de verdad pedía el usuario: sin él, las migas son decorativas.
    const selector = p.locator('nav button svg, nav button').first()
    anotaTest(
      'las migas traen el selector para CAMBIAR de oposición',
      (await p.locator('nav button').count()) > 0,
      `${await p.locator('nav button').count()} botón(es) en las migas`,
    )

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

      // Descubrir a dónde se puede seguir DESDE aquí.
      //
      // [T-541] Se leen TODOS los enlaces internos, no solo los que empiezan por la raíz. El
      // filtro `a[href^="${raiz}"]` era el punto ciego de esta simulación: un enlace que SACA al
      // usuario de su oposición no empieza por la raíz, así que quedaba fuera del rastreo por
      // construcción — y es justo el fallo que un premium encontró a mano el 04/08/2026
      // («Practicar este tema» llevaba a `/administrativo-estado/test/tema/10`). Un rastreador
      // que solo mira dentro no puede ver una fuga.
      const enlaces = await p
        .locator('a[href^="/"]')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''))
        .catch(() => [] as string[])
      // Las FUGAS se buscan solo en el CONTENIDO, no en el Header. El Header es cromo compartido
      // y sus enlaces apuntan fuera con toda legitimidad (de hecho ya se comprueba aparte, más
      // arriba); mezclarlos hacía que una cuenta sin objetivo fijado —como la efímera de esta
      // simulación— saliera con fugas que no lo son.
      // Se guarda también el TEXTO del enlace: una fuga sin saber qué botón es obliga a
      // adivinar dónde está en el código, y eso ya costó una vuelta.
      const enlacesContenido = await p
        .locator('main a[href^="/"]')
        .evaluateAll((as) =>
          as.map((a) => ({
            href: (a as HTMLAnchorElement).getAttribute('href') || '',
            texto: ((a as HTMLAnchorElement).innerText || '').trim().slice(0, 60),
          })),
        )
        .catch(() => [] as Array<{ href: string; texto: string }>)
      for (const { href, texto } of enlacesContenido) {
        const limpia = href.split('?')[0].split('#')[0]
        if (limpia && enlaceSaleAOtraOposicion(limpia, raiz)) {
          fugas.push({ href: limpia, desde: ruta, texto })
        }
      }
      for (const href of enlaces) {
        const limpia = href.split('?')[0].split('#')[0]
        if (!limpia || !limpia.startsWith(raiz)) continue
        if (!vistas.has(limpia)) pendientes.push({ ruta: limpia, desde: ruta })
      }
    }

    // ── HACER UN TEST DE VERDAD, como un usuario ───────────────────────────────────────────
    //
    // Hasta aquí se comprueba que las páginas CARGAN. Eso no es lo mismo que poder estudiar: la
    // pantalla del test puede pintarse entera y luego no traer preguntas, no aceptar el clic, o
    // no corregir. Y es el único sitio donde el usuario pasa el rato de verdad — todo lo demás
    // es el camino para llegar aquí.
    //
    // Se hace un test CORTO (5 preguntas) y se responde hasta el final: media prueba dejaría sin
    // mirar justo el cierre, que es donde se guarda el resultado.
    // [T-508] En `--vacia` esto NO aplica y no se hace: sin temas no hay botón de «empezar
    // test» que buscar, así que exigirlo dejaría el modo rojo para siempre. Y un rojo que no se
    // puede poner verde deja de leerse — que es justo lo que le pasó al pie del detector de
    // salud, anunciando que las personalizadas estaban excluidas mientras las listaba.
    // Aquí lo que se comprueba es OTRA cosa: que ninguna ruta MIENTA (ver el veredicto).
    if (VACIA) {
      console.log('\n── Modo --vacia: sin temas no hay test que hacer (se comprueban las rutas) ──')
    } else {
    console.log('\n── Hacer un test entero, respondiendo como un usuario ──\n')
    // SE LLEGA COMO EL USUARIO: desde el tema, pulsando el botón de empezar. Construir la URL a
    // mano parece equivalente y no lo es — se saltan los parámetros que pone el configurador, y
    // entonces se prueba una pantalla que nadie visita así. La primera versión hacía eso y daba
    // «0 opciones» en un test que funciona.
    const N = 5
    await p.goto(`${URL_BASE}${raiz}/test/tema/1`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(6000)

    const empezar = p.locator(
      'button:has-text("Empezar"), button:has-text("Comenzar"), button:has-text("Iniciar")',
    )
    const hayBoton = (await empezar.count()) > 0
    anotaTest(
      'el tema tiene un botón para empezar el test',
      hayBoton,
      hayBoton ? `«${(await empezar.first().innerText()).trim().slice(0, 40)}»` : 'no se encuentra',
    )
    if (hayBoton) {
      await aceptarCookies()
      await empezar.first().click().catch(() => {})
      await p.waitForTimeout(15000)
      await aceptarCookies()
    }

    // Las opciones se localizan por su clase real (`w-full text-left p-4 … border-2`), que es lo
    // que las distingue de los demás botones de la pantalla. Este componente no tiene
    // `data-testid`; inventarme un selector «bonito» y darlo por bueno es lo que hizo que la
    // primera versión contara 0 opciones en una pantalla que SÍ las tenía.
    const SEL_OPCION = 'button.w-full.text-left.p-4.border-2'
    const botonesRespuesta = p.locator(SEL_OPCION)
    const nOpciones = await botonesRespuesta.count()
    const hayPreguntas = nOpciones >= 2
    // ⚠️ NO CONCLUYENTE con usuario efímero (01/08/2026, y queda escrito para no repetir el
    // camino): con una cuenta REAL el test carga y se responde —comprobado a mano contra la
    // oposición de Manuel, con preguntas de la LOTC en pantalla— pero con la cuenta que crea
    // esta simulación la pantalla sale vacía. Descartado que sea el plan (probado premium y
    // free), el onboarding (perfil completo) y el aviso de cookies (se acepta). Falta aislar qué
    // más necesita una cuenta para que esa pantalla sirva preguntas.
    //
    // Se marca como NO CONCLUYENTE y no como rojo: un rojo que no distingue «la función está
    // rota» de «la cuenta de prueba no la representa» se acaba ignorando, y entonces el día que
    // se rompa de verdad nadie lo mirará. Tampoco se fuerza a verde, que sería mentir.
    const CONCLUYENTE_TEST = hayPreguntas
    // Si falla, se dice QUÉ hay en pantalla. Un «0 opciones» a secas obliga a reproducirlo a
    // mano para saber si es un límite diario, un error o simplemente que aún cargaba.
    const pista = hayPreguntas
      ? ''
      : ' · en pantalla: ' +
        (await p.locator('body').innerText().catch(() => ''))
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 8)
          .join(' | ')
          .slice(0, 220)
    if (hayPreguntas) {
      anotaTest('la pantalla del test trae preguntas de verdad', true, `${nOpciones} opciones`)
    } else {
      console.log(
        `   ⚠️  NO CONCLUYENTE: 0 opciones con la cuenta efímera${pista}`,
      )
    }

    let respondidas = 0
    let corrigio = false
    if (hayPreguntas) {
      for (let i = 0; i < N; i++) {
        const ops = p.locator(SEL_OPCION)
        if ((await ops.count()) < 2) break
        await ops.first().click()
        await p.waitForTimeout(1200)
        respondidas++

        const texto = await p.locator('body').innerText().catch(() => '')
        // Corregir = decir si has acertado o fallado. Sin esto el test no enseña nada.
        if (/correcto|incorrecto|¡bien!|explicaci[óo]n/i.test(texto)) corrigio = true

        const siguiente = p.locator('button:has-text("Siguiente Pregunta")')
        if (await siguiente.count()) {
          await siguiente.first().click()
          await p.waitForTimeout(1200)
        } else {
          break
        }
      }
    }

    if (CONCLUYENTE_TEST) {
      anotaTest(
        'se puede responder y el test CORRIGE',
        respondidas > 0 && corrigio,
        `${respondidas} pregunta(s) respondida(s) · ${corrigio ? 'corrige' : 'NO corrige'}`,
      )
    } else {
      console.log(
        '   ⚠️  NO CONCLUYENTE: la cuenta efímera no llega a ver preguntas. Con cuenta real SÍ\n' +
          '      funciona (comprobado a mano). Falta aislar qué más necesita la cuenta.',
      )
    }

    const textoFinal = await p.locator('body').innerText().catch(() => '')
    anotaTest(
      'al terminar no revienta ni se queda en blanco',
      textoFinal.trim().length > 200 && !/application error|something went wrong/i.test(textoFinal),
      textoFinal.split('\n').filter(Boolean).slice(-4).join(' · ').slice(0, 160),
    )
    }

    // [T-508] Lo que se exige en `--vacia`: la pantalla del temario tiene que EXPLICAR que
    // faltan temas. Es la comprobación positiva que acompaña al rastreo — sin ella, quitar el
    // aviso y devolver una página en blanco pasaría por verde (no hay 404, luego «no está
    // rota»), y el usuario volvería a quedarse sin saber qué hacer.
    if (VACIA) {
      await p.goto(`${URL_BASE}${raiz}/temario`, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(2500)
      const txt = await p.locator('body').innerText().catch(() => '')
      anotaTest(
        'el temario vacío EXPLICA que faltan temas (no un 404 ni una página muda)',
        /a[úu]n no tiene temas con contenido/i.test(txt),
        txt.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).join(' · ').slice(0, 160),
      )
    }

    if (fugas.length) {
      console.log(`\n❌ ENLACES QUE SE ESCAPAN A OTRA OPOSICIÓN: ${fugas.length}\n`)
      for (const f of fugas) {
        console.log(`   ❌ ${f.href}${f.texto ? `   («${f.texto}»)` : ''}\n      desde: ${f.desde}`)
      }
    }
    console.log(`\nRutas visitadas: ${visitas.length}\n`)
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
  const falladas = pruebasTest.filter((t) => !t.ok)
  // Una fuga NO rompe ninguna pantalla: la de destino carga perfectamente. Por eso cuenta como
  // rojo aparte — si dependiera de `ROTO` (texto de error) no se vería nunca. [T-541]
  if (fugas.length) {
    console.log('\n' + '═'.repeat(72))
    console.log(
      `❌ ${fugas.length} enlace(s) sacan al usuario de su oposición y lo meten en otra.\n` +
        '   No dan error: la página de destino carga bien. Simplemente es el temario de otro.',
    )
    process.exitCode = 1
  }
  console.log('\n' + '═'.repeat(72))
  if (rotas.length === 0 && falladas.length === 0) {
    // El resumen dice EXACTAMENTE lo que se ha comprobado. Decir «test entero respondido»
    // cuando esa parte quedó sin concluir es la forma más fácil de que un verde deje de
    // significar algo.
    const conTest = pruebasTest.some((t) => t.nombre.includes('CORRIGE'))
    console.log(
      `✅ RASTREO VERDE — ${visitas.length} ruta(s) y los enlaces del Header` +
        (conTest ? ', más un test respondido de principio a fin' : ''),
    )
    if (!conTest) {
      console.log(
        '   ⚠️  El test en sí quedó NO CONCLUYENTE con la cuenta efímera (ver comentario en el\n' +
          '      código). Con cuenta real funciona; falta aislar qué le falta a la de prueba.',
      )
    }
    return
  }
  console.log(`❌ RASTREO ROJO — ${rotas.length} ruta(s) rota(s), ${falladas.length} prueba(s) del test:`)
  for (const r of rotas) console.log(`   · ${r.ruta} (llega desde: ${r.desde})`)
  for (const t of falladas) console.log(`   · ${t.nombre}: ${t.detalle}`)
  process.exit(1)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
