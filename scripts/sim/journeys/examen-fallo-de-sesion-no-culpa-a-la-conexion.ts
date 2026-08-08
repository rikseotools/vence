// Journey: si la corrección de un examen falla por SESIÓN, no se le puede decir al opositor
// que revise su conexión.
//
// Bug real ([T-671], feedbacks `86071bf9` y `3bcbd41b` de `rbsc87`, premium de tres días,
// 07/08/2026). Hizo OCHO exámenes de 25 preguntas y no pudo corregir ninguno: sus peticiones
// salían sin token, `/api/exam/validate` las rechazaba con 403 y `ExamLayout` mostraba SIEMPRE
// el mismo aviso, dijera lo que dijera el servidor:
//
//     alert('Error al enviar el examen. Comprueba tu conexión e inténtalo de nuevo.')
//
// Él contestó, literalmente: *«lanza el mensaje de que no tengo conexión (…) cuando la conexión
// es perfecta»*. Le hicimos dudar de su equipo y le dejamos sin la única acción que lo
// resolvía, que era volver a entrar.
//
// POR QUÉ ESTE JOURNEY Y NO UN TEST: el núcleo del aviso ya está cubierto por unitarios
// (`__tests__/lib/tests/avisoDeCorreccion.test.ts`), que prueban el TEXTO. Lo que no pueden ver
// es si ese texto llega a la pantalla — que es donde se rompió: el núcleo puede estar perfecto y
// el `alert()` seguir ahí. Aquí se reproduce la condición exacta de producción (403 con
// `reason: 'sin_identidad'`, el cuerpo que manda `requireDuenoDelRecurso`) y se mira lo que lee
// la persona.
//
// Contra el código ANTERIOR da ROJO por construcción: el aviso viejo contenía «conexión».
import { faults } from '../../../lib/sim/faults'
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_estado'

const journey: Journey = {
  name: 'examen-fallo-de-sesion-no-culpa-a-la-conexion',
  // Alta: no se pierde nada (las respuestas están guardadas), pero la persona acaba de echar
  // una hora, no ve su nota y encima se le da una causa falsa.
  severity: 'high',
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  postDeploy: true,
  async run(ctx) {
    const resultados: InvariantResult[] = []

    // La condición REAL del incidente: el servidor rechaza la corrección por identidad. No es
    // un 500 ni una caída de red — es el matiz que decide qué se le dice al usuario.
    await ctx.injectFault(
      faults.httpStatus('**/api/exam/validate**', 403, {
        success: false,
        error: 'Tu sesión no está activa. Vuelve a entrar para continuar.',
        reason: 'sin_identidad',
      }),
    )

    await ctx.step('abrir un examen', () => ctx.goto(`/${POSITION.replace(/_/g, '-')}/test/tema/1/test-examen?n=5`), { shot: true })
    await ctx.step('aceptar cookies', async () => {
      const b = ctx.page.getByRole('button', { name: /Aceptar todo|Rechazar todo/i }).first()
      if (await b.count()) await b.click({ timeout: 4000 }).catch(() => {})
    })
    await ctx.page.waitForTimeout(4000)

    // Responder lo que haya en pantalla: en modo examen están todas visibles a la vez.
    // Las opciones del modo examen son botones de fila con el texto «A) …», NO los botones
    // cuadrados A/B/C/D del test normal (ese selector, el primero que probé, daba CERO y
    // dejaba el journey «verde por no haber ejercitado nada»). Se responde UNA por pregunta:
    // pinchar las cuatro dejaría marcada la última, que da igual para lo que se mide, pero
    // multiplica las llamadas a /api/exam/answer sin motivo.
    const respondidas = await ctx.step('responder el examen', async () => {
      const primeras = ctx.page.locator('button').filter({ hasText: /^\s*A\)/ })
      const n = await primeras.count()
      for (let i = 0; i < n; i++) {
        await primeras.nth(i).click({ timeout: 3000 }).catch(() => {})
        await ctx.page.waitForTimeout(200)
      }
      return n
    })

    const corregir = await ctx.step('pulsar Corregir Examen', async () => {
      const b = ctx.page.getByRole('button', { name: /Corregir Examen/i }).first()
      if (!(await b.count())) return false
      await b.click({ timeout: 5000 })
      return true
    }, { shot: true })

    if (!respondidas || !corregir) {
      // No se pudo llegar al punto de medida. Se dice, en vez de dar un verde vacío: un
      // journey que no ejercitó nada no prueba nada (misma regla que `resumenBarrida`).
      resultados.push({
        name: 'examen-corregible',
        ok: false,
        detail: `no se llegó a pulsar Corregir Examen (${respondidas} opción(es) respondida(s))`,
      })
      return resultados
    }

    // ── Lo que se mide: QUÉ LEE la persona.
    await ctx.page.waitForTimeout(3000)
    await ctx.screenshot('aviso-tras-fallar-la-correccion')

    const hablaDeConexion = (await ctx.seesText(/comprueba tu conexi[óo]n/i)) > 0
    const diceLaVerdad = (await ctx.seesText(/sesi[óo]n/i)) > 0
    const respuestasASalvo = (await ctx.seesText(/respuestas est[áa]n guardadas/i)) > 0
    const ofreceEntrar = (await ctx.countRole('link', /Volver a entrar/i)) > 0

    resultados.push({
      name: 'no-culpa-a-la-conexion',
      ok: !hablaDeConexion,
      detail: hablaDeConexion
        ? 'la pantalla sigue diciendo «comprueba tu conexión» ante un fallo de SESIÓN — es el bug de rbsc87'
        : undefined,
    })
    resultados.push({
      name: 'nombra-la-causa-real',
      ok: diceLaVerdad,
      detail: diceLaVerdad ? undefined : 'el aviso no menciona la sesión, que es lo que falló',
    })
    resultados.push({
      name: 'le-quita-el-miedo-a-haber-perdido-el-examen',
      ok: respuestasASalvo,
      detail: respuestasASalvo ? undefined : 'no se le dice que sus respuestas están guardadas',
    })
    resultados.push({
      name: 'ofrece-la-salida-que-lo-arregla',
      ok: ofreceEntrar,
      detail: ofreceEntrar ? undefined : 'no hay botón de «Volver a entrar»: callejón sin salida',
    })

    return resultados
  },
}
export default journey
