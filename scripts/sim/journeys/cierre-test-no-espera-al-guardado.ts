// Journey: al terminar un test, la pantalla de resultados NO puede quedarse esperando al
// guardado.
//
// Bug real ([T-315], feedback `e790c7bf` de Lourdes, premium de Sevilla, 07/08/2026). Escribió
// que *«la plataforma se me queda colgada… me ocurre cuando termino un test y quiero hacer
// otro»*; se le contestó con la causa de OTRO incidente y ella replicó que no era eso. Lo que
// era: `TestLayout` esperaba **20 segundos** a que drenara la cola de `/api/v2/answer-and-save`
// antes de cerrar el test, y hasta entonces no aparecían ni la confirmación ni «Revisar fallos»
// ni «Practicar mis fallos». El día que el servidor se satura —lo que arregla el presupuesto
// único de `backend/src/answer-save/presupuesto.ts`— esa espera se agotaba entera.
//
// POR QUÉ ESTE JOURNEY Y NO UN TEST: el arreglo del cliente estaba cubierto por tests ESTÁTICOS
// sobre el fuente (`__tests__/components/TestLayoutCierre.test.ts`), que comprueban el cableado
// y no pueden ver una pantalla. Lo que le pasa a la persona solo se ve en un navegador y con el
// guardado yendo mal, así que aquí se REPRODUCE la condición: se inyecta latencia en el
// guardado (más que la espera nueva, para que no pueda drenar) y se cronometra si la pantalla
// ofrece algo accionable de todas formas.
//
// Contra el código ANTERIOR este journey da ROJO por construcción: con el guardado colgado, la
// espera de 20 s dejaba la pantalla sin confirmación ni botones muy por encima del margen.
import { faults } from '../../../lib/sim/faults'
import { testEndOffersActionsInTime } from '../../../lib/sim/invariants'
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// La cuenta de prueba de siempre (nunca un cliente real). Sin ella el runner lo salta.
const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_estado'

/**
 * Latencia inyectada en el guardado: por encima de la espera nueva (3 s) para que la cola NO
 * pueda drenar. Es la condición del usuario saturado, reproducida a propósito.
 */
const LATENCIA_GUARDADO_MS = 12_000

/**
 * Margen para que la pantalla ofrezca algo tras la última respuesta: la espera nueva (3 s) más
 * holgura de red, render y del propio cierre en servidor. Muy por debajo de los 20 s de antes,
 * que es lo que hace que este journey distinga el arreglo del bug.
 */
const MARGEN_MS = 12_000

const journey: Journey = {
  name: 'cierre-test-no-espera-al-guardado',
  // Alta: no pierde datos, pero deja a quien acaba de estudiar sin poder seguir, que es
  // exactamente por lo que escribió.
  severity: 'high',
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    // El guardado va lento a propósito: sin esto el journey mide el camino feliz, que ya iba
    // bien antes del arreglo y no distingue nada.
    await ctx.injectFault(faults.latency('**/api/v2/answer-and-save**', LATENCIA_GUARDADO_MS))

    await ctx.step('abrir un test rápido', () => ctx.goto('/test/rapido'), { shot: true })
    await ctx.step('aceptar cookies', async () => {
      const b = ctx.page.getByRole('button', { name: /Aceptar todo|Rechazar todo/i }).first()
      if (await b.count()) await b.click({ timeout: 4000 }).catch(() => {})
    })
    await ctx.page.waitForTimeout(4000)

    // Responder hasta el final. El test rápido son 10 preguntas; se deja margen por si cambia.
    let respondidas = 0
    let terminado = false
    for (let i = 0; i < 15 && !terminado; i++) {
      const siguio = await ctx.step(`responder ${i + 1}`, async () => {
        const opcion = ctx.page.getByRole('button', { name: /^[ABCD]$/ }).first()
        if (!(await opcion.count())) return false
        await opcion.click()
        respondidas++
        await ctx.page.waitForTimeout(1200)
        const next = ctx.page.getByRole('button', { name: /Siguiente Pregunta/i }).first()
        if (await next.count()) {
          await next.click()
          await ctx.page.waitForTimeout(1000)
          return true
        }
        // Sin «Siguiente Pregunta» era la última: el test se cierra aquí.
        terminado = true
        return true
      })
      if (!siguio) break
    }

    if (respondidas === 0) {
      return [
        testEndOffersActionsInTime({ elapsedMs: 0, budgetMs: MARGEN_MS, actionsVisible: false }),
      ]
    }

    // ── Lo que se mide: desde que se responde la última, ¿cuánto tarda la pantalla en ofrecer
    //    algo? Se cronometra con el reloj, no se pregunta por el estado interno.
    const t0 = Date.now()
    let actionsVisible = false
    while (Date.now() - t0 < MARGEN_MS + 8_000) {
      const confirmacion = (await ctx.seesText(/Progreso guardado en tu perfil/i)) > 0
      const revisar = (await ctx.countRole('link', /Revisar fallos/i)) > 0
      const practicar = (await ctx.countRole('button', /Practicar mis fallos/i)) > 0
      // La salida del caso malo cuenta como acción: le dice que sus respuestas están a salvo y
      // le da un botón. Lo que NO vale es una pantalla que no ofrece nada.
      const salida = (await ctx.seesText(/Tus respuestas están a salvo/i)) > 0
      if (confirmacion || revisar || practicar || salida) {
        actionsVisible = true
        break
      }
      await ctx.page.waitForTimeout(500)
    }
    const elapsedMs = Date.now() - t0

    await ctx.screenshot('pantalla-al-terminar-el-test')
    resultados.push(testEndOffersActionsInTime({ elapsedMs, budgetMs: MARGEN_MS, actionsVisible }))
    return resultados
  },
}
export default journey
