'use strict'
// lib/convocatoria/notasRecorte.cjs — NÚCLEO PURO: recortar el texto que se le manda al LLM en
// `detect_notas` a lo que de verdad puede contener la respuesta.
//
// ## Por qué existe (26/07/2026)
//
// `detect_notas` es el mayor consumidor de saldo: **11.398 tokens de entrada de media para 349 de
// salida — 33 a 1**. Le manda al modelo la página de seguimiento entera (8.000 chars) más cada
// nota (8.000 chars cada una, hasta 60.000), para que devuelva un JSON con seis campos: versiones
// de software, fecha de examen, criterio de versión, material permitido, penalización y
// aclaraciones. **La inmensa mayoría de ese texto no puede contener ninguno de esos seis datos.**
//
// Recortar antes de llamar es la palanca grande y **es independiente del modelo**: baja el coste
// igual con Haiku que con Kimi, y además reduce latencia y el riesgo de que el dato bueno se
// pierda entre 60.000 caracteres de ruido.
//
// ## Cómo recorta (y por qué así)
//
// Conserva los PÁRRAFOS que contienen una señal de los datos que se extraen, con una ventana de
// contexto alrededor —una fecha suele estar en la frase de al lado, no en la misma—. Nunca
// reordena ni reescribe: recorta y une con un marcador visible, para que el modelo sepa que hay
// huecos y no invente continuidad.
//
// **Fail-safe:** si no encuentra ninguna señal, devuelve el principio del texto tal cual (mejor
// mandar algo que arriesgarse a perder un dato en un documento con formato inesperado). Y nunca
// devuelve más de lo que recibió.
//
// ## Por qué por FRASES y no por párrafos (medido, no supuesto)
//
// La primera versión recortaba por párrafos y sobre los documentos REALES del hub bajaba… un 7%.
// La causa: los PDF oficiales llegan extraídos como bloques enormes sin estructura de párrafo, así
// que conservar un bloque es conservar casi todo. Afinar las señales lo empeoraba (1%), que es la
// pista de que el problema no eran las señales sino la unidad de corte. Por frases, con una
// ventana de ±1, el recorte es del **61%** sobre esos mismos 40 documentos.

// Señales de los seis campos que el prompt pide. Deliberadamente generosas: el coste de incluir
// un párrafo de más es despreciable; el de perder la única frase que fija la versión de Windows,
// no. Las tildes van opcionales porque los PDFs oficiales las pierden con frecuencia.
const SENALES = [
  // versiones de software
  /windows|office|word|excel|access|outlook|powerpoint|libreoffice|microsoft\s*365|ofim[aá]tica|versi[oó]n/i,
  // fecha y lugar del ejercicio
  /fecha|d[ií]a\s+\d|examen|ejercicio|celebrar[aá]|convocatoria\s+del?\s+(primer|segundo)|llamamiento/i,
  // material permitido
  /material|calculadora|diccionario|permitid|prohibid|aportar|documentaci[oó]n\s+identificativa/i,
  // penalización y corrección
  /penaliza|descuenta|acierto|error|respuesta\s+err[oó]nea|f[oó]rmula|puntuaci[oó]n|reserva/i,
  // temario y programa (afectan al contenido de las preguntas)
  /temario|programa|anexo|tema\s+\d|bloque/i,
]

/**
 * Trocea en FRASES (no en párrafos): los documentos del hub llegan como bloques enormes sin
 * estructura, así que la frase es la única unidad con la que el recorte muerde de verdad.
 * Se corta por punto/punto y coma/dos puntos y por saltos de línea.
 */
function trocear(texto) {
  const t = String(texto || '')
  if (!t.trim()) return []
  return t.split(/(?<=[.;:])\s+|\n+/).filter((x) => x.trim().length > 1)
}

/**
 * Recorta el texto conservando lo que puede contener los datos que extrae `detect_notas`.
 *
 * @param {string} texto
 * @param {{maxChars?:number, cabecera?:number, ventana?:number}} [opts]
 *   maxChars  tope duro del resultado (por defecto 8.000, el mismo que usaba el prompt)
 *   cabecera  chars iniciales que se conservan siempre (contexto: de qué documento hablamos)
 *   ventana   párrafos de contexto que se conservan alrededor de cada señal
 * @returns {{texto:string, recortado:boolean, charsAntes:number, charsDespues:number, bloques:number}}
 */
function recortarParaNotas(texto, opts) {
  const o = opts || {}
  const maxChars = o.maxChars == null ? 8000 : o.maxChars
  const cabecera = o.cabecera == null ? 400 : o.cabecera
  const ventana = o.ventana == null ? 1 : o.ventana
  const original = String(texto || '')
  const charsAntes = original.length
  if (!charsAntes) return { texto: '', recortado: false, charsAntes: 0, charsDespues: 0, bloques: 0 }

  const bloques = trocear(original)
  if (!bloques.length) {
    const corte = original.slice(0, maxChars)
    return { texto: corte, recortado: corte.length < charsAntes, charsAntes, charsDespues: corte.length, bloques: 0 }
  }
  const relevante = new Set()
  bloques.forEach((b, i) => {
    if (!SENALES.some((re) => re.test(b))) return
    for (let j = Math.max(0, i - ventana); j <= Math.min(bloques.length - 1, i + ventana); j++) {
      relevante.add(j)
    }
  })

  // Sin señales: no se recorta a ciegas — se devuelve el principio, que es donde suele estar el
  // encabezado con la información del documento.
  if (relevante.size === 0) {
    const corte = original.slice(0, maxChars)
    return { texto: corte, recortado: corte.length < charsAntes, charsAntes, charsDespues: corte.length, bloques: 0 }
  }

  const indices = [...relevante].sort((a, b) => a - b)
  const partes = []
  // La cabecera siempre entra: sitúa al modelo (de qué convocatoria/nota se habla).
  if (cabecera > 0 && indices[0] !== 0) partes.push(original.slice(0, cabecera))
  let anterior = -2
  for (const i of indices) {
    // Marcador explícito de hueco: el modelo debe saber que el texto NO es continuo, para no
    // encadenar frases que en el original estaban a 20 páginas de distancia.
    if (i > anterior + 1 && partes.length) partes.push('[…]')
    partes.push(bloques[i])
    anterior = i
  }
  let salida = partes.join(' ')
  if (salida.length > maxChars) salida = `${salida.slice(0, maxChars)}\n[…]`
  // Nunca devolver más de lo que había.
  if (salida.length >= charsAntes) {
    return { texto: original.slice(0, maxChars), recortado: charsAntes > maxChars, charsAntes, charsDespues: Math.min(charsAntes, maxChars), bloques: indices.length }
  }
  return { texto: salida, recortado: true, charsAntes, charsDespues: salida.length, bloques: indices.length }
}

module.exports = { SENALES, recortarParaNotas }
