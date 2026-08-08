// lib/convocatoria/seguimientoFuenteError.cjs — lógica PURA del detector de
// `oposiciones.seguimiento_change_status = 'error'`: el cron de seguimiento FALLA (no llega ni a
// obtener un HTTP 2xx) y hoy eso no lo mira ningún detector. Sin BD, sin red.
//
// ## El hueco que motiva esto (T-564, 05-07/08/2026)
//
// Hay dos detectores hermanos y los dos se declaran EXPLÍCITAMENTE ciegos a este caso:
//   · `seguimientoUrlSalud.cjs` (`seguimiento_url_stale`)   — mira el TEXTO de la URL, no si el
//     fetch tuvo éxito. No decide nada sobre un fallo de red.
//   · `seguimientoVigilable.cjs` (`seguimiento_fuente_ciega`) — su propio comentario dice
//     «Fallos RUIDOSOS: ya visibles como seguimiento_change_status='error' → warn, no duplicar»,
//     y el sweep hace `if (v.severidad !== 'error') continue`, así que el caso `warn` (fetch_error)
//     se DESCARTA siempre — nunca genera un `content_health_finding`.
//
// Los dos parten de que la petición HTTP funciona (200, con o sin contenido útil). Cuando el
// fetch ni siquiera llega a eso —DNS roto, timeout, TLS caído, conexión rechazada, HTTP 4xx/5xx
// antes de leer cuerpo—, `check-seguimiento.service.ts` marca `seguimiento_change_status='error'`
// y AHÍ SE QUEDA: nada vuelve a mirarlo. El cron reintenta cada día y falla cada día, en
// silencio, para siempre. MEDIDO (07/08/2026, vence_lector): 18 oposiciones ACTIVAS en ese
// estado, y de ellas SOLO 3 tenían algún hallazgo de salud relacionado con seguimiento (por
// `seguimiento_url_stale`, que dispara por otro motivo — el patrón del texto de la URL — no
// porque nadie mirara el fallo de red); las otras 15 (83%) no tenían NINGÚN hallazgo de
// seguimiento. Y CERO de las 18 tenían `seguimiento_fuente_ciega`, confirmando por qué: esa
// bandeja descarta el caso `error` a propósito.
//
// ## Por qué la severidad depende de la FASE, no solo de que exista el fallo
//
// No es lo mismo que el cron esté ciego en una oposición sin convocatoria concreta (`oep_aprobada`,
// `sin_oep`) que en una con ficha viva (`convocada`, `inscripcion_abierta`…): en la primera, si
// aparece una convocatoria nueva la detectarán otras capas del radar (PAG, boletines, competidor —
// ver `docs/maintenance/oeps-convocatorias-seguimiento.md`); en la segunda, la ficha YA EXISTE y es
// la que hay que vigilar para sus cambios (aplazamientos, listas, correcciones) — ahí estar ciego
// es indefendible. Mismo criterio de fase que ya usan `seguimientoUrlSalud.procesoConFichaViva` y
// `diagnosticarSeguimientoUrl` (`url_generica` con `procesoEnJuego`), reutilizado aquí, no
// reinventado.
//
// ## Lo que este módulo NO decide (a propósito)
//
// No clasifica el MOTIVO del fallo (WAF, DNS, TLS, 404…) ni sugiere una URL de repuesto: esa
// evidencia vive en `convocatoria_seguimiento_checks.error_message`/`http_status`, que HOY
// devuelve 0 filas para `vence_lector` — la tabla tiene RLS activo (`relrowsecurity=true`) y
// CERO políticas para NINGÚN rol (medido 07/08/2026), la misma clase de bug ya vista en
// `question_lifecycle_history`/`daily_question_usage`/`user_devices`/`test_questions`. Sin esa
// evidencia no se puede afirmar el motivo sin adivinar, así que este detector se limita a hacer
// VISIBLE el hecho — que hoy es 100% invisible — y deja el diagnóstico fino (curl manual contra
// la URL) a quien trabaje la cola. Ficha aparte para el hueco de RLS.
//
// JS plano (no .ts) a propósito: `scripts/health-sweep.cjs` lo requiere con `node` pelado y el
// wrapper `seguimientoFuenteError.ts` lo reexporta → una sola fuente de verdad (misma convención
// que `seguimientoUrlSalud.cjs`/`seguimientoVigilable.cjs`/`lib/backlog/pushGuard.cjs`).

const { procesoConFichaViva } = require('./seguimientoUrlSalud.cjs')

/**
 * Diagnostica una oposición cuyo `seguimiento_change_status` está en `'error'`.
 *
 * @param {object} entrada
 * @param {string|null|undefined} entrada.estadoProceso  `oposiciones.estado_proceso`
 * @param {string|null|undefined} entrada.seguimientoUrl  para el motivo (no se re-evalúa el texto)
 * @returns {{severidad:'error'|'warn', motivo:string}}
 */
function diagnosticarSeguimientoError(entrada) {
  const { estadoProceso, seguimientoUrl } = entrada || {}
  const enJuego = procesoConFichaViva(estadoProceso)
  const url = seguimientoUrl ? ` (${seguimientoUrl})` : ''
  if (enJuego) {
    return {
      severidad: 'error',
      motivo:
        `el cron de seguimiento FALLA al comprobar la seguimiento_url${url} — con la convocatoria ` +
        `viva (estado_proceso='${estadoProceso}') esto nos deja ciegos a sus cambios (aplazamientos, ` +
        'listas, correcciones) mientras el fallo persista; el error no es ruido, nadie más lo mira',
    }
  }
  return {
    severidad: 'warn',
    motivo:
      `el cron de seguimiento FALLA al comprobar la seguimiento_url${url} — sin convocatoria con ` +
      `ficha viva todavía (estado_proceso='${estadoProceso}'), el radar (PAG/boletines/competidor) ` +
      'puede detectar igualmente la convocatoria nueva por otra vía, pero conviene arreglarlo antes ' +
      'de que la convocatoria salga',
  }
}

module.exports = { diagnosticarSeguimientoError }
