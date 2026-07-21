// lib/convocatoria/examenPasadoEnTexto.cjs — detecta textos libres (landing_faqs,
// landing_description) que anuncian un examen como VIGENTE con una fecha que YA PASÓ.
//
// ## El punto ciego que cubre (21/07/2026)
//
// El badge de rollover cuenta oposiciones con `exam_date` (vista) pasada. Pero los TEXTOS
// libres pueden seguir diciendo "¿Cuándo es el examen? El 18 de abril de 2026" aunque
// `exam_date` esté null o correcto → el badge no lo caza y el opositor lee una fecha pasada
// como si fuera la próxima. Apareció 3 veces en dos días (Seguridad Social y Osakidetza en
// T-062; celador-sescam-clm en T-061). No es anécdota: es un punto ciego del badge.
//
// ## Por qué está calibrado así (la lección de siempre)
//
// La detección naive —"cualquier fecha pasada cerca de la palabra examen"— da 32 casos, la
// mayoría RUIDO: fechas de plazo ("el plazo cerró el 10 de junio"), de publicación ("la
// convocatoria se publicó el 29/12"), de resultados, o históricos correctos ("el examen SE
// CELEBRÓ el 20 de junio"). Marcar todo eso reproduce el error de hash_change. Con las tres
// condiciones de abajo, los 32 se reducen a ~5 casos de ENGAÑO real, todos verdaderos.
//
// El detector marca SOLO el engaño (examen presentado como vigente/futuro con fecha pasada),
// NO el histórico redactado en pasado, que es informativo y correcto. La corrección nunca es
// automática: reescribir el texto exige verificar el estado real de la oposición (¿pivotó? ¿a
// qué ciclo?) contra fuente oficial.

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

// Contexto que indica que la fecha es de un EXAMEN (no de otra fase).
const ES_EXAMEN = /\b(examen|ejercicio|prueba)\b/i
// La fecha va con OTRA cosa (plazo/publicación/resultados) → no es fecha de examen.
const NO_EXAMEN = /plazo|solicitud|inscripci|se public|publicad|publicaron|cerr[óo]|finaliz|resultado|lista|admitid|nombramiento/i
// Redacción que presenta el examen como VIGENTE/futuro (engaña si la fecha ya pasó).
const VIGENTE = /\b(es el|es la|ser[áa]|tendr[áa] lugar|se celebrar[áa]|previsto para|prevista para|convocado para|convocada para|examen el|examen es|fecha del examen|se realizar[áa])\b/i
// Redacción PASADA (histórico correcto, NO se marca).
// OJO: nada de `\b` justo después de una vocal acentuada ("celebr[óo]\b"): en regex JS sin flag
// unicode, "ó" no es carácter \w, así que el word-boundary NO salta y "celebró su examen" se
// colaba como si fuera vigente (hueco real detectado en tcae-sescam). Se usan límites por
// espacio/inicio en su lugar.
const PASADO = /(^|\s)se celebr[óo]|(^|\s)celebr[óo]|celebrad[oa]|tuvo lugar|se realiz[óo]|realizad[oa]|ya (se )?celebr|examen fue/i

/** Extrae fechas ISO de un texto: "DD de MMMM de YYYY" y "DD/MM/YYYY". */
function extraerFechas(txt) {
  const out = []
  const re1 = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(20\d\d)/gi
  for (const m of txt.matchAll(re1)) {
    out.push({ iso: `${m[3]}-${String(MESES[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`, idx: m.index })
  }
  const re2 = /(\d{1,2})\/(\d{1,2})\/(20\d\d)/g
  for (const m of txt.matchAll(re2)) {
    out.push({ iso: `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`, idx: m.index })
  }
  return out
}

/**
 * ¿Este texto anuncia un examen como vigente con una fecha ya pasada?
 * @param {string} texto  un fragmento (una FAQ "pregunta respuesta", o landing_description)
 * @param {string} hoyIso fecha de hoy en ISO (YYYY-MM-DD)
 * @returns {Array<{iso:string, contexto:string}>} las fechas de examen pasadas presentadas como vigentes
 */
function examenPasadoPresentadoVigente(texto, hoyIso) {
  if (!texto) return []
  const t = String(texto)
  const hits = []
  for (const f of extraerFechas(t)) {
    if (f.iso >= hoyIso) continue // futura: correcta
    const ctx = t.slice(Math.max(0, f.idx - 55), f.idx + 15)
    if (!ES_EXAMEN.test(ctx)) continue // no es fecha de examen
    if (NO_EXAMEN.test(ctx)) continue // es plazo/publicación/resultados
    if (PASADO.test(ctx)) continue // histórico correcto, redactado en pasado
    if (!VIGENTE.test(ctx)) continue // solo si se presenta como vigente/futuro
    hits.push({ iso: f.iso, contexto: ctx.replace(/\s+/g, ' ').trim() })
  }
  return hits
}

/**
 * Aplica el detector a los textos libres de una oposición (descripción + FAQs).
 * @returns {Array<{iso:string, contexto:string}>} vacío si no hay engaño.
 */
function detectarEnOposicion({ landingDescription, landingFaqs }, hoyIso) {
  const textos = []
  if (landingDescription) textos.push(String(landingDescription))
  if (Array.isArray(landingFaqs)) {
    for (const f of landingFaqs) textos.push(`${f.pregunta || ''} ${f.respuesta || ''}`)
  }
  return textos.flatMap((t) => examenPasadoPresentadoVigente(t, hoyIso))
}

module.exports = { examenPasadoPresentadoVigente, detectarEnOposicion, extraerFechas }
