/**
 * lib/shuffle/subsetOrder.ts — servir MENOS opciones de las que tiene la pregunta (T-267).
 *
 * ## Por qué
 *
 * Pilar Martín (feedback `ed09cf73`, 28/07/2026) prepara el Ayuntamiento de Madrid, cuyo
 * examen es de TRES opciones, y nos avisó de que servimos cuatro: *«¿hay alguna opción
 * para elegir que haya tres?»*. No la había. Y el dato correcto estaba en casa desde
 * siempre — `oposiciones.examen_config.opciones = 3` — pero solo lo leía la landing.
 *
 * ## Cómo, sin tocar el banco
 *
 * Servir "la correcta + 2 distractores" es la MISMA operación que barajar: elegir qué
 * opciones se muestran y en qué orden. El motor de barajado ya guarda en
 * `test_questions.option_order` lo que vio el usuario, así que basta con que ese `order`
 * pueda ser un SUBCONJUNTO en vez de una permutación completa. Ni una pregunta se
 * reescribe.
 *
 * ## La trampa que hay que evitar
 *
 * `isValidOrder` (permute.ts) exige `order.length === n`. Un subconjunto [2,0,3] sobre 4
 * opciones lo suspendería, la validación lo trataría como null → identidad, y corregiría
 * la posición MOSTRADA contra la clave ORIGINAL: exactamente el fallo que marcó 56
 * aciertos como error en el piloto de Valencia. Por eso aquí va `isValidDisplayOrder`,
 * que admite longitud ≤ n, y las dos implementaciones del endpoint de respuesta la usan.
 *
 * Diseño y condiciones no negociables: ficha T-267 en docs/roadmap/tareas-pendientes.md.
 */

/** Hash determinista de string → uint32 (FNV-1a). Copia local: sin dependencias. */
function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** PRNG determinista sembrado (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Orden de exposición con SOLO `target` opciones de las `n` que tiene la pregunta.
 *
 * Garantías (las tres importan y están testeadas):
 *  1. La correcta SIEMPRE está incluida — servir una pregunta sin respuesta válida sería
 *     peor que servirla con una opción de más.
 *  2. Los distractores se eligen de forma reproducible dentro de la request (mismo
 *     `nonce` → mismo resultado), como en `permutationFor`.
 *  3. La correcta NO queda siempre en la misma posición: el subconjunto se baraja después
 *     de elegirlo. Sin esto, el opositor aprendería la posición en vez de la materia.
 *
 * Devuelve `null` cuando no se puede reducir con seguridad (target inválido, la correcta
 * fuera de rango, o no hay distractores suficientes). El llamador sirve natural: reducir
 * es una mejora, nunca un motivo para degradar una pregunta.
 */
export function subsetOrderFor(
  questionId: string,
  nonce: string,
  n: number,
  target: number,
  correctOption: number,
): number[] | null {
  if (!Number.isInteger(n) || !Number.isInteger(target) || !Number.isInteger(correctOption)) return null
  if (target < 2 || target >= n) return null // 1 opción no es una pregunta; ≥ n no reduce nada
  if (correctOption < 0 || correctOption >= n) return null

  const rand = mulberry32(hashString(`${questionId}::${nonce}::subset${target}`))

  // Distractores disponibles, barajados de forma determinista (Fisher-Yates).
  const distractores: number[] = []
  for (let i = 0; i < n; i++) if (i !== correctOption) distractores.push(i)
  if (distractores.length < target - 1) return null
  for (let i = distractores.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[distractores[i], distractores[j]] = [distractores[j], distractores[i]]
  }

  // La correcta + los distractores elegidos, y se baraja el conjunto resultante para que
  // la correcta no caiga siempre en el mismo sitio.
  const elegidos = [correctOption, ...distractores.slice(0, target - 1)]
  for (let i = elegidos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[elegidos[i], elegidos[j]] = [elegidos[j], elegidos[i]]
  }
  return elegidos
}

/**
 * ¿Es `order` un orden de exposición válido sobre `n` opciones?
 *
 * Admite tanto una permutación completa como un SUBCONJUNTO (longitud ≤ n). Reemplaza a
 * `isValidOrder` en la validación de respuestas: con la versión estricta, un subconjunto
 * se tomaría por corrupto y la respuesta se corregiría contra la clave equivocada.
 */
export function isValidDisplayOrder(order: unknown, n: number): order is number[] {
  if (!Array.isArray(order)) return false
  if (order.length < 1 || order.length > n) return false
  const vistos = new Set<number>()
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= n || vistos.has(v)) return false
    vistos.add(v)
  }
  return true
}

/**
 * Máximo de opciones que puede tener una pregunta en el banco (A-E en `questions`).
 * Es el techo de los índices ORIGINALES a los que puede apuntar un orden de exposición.
 */
export const MAX_OPCIONES_BANCO = 5

/**
 * Validación del orden tal y como llega al RESPONDER, que es donde importa de verdad.
 *
 * El matiz que se paga caro si se ignora: el cliente manda las opciones que VIO (3 si se
 * sirvieron 3), pero los índices del orden apuntan a las opciones ORIGINALES de la
 * pregunta (0-3 de un banco de 4). Validar los índices contra el número de opciones
 * mostradas rechazaría todo subconjunto legítimo → se trataría como identidad → se
 * corregiría la posición mostrada contra la clave original. Ese es exactamente el fallo
 * que marcó 56 aciertos como error en el piloto.
 *
 * Por eso aquí se comprueban dos cosas distintas:
 *   · la LONGITUD contra lo que el usuario vio (`mostradas`), y
 *   · los VALORES contra el techo del banco (A-E), no contra lo mostrado.
 */
export function isValidExposureOrder(
  order: unknown,
  mostradas: number,
  maxOriginales: number = MAX_OPCIONES_BANCO,
): order is number[] {
  if (!Array.isArray(order)) return false
  if (order.length !== mostradas) return false
  const vistos = new Set<number>()
  for (const v of order) {
    if (!Number.isInteger(v) || v < 0 || v >= maxOriginales || vistos.has(v)) return false
    vistos.add(v)
  }
  return true
}

/**
 * Frases que impiden quitar una opción: "todas las anteriores", "ninguna de las
 * anteriores" y variantes. Si se elimina una opción, esas dejan de significar lo mismo y
 * la pregunta pasa a ser incorrecta, no solo más corta.
 *
 * Es una de las condiciones no negociables de la ficha (317 preguntas solo en Madrid).
 */
const RE_REFERENCIA_AL_CONJUNTO =
  /\b(todas|ninguna|ambas|todos|ninguno)\b[^.]{0,30}\b(las|los)?\s*(anteriores|respuestas|opciones|son correctas|son ciertas|son verdaderas|es correcta)\b|\bson correctas\b|\bson ciertas\b|\bninguna es correcta\b|\bA y B\b|\bB y C\b/i

/** ¿Alguna opción se refiere al conjunto de opciones? Entonces no se puede recortar. */
export function tieneOpcionQueDependeDelConjunto(options: string[]): boolean {
  return options.some((o) => RE_REFERENCIA_AL_CONJUNTO.test(String(o || '')))
}

/**
 * Nº de opciones con el que examina una oposición, leído de `examen_config`.
 *
 * El campo puede estar en la raíz (`{opciones: 3}`) o dentro de cada parte del ejercicio
 * (`{partes:[{opciones:3}, …]}`). Cuando las partes discrepan se devuelve `null`: mejor
 * servir como siempre que recortar media oposición con el número de la otra mitad.
 *
 * PURA: es el dato que ya existía y que nadie leía al servir. Aquí se lee una sola vez y
 * de una sola forma, para que no vuelva a haber dos verdades.
 */
export function opcionesDeExamen(examenConfig: unknown): number | null {
  if (!examenConfig || typeof examenConfig !== 'object') return null
  const cfg = examenConfig as { opciones?: unknown; partes?: Array<{ opciones?: unknown }> }

  const raiz = Number(cfg.opciones)
  if (Number.isInteger(raiz) && raiz >= 2 && raiz <= 5) return raiz

  if (Array.isArray(cfg.partes)) {
    const valores = cfg.partes
      .map((p) => Number(p?.opciones))
      .filter((v) => Number.isInteger(v) && v >= 2 && v <= 5)
    if (valores.length === 0) return null
    const unico = new Set(valores)
    if (unico.size === 1) return valores[0]
    return null // partes con distinto número de opciones → no reducir
  }
  return null
}
