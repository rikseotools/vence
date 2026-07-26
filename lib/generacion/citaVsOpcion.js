/**
 * Detección de **CORRECTA PARCIAL**: la opción marcada correcta recoge menos de
 * lo que el enunciado pregunta, y **la propia explicación lo delata** porque su
 * blockquote cita el precepto entero.
 *
 * Es la "señal de alarma" que ya describe §2.2 del manual, convertida en check:
 * *si la cita que aportas como prueba dice más que la opción que marcas correcta,
 * o sobra en la cita o falta en la opción*.
 *
 * ── Por qué hace falta un check propio y no basta `citaTruncada.js` ──
 * Aquel compara la opción contra el ARTÍCULO y solo se dispara si detrás viene una
 * cláusula de una lista cerrada ("salvo", "así como", "siempre que"…). Los tres
 * casos reales de la campaña T-115 (26/07/2026) pasaron ese filtro y aun así eran
 * defecto, porque la continuación era prosa sustantiva corriente:
 *
 *   · art. 28.2 LCSP — la opción paraba antes de *"y promoverán la participación
 *     de la pequeña y mediana empresa…"*, con un enunciado que decía "y además:".
 *   · art. 31.1 a) LCSP — paraba antes de *"en el ejercicio de su potestad de auto
 *     organización, mediante el oportuno acuerdo de encargo"*, es decir, dejaba
 *     fuera el instrumento jurídico con el que se articula la cooperación vertical.
 *   · art. 149.3 LCSP — paraba antes de *"y ello con independencia de que presenten
 *     su oferta en solitario o conjuntamente…"*, que precisa el ámbito (las UTE).
 *
 * Los tres los cazaron auditores LLM, uno por lote. Un juez caro por lote no es un
 * guardarraíl: si la regla se puede mirar sola, va al gate.
 *
 * ── Calibración (banco real, 4.000 explicaciones activas) ──
 * Comparar la opción contra el ARTÍCULO daba 10,5% de aviso — ruido inservible,
 * lleno de enumeraciones y de contenido editorial. Exigir además que **el
 * blockquote incluya la cola omitida** lo baja al **3,9%**, porque ese es el
 * verdadero síntoma: el redactor tenía el texto completo delante y aun así acotó.
 *
 * Es un AVISO, no un error duro: hay condensaciones válidas (§2.2) — omitir una
 * remisión ("en aplicación de lo establecido en el artículo 201") o la cláusula
 * introductoria que ya está en el enunciado no es defecto. Lo que el aviso pide es
 * mirar: **o se acota el enunciado, o se completa la opción.**
 *
 * ⚠️ **LIMITACIÓN DE DISEÑO: este check NO lee el enunciado.** Y el enunciado es
 * justo lo que convierte una opción "parcial" en correcta: si pregunta *"¿con
 * quién se elaboran los mapas?"* o *"¿qué Administración velará…?"*, la opción
 * responde exactamente lo pedido aunque el artículo siga hablando. Medido sobre
 * los 4 lotes propios de la campaña: **7 avisos de 67 preguntas, y 5 eran falsos
 * positivos de ese tipo**; los otros 2 se arreglaron acotando el enunciado.
 * Léelo, por tanto, junto al enunciado — igual que el gate de literalidad, es un
 * filtro de sospechosos, no un veredicto. Un aviso que persiste tras acotar el
 * enunciado es esperable y no hay que "arreglarlo" alargando la opción.
 */

const norm = (t) =>
  String(t || '').replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Colas que son **remisión pura** (metalenguaje). §2.2 las admite como
 * condensación válida: omitir *"en aplicación de lo establecido en el artículo
 * 201"* no cambia la regla que se pregunta, y marcarlas convertiría el aviso en
 * ruido. Caso real adjudicado así en el lote 4 (art. 149.4).
 */
// OJO con `\b` al final de una alternativa que termina en preposición: "en
// aplicación de" NO casaba con "en aplicación **del** artículo 201" porque entre
// "de" y "l" no hay frontera de palabra. Por eso las raíces se cortan antes.
const REMISION_PURA =
  /^,?\s*(en aplicación|de conformidad|conforme a|en los términos|según lo dispuesto|de acuerdo con lo|sin perjuicio de lo dispuesto|a que se refiere|previsto en|regulado en)\b/i

/** Texto del blockquote de la explicación (las líneas que empiezan por `>`). */
function citaDe(explanation) {
  return norm(
    String(explanation || '')
      .split('\n')
      .filter((l) => /^\s*>/.test(l))
      .map((l) => l.replace(/^\s*>\s?/, '').replace(/\*\*/g, ''))
      .join(' ')
  )
}

/**
 * @param {string} explanation Explicación con su blockquote.
 * @param {string} correcta Texto de la opción marcada como correcta.
 * @returns {{aviso:boolean, cola?:string}} `cola` = lo que la cita dice de más,
 *   dentro de la misma frase.
 */
function analizarCitaVsOpcion(explanation, correcta) {
  const cita = citaDe(explanation)
  const op = norm(correcta)
  if (!op || !cita) return { aviso: false }

  const i = cita.indexOf(op)
  if (i < 0) return { aviso: false } // la cita no reproduce la opción: no hay nada que comparar

  const resto = cita.slice(i + op.length)
  // La cita termina donde termina la opción (o cierra frase): abarcan lo mismo.
  if (/^\s*["».:]/.test(resto)) return { aviso: false }

  const fin = resto.search(/[.]/)
  const cola = (fin === -1 ? resto : resto.slice(0, fin)).replace(/["»]/g, '').trim()

  if (cola.length < 25) return { aviso: false } // una coletilla no es una omisión material
  if (/^[a-z]\)/.test(cola)) return { aviso: false } // empieza otra letra del listado, no es cola
  if (REMISION_PURA.test(cola) && cola.length <= 120) return { aviso: false } // metalenguaje

  return { aviso: true, cola }
}

module.exports = { analizarCitaVsOpcion, citaDe }
