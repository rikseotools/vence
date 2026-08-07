// Journey: hacer SCROLL con el dedo sobre la barra de meta diaria tiene que hacer scroll,
// no arrastrar la barra.
//
// Bug real ([T-315], feedback `247449ed` de Sara, premium de Badajoz, 07/08/2026). Escribió
// dos cosas: *«no se activa hoy»* y *«ayer al darle me aparecía pero se me movía por la
// pantalla, no se quedaba quieta en un sitio como antes»*. Y, en el mismo mensaje, que al
// pulsar «hacerlo por artículo» no se le abría la pantalla.
//
// Era UN solo fallo: la pastilla llevaba `touch-action: none` para poder arrastrarla, así que
// el navegador NO hacía scroll cuando el dedo empezaba encima — lo convertía en arrastre. Sus
// propios eventos lo dicen: desplazamientos de y=1433, 948, 707 px. Nadie coloca así una
// pastilla de 24 px de alto. Y donde quedaba se quedaba, con `z-index: 50`, flotando sobre el
// contenido: lo que hubiera debajo dejaba de recibir toques. Medido en 30 días: 59 de 129
// arrastres (11 usuarios) con más de 200 px de desplazamiento vertical, el 75% desde móvil.
//
// POR QUÉ NO LO CAZÓ NADA HASTA QUE ESCRIBIÓ UNA USUARIA: vence-sim solo corría en escritorio,
// donde este fallo NO EXISTE (con ratón no hay gesto de scroll que capturar). Este journey
// estrena el modo móvil del harness (`device: 'movil'`), que es la capa que faltaba.
//
// Contra el código anterior da ROJO por construcción: el arrastre movía la barra y la página
// no se desplazaba.
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_estado'

/** Recorrido del gesto: un scroll normal de móvil, hacia arriba. */
const RECORRIDO_PX = 260

const journey: Journey = {
  name: 'barra-meta-no-se-arrastra-con-scroll',
  // Alta: no pierde datos, pero deja la barra encima del contenido comiéndose los toques de
  // lo que haya debajo, y la persona no relaciona una cosa con la otra (Sara reportó los dos
  // síntomas como fallos distintos).
  severity: 'high',
  device: 'movil',
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    await ctx.step('abrir el hub de test', () => ctx.goto(`/${POSITION.replace(/_/g, '-')}/test`), { shot: true })
    await ctx.step('aceptar cookies', async () => {
      const b = ctx.page.getByRole('button', { name: /Aceptar todo|Rechazar todo/i }).first()
      if (await b.count()) await b.click({ timeout: 4000 }).catch(() => {})
    })
    await ctx.page.waitForTimeout(4000)

    // La barra solo existe para premium y con la preferencia activa. Si no está, el journey no
    // puede afirmar nada: se dice, en vez de dar un verde vacío.
    const antes = await ctx.page.evaluate(() => {
      const pill = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title') || '').includes('Meta diaria'))
      if (!pill) return null
      const r = pill.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: Math.round(r.top), scrollY: window.scrollY }
    })
    if (!antes) {
      return [{ name: 'barra_meta_presente', ok: false, detail: 'no se pintó la barra de meta diaria: sin ella este journey no puede afirmar nada (¿cuenta no premium o barra oculta en el perfil?)' }]
    }

    // EL GESTO: un dedo que empieza ENCIMA de la barra y sube, que es lo que hace cualquiera
    // para bajar por la página sin mirar dónde apoya el pulgar.
    await ctx.step('arrastrar el dedo hacia arriba empezando SOBRE la barra', async () => {
      await ctx.page.touchscreen.tap(antes.x, antes.y) // asegura que el gesto empieza ahí
      const t = ctx.page.touchscreen
      await ctx.page.evaluate(() => window.scrollTo(0, 0))
      await t.tap(antes.x, antes.y)
      // Gesto continuo: down → move → up (Playwright no expone swipe, se hace con CDP-lite)
      await ctx.page.mouse.move(antes.x, antes.y)
      await ctx.page.mouse.down()
      for (let i = 1; i <= 8; i++) await ctx.page.mouse.move(antes.x, antes.y - (RECORRIDO_PX * i) / 8)
      await ctx.page.mouse.up()
      await ctx.page.waitForTimeout(1200)
    }, { shot: true })

    const despues = await ctx.page.evaluate(() => {
      const pill = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title') || '').includes('Meta diaria'))
      const r = pill?.getBoundingClientRect()
      const wrapper = pill?.parentElement
      return {
        top: r ? Math.round(r.top) : null,
        scrollY: window.scrollY,
        transform: wrapper ? getComputedStyle(wrapper).transform : 'none',
        guardada: (() => { try { return Object.keys(localStorage).filter(k => k.startsWith('daily_goal_pos:')).length } catch { return -1 } })(),
      }
    })

    // INVARIANTE: el gesto no puede haber MOVIDO la barra de su sitio. Se juzga por lo que
    // queda escrito (posición persistida / transform), no por píxeles en pantalla: al hacer
    // scroll la barra cambia de sitio en el viewport aunque no se haya arrastrado, y confundir
    // las dos cosas daría un rojo falso.
    const seArrastro = despues.transform !== 'none' && despues.transform !== 'matrix(1, 0, 0, 1, 0, 0)'
    resultados.push({
      name: 'scroll_sobre_la_barra_no_la_arrastra',
      ok: !seArrastro && despues.guardada === 0,
      detail: seArrastro || despues.guardada > 0
        ? `el gesto de scroll movió la barra (transform=${despues.transform}, posiciones guardadas=${despues.guardada}): con touch-action:none en la pastilla, el dedo que hace scroll la arrastra`
        : undefined,
    })

    await ctx.screenshot('tras-el-gesto')
    return resultados
  },
}
export default journey
