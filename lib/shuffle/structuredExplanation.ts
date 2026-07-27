/**
 * Barajar opciones — FASE 2: explicación ESTRUCTURADA por-opción, SIN letras.
 *
 * PROBLEMA que resuelve (ver docs/roadmap/barajar-opciones-fase2-explicaciones-estructuradas.md):
 * el formato §8.1 clava la letra en la explicación ("**Por qué B es correcta:** …",
 * "- **A)** …"). Al barajar las opciones, la letra deja de apuntar a lo mismo → la
 * explicación se rompe. Por eso hoy el 26% letra-anclado NO se puede barajar.
 *
 * SOLUCIÓN: guardar la razón de cada opción keada a la IDENTIDAD de la opción (su
 * índice ORIGINAL en BD, 0=A…4=E), NUNCA a la letra mostrada. La letra (A/B/C/D) es
 * PRESENTACIÓN: se asigna al renderizar, según la posición en la que caiga la opción
 * tras barajar (`option_order`). Así la explicación es shuffle-safe POR CONSTRUCCIÓN:
 * barajar mueve cada opción CON su razón, y `render*` recompone las letras coherentes.
 *
 * Contrato de coordenadas (idéntico a permute.ts):
 *   - índice ORIGINAL = 0=A,1=B,2=C,3=D,4=E tal como están en BD (option_a..option_e).
 *   - option_order[i] = índice ORIGINAL mostrado en la posición i (0=A al render).
 *   - `correctOption` (questions.correct_option) es SIEMPRE en coordenadas ORIGINALES.
 *
 * Este módulo es PURO (sin IO, sin deps). Alimenta:
 *   - serve: renderiza `explanation` desde `explanation_data` + `option_order`.
 *   - migración: `parseLetterFormatExplanation` convierte el §8.1 histórico a estructura.
 *   - generación: el manual manda emitir directamente `explanation_data` (sin letras).
 */

/** Marco de la pregunta: elegir la CORRECTA (default) o la INCORRECTA ("señale la falsa"). */
export type ExplanationFrame = 'select_correct' | 'select_incorrect'

export interface StructuredExplanation {
  /** Versión del esquema. Empieza en 1. */
  v: 1
  /** Texto introductorio independiente de opción (opcional). */
  intro?: string
  /**
   * Cita legal (blockquote). `ref` = "Art. X.Y Norma"; `texto` = cita literal.
   *
   * `bloque` guarda el blockquote ÍNTEGRO (sin el prefijo "> ") y, si está, manda sobre
   * ref/texto al renderizar. Existe porque el par {ref, texto} solo captura el primer
   * **negrita** y el primer "entrecomillado": medido el 27/07 sobre el banco vivo, las citas
   * multilínea —las que desglosan apartados, o las de ofimática con rutas de menú— perdían todo
   * lo demás al migrar (un caso real pasaba de 1.024 a 391 caracteres). Con `bloque` la
   * transcripción es sin pérdida.
   */
  cita?: { ref?: string; texto?: string; bloque?: string }
  /**
   * Razón por opción, keada al índice ORIGINAL como string ("0".."4").
   * DEBE existir una entrada por cada opción presente de la pregunta. La razón se
   * escribe referida al CONTENIDO de la opción, JAMÁS a su letra ("No corresponde al
   * órgano de administración electrónica", no "La A es incorrecta").
   */
  options: Record<string, string>
  /**
   * Texto de cierre independiente de opción (opcional): resúmenes tipo "**Clave:** …"
   * que algunas explicaciones §8.1 llevan TRAS los bullets. Se renderiza al final, fuera
   * de la lista de opciones, para que sobreviva intacto al barajado (si quedara pegado a
   * una opción, al reordenar aparecería en medio de la lista).
   */
  outro?: string
  /** Marco. Default 'select_correct'. */
  frame?: ExplanationFrame
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

/** Índice original (0-4) → letra. */
export function indexToLetter(i: number): string {
  return LETTERS[i] ?? String.fromCharCode(65 + i)
}

/** Letra (A-E, case-insensitive) → índice original (0-4), o -1 si no es letra de opción. */
export function letterToIndex(letter: string): number {
  const i = LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number])
  return i
}

/**
 * ¿Es `data` una StructuredExplanation válida y USABLE para `nOptions` opciones?
 * Exige: v=1, `options` con una razón no vacía por cada índice 0..nOptions-1.
 * Un dato inválido/incompleto ⇒ NO se usa (se cae al `explanation` de texto → seguro).
 */
export function isStructuredExplanation(
  data: unknown,
  nOptions: number
): data is StructuredExplanation {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (d.v !== 1) return false
  if (!d.options || typeof d.options !== 'object') return false
  const opts = d.options as Record<string, unknown>
  for (let i = 0; i < nOptions; i++) {
    const r = opts[String(i)]
    if (typeof r !== 'string' || r.trim() === '') return false
  }
  return true
}

/**
 * Renderiza la explicación en el MISMO formato markdown §8.1 que la UI ya pinta, pero
 * con las letras calculadas desde la posición MOSTRADA (`optionOrder`). Drop-in: la
 * cadena resultante se le pasa al mismo renderer de markdown de hoy — cero cambio de UI.
 *
 * @param data          explicación estructurada (razones keadas a índice ORIGINAL)
 * @param correctOption índice ORIGINAL de la correcta (questions.correct_option)
 * @param optionOrder   permutación mostrada→original; null/undefined ⇒ orden natural
 * @param nOptions      nº de opciones presentes (3 ó 4 normalmente)
 *
 * Invariante clave: la razón de cada opción viaja con ella; la letra del header y de
 * cada bullet corresponde a la POSICIÓN MOSTRADA de esa opción tras barajar.
 */
export function renderStructuredExplanation(
  data: StructuredExplanation,
  {
    correctOption,
    optionOrder,
    nOptions,
  }: { correctOption: number; optionOrder?: number[] | null; nOptions: number }
): string {
  const frame: ExplanationFrame = data.frame ?? 'select_correct'
  // order[i] = índice original en la posición mostrada i. Sin barajar ⇒ identidad.
  const order =
    optionOrder && optionOrder.length === nOptions
      ? optionOrder
      : Array.from({ length: nOptions }, (_, i) => i)

  // Posición MOSTRADA de la opción marcada (correcta o, si frame=incorrect, la falsa).
  const markedDisplayPos = order.indexOf(correctOption)
  const markedLetter = indexToLetter(markedDisplayPos >= 0 ? markedDisplayPos : correctOption)

  const parts: string[] = []
  if (data.intro && data.intro.trim()) parts.push(data.intro.trim())

  if (data.cita && (data.cita.bloque || data.cita.ref || data.cita.texto)) {
    // `bloque` (el blockquote íntegro) manda: reproduce la cita tal cual estaba, incluidas las
    // multilínea. Sin él se recompone desde ref/texto, que es el formato canónico §8.1.
    const lines = data.cita.bloque
      ? data.cita.bloque.split('\n').map((l) => `> ${l}`.trimEnd())
      : [data.cita.ref ? `**${data.cita.ref}**` : '', data.cita.texto ? `"${data.cita.texto}"` : '']
          .filter(Boolean)
          .map((l) => `> ${l}`)
    if (lines.length) parts.push(lines.join('\n'))
  }

  const markedReason = data.options[String(correctOption)] ?? ''
  const headerMarked =
    frame === 'select_incorrect'
      ? `**Por qué ${markedLetter} es la incorrecta:** ${markedReason}`
      : `**Por qué ${markedLetter} es correcta:** ${markedReason}`
  parts.push(headerMarked.trim())

  // Las DEMÁS opciones, en orden MOSTRADO (para que los bullets lean A), B)… saltando
  // la marcada). Cada bullet lleva la letra de su posición mostrada + su razón original.
  const otherHeader =
    frame === 'select_incorrect'
      ? '**Por qué las demás son correctas:**'
      : '**Por qué las demás son incorrectas:**'
  const bullets: string[] = []
  for (let displayPos = 0; displayPos < nOptions; displayPos++) {
    const original = order[displayPos]
    if (original === correctOption) continue
    const reason = data.options[String(original)] ?? ''
    bullets.push(`- **${indexToLetter(displayPos)})** ${reason}`.trimEnd())
  }
  if (bullets.length) parts.push(`${otherHeader}\n${bullets.join('\n')}`)

  if (data.outro && data.outro.trim()) parts.push(data.outro.trim())

  return parts.join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Migración: parsear el §8.1 histórico (letra-anclado) → StructuredExplanation.
// Determinista y CONSERVADOR: si algo no encaja limpiamente devuelve null (esa
// explicación NO se migra por esta vía → queda para la pasada LLM). FN inocuo
// (no se migra), FP peligroso (estructura mal) → ante la duda, null.
// ─────────────────────────────────────────────────────────────────────────────

/** Quita énfasis markdown (* _ ` ~) para casar patrones sobre texto limpio. */
function stripEmphasis(s: string): string {
  return s.replace(/[*_`~]+/g, '')
}

/**
 * Convierte una explicación §8.1 ("**Por qué B es correcta:** … **Por qué las demás
 * son incorrectas:** - **A)** … - **C)** …") a StructuredExplanation.
 *
 * @param explanation  texto markdown almacenado
 * @param correctOption índice ORIGINAL de la correcta (para keaer su razón)
 * @param nOptions      nº de opciones presentes
 * @returns StructuredExplanation si parsea limpio y cubre TODAS las opciones; null si no.
 */
export function parseLetterFormatExplanation(
  explanation: string | null | undefined,
  { correctOption, nOptions }: { correctOption: number; nOptions: number }
): StructuredExplanation | null {
  if (!explanation || !explanation.trim()) return null
  const text = explanation.replace(/\r\n/g, '\n')

  // 2) Razón de la correcta: entre "Por qué <L> (es|no es) correcta/incorrecta:" y
  //    "Por qué las demás". Se aceptan las variantes de cabecera SEGURAS medidas en el
  //    banco real: letra con paréntesis ("A)"), y orden invertido ("Por qué es correcta
  //    la opción C" / "Por qué la opción C es correcta"). El énfasis (**) es opcional.
  const flat = text
  const correctHeaderVariants: RegExp[] = [
    // "Por qué B es correcta" / "Por qué A) es correcta" (letra primero)
    /\*{0,2}\s*Por qu[eé]\s+([A-E])\)?\s+(?:es|son|no es)\s+(?:la\s+)?(?:correct[ao]|incorrect[ao]|falsa|verdadera)\s*:?\s*\*{0,2}/i,
    // "Por qué la opción C es correcta"
    /\*{0,2}\s*Por qu[eé]\s+la\s+(?:opci[óo]n|respuesta|letra)\s+([A-E])\)?\s+(?:es|son|no es)\s+(?:correct[ao]|incorrect[ao]|falsa|verdadera)\s*:?\s*\*{0,2}/i,
    // "Por qué es correcta la opción C"
    /\*{0,2}\s*Por qu[eé]\s+(?:es|son)\s+(?:correct[ao]|incorrect[ao]|falsa|verdadera)\s+(?:la\s+)?(?:opci[óo]n|respuesta|letra)?\s*([A-E])\)?\s*:?\s*\*{0,2}/i,
  ]
  let cm: RegExpMatchArray | null = null
  for (const re of correctHeaderVariants) {
    cm = flat.match(re)
    if (cm && cm.index != null) break
  }
  const demasRe = /\*\*\s*Por qu[eé]\s+las\s+dem[aá]s\b[^*]*\*\*/i
  const dm = flat.match(demasRe)
  if (!cm || cm.index == null) return null
  const correctLetter = cm[1].toUpperCase()
  const correctFromHeader = letterToIndex(correctLetter)
  // La cabecera debe coincidir con correct_option (si no, algo raro → no migrar).
  if (correctFromHeader !== correctOption) return null

  const afterCorrect = flat.slice(cm.index + cm[0].length)
  const demasIdxInAfter = dm && dm.index != null ? flat.slice(cm.index + cm[0].length).search(demasRe) : -1
  const correctReasonRaw =
    demasIdxInAfter >= 0 ? afterCorrect.slice(0, demasIdxInAfter) : afterCorrect
  const correctReason = correctReasonRaw.trim()
  if (!correctReason) return null

  // 3) Bullets de distractores: "- **A)** …" (una por opción distractor).
  const options: Record<string, string> = {}
  options[String(correctOption)] = correctReason

  const demasBlock = dm && dm.index != null ? flat.slice(dm.index + dm[0].length) : ''
  // Bullet de distractor. La letra abre el bullet y DEBE ir seguida de un delimitador
  // EXPLÍCITO —")", ":", ".", "**" o glosa "(…)"— para no confundir contenido que
  // empieza por A/E ("- A veces…"): sin delimitador, no es un bullet de opción → se
  // ignora (y la cobertura fallará → null, seguro). Variantes reales cubiertas:
  //   "- **A)** …" · "- A) …" · "- **A** …" · "- A: …" · "- A (registro): …"
  const bulletRe = /(?:^|\n)\s*[-*]\s*(?:\*\*)?\s*([A-E])\s*(?:\)|:|\.|\*\*|\([^)]*\)[:.]?)\s*(?:\*\*)?\s+/g
  let bm: RegExpExecArray | null
  const bulletStarts: { letter: string; start: number }[] = []
  while ((bm = bulletRe.exec(demasBlock)) !== null) {
    bulletStarts.push({ letter: bm[1].toUpperCase(), start: bm.index + bm[0].length })
  }
  let outro: string | undefined
  for (let k = 0; k < bulletStarts.length; k++) {
    const end = k + 1 < bulletStarts.length ? demasBlock.indexOf('\n', bulletStarts[k + 1].start - 1) : demasBlock.length
    // recorte hasta el inicio del siguiente bullet
    const nextStart =
      k + 1 < bulletStarts.length
        ? // localizar el inicio real del bullet siguiente
          demasBlock.lastIndexOf('\n', bulletStarts[k + 1].start)
        : demasBlock.length
    let reason = demasBlock.slice(bulletStarts[k].start, nextStart >= 0 ? nextStart : end).trim()
    // Cierre tras el ÚLTIMO bullet (p.ej. "**Clave:** …"): un bloque separado por línea
    // en blanco que arranca con un header en negrita → NO es parte de la razón de la
    // opción, es texto independiente. Separarlo a `outro` para que no viaje con la opción.
    if (k === bulletStarts.length - 1) {
      // Sin flag `s` (dotAll): el patrón no contiene `.`, así que `s` no tenía efecto
      // y rompía el typecheck (target ES2017). Comportamiento idéntico sin él.
      const m = reason.match(/\n\s*\n\s*(\*\*[^\n]+)$/)
      if (m && m.index != null) {
        outro = reason.slice(m.index).trim()
        reason = reason.slice(0, m.index).trim()
      }
    }
    const oi = letterToIndex(bulletStarts[k].letter)
    if (oi < 0 || oi >= nOptions) return null
    if (oi === correctOption) return null // un bullet no debe repetir la correcta
    if (reason) options[String(oi)] = reason
  }

  // 4) Cobertura: DEBE haber una razón por cada opción presente. Si falta alguna → null.
  for (let i = 0; i < nOptions; i++) {
    const r = options[String(i)]
    if (!r || !stripEmphasis(r).trim()) return null
  }

  // 4-bis) CITA e INTRO: todo lo que va ANTES de la cabecera de la correcta.
  //
  // La cita se buscaba antes con un bucle desde la línea 0, o sea que **solo la encontraba si el
  // blockquote abría la explicación**. Con un párrafo de contexto delante (que es lo normal en
  // buena parte del banco), la cita se PERDÍA al migrar. Ahora se recorta la zona previa a la
  // cabecera y de ahí salen las dos cosas: las líneas `>` son la cita y el resto es el intro.
  const zonaPrevia = text.slice(0, cm.index)
  const quoteLines = zonaPrevia
    .split('\n')
    .filter((l) => l.trim().startsWith('>'))
    .map((l) => l.trim().replace(/^>\s?/, ''))
  let cita: { ref?: string; texto?: string; bloque?: string } | undefined
  if (quoteLines.length) {
    const joined = quoteLines.join(' ').trim()
    const refMatch = joined.match(/\*\*([^*]+)\*\*/)
    const txtMatch = joined.match(/"([^"]+)"/)
    cita = {
      ref: refMatch ? refMatch[1].trim().replace(/[:：]\s*$/, '') : undefined,
      texto: txtMatch ? txtMatch[1].trim() : undefined,
      bloque: quoteLines.join('\n').trim() || undefined,
    }
    if (!cita.ref && !cita.texto && !cita.bloque) cita = undefined
  }

  // 5) INTRO: el texto en prosa que va ANTES de la cabecera de la correcta y que no es la cita.
  //    Sin esto se PERDÍA al migrar — medido el 27/07 sobre el banco vivo: explicaciones de 1.024
  //    caracteres se renderizaban en 629 porque el párrafo de contexto ("En las bases de datos
  //    relacionales, la terminología de tablas tiene significados precisos.") desaparecía. El
  //    esquema ya tenía el campo `intro` y el render lo emite primero; solo faltaba capturarlo.
  //    Lo cazó la guarda de no-regresión del backfill (render ≠ original ⇒ no se migra), no un
  //    test: la invariante ida-vuelta no lo veía porque lo que se pierde nunca entra.
  const introTexto = zonaPrevia
    .split('\n')
    .filter((l) => !l.trim().startsWith('>'))   // la cita ya está capturada aparte
    .join('\n')
    .trim()
  const intro = introTexto || undefined

  const frame: ExplanationFrame = /incorrect|falsa/i.test(cm[0]) ? 'select_incorrect' : 'select_correct'
  const result: StructuredExplanation = { v: 1, options, frame }
  if (intro) result.intro = intro
  if (cita) result.cita = cita
  if (outro) result.outro = outro
  return result
}
