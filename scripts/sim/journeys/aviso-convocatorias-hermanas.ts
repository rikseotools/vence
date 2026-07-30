// Journey: quien entra en una oposición con DOS convocatorias vivas tiene que ver el aviso.
//
// Caso real (30/07/2026): Auxiliar Administrativo de la Comunidad de Madrid tiene dos
// convocatorias abiertas con temario distinto (examen octubre 2026 → Windows 10; junio 2027
// → Windows 11), servidas como dos oposiciones separadas. En el selector se distinguen bien,
// pero una vez dentro NADA lo decía: una usuaria estudió el temario que no le tocaba y se
// enteró de casualidad escribiendo a soporte por otra cosa («me he metido en la convocatoria
// equivocada»). Teníamos el dato en la base de datos y no se lo contábamos.
//
// El aviso depende de una columna (`oposiciones.grupo_convocatoria`) que se rellena a mano,
// así que se puede perder de tres formas silenciosas: que alguien la vacíe, que una hermana
// nueva nazca sin grupo, o que el componente deje de pintarse tras un refactor. Ninguna
// rompería nada visible — la página seguiría cargando perfecta, solo que muda. Por eso hay
// journey: es la única capa que mira lo que la persona ve de verdad.
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// La oposición del caso. Pública: no hace falta identidad, así que este journey no depende
// de la autenticación del simulador (lo que hoy tiene otros apagados).
const SLUG = process.env.SIM_SLUG_HERMANAS || 'auxiliar-administrativo-madrid'

const journey: Journey = {
  name: 'aviso-convocatorias-hermanas',
  // `high`: no rompe la aplicación, pero su ausencia manda a alguien a estudiar meses el
  // programa que no le entra. Se descubre tarde y no se puede recuperar el tiempo.
  severity: 'high',
  postDeploy: true,
  async run(ctx) {
    const resultados: InvariantResult[] = []

    await ctx.step(`abrir /${SLUG}/test`, () => ctx.goto(`/${SLUG}/test`), { shot: true })
    await ctx.page.waitForTimeout(3500)

    const texto = await ctx.page.locator('body').innerText()

    const avisa = /temario distinto/i.test(texto) && /convocatoria a la que te presentas/i.test(texto)
    resultados.push({
      name: 'aviso_visible',
      ok: avisa,
      detail: avisa
        ? 'la página avisa de que hay otra convocatoria con temario distinto'
        : 'NO se avisa: quien entre aquí no sabe que existe otra convocatoria con otro temario (mirar oposiciones.grupo_convocatoria y el render en TestHubClient)',
    })

    // Y que diga CUÁL es la otra: un aviso que no la nombra obliga a adivinar.
    const nombraLaOtra = /La otra es/i.test(texto)
    resultados.push({
      name: 'aviso_nombra_la_otra',
      ok: !avisa || nombraLaOtra,
      detail: nombraLaOtra ? 'nombra la otra convocatoria' : 'avisa pero no dice cuál es la otra',
    })

    // El aviso tiene que dejar actuar, no solo asustar.
    const puedeCambiar = (await ctx.page.getByText(/Cambiar de convocatoria/i).count()) > 0
    resultados.push({
      name: 'aviso_permite_cambiar',
      ok: !avisa || puedeCambiar,
      detail: puedeCambiar ? 'ofrece cambiar de convocatoria' : 'avisa pero no ofrece cómo cambiar',
    })

    return resultados
  },
}

export default journey
