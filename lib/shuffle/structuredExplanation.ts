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
  /**
   * ESTILO con el que se vuelve a componer el texto. El banco tiene DOS formatos legacy vivos y
   * transcribir uno al otro cambiaría lo que ve el opositor:
   *   · `boletin` (default) — el §8.1 de generación: blockquote + "**Por qué B es correcta:**"
   *     + bullets "- **A)** …". 26.571 preguntas activas.
   *   · `impugnacion` — el §5.1 del manual de impugnaciones: "La respuesta correcta es …" +
   *     un bloque por opción "**A)** CORRECTA/INCORRECTA — …". 13.559 preguntas activas, y es
   *     el que produce CADA corrección de impugnación.
   * En ambos, las razones siguen keadas al índice de la opción: la letra la pone el render.
   */
  estilo?: 'boletin' | 'impugnacion'
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
/**
 * Render del estilo §5.1 (manual de impugnaciones): apertura "La respuesta correcta es la **X**",
 * cita en blockquote y un bloque por opción, en orden MOSTRADO, marcando CORRECTA/INCORRECTA.
 *
 * Las tres cosas las EMITE el render, no el que escribe, y por un motivo: la letra de la apertura
 * y el veredicto de cada opción dependen de DÓNDE queda cada una al barajar. Si los escribiera a
 * mano quien redacta, volveríamos al problema que este formato viene a resolver.
 *
 * ⚠️ Nació incumpliendo su propio docstring en las tres (T-201, cazado por la sesión de
 * impugnaciones al aplicarlo a casos reales): no emitía la apertura, no marcaba los veredictos —así
 * que el texto generado NO pasaba `validar-explicacion.cjs`, que los exige, con dos guardarraíles
 * de la casa contradiciéndose— y **solo leía `cita.bloque`**, de modo que la forma documentada
 * `cita: {ref, texto}` producía un texto SIN cita. La ironía: uno de los casos venía justo de una
 * impugnación por la cita mal transcrita.
 */
function renderEstiloImpugnacion(
  data: StructuredExplanation,
  { correctOption, optionOrder, nOptions }: { correctOption: number; optionOrder?: number[] | null; nOptions: number }
): string {
  const order =
    optionOrder && optionOrder.length === nOptions
      ? optionOrder
      : Array.from({ length: nOptions }, (_, i) => i)
  const partes: string[] = []

  // 1) Apertura con la letra MOSTRADA de la correcta (§5.1 la exige; el validador la comprueba).
  //    Salvo que el `intro` YA la traiga: el histórico transcrito la tiene dentro (era la primera
  //    frase del texto) y añadirla otra vez la duplicaba. Lo nuevo no debe escribirla a mano —el
  //    aplicador lo rechaza— precisamente para que la ponga el render y siga a la opción al barajar.
  const posCorrecta = order.indexOf(correctOption)
  const letraCorrecta = indexToLetter(posCorrecta >= 0 ? posCorrecta : correctOption)
  const introTrim = (data.intro ?? '').trim()
  const introYaAbre = /^la respuesta correcta es/i.test(introTrim)
  if (!introYaAbre) partes.push(`La respuesta correcta es la **${letraCorrecta}**.`)
  if (introTrim) partes.push(introTrim)

  // 2) La cita, desde el bloque íntegro O recompuesta desde ref/texto — como el render de boletín.
  const lineasCita = data.cita?.bloque
    ? data.cita.bloque.split('\n')
    : [data.cita?.ref ? `**${data.cita.ref}**` : '', data.cita?.texto ? `"${data.cita.texto}"` : ''].filter(Boolean)
  if (lineasCita.length) partes.push(lineasCita.map((l) => `> ${l}`.trimEnd()).join('\n'))

  // 3) Un bloque por opción con su VEREDICTO, que lo decide la clave, no la letra.
  for (let pos = 0; pos < nOptions; pos++) {
    const original = order[pos]
    const razon = (data.options[String(original)] ?? '').trim()
    if (!razon) continue
    const veredicto = original === correctOption ? 'CORRECTA' : 'INCORRECTA'
    // Si la razón ya viene con el veredicto escrito (histórico), no se duplica.
    const yaLoTrae = new RegExp(`^\\*{0,2}(CORRECTA|INCORRECTA)\\b`, 'i').test(razon)
    partes.push(yaLoTrae ? `**${indexToLetter(pos)})** ${razon}` : `**${indexToLetter(pos)})** ${veredicto} — ${razon}`)
  }

  if (data.outro && data.outro.trim()) partes.push(data.outro.trim())
  return partes.join('\n\n')
}

export function renderStructuredExplanation(
  data: StructuredExplanation,
  {
    correctOption,
    optionOrder,
    nOptions,
  }: { correctOption: number; optionOrder?: number[] | null; nOptions: number }
): string {
  // El estilo se preserva: transcribir una explicación de impugnación al formato de boletín le
  // cambiaría la cara al opositor, y esto es una transcripción, no un rediseño.
  if (data.estilo === 'impugnacion') {
    return renderEstiloImpugnacion(data, { correctOption, optionOrder, nOptions })
  }
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
/**
 * Parser del formato §5.1 (manual de impugnaciones): "La respuesta correcta es …" seguido de un
 * bloque por opción `**A)** CORRECTA/INCORRECTA — razón`.
 *
 * Existe porque el banco tiene DOS formatos legacy y este lo produce **cada corrección de
 * impugnación**: sin él, el trabajo de impugnaciones seguiría creando explicaciones no
 * transcribibles (13.559 preguntas activas hoy). Devuelve la estructura con `estilo:'impugnacion'`
 * para que el render la reproduzca igual y el opositor no note el cambio.
 */
export function parseImpugnacionFormatExplanation(
  explanation: string | null | undefined,
  { correctOption, nOptions }: { correctOption: number; nOptions: number }
): StructuredExplanation | null {
  if (!explanation || !explanation.trim()) return null
  const text = explanation.replace(/\r\n/g, '\n').trim()
  if (!/^la respuesta correcta es/i.test(text)) return null

  // Un bloque por opción: "**A)** …" hasta el siguiente "**X)**" o el final.
  const RE_OPCION = /\*\*([A-E])\)\*\*/g
  const marcas: { letra: string; ini: number; finCabecera: number }[] = []
  let m: RegExpExecArray | null
  while ((m = RE_OPCION.exec(text)) !== null) {
    marcas.push({ letra: m[1].toUpperCase(), ini: m.index, finCabecera: m.index + m[0].length })
  }
  if (marcas.length < 2) return null

  const options: Record<string, string> = {}
  for (let i = 0; i < marcas.length; i++) {
    const fin = i + 1 < marcas.length ? marcas[i + 1].ini : text.length
    const razon = text.slice(marcas[i].finCabecera, fin).trim()
    const idx = letterToIndex(marcas[i].letra)
    if (idx < 0 || idx >= nOptions) return null
    if (!razon) return null
    if (options[String(idx)]) return null // opción repetida → no migrar
    options[String(idx)] = razon
  }
  // Cobertura completa: si falta la razón de alguna opción presente, no se migra.
  for (let i = 0; i < nOptions; i++) if (!options[String(i)]) return null

  // La marca CORRECTA debe caer en la clave real; si no, el texto y el dato se contradicen y eso
  // es un defecto de contenido, no algo que la transcripción deba consolidar.
  const razonClave = options[String(correctOption)] || ''
  if (!/\bCORRECTA\b/i.test(razonClave)) return null

  const intro = text.slice(0, marcas[0].ini).replace(/^>.*$/gm, '').trim() || undefined
  const bloqueCita = text
    .slice(0, marcas[0].ini)
    .split('\n')
    .filter((l) => l.trim().startsWith('>'))
    .map((l) => l.trim().replace(/^>\s?/, ''))
    .join('\n')
    .trim()

  const out: StructuredExplanation = { v: 1, options, estilo: 'impugnacion' }
  if (intro) out.intro = intro
  if (bloqueCita) out.cita = { bloque: bloqueCita }
  return out
}

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
    // ETIQUETA DESCOLGADA: hay bullets escritos como "- **A) Este equipo:** muestra…", con la
    // etiqueta DENTRO de las negritas del marcador. Al separar marcador y razón, la razón se
    // queda con el cierre de negritas y sin su apertura ("Este equipo:** muestra…"), y el render
    // produce markdown ROTO que el opositor ve tal cual. Medido el 27/07: 503 razones en 186
    // preguntas. Se reequilibra devolviéndole su apertura.
    if (/^[^*]{1,60}:\*\*/.test(reason)) reason = `**${reason}`

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

/**
 * ¿Dos explicaciones dicen LO MISMO, aunque no se escriban igual?
 *
 * Comparador de no-regresión para la transcripción a `explanation_data`. Lo usan el backfill
 * (antes de escribir) y el canary contra BD viva (después), y por eso vive aquí: tenerlo
 * duplicado en los dos sitios garantiza que un día divergen y el canary deja de vigilar lo que
 * el backfill decide.
 *
 * Tolera lo que puede cambiar sin engañar a nadie y NO tolera lo que sí:
 *   · la LETRA de la cabecera y de cada bullet cambia al barajar — es el objetivo del sistema;
 *   · el marcador del bullet puede escribirse `- **A)**` o `- **A**` (1.210 preguntas del banco
 *     usan la segunda forma) y el render emite siempre la canónica;
 *   · el ORDEN de los bullets cambia al reordenar las opciones.
 *   · pero el TEXTO —intro, cita, razones, cierre— tiene que estar entero. Ahí es donde se
 *     colaron las tres pérdidas que cazó la guarda el 27/07.
 */
export function mismoContenidoExplicacion(a: string, b: string): boolean {
  // DOS patrones explícitos, no uno elástico (un solo patrón permisivo empezó a tragarse líneas
  // de texto normal que arrancan por "A." y rompió más de lo que arreglaba):
  //   · con viñeta  — "- **A)** …", "- **A** …", "* **A**: …"   (estilo §8.1)
  //   · sin viñeta  — "**A)** …" al principio de línea            (estilo §5.1, impugnaciones)
  // El segundo hace falta porque el bloque por opción del formato de impugnaciones no lleva
  // viñeta: sin reconocerlo, esos bloques se comparaban como texto corrido y al barajar —que los
  // reordena— el canary los daba por texto cambiado (40 falsos fallos, 27/07).
  const RE_BULLETS = [
    /^\s*[-*]\s*(?:\*\*)?\s*([A-E])\s*(?:\)|:|\.)?\s*(?:\*\*)?\s*(.*)$/,
    /^\s*\*\*\s*([A-E])\s*\)\s*\*\*\s*(.+)$/,
  ]
  const norm = (s: string) =>
    (s || '')
      .replace(/Por qu[eé]\s+[A-E]\s+(es|no es)/gi, 'Por qué <L> $1')
      // Los asteriscos son FORMATO, no contenido: al reequilibrar la etiqueta descolgada
      // ("Este equipo:**" → "**Este equipo:**") el texto dice exactamente lo mismo y solo cambia
      // el énfasis. Compararlos haría saltar el canary por un arreglo de markdown.
      .replace(/\*+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const trocear = (texto: string) => {
    const bullets: string[] = []
    const resto: string[] = []
    for (const linea of (texto || '').replace(/\r\n/g, '\n').split('\n')) {
      const m = RE_BULLETS.reduce<RegExpMatchArray | null>((acc, re) => acc || linea.match(re), null)
      // Un bullet de verdad tiene contenido tras la letra; si no, es texto normal.
      if (m && m[2] && m[2].trim()) bullets.push(norm(m[2]))
      else resto.push(linea)
    }
    return { bullets: bullets.sort().join('␟'), resto: norm(resto.join(' ')) }
  }
  const x = trocear(a)
  const y = trocear(b)
  return x.resto === y.resto && x.bullets === y.bullets
}
