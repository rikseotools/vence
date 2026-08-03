/**
 * scripts/sim/sim-cabecera-alcanzable.ts — la cabecera NUNCA deja nada fuera de la pantalla.
 *
 * ## Por qué existe (T-504, 03/08/2026)
 *
 * La cabecera de escritorio creció un enlace cada vez durante meses y nadie comprobó que
 * siguiera cabiendo, porque no había con qué: los tests de la cabecera miran QUÉ enlaces se
 * pintan, no DÓNDE acaban. El 03/08 dejó de caber y el avatar y la campana se quedaron fuera
 * del viewport —con `overflow-x: hidden`, o sea sin scroll con el que rescatarlos— en las
 * cuatro anchuras de escritorio y en los dos planes. Lo reportó un usuario.
 *
 * Esta simulación comprueba las TRES cosas que tienen que ser ciertas, con navegador real:
 *
 *   1. **La fila no desborda su contenedor** (`scrollWidth ≤ clientWidth`). Es la causa: sin
 *      esto, todo lo demás es cuestión de suerte.
 *   2. **Todo lo pulsable de la cabecera se puede PULSAR** — su centro cae dentro del
 *      viewport. Es el síntoma que sufre el usuario, y se comprueba aparte a propósito: (1)
 *      puede cumplirse y (2) fallar igual si algo se posiciona por su cuenta.
 *   3. **No se ha perdido ningún enlace**: los que no caben en la barra tienen que estar en el
 *      menú «Más», ese menú tiene que ABRIRSE y sus enlaces tienen que poder PULSARSE —se
 *      comprueba con `elementFromPoint`, no contándolos—. Sin este tercer punto, la forma más
 *      fácil de pasar (1) y (2) sería esconder media navegación.
 *
 * ## Contra qué corre
 *
 *   npx tsx scripts/sim/sim-cabecera-alcanzable.ts                  # localhost:3000
 *   AUTH_SECRET=… npx tsx scripts/sim/sim-cabecera-alcanzable.ts --url=https://www.vence.es
 *
 * Solo LEE: carga páginas y mide geometría. Las sesiones se forjan con `lib/sim/session.ts`,
 * que marca el tráfico como simulación para no envenenar las métricas.
 *
 * ## Salidas
 *
 *   0 = verde   ·   1 = ROJO (hay algo fuera de pantalla o perdido)
 *   2 = NO CONCLUYENTE — no se pudo medir (sin cabecera, sin sesión, sin enlaces). Existe
 *       porque un cero de hallazgos sobre cero casos medidos parece verde y no lo es.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium, type Browser } from 'playwright'

const URL_BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'
const SOLO = process.argv.find((a) => a.startsWith('--solo'))?.split('=')[1]

/** Anchuras de escritorio reales. 1280 es donde arranca el menú completo (`xl:`); 1920 es la
 *  pantalla más común de sobremesa y era la del usuario que lo reportó. */
const ANCHURAS = [1280, 1440, 1536, 1920]

interface Caso { etiqueta: string; userId: string | null; email: string | null }

interface Medida {
  hayCabecera: boolean
  desborde: number
  fuera: Array<{ que: string; px: number; lado: string; l: number; r: number }>
  enBarra: number
  totalEnlaces: number
  hayBotonMas: boolean
  haySesion: boolean
}

const GUION_MEDIR = `(() => {
  const header = document.querySelector('header');
  if (!header) return { hayCabecera: false, desborde: 0, fuera: [], enBarra: 0, totalEnlaces: 0, hayBotonMas: false, haySesion: false };
  const fila = header.querySelector('div > div.flex.items-center.justify-between');
  const desborde = fila ? fila.scrollWidth - fila.clientWidth : 0;

  // Todo lo que el usuario puede pulsar en la barra principal. Se excluye lo que está oculto
  // (display:none del responsive) y el MEDIDOR, que es invisible a propósito.
  //
  // El criterio es el CENTRO dentro del viewport, no el borde, y no es un umbral elegido a
  // ojo: un elemento cuyo centro está en pantalla se puede pulsar, y uno cuyo centro está
  // fuera no. Con el borde habría que inventarse una tolerancia — el logo lleva scale-125 y
  // su caja visual asoma 1 px por la izquierda sin que eso le impida a nadie hacer clic.
  // Que nada se vea CORTADO lo cubre la otra comprobación (la fila no desborda su contenedor),
  // que es geometría de layout y no admite discusión.
  const fuera = [];
  const pulsables = header.querySelectorAll('a[href], button');
  for (let i = 0; i < pulsables.length; i++) {
    const el = pulsables[i];
    if (el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.top > 200) continue;
    const nombre = (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 40);
    const centro = (r.left + r.right) / 2;
    if (centro > window.innerWidth) fuera.push({ que: nombre, px: Math.round(centro - window.innerWidth), lado: 'derecha', l: Math.round(r.left), r: Math.round(r.right) });
    else if (centro < 0) fuera.push({ que: nombre, px: Math.round(-centro), lado: 'izquierda', l: Math.round(r.left), r: Math.round(r.right) });
  }

  const nav = header.querySelector('nav');
  const medidor = nav ? nav.querySelector('[aria-hidden="true"]') : null;
  // El total sale del MEDIDOR, que por construcción lleva la lista completa. Si no está (código
  // viejo, o alguien lo quitó) NO se puede comprobar que no falte ningún enlace — pero las
  // otras dos comprobaciones siguen valiendo, así que el caso NO se salta: se marca.
  const totalEnlaces = medidor ? medidor.querySelectorAll('[data-medida="enlace"]').length : 0;
  const enBarra = nav ? nav.querySelectorAll('a[href]').length : 0;
  const botones = nav ? nav.querySelectorAll('button[aria-haspopup="menu"]') : [];
  // Que la sesión se haya aplicado se mira por la CAMPANA, que solo existe con sesión. Antes se
  // deducía del medidor y eso ataba la comprobación al código nuevo: contra el código viejo
  // todos los casos con sesión se saltaban «no concluyentes» y el resumen salía verde con 8 de
  // 12 casos sin mirar. Un instrumento que no puede juzgar el fallo que busca no sirve.
  const haySesion = !!header.querySelector('button[aria-label^="Notificaciones"]');
  return { hayCabecera: true, desborde, fuera, enBarra, totalEnlaces, hayBotonMas: botones.length > 0, haySesion };
})()`

async function medirCaso(browser: Browser, caso: Caso, ancho: number, cookie: string | null) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 925 } })
  if (cookie) {
    const { cookieForPlaywright } = await import('../../lib/sim/session')
    ctx.addCookies([cookieForPlaywright(cookie, new URL(URL_BASE).hostname)])
  }
  const page = await ctx.newPage()
  await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 60000 })
  // El reparto ocurre tras el primer layout (se mide y se vuelve a pintar): sin esta espera
  // se estaría midiendo el render provisional, que a propósito enseña TODOS los enlaces.
  await page.waitForTimeout(2500)

  const m: Medida = await page.evaluate(GUION_MEDIR)

  // Abrir «Más» y mirar lo que guarda. NO basta con CONTAR los enlaces: la primera versión
  // de esta simulación los contaba y daba verde con el menú **recortado por un
  // `overflow-x: auto`**, o sea invisible en pantalla. Lo cazó un pantallazo. Ahora se
  // comprueba que cada enlace se pueda PULSAR de verdad — que en su centro conteste él y no
  // otro elemento (`elementFromPoint`), que es lo que caza recortes, tapados y z-index malos.
  let enMenu = 0
  let inalcanzablesEnMenu: string[] = []
  if (m.hayBotonMas) {
    await page.click('header nav button[aria-haspopup="menu"]')
    await page.waitForTimeout(400)
    const r: { total: number; inalcanzables: string[] } = await page.evaluate(`(() => {
      const enlaces = Array.from(document.querySelectorAll('header nav [role="menu"] a[href]'));
      const malos = [];
      for (let i = 0; i < enlaces.length; i++) {
        const el = enlaces[i];
        const b = el.getBoundingClientRect();
        const etiqueta = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
        if (b.width === 0 || b.height === 0) { malos.push(etiqueta + ' (sin caja: recortado u oculto)'); continue }
        const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) { malos.push(etiqueta + ' (fuera de pantalla)'); continue }
        const golpe = document.elementFromPoint(cx, cy);
        if (!golpe || (golpe !== el && !el.contains(golpe))) {
          malos.push(etiqueta + ' (tapado por <' + (golpe ? golpe.tagName.toLowerCase() : 'nada') + '>)');
        }
      }
      return { total: enlaces.length, inalcanzables: malos };
    })()`)
    enMenu = r.total
    inalcanzablesEnMenu = r.inalcanzables
  }
  await ctx.close()
  return { ...m, enMenu, inalcanzablesEnMenu }
}

async function main() {
  const esLocal = /localhost|127\.0\.0\.1/.test(URL_BASE)
  const secret = process.env.AUTH_SECRET
  if (!secret) { console.error('❌ Falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET).'); process.exit(2) }

  const { mintOwnAuthCookie } = await import('../../lib/sim/session')
  const { Client } = await import('pg')
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs')
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  // Los dos planes tienen menús de distinta longitud (premium suma «Recompensas» y pierde el
  // botón «Hazte Premium»), así que probar solo uno deja el otro sin vigilar.
  const prem = (await c.query(`select id, email from user_profiles where plan_type='premium' order by updated_at desc limit 1`)).rows[0]
  const free = (await c.query(`select id, email from user_profiles where plan_type='free' and target_oposicion is not null order by updated_at desc limit 1`)).rows[0]
  await c.end()

  const casos: Caso[] = [
    { etiqueta: 'premium', userId: prem?.id ?? null, email: prem?.email ?? null },
    { etiqueta: 'free', userId: free?.id ?? null, email: free?.email ?? null },
    { etiqueta: 'sin sesión', userId: null, email: null },
  ].filter((k) => !SOLO || k.etiqueta === SOLO)

  console.log(`\n🧭 Cabecera alcanzable — ${URL_BASE}${esLocal ? ' (local)' : ' (PRODUCCIÓN)'}\n`)

  const browser = await chromium.launch()
  let rojos = 0
  let medidos = 0
  const noConcluyentes: string[] = []
  const sinMedidor: string[] = []

  for (const caso of casos) {
    if (caso.userId === null && caso.etiqueta !== 'sin sesión') {
      noConcluyentes.push(`${caso.etiqueta}: no hay usuario de ese plan en la BD`)
      continue
    }
    const cookie = caso.userId
      ? await mintOwnAuthCookie(
          { userId: caso.userId, email: caso.email! },
          secret,
          { nowSec: Math.floor(Date.now() / 1000), ttlSec: 900, host: new URL(URL_BASE).hostname },
        )
      : null

    for (const ancho of ANCHURAS) {
      const r = await medirCaso(browser, caso, ancho, cookie)
      const nombre = `${caso.etiqueta} @${ancho}`
      if (!r.hayCabecera) { noConcluyentes.push(`${nombre}: no se encontró la cabecera`); continue }
      if (caso.userId && !r.haySesion) { noConcluyentes.push(`${nombre}: la sesión no se aplicó (sin campana)`); continue }
      medidos++

      const problemas: string[] = []
      // 1px de tolerancia: el subpíxel del layout no es un desborde.
      if (r.desborde > 1) problemas.push(`la fila desborda su contenedor ${r.desborde}px`)
      for (const f of r.fuera) problemas.push(`«${f.que}» no se puede pulsar: su centro cae ${f.px}px fuera por la ${f.lado} [${f.l}..${f.r}] de ${ancho}`)
      if (r.totalEnlaces > 0 && r.enBarra + r.enMenu < r.totalEnlaces) {
        problemas.push(`se han perdido ${r.totalEnlaces - r.enBarra - r.enMenu} enlaces (barra ${r.enBarra} + menú ${r.enMenu} de ${r.totalEnlaces})`)
      }
      if (r.hayBotonMas && r.enMenu === 0) problemas.push('el botón «Más» existe pero su menú no se abre o está vacío')
      for (const mal of r.inalcanzablesEnMenu) problemas.push(`en el menú «Más», «${mal}» no se puede pulsar`)
      if (r.totalEnlaces === 0) sinMedidor.push(nombre)

      if (problemas.length) {
        rojos++
        console.log(`❌ ${nombre}`)
        problemas.forEach((p) => console.log(`     · ${p}`))
      } else {
        const reparto = r.totalEnlaces > 0 ? ` — ${r.enBarra} en barra${r.enMenu ? ` + ${r.enMenu} en «Más»` : ''}` : ''
        console.log(`✅ ${nombre}${reparto}`)
      }
    }
  }
  await browser.close()

  console.log('')
  if (sinMedidor.length) {
    console.log(`⚠️  sin medidor en ${sinMedidor.length} caso(s) → NO se ha podido comprobar que no falte ningún enlace: ${sinMedidor.join(', ')}`)
  }
  if (noConcluyentes.length) noConcluyentes.forEach((n) => console.log(`⚠️  no concluyente — ${n}`))

  if (rojos > 0) {
    console.log(`\n🔴 ${rojos} de ${medidos} casos con algo fuera de la pantalla.`)
    process.exit(1)
  }
  // Un verde PARCIAL no es un verde. Si algún caso no se pudo medir, el veredicto es amarillo
  // aunque lo medido esté limpio: si no, basta con que una comprobación se rompa en silencio
  // para que la simulación deje de mirar y siga diciendo que todo va bien.
  if (medidos === 0 || noConcluyentes.length || sinMedidor.length) {
    console.log(`\n🟡 NO CONCLUYENTE: ${medidos} caso(s) medidos y ${noConcluyentes.length + sinMedidor.length} sin poder juzgar del todo.`)
    process.exit(2)
  }
  console.log(`\n🟢 ${medidos} casos medidos, todo dentro de la pantalla y ningún enlace perdido.`)
}

main().catch((e) => { console.error('💥', e); process.exit(2) })
