// Journey: el panel "Tu Evolución en esta pregunta" NO puede contradecirse a sí mismo.
//
// Bug real (28/07/2026, feedback 108cc2a8 de MariSol, premium de Valencia): respondió una pregunta
// BIEN y la cabecera le dijo «Sigues fallando esta pregunta (0/2)»; en otra FALLÓ y le dijo
// «¡Progreso! Antes fallaste, ahora acertaste». Ella lo reportó como "las bolitas verde/roja salen
// al revés". Se replayearon sus tres casos con datos reales
// (`scripts/sim/sim-evolucion-marisol.ts`): las bolitas y el porcentaje coinciden EXACTAMENTE con
// la base de datos y es la CABECERA la que miente — el fallo está en `currentResult`, que el
// TestLayout deriva del estado del cliente (`selectedAnswer === verifiedCorrectAnswer`), no en la
// función pura que pinta el panel.
//
// Este journey lo caza desde el navegador, que es donde vive: responde varias preguntas eligiendo
// SIEMPRE una opción conocida, y en cada una comprueba que la cabecera no afirma lo contrario de lo
// que la propia UI acaba de marcar como acierto/fallo. Es un invariante de COHERENCIA: no necesita
// saber cuál es la respuesta correcta, solo que las dos verdades del recuadro no se contradigan.
import { evolutionHeaderMatchesLastAttempt } from '../../../lib/sim/invariants'
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// El repaso de fallos es donde apareció (ahí el guardado gana la carrera SIEMPRE y el panel se
// re-renderiza con el intento ya persistido), pero el panel es el mismo en cualquier test.
const RUTA = process.env.SIM_EVOLUCION_PATH ?? '/test/repaso-fallos-v2'
const PREGUNTAS = Number(process.env.SIM_EVOLUCION_N ?? 6)

// ⚠️ POR QUÉ HAY UNA PASADA PREVIA (31/07/2026): este journey nunca pudo dar verde. Entraba
// directo al repaso de fallos, que **solo tiene contenido si la cuenta ha fallado algo**, y la
// cuenta de prueba tenía 114 respuestas y CERO fallos (son de canaries, todas sobre la misma
// pregunta). El test salía vacío y el journey moría con «no se pudo evaluar ninguna pregunta».
//
// En vez de sembrar datos a mano —que caduca en cuanto alguien limpie la cuenta— el journey se
// los fabrica por el CAMINO REAL: responde un test normal eligiendo siempre la primera opción,
// lo que falle cae solo en el repaso, y ahí esas preguntas YA tienen historial, que es
// justo lo que necesita el panel de evolución para existir.

// El panel de evolución solo existe para un usuario con historial → journey AUTENTICADO con la
// MISMA cuenta de test que el resto de canaries (SMOKE_USER_ID). NUNCA un cliente real; sin esa
// variable el runner lo salta en vez de fallar.
const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
// La de la cuenta de prueba de verdad: declarar otra hacía que el test ni cargara.
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_estado'

// `test/aleatorio` va DIRECTO a las preguntas; `test/tema/N` es la pantalla de configuración
// («Selecciona el modo de estudio») y ahí no hay ninguna opción que pulsar. Mismo patrón que
// usa el journey del límite diario, que sí funciona.
const RUTA_SIEMBRA =
  process.env.SIM_EVOLUCION_SIEMBRA ?? `/${POSITION.replace(/_/g, '-')}/test/aleatorio`

const journey: Journey = {
  name: 'evolucion-cabecera-coherente',
  severity: 'high', // afirma al usuario que ha fallado algo que acertó: mina la confianza en sus datos
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    // ── Pasada 1: sembrar fallos por el camino real ──────────────────────────────────────
    await ctx.step('sembrar: abrir test normal', () => ctx.goto(RUTA_SIEMBRA), { shot: true })
    // El banner de cookies flota encima y se come los clics.
    await ctx.step('aceptar cookies', async () => {
      const b = ctx.page.getByRole('button', { name: /Aceptar todo|Rechazar todo/i }).first()
      if (await b.count()) await b.click({ timeout: 4000 }).catch(() => {})
    })
    // `test/aleatorio` no lleva a las preguntas: es el configurador. Hay que darle a empezar.
    await ctx.step('arrancar el test', async () => {
      const empezar = ctx.page.getByRole('button', { name: /Comenzar|Empezar|Iniciar|Generar/i }).first()
      if (await empezar.count()) await empezar.click({ timeout: 6000 }).catch(() => {})
      await ctx.page.waitForTimeout(6000)
    }, { shot: true })
    for (let i = 0; i < PREGUNTAS; i++) {
      const siguio = await ctx.step(`sembrar ${i + 1}`, async () => {
        const opcion = ctx.page.getByRole('button', { name: /^[ABCD]$/ }).first()
        if (!(await opcion.count())) return false
        await opcion.click()
        await ctx.page.waitForTimeout(2000) // que aterrice el guardado asíncrono
        const next = ctx.page.getByRole('button', { name: /Siguiente Pregunta/i }).first()
        if (await next.count()) { await next.click(); await ctx.page.waitForTimeout(1500) }
        return true
      })
      if (!siguio) break
    }

    // ── Pasada 2: el repaso, donde esas preguntas ya tienen historial ────────────────────
    await ctx.step('abrir repaso de fallos', () => ctx.goto(RUTA), { shot: true })
    await ctx.page.waitForTimeout(4000)

    for (let i = 0; i < PREGUNTAS; i++) {
      const respondida = await ctx.step(`responder pregunta ${i + 1}`, async () => {
        const opcion = ctx.page.getByRole('button', { name: /^[ABCD]$/ }).first()
        if (!(await opcion.count())) return false
        await opcion.click()
        await ctx.page.waitForTimeout(2500) // deja aterrizar el guardado asíncrono
        return true
      })
      if (!respondida) break

      // Verdad de la UI para ESE intento: el bloque de resultado dice si fue correcta.
      const acerto = (await ctx.seesText(/¡Correcto!|Respuesta correcta/i)) > 0
      const fallo = (await ctx.seesText(/Incorrecto|Respuesta incorrecta/i)) > 0
      if (!acerto && !fallo) continue // sin veredicto visible, no hay nada que contrastar

      const cabecera = await ctx.page
        .locator('text=/Siempre aciertas|Sigues fallando|ahora acertaste|Antes acertaste|La acertaste/i')
        .first()
        .textContent()
        .catch(() => null)

      if (cabecera) {
        const r = evolutionHeaderMatchesLastAttempt({ headerText: cabecera, lastAttemptCorrect: acerto })
        if (!r.ok) await ctx.screenshot(`cabecera-incoherente-${i + 1}`)
        resultados.push(r)
      }

      await ctx.step(`siguiente ${i + 1}`, async () => {
        const next = ctx.page.getByRole('button', { name: /Siguiente Pregunta/i }).first()
        if (await next.count()) { await next.click(); await ctx.page.waitForTimeout(1800) }
      })
    }

    // Sin datos que contrastar el journey no puede dar verde silencioso: se dice explícitamente.
    if (resultados.length === 0) {
      return [{ name: 'evolution_header_matches_last_attempt', ok: false, detail: 'no se pudo evaluar ninguna pregunta: ni siquiera tras sembrar fallos hay repaso con historial (¿selectores cambiados, o el test de siembra no carga?)' }]
    }
    return resultados
  },
}
export default journey
