// lib/sim/invariants.ts
//
// Vence Sim — INVARIANTES de dominio. Aquí vive el juicio que distingue "el app
// respondió 200" de "el app hizo lo CORRECTO". Cada invariante es una función PURA que
// recibe datos ya extraídos (por API o por el DOM) y devuelve un InvariantResult. Son la
// pieza más valiosa del harness: convierten un bug de percepción/estado en una aserción
// determinista. Testeadas en __tests__/sim/invariants.test.ts.

import type { InvariantResult } from './types'

/** Representación mínima de una pregunta servida (ley + artículo). */
export interface ServedQuestion {
  law: string
  article: string
}

/** Selección del usuario: por ley, qué artículos pidió (vacío = ley entera). */
export interface Selection {
  laws: string[]
  articlesByLaw: Record<string, string[]>
}

const pass = (name: string): InvariantResult => ({ name, ok: true })
const fail = (name: string, detail: string): InvariantResult => ({ name, ok: false, detail })

/**
 * INVARIANTE NÚCLEO (bug Alfonso #2): ninguna pregunta servida puede caer fuera de la
 * selección. Para una ley CON artículos elegidos, solo esos artículos; para una ley SIN
 * artículos (entera) o no seleccionada, se comprueba solo la pertenencia a leyes elegidas.
 */
export function questionsWithinSelection(
  questions: ServedQuestion[],
  selection: Selection,
): InvariantResult {
  const name = 'questions_within_selection'
  const lawSet = new Set(selection.laws)
  const violations: string[] = []
  for (const q of questions) {
    if (!lawSet.has(q.law)) {
      // ley no seleccionada (match tolerante: la ley puede venir como "Ley 40/2015")
      const inSel = selection.laws.some(l => q.law.includes(l) || l.includes(q.law))
      if (!inSel) { violations.push(`${q.law}:${q.article} (ley no seleccionada)`); continue }
    }
    const key = selection.laws.find(l => q.law.includes(l) || l.includes(q.law)) ?? q.law
    const arts = selection.articlesByLaw[key]
    if (arts && arts.length > 0 && !arts.map(String).includes(String(q.article))) {
      violations.push(`${q.law}:${q.article} (fuera de [${arts.join(',')}])`)
    }
  }
  return violations.length === 0
    ? pass(name)
    : fail(name, `${violations.length} pregunta(s) fuera: ${violations.slice(0, 5).join('; ')}${violations.length > 5 ? '…' : ''}`)
}

/**
 * INVARIANTE (bug Alfonso #1): tras un blip de red transitorio, la ruta crítica debe
 * RECUPERARSE (reintento) — ni pantalla de error ni cero contenido.
 */
export function recoveredFromBlip(opts: {
  attempts: number
  errorShown: boolean
  contentRendered: boolean
}): InvariantResult {
  const name = 'recovered_from_network_blip'
  if (opts.attempts < 2) return fail(name, `no hubo reintento (intentos=${opts.attempts})`)
  if (opts.errorShown) return fail(name, 'se mostró "Error al cargar" pese al reintento')
  if (!opts.contentRendered) return fail(name, 'no renderizó contenido tras recuperar')
  return pass(name)
}

/** INVARIANTE: los reintentos de red son FINITOS (no cuelgan) — caída sostenida → error controlado. */
export function retriesAreBounded(opts: {
  attempts: number
  expected: number
  errorShownOnSustained: boolean
}): InvariantResult {
  const name = 'retries_are_bounded'
  if (opts.attempts !== opts.expected) return fail(name, `reintentos=${opts.attempts}, esperados=${opts.expected}`)
  if (!opts.errorShownOnSustained) return fail(name, 'caída sostenida no mostró error controlado (posible cuelgue)')
  return pass(name)
}

/**
 * INVARIANTE (bug Alfonso #2, UI): si el usuario mezcla una ley acotada con otra que
 * entra entera, el configurador DEBE avisar (visibilidad del "flood").
 */
export function mixedInclusionIsWarned(opts: {
  hasNarrowed: boolean
  hasWhole: boolean
  warningShown: boolean
}): InvariantResult {
  const name = 'mixed_inclusion_is_warned'
  const shouldWarn = opts.hasNarrowed && opts.hasWhole
  if (shouldWarn && !opts.warningShown) return fail(name, 'estado mixto (acotada + entera) SIN aviso')
  if (!shouldWarn && opts.warningShown) return fail(name, 'aviso mostrado sin estado mixto (falso positivo)')
  return pass(name)
}

/**
 * INVARIANTE (bug MariSol 28/07/2026, feedback 108cc2a8): en el panel "Tu Evolución en esta
 * pregunta", **la cabecera no puede contradecir al intento que el usuario acaba de hacer**.
 *
 * El caso real: respondió bien y la cabecera dijo «Sigues fallando esta pregunta (0/2)»; en otra
 * falló y dijo «¡Progreso! Antes fallaste, ahora acertaste». Las bolitas y el porcentaje SÍ
 * cuadraban con la base de datos —se verificó intento a intento—, así que el usuario ve dos
 * verdades opuestas en el mismo recuadro y la que está mal es la de arriba.
 *
 * Se afirma solo la DIRECCIÓN (acierto/fallo), que es lo que el usuario percibe, y no el texto
 * exacto: los mensajes cambian y esto debe seguir protegiendo igual.
 */
export function evolutionHeaderMatchesLastAttempt(opts: {
  /** Mensaje de la cabecera tal cual se ve en pantalla. */
  headerText: string
  /** ¿El intento que se acaba de responder fue correcto? (verdad del test, no de la UI). */
  lastAttemptCorrect: boolean
}): InvariantResult {
  const name = 'evolution_header_matches_last_attempt'
  const t = (opts.headerText || '').toLowerCase()
  // Mensajes que AFIRMAN acierto en el último intento, y los que afirman fallo.
  const diceAcierto = /ahora (la has )?acertaste|siempre aciertas|la acertaste/.test(t)
  const diceFallo = /sigues fallando|ahora fallaste|siempre fallas/.test(t)
  if (!diceAcierto && !diceFallo) return pass(name) // neutro (primera vez, blanco…): no afirma nada
  if (diceAcierto && !opts.lastAttemptCorrect) {
    return fail(name, `la cabecera dice que acertó pero el intento fue FALLO: "${opts.headerText}"`)
  }
  if (diceFallo && opts.lastAttemptCorrect) {
    return fail(name, `la cabecera dice que falla pero el intento fue ACIERTO: "${opts.headerText}"`)
  }
  return pass(name)
}

/** INVARIANTE genérica: una llamada scoped debe ir a la oposición esperada (no anónima). */
export function requestIsScopedTo(url: string | null, positionType: string): InvariantResult {
  const name = 'request_is_scoped'
  return url && url.includes(`positionType=${positionType}`)
    ? pass(name)
    : fail(name, `la llamada no fue scoped a ${positionType} (url=${url ?? 'ninguna'})`)
}

/**
 * INVARIANTE de ALCANZABILIDAD (bug Manolo, 28/07/2026): un control flotante que se PINTA
 * pero al que no le llegan los clics es peor que uno ausente — el usuario lo ve (o ni eso) y
 * no responde. Pasó con la barra del examen: se pegaba con `top-0` bajo una cabecera también
 * pegajosa y con más `z-index`, así que quedaba DETRÁS: invisible y sorda a los clics. Sus
 * dos quejas ("el reloj no baja", "el botón no funciona") eran ese único fallo.
 *
 * El juicio no es "¿existe en el DOM?" ni "¿está en pantalla?" — las dos cosas eran ciertas
 * mientras estaba roto. Es: en el CENTRO del control, ¿quién recibiría el clic? Por eso el
 * journey pasa aquí el resultado de `elementFromPoint`, no un `isVisible()`.
 *
 * El segundo juicio caza el extremo contrario: un control que HUYE hacia abajo porque se midió
 * mal el hueco de la cabecera (nos pasó al corregirlo: un menú oculto de 457 px empujó los
 * controles a media pantalla). Ahí nadie los tapa, pero están donde no deben. Se juzga contra
 * el borde REAL de la cabecera y no contra un número fijo, porque ese borde cambia con el
 * ancho, con la sesión y con el aviso de convocatoria: "pegado debajo de la cabecera" es el
 * invariante; "a menos de N píxeles" sería una constante que envejece.
 */
export function floatingControlIsReachable(opts: {
  control: string
  /** ¿lo pinta el navegador? (display/visibility/opacity ya resueltos) */
  visible: boolean
  /** qué elemento recibiría el clic en su centro; null = el propio control. */
  occludedBy?: string | null
  /** distancia al borde superior del viewport, si el journey la midió. */
  topPx?: number | null
  /** borde inferior de la cabecera pegajosa, si el journey lo midió. */
  cabeceraBottomPx?: number | null
  /** holgura admitida bajo la cabecera (separación de diseño). */
  margenPx?: number
}): InvariantResult {
  const name = `floating_control_reachable:${opts.control}`
  if (!opts.visible) return fail(name, `"${opts.control}" no se pinta cuando debería estar disponible`)
  if (opts.occludedBy) {
    return fail(name, `"${opts.control}" está tapado por ${opts.occludedBy}: el clic del usuario no le llega`)
  }
  const margen = opts.margenPx ?? 40
  if (typeof opts.topPx === 'number' && typeof opts.cabeceraBottomPx === 'number') {
    const limite = opts.cabeceraBottomPx + margen
    if (opts.topPx > limite) {
      return fail(
        name,
        `"${opts.control}" quedó a ${Math.round(opts.topPx)}px cuando la cabecera acaba en ${Math.round(opts.cabeceraBottomPx)}px ` +
        `(margen ${margen}px): hueco de cabecera mal medido`,
      )
    }
    if (opts.topPx < opts.cabeceraBottomPx - 1) {
      // Solapa la cabecera aunque `elementFromPoint` no lo haya visto (p.ej. porque el centro
      // del control cae justo por debajo del borde): sigue estando medio tapado.
      return fail(
        name,
        `"${opts.control}" empieza a ${Math.round(opts.topPx)}px, por encima del borde de la cabecera (${Math.round(opts.cabeceraBottomPx)}px)`,
      )
    }
  }
  return pass(name)
}

/**
 * INVARIANTE de OBSERVABILIDAD (meta-bug): si el usuario vive un fallo, la observabilidad
 * debió capturarlo. Un fallo visible con CERO eventos = punto ciego (caso Alfonso #1, cuya
 * caída no dejó rastro). Cruza lo que la sim vio con lo que se logueó.
 */
export function failureWasObserved(opts: {
  userVisibleFailure: boolean
  observedEventCount: number
}): InvariantResult {
  const name = 'failure_was_observed'
  if (opts.userVisibleFailure && opts.observedEventCount === 0) {
    return fail(name, 'fallo visible al usuario SIN ningún evento de observabilidad (punto ciego)')
  }
  return pass(name)
}
