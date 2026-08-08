// lib/api/v2/answer-and-save/rutaLenta.ts
//
// Desglose de fases a nivel de RUTA (T-312, ampliación 06/08).
//
// ## El agujero que esto cierra
//
// El 30/07 se instrumentó `validateAndSaveAnswer` (queries.ts) con tres fases —validar/guardar/
// score— y un evento `answer_save_lento` que dispara al 100% cuando esa función tarda >2s. Está
// desplegado (el commit vive en `origin/main` desde el 30/07) y es real: `evaluarFases`/
// `evaluarFasesNombradas` tienen 27 tests y el propio [T-319] reutilizó el núcleo para otro
// endpoint.
//
// Pero **medido el 06/08 contra producción**: `answer_save_lento` lleva **CERO disparos desde que
// se desplegó** (7 días), mientras `request_completed` del mismo endpoint sigue viendo el mismo
// **1,3% de peticiones >2s** que motivó la ficha original (73 de 5.516 muestras en 3 días). Las
// dos cifras juntas demuestran algo, no lo sospechan: el tiempo lento no está dentro de
// `validateAndSaveAnswer` — está ANTES, porque esa función arranca su cronómetro (`tInicio`)
// DESPUÉS de que `app/api/v2/answer-and-save/route.ts` ya haya hecho el auth y las 3 RPCs de
// antifraude en paralelo (`ANTIFRAUD_TIMEOUT_MS = 25000`, con comentario propio en el código:
// "las 3 RPCs antifraude paralelas pueden tardar 10-20s bajo carga BD"). El desglose que existía
// era ciego, por construcción, a la fase que más probablemente domina.
//
// Este módulo añade el desglose que faltaba, a nivel de ruta: auth + antifraude + la llamada
// completa a `validateAndSaveAnswer` (que ya trae su propio desglose interno para cuando ES esa
// fase la que domina). Mismo criterio que el desglose interno — reutiliza `evaluarFasesNombradas`
// en vez de reimplementar la decisión — y mismo criterio de captura: **solo las lentas, al 100%**
// (el mismo sesgo de `request_completed` muestreado al 10% que ya obligó a esa regla la vez
// anterior).
import { evaluarFasesNombradas } from '@/lib/observability/fasesLentas'
import type { ObservableEvent } from '@/lib/observability/sink'

export interface FasesRuta {
  /** `verifyAuth` — normalmente <5ms con JWT local; el candidato menos probable. */
  authMs: number
  /** Las 3 RPCs de antifraude en paralelo + `esFraudeConfirmado`. El candidato que la propia ruta
   *  documenta como capaz de tardar 10-20s bajo carga — el sospechoso principal. */
  antifraudeMs: number
  /** La llamada COMPLETA a `validateAndSaveAnswer`. Si domina, el desglose interno
   *  (`answer_save_lento`, mismo request) dice cuál de validar/guardar/score se lo llevó. */
  guardarTotalMs: number
  /** Total de punta a punta de la ruta, medido desde el inicio del handler. */
  totalMs: number
}

/**
 * Decide si esta petición merece el desglose de ruta y construye el evento a emitir.
 * `null` si no fue lenta — no hay nada que registrar.
 *
 * Pura: no llama a `emit`, no toca reloj. Quien la llama mide con `Date.now()` y emite.
 */
export function construirEventoRutaLenta(
  fases: FasesRuta,
  ctx: { questionId?: string | null; instanceId?: string | null },
): ObservableEvent | null {
  const veredicto = evaluarFasesNombradas(
    {
      auth: fases.authMs,
      antifraude: fases.antifraudeMs,
      guardarTotal: fases.guardarTotalMs,
    },
    fases.totalMs,
  )
  if (!veredicto.lenta) return null

  return {
    source: 'vercel',
    severity: 'warn',
    eventType: 'answer_save_ruta_lenta',
    endpoint: '/api/v2/answer-and-save',
    durationMs: fases.totalMs,
    metadata: {
      authMs: fases.authMs,
      antifraudeMs: fases.antifraudeMs,
      guardarTotalMs: fases.guardarTotalMs,
      totalMs: fases.totalMs,
      dominante: veredicto.dominante,
      pctDominante: veredicto.pctDominante,
      noExplicadoMs: veredicto.noExplicadoMs,
      questionId: ctx.questionId ?? null,
      instanceId: ctx.instanceId ?? null,
    },
  }
}
