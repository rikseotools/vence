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

/** INVARIANTE genérica: una llamada scoped debe ir a la oposición esperada (no anónima). */
export function requestIsScopedTo(url: string | null, positionType: string): InvariantResult {
  const name = 'request_is_scoped'
  return url && url.includes(`positionType=${positionType}`)
    ? pass(name)
    : fail(name, `la llamada no fue scoped a ${positionType} (url=${url ?? 'ninguna'})`)
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
