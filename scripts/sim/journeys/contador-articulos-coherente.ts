// Journey: el número de artículos que anuncia la pantalla de una ley tiene que ser el que
// luego se puede marcar.
//
// Bug real (30/07/2026): en `/leyes/lo-3-2007` el filtro decía «798 artículos disponibles»
// y, al abrirlo, ofrecía 136 casillas. La ley tiene 134 artículos: el 798 era el número de
// PREGUNTAS, colocado en el campo de artículos (`articles_with_questions:
// lawStats.totalQuestions`). Nadie lo detectó en meses porque no rompe nada — solo miente —
// y ningún tipo lo impedía: los dos campos son `number`.
//
// Salió al verificar la pregunta de un usuario premium sobre si se podían elegir artículos
// sueltos. Se podía; lo que estaba mal era el rótulo de encima.
//
// Este journey compara las DOS cifras de la misma pantalla, que es justo lo que ningún test
// de código puede hacer: el contador viene de la API y las casillas del selector se pintan
// aparte, así que solo se contradicen en el navegador.
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// Ley de referencia: la del caso real. Es pública (no hace falta identidad), grande y
// estable, y tiene títulos además de artículos, así que ejercita los dos filtros.
const LEY = process.env.SIM_LEY_CONTADOR || 'lo-3-2007'

const journey: Journey = {
  name: 'contador-articulos-coherente',
  // `medium`: no impide estudiar, pero es un dato falso en pantalla. Quien lo nota deja de
  // fiarse del resto de números (y los números son el producto).
  severity: 'medium',
  // Anónimo a propósito: la pantalla de una ley se ve sin sesión, así que este journey no
  // depende de la autenticación del simulador (el punto que hoy tiene otros apagados).
  postDeploy: true,
  async run(ctx) {
    const resultados: InvariantResult[] = []

    await ctx.step(`abrir la ley ${LEY}`, () => ctx.goto(`/leyes/${LEY}`), { shot: true })
    await ctx.page.waitForTimeout(4000)

    // El filtro viene plegado: hay que desplegarlo, igual que la persona.
    const desplegar = ctx.page.getByRole('button', { name: /^Mostrar/ })
    const hayFiltro = (await desplegar.count()) > 0
    resultados.push({
      name: 'filtro_de_articulos_presente',
      ok: hayFiltro,
      detail: hayFiltro ? 'sección «Filtrar por Artículos» disponible' : 'no aparece el filtro de artículos en la pantalla de la ley',
    })
    if (!hayFiltro) return resultados

    await ctx.step('desplegar el filtro', async () => {
      await desplegar.first().click()
      await ctx.page.waitForTimeout(1500)
    })

    // 1) Lo que ANUNCIA el rótulo (si no hay número, es correcto: se prefiere callar).
    //
    // Se lee del ELEMENTO que lo pinta, no del `innerText` de la página. La primera versión
    // buscaba el patrón en todo el texto y daba un falso positivo de manual: encadenaba un
    // «798» de una línea con el «artículos disponibles» de la siguiente y denunciaba un bug
    // que ya estaba arreglado. Un journey que falla cuando no debe se acaba ignorando, que
    // es la peor avería posible en un guardarraíl.
    const anunciados = await ctx.page.evaluate(() => {
      const hojas = Array.from(document.querySelectorAll('*')).filter(
        (el) => el.children.length === 0 && /^\s*\d+\s+art[íi]culos?\s+disponibles?\s*$/i.test(el.textContent || ''),
      )
      if (!hojas.length) return null
      const m = (hojas[0].textContent || '').match(/(\d+)/)
      return m ? Number(m[1]) : null
    })

    // 2) Lo que OFRECE el selector de verdad.
    const btnArticulos = ctx.page.getByRole('button', { name: /🔧\s*Art[íi]culos/ })
    const hayBoton = (await btnArticulos.count()) > 0
    resultados.push({
      name: 'selector_de_articulos_accesible',
      ok: hayBoton,
      detail: hayBoton ? 'botón «Artículos» visible tras desplegar' : 'el botón de artículos no aparece: no se pueden elegir artículos sueltos',
    })
    if (!hayBoton) return resultados

    await ctx.step('abrir el selector de artículos', async () => {
      await btnArticulos.first().click()
      await ctx.page.waitForTimeout(2000)
    }, { shot: true })

    const casillas = await ctx.page.locator('input[type=checkbox]').count()
    resultados.push({
      name: 'selector_ofrece_articulos',
      ok: casillas > 1,
      detail: `${casillas} casilla(s) en el selector`,
    })

    // 3) La invariante que importa: si se anuncia un número, no puede ser un orden de
    //    magnitud distinto de lo que se ofrece. Se compara con holgura porque el selector
    //    incluye controles propios (seleccionar todos) y puede paginar; lo que se persigue
    //    es el disparate tipo 798 contra 136, no un desajuste de una unidad.
    if (anunciados === null) {
      resultados.push({
        name: 'contador_coherente',
        ok: true,
        detail: 'la pantalla no anuncia número de artículos (correcto: mejor callar que mentir)',
      })
    } else {
      const proporcion = casillas > 0 ? anunciados / casillas : Infinity
      const ok = proporcion <= 1.5
      resultados.push({
        name: 'contador_coherente',
        ok,
        detail: ok
          ? `anuncia ${anunciados} y ofrece ${casillas}`
          : `anuncia ${anunciados} artículos pero el selector ofrece ${casillas} (el bug del 30/07 fue 798 contra 136: el contador traía el número de PREGUNTAS)`,
      })
    }

    return resultados
  },
}

export default journey
