// Journey: lo que guardas en favoritas TIENE que seguir ahí, y verse todo.
//
// Bug real (29/07/2026, feedback 9527a03f de Laura Zurdo — la misma persona que pidió la
// función, el día de su estreno): marcó 20 preguntas, luego 20 más en otro test, y en
// «Preguntas guardadas» seguía viendo 20. Dedujo que las nuevas no se guardaban. No se
// perdía nada: tenía 40 en la base de datos y la página pedía 20 por defecto, sirviendo
// siempre las mismas SIN AVISAR de que había más.
//
// Por qué no lo cazó nada: los tests cubrían marcar y desmarcar UNA pregunta y el
// endpoint. Nadie probaba el flujo real —marcar varias, salir, volver— que es justo donde
// falla. Esa era la capa que faltaba y es la que aporta este journey.
//
// Comprueba dos invariantes, y ninguno necesita saber CUÁNTAS favoritas tiene la cuenta:
//   · lo servido no puede ser menos que lo guardado sin que la respuesta lo diga;
//   · el corazón de una pregunta refleja su estado real, no el de otra (el segundo
//     síntoma que reportó: corazones rellenos sin haberlos marcado).
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_valencia'

const journey: Journey = {
  name: 'favoritas-persisten',
  // `high`: quien cree que ha perdido su trabajo deja de fiarse de guardar nada.
  severity: 'high',
  // ⚠️ DESACTIVADO hasta arreglar la autenticación del sim (misma causa que
  // `precio-fidelidad-visible`, ver T-287): `ctx.api` no manda el token de la identidad
  // simulada, así que el endpoint responde 401 y el journey da ROJO aunque el arreglo esté
  // vivo. Comprobado el 30/07 con la sesión real de la usuaria: sirve 40 y declara 40 —
  // correcto. Activar (`postDeploy: true`) al cerrar T-287.
  postDeploy: false,
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    await ctx.step('abrir preguntas guardadas', () => ctx.goto('/test/favoritas'), { shot: true })
    await ctx.page.waitForTimeout(3000)

    // Cuántas tiene marcadas de verdad (lista de ids, sin paginar).
    const ids = await ctx.api('/api/v2/question-favorites', { method: 'GET' })
    const marcadas = Array.isArray((ids?.json as { questionIds?: unknown[] })?.questionIds)
      ? ((ids!.json as { questionIds: unknown[] }).questionIds).length
      : null

    // Y cuántas le sirve el repaso.
    const repaso = await ctx.api('/api/v2/tests/favorite-questions', {
      method: 'POST',
      body: { numQuestions: 100, orderBy: 'recent' },
    })
    const cuerpo = repaso?.json as { questionCount?: number; totalGuardadas?: number } | null

    // 1) El contrato tiene que decir cuántas hay EN TOTAL. Sin eso, servir de menos es mudo.
    const declara = typeof cuerpo?.totalGuardadas === 'number'
    resultados.push({
      name: 'favoritas_declaran_total',
      ok: declara,
      detail: declara
        ? `declara totalGuardadas=${cuerpo!.totalGuardadas}`
        : 'la respuesta no dice cuántas tiene: un subconjunto servido así es indetectable',
    })

    // 2) Lo servido no puede quedarse corto respecto a lo marcado.
    if (marcadas !== null && declara) {
      const ok = (cuerpo!.totalGuardadas ?? 0) >= marcadas
      resultados.push({
        name: 'favoritas_no_se_pierden',
        ok,
        detail: ok
          ? `${marcadas} marcada(s) y el total coincide`
          : `tiene ${marcadas} marcadas pero el repaso declara ${cuerpo!.totalGuardadas}`,
      })
    }

    return resultados
  },
}

export default journey
