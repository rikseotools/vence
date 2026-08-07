// lib/api/syntheticTrust.ts
// Tráfico sintético de CONFIANZA — el que además de decir que es un canary, lo demuestra.
//
// POR QUÉ EXISTE (hallazgo 29/07/2026):
//   `isSyntheticRequest` (lib/api/syntheticRequest.ts) reconoce a los canaries por el header
//   `x-vence-canary`, que NO lleva secreto. Su propia documentación dice que eso es inofensivo
//   porque el marcador "solo se usa para DEGRADAR observabilidad, NUNCA para conceder acceso ni
//   saltar validaciones". Esa premisa dejó de ser cierta: `/api/questions/filtered` lo usaba
//   para EXIMIR del reto anti-scraping, así que cualquiera que escribiera esa línea en su
//   petición descargaba preguntas sin pasar el Turnstile. Comprobado contra producción:
//     sin header → 403 {"challengeRequired":true}
//     con header → 200 {"success":true,"questions":[…]}
//
//   La distinción que faltaba: **afirmar** que eres un canary (barato, falsificable, vale para
//   no ensuciar logs) frente a **demostrarlo** (con un secreto compartido, que es lo mínimo
//   para saltarse una defensa).
//
// CÓMO:
//   El canary manda `x-vence-canary-secret: <secreto>`. El secreto ya existe en los dos lados
//   (los canaries del backend usan `CRON_SECRET` para hablar con endpoints internos), así que
//   esto no añade infraestructura nueva; `CANARY_SECRET` permite separarlo el día que interese.
//
// LÍMITE DELIBERADO:
//   Esto NO autentica a un usuario ni concede datos que la sesión no tuviera: solo evita el
//   reto anti-bot a tráfico interno. Todo lo demás (auth, plan, scope) sigue igual.

/** Forma mínima de request: acceso a headers.get(). */
type HeaderReadable = {
  headers?: { get?: (name: string) => string | null } | null
} | null | undefined

export const CABECERA_CANARY_SECRETO = 'x-vence-canary-secret'

/**
 * Cabecera SEPARADA (T-381, 07/08/2026) para eximir SOLO de la contabilización en
 * `daily_questions_served`, sin eximir del reto anti-scraping.
 *
 * Hace falta porque hay canaries que necesitan las DOS cosas a la vez y son
 * contradictorias con una sola cabecera: `canary-questions-gate` (T-280) comprueba que el
 * gate NO reta a un usuario normal, así que su sonda «real» manda `x-vence-canary` pero A
 * PROPÓSITO se queda SIN `x-vence-canary-secret` — si lo mandara, `canaryDeConfianza` sería
 * `true` y dejaría de probar el camino real (que es justo lo que esa sonda existe para
 * comprobar). El coste es que esa misma petición, sin ninguna exención, se contaba en
 * `daily_questions_served` como si fuera un opositor: tráfico sintético (numQuestions=1 por
 * sonda) envenenando el ratio respondidas/servidas del detector de cosecha (medido: exactamente
 * ese patrón — "2 servidas de un usuario smoke" — es lo que el canario `served-rollup` venía
 * denunciando).
 *
 * Con esta cabecera esa sonda puede DEMOSTRAR que es un canario (mismo secreto compartido,
 * igual de infalsificable) sin que eso decida si se le reta o no.
 */
export const CABECERA_CANARY_METRICAS_SECRETO = 'x-vence-canary-metrics-secret'

/**
 * Comparación en tiempo constante. Sin esto, comparar con `===` filtra por el tiempo de
 * respuesta cuántos caracteres iniciales acertaste, y un secreto se puede adivinar a base de
 * medir. Es barato hacerlo bien.
 */
export function comparacionSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Común a las dos cabeceras: sin secreto configurado o sin coincidencia, no hay exención. */
function tieneSecretoValido(
  request: HeaderReadable,
  cabecera: string,
  secretoEsperado?: string | null,
): boolean {
  if (!secretoEsperado || secretoEsperado.length < 16) return false
  const enviado = request?.headers?.get?.(cabecera)
  if (!enviado) return false
  return comparacionSegura(enviado, secretoEsperado)
}

/**
 * ¿La petición viene de monitorización interna que PUEDE demostrarlo?
 *
 * Devuelve `false` si no hay secreto configurado: sin secreto no hay forma de distinguir a un
 * canary de un scraper, y ante la duda se protege (el canary se pondrá rojo y alguien lo mirará;
 * lo contrario sería abrir el banco de preguntas en silencio).
 */
export function esCanaryDeConfianza(request: HeaderReadable, secretoEsperado?: string | null): boolean {
  return tieneSecretoValido(request, CABECERA_CANARY_SECRETO, secretoEsperado)
}

/**
 * ¿Debe excluirse esta petición de las MÉTRICAS anti-cosecha (`daily_questions_served`)?
 *
 * Más laxo que `esCanaryDeConfianza` A PROPÓSITO — es el punto entero de esta función: un
 * canary que demuestra su identidad SOLO para fines de medición (`CABECERA_CANARY_METRICAS_SECRETO`)
 * queda fuera del ratio anti-cosecha aunque siga sujeto al reto anti-scraping como un usuario
 * cualquiera. Todo el que ya demuestra ser canary de confianza (`esCanaryDeConfianza`) también
 * cuenta, claro — ya demostró más de lo que aquí se pide.
 */
export function esCanaryParaMetricas(request: HeaderReadable, secretoEsperado?: string | null): boolean {
  return (
    esCanaryDeConfianza(request, secretoEsperado) ||
    tieneSecretoValido(request, CABECERA_CANARY_METRICAS_SECRETO, secretoEsperado)
  )
}

/** El secreto que se espera, con el de los crons como respaldo mientras no se separen. */
export function secretoCanaryEsperado(env: Record<string, string | undefined>): string | null {
  return env.CANARY_SECRET || env.CRON_SECRET || null
}
