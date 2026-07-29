// Journey: los controles flotantes del examen (reloj, respondidas, saltar a las que faltan)
// tienen que SEGUIR AHÍ y RECIBIR EL CLIC mientras el usuario baja por las preguntas.
//
// Bug real (28/07/2026, feedback 793d6b9e de Manolo, premium de Diputación de Córdoba): pidió
// dos cosas —ver el tiempo que le queda y volver a las que dejaba en blanco sin ir subiendo— y
// las dos se le sirvieron rotas. Los controles se pegaban con `top-0` y `z-30`, pero la
// cabecera del sitio también es pegajosa y va por encima (`z-50`, ~105 px): quedaban pegados
// DETRÁS de ella. Invisibles, y sordos al clic (aterrizaba en la cabecera). Sus dos síntomas
// ("el reloj no baja", "el botón no funciona") eran ese mismo fallo.
//
// Por qué aquí y no en el harness de Playwright de `e2e/`: la clase de fallo es de PINTADO
// (oclusión), así que hace falta navegador de verdad; y hace falta SESIÓN, porque la cabecera
// logueada es más alta que la anónima (lleva la fila de racha/leyes que cuelga por debajo) —
// justo el caso que el hueco tiene que medir bien. Además, abrir exámenes sin sesión hace
// saltar el anti-scraping (403 en /api/questions/filtered), que vuelve inestable cualquier
// prueba anónima.
//
// El juicio clave NO es `isVisible()` (era cierto mientras estaba roto) sino `elementFromPoint`
// en el centro del control: quién recibiría el clic del usuario.
import { floatingControlIsReachable } from '../../../lib/sim/invariants'
import type { Journey, JourneyCtx } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// La cuenta de test prepara auxiliar_administrativo_estado; el examen por tema es el que
// describió Manolo (50 preguntas, primera vuelta dejando huecos).
const RUTA = process.env.SIM_EXAMEN_PATH ?? '/auxiliar-administrativo-estado/test/tema/1/test-examen'

// Journey AUTENTICADO con la MISMA cuenta de test que el resto de canaries (SMOKE_USER_ID),
// NUNCA un cliente real. Sin esa variable el runner lo salta en vez de fallar.
const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_estado'

/**
 * Mide, para un control: si se pinta, quién recibiría el clic en su centro, a qué altura está
 * y dónde acaba la cabecera pegajosa (el borde contra el que se juzga esa altura: cambia con
 * la sesión y el ancho, así que se mide, no se supone).
 */
async function medirControl(ctx: JourneyCtx, selector: string) {
  return ctx.page.evaluate((sel: string) => {
    const cabecera = document.querySelector('header')
    const cabeceraBottomPx = cabecera ? Math.round(cabecera.getBoundingClientRect().bottom) : null
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { visible: false, occludedBy: null as string | null, topPx: null as number | null, cabeceraBottomPx }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.height > 0
    if (!visible) return { visible: false, occludedBy: null, topPx: Math.round(r.top), cabeceraBottomPx }
    const enElPunto = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    const propio = enElPunto === el || el.contains(enElPunto) || (enElPunto ? enElPunto.contains(el) : false)
    const describe = (n: Element | null) =>
      n ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}.${(n.className || '').toString().split(' ').slice(0, 2).join('.')}` : 'nada'
    return {
      visible: true,
      occludedBy: propio ? null : describe(enElPunto),
      topPx: Math.round(r.top),
      cabeceraBottomPx,
    }
  }, selector)
}

/** Qué pregunta está centrada en pantalla (para juzgar si el salto movió de verdad). */
async function preguntaCentrada(ctx: JourneyCtx): Promise<string | null> {
  return ctx.page.evaluate(() => {
    const centro = window.innerHeight / 2
    const anclas = [...document.querySelectorAll('[id^=pregunta-]')]
    if (!anclas.length) return null
    return anclas
      .map(e => {
        const r = e.getBoundingClientRect()
        return { id: e.id, d: Math.abs(r.top + r.height / 2 - centro) }
      })
      .sort((a, b) => a.d - b.d)[0].id
  })
}

const SEL_RELOJ = '[data-testid="reloj-examen"]'
const SEL_SIGUIENTE = 'button[aria-label="Ir a la siguiente pregunta en blanco"]'
const SEL_ANTERIOR = 'button[aria-label="Ir a la anterior pregunta en blanco"]'

const journey: Journey = {
  name: 'examen-controles-flotantes',
  // high y no critical: el examen se puede hacer igual, pero deja al usuario sin las dos cosas
  // que pidió y sin forma de saber que existen.
  severity: 'high',
  // Es un fallo de PINTADO que introduce un despliegue: se verifica justo cuando la versión
  // llega a producción, que es cuando el riesgo existe y cuando el culpable es evidente.
  postDeploy: true,
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    await ctx.step('abrir examen', () => ctx.goto(RUTA), { shot: true })
    // 60s y no 30: recién desplegado, el contenedor está frío y preparar el examen puede pasar
    // de medio minuto. Con 30 el journey se ponía rojo por la temperatura del contenedor, no
    // por un fallo — y un rojo que no es un fallo es peor que no tener el journey.
    const hayPreguntas = await ctx.step('esperar preguntas', async () => {
      for (let i = 0; i < 60; i++) {
        if (await ctx.page.locator('[id^=pregunta-]').count()) return true
        await ctx.page.waitForTimeout(1000)
      }
      return false
    })
    if (!hayPreguntas) {
      // Qué se quedó en pantalla importa para no confundir un fallo del app con el entorno:
      // "Algo no ha ido bien" suele ser el límite de peticiones o el reto anti-scraping (típico
      // al reintentar el journey varias veces seguidas), mientras que quedarse en "Preparando
      // examen…" apunta a la carga de preguntas.
      const texto = (await ctx.page.locator('body').innerText().catch(() => '')) as string
      const pista = /Algo no ha ido bien/i.test(texto)
        ? 'la página muestra el error genérico — probable límite de peticiones o reto anti-scraping por reintentos seguidos; espera unos minutos'
        : /Preparando examen/i.test(texto)
          ? 'se quedó en "Preparando examen…" — la carga de preguntas no terminó'
          : `la página muestra: ${texto.slice(0, 120).replace(/\s+/g, ' ')}`
      return [{ name: 'examen_cargado', ok: false, detail: `no cargaron preguntas en ${RUTA}: ${pista}` }]
    }

    // Bajar: es el momento exacto del que se quejaba Manolo ("una vez que pasas de la primera
    // pregunta dejas de ver el reloj").
    await ctx.step('bajar por el examen', async () => {
      await ctx.page.evaluate(() => window.scrollTo(0, 1600))
      await ctx.page.waitForTimeout(800)
    }, { shot: true })

    for (const [etiqueta, selector] of [
      ['reloj', SEL_RELOJ],
      ['ir a la siguiente en blanco', SEL_SIGUIENTE],
      ['ir a la anterior en blanco', SEL_ANTERIOR],
    ] as const) {
      const m = await ctx.step(`medir "${etiqueta}"`, () => medirControl(ctx, selector))
      resultados.push(floatingControlIsReachable({ control: etiqueta, ...m }))
    }

    // El reloj y la cuenta atrás son DOS botones nombrados (antes alternaba con un toque sobre
    // el propio reloj y nadie lo descubría): pulsar "cuenta atrás" tiene que cambiar lo que se
    // muestra. Si el botón estuviera tapado, aquí no pasaría nada.
    const cambioDeModo = await ctx.step('pulsar "cuenta atrás"', async () => {
      const antes = await ctx.page.locator(SEL_RELOJ).innerText()
      await ctx.page.locator('button[aria-label="Ver la cuenta atrás hasta tu objetivo"]').click()
      await ctx.page.waitForTimeout(500)
      const despues = await ctx.page.locator(SEL_RELOJ).innerText()
      return { antes: antes.trim(), despues: despues.trim() }
    }, { shot: true })
    resultados.push(
      cambioDeModo.despues.includes('⏳')
        ? { name: 'reloj_alterna_modo', ok: true }
        : { name: 'reloj_alterna_modo', ok: false, detail: `el reloj no pasó a cuenta atrás (${cambioDeModo.antes} → ${cambioDeModo.despues})` },
    )

    // Saltar a las que quedan en blanco, en los dos sentidos: ‹ tiene que deshacer lo que hizo ›.
    const salto = await ctx.step('saltar entre las que faltan', async () => {
      await ctx.page.locator(SEL_SIGUIENTE).click()
      await ctx.page.waitForTimeout(1300)
      const primera = await preguntaCentrada(ctx)
      await ctx.page.locator(SEL_SIGUIENTE).click()
      await ctx.page.waitForTimeout(1300)
      const segunda = await preguntaCentrada(ctx)
      await ctx.page.locator(SEL_ANTERIOR).click()
      await ctx.page.waitForTimeout(1300)
      const vuelta = await preguntaCentrada(ctx)
      return { primera, segunda, vuelta }
    }, { shot: true })
    resultados.push(
      salto.primera && salto.segunda && salto.primera !== salto.segunda
        ? { name: 'salto_en_blanco_avanza', ok: true }
        : { name: 'salto_en_blanco_avanza', ok: false, detail: `el salto no movió de pregunta (${salto.primera} → ${salto.segunda})` },
    )
    resultados.push(
      salto.vuelta === salto.primera
        ? { name: 'salto_en_blanco_retrocede', ok: true }
        : { name: 'salto_en_blanco_retrocede', ok: false, detail: `‹ no volvió a la anterior en blanco (esperada ${salto.primera}, centrada ${salto.vuelta})` },
    )

    return resultados
  },
}

export default journey
