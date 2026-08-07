// lib/health/articleAuditNote.cjs — núcleo puro del detector `article_audit_note`:
// artículos ACTIVOS cuyo `content` (la TEORÍA que lee el opositor, no la explicación de
// una pregunta) lleva incrustada la nota de un pase de auditoría anterior. (T-253)
//
// ## El defecto, en un ejemplo real (Correos T3, CityPaq)
//
//   «Si no es recogido, el destinatario **NO puede retirarlo en la oficina de referencia
//    en 5 días naturales** (esa afirmación es INCORRECTA). El procedimiento exacto aplica
//    plazos y condiciones específicos.»
//
// El párrafo NI afirma ni niega: dice que la negación es falsa y no dice cuál es el plazo
// real. Es el hermano de `audit_note_explanation` (`lib/health/auditNoteExplanation.cjs`)
// pero un escalón más grave: aquello ensucia la EXPLICACIÓN de una pregunta; esto ensucia
// el ARTÍCULO, que es la fuente de la que cuelgan potencialmente cientos de preguntas Y la
// teoría que el opositor estudia directamente en `/temario`. Si una pregunta se generó a
// partir del párrafo confuso, la pregunta hereda el defecto — por eso el runbook exige
// revisar las preguntas del artículo, no solo reescribir el párrafo.
//
// ## Calibración (medida sobre el banco, 06/08/2026, no supuesta)
//
// La ficha original (28/07) estimaba «9 artículos». Medido de nuevo hoy con el patrón
// ampliado: **17 artículos activos, 45 apariciones, 8.410 preguntas activas colgando**
// (8 bloques de Correos T1/T3/T4/T6/T7/T9/T10/T12 + 9 artículos de otras materias:
// Informática Básica, POO y UML, Arquitectura Cliente-Servidor, Ciberseguridad CCN-CERT,
// Modelado y Diseño de BD, Personal Estatutario SERGAS, Reglamento Defensor del Pueblo GC,
// Planes de Salud Osakidetza). La ficha original solo veía 9 porque el patrón exigía el
// texto exacto `(esa afirmación es incorrecta)`, con paréntesis y sin negrita — y **T7 de
// Correos** llevaba la MISMA nota con la palabra en negrita markdown (`**incorrecta**`),
// invisible para ese patrón. Verificado uno por uno: 17/17 son nota de auditoría real
// (0 falsos positivos en la muestra completa, no parcial).
//
// ## El sujeto es «afirmación», y eso NO es arbitrario — es lo que evita el falso positivo
//
// Se probó y se DESCARTÓ ampliar el patrón a «esto/esta es incorrecta» sin exigir la
// palabra «afirmación»: sobre el banco real, ese patrón más ancho SÍ añade una fila —
// pero es un FALSO POSITIVO real, no una nota de auditoría. En `Access 365`:
//
//   «Si una pregunta menciona "0 para falso y -1 para verdadero" y pregunta si el tamaño
//    es 1 byte, también es **incorrecta** porque el tamaño es 1 bit, no 1 byte.»
//
// Es contenido pedagógico legítimo (avisa de una trampa de examen), no una nota de
// auditoría — y sin límite de palabra (`\b` en JS, `\y` en Postgres ARE), el propio
// patrón ancho casaba «esta» DENTRO de «respu**esta**», mostrando dos fallos a la vez:
// el patrón demasiado ancho Y la falta de límite de palabra. Con «afirmación» como
// sujeto obligatorio, ese caso no casa (Access 365 no vuelve a aparecer). Se prefiere
// perder algún caso marginal a inundar la bandeja con contenido correcto — mismo criterio
// que `auditNoteExplanation.cjs` con «la explicación anterior».
//
// ## GOTCHA de driver: `\b` NO es límite de palabra en Postgres ARE
//
// Medido en vivo: `SELECT 'esta es' ~* '\besta'` da **false** — Postgres Advanced Regular
// Expressions no trata `\b` como límite de palabra (es un carácter literal 'b' tras un
// escape que no hace nada especial ahí). El límite de palabra en Postgres es **`\y`**.
// `SELECT 'esta es' ~* '\yesta'` → true; `SELECT 'respuesta' ~* '\yesta'` → false (correcto:
// "esta" dentro de "respuesta" no es una palabra). Por eso este módulo expone DOS fuentes:
// una para JS (con `\b`) y otra para SQL (con `\y`) — compartir una sola habría reintroducido
// el propio falso positivo que motivó el límite de palabra.
//
// ## Por qué NO se fusiona con `no se ha podido verificar` (Archivística)
//
// Al calibrar apareció una familia DISTINTA: 8 artículos de la ley «Archivística» (10
// apariciones, 64 preguntas) con marcas de incertidumbre EXPLÍCITA dejadas por el pipeline
// de generación («⚠️ No se ha podido verificar textualmente en esta sesión…»). Es real y
// es el mismo problema de fondo (prosa de auditoría dentro del temario), pero es un ACTO
// distinto — aquí el pipeline SÍ avisa de la duda (no afirma y niega a la vez) — y afecta
// a una ley completamente distinta. Mezclarlo en el mismo patrón sería exactamente el
// error que este fichero evita en el punto de arriba: dos fenómenos, un solo detector,
// ninguno bien calibrado. Queda anotado como hallazgo separado para su propia campaña.

/** El patrón para JS: `\b` SÍ es límite de palabra aquí. */
const ARTICLE_AUDIT_NOTE_RE_SRC_JS =
  '\\b(esa|esta|dicha|tal)\\s+afirmaci[oó]n\\s+(es|resulta)\\s+(\\*\\*)?incorrect[a-záé]*'

/** El mismo patrón para Postgres `~*`: `\y` es el límite de palabra en ARE, no `\b`. */
const ARTICLE_AUDIT_NOTE_RE_SRC_SQL =
  '\\y(esa|esta|dicha|tal)\\s+afirmaci[oó]n\\s+(es|resulta)\\s+(\\*\\*)?incorrect'

const ARTICLE_AUDIT_NOTE_RE = new RegExp(ARTICLE_AUDIT_NOTE_RE_SRC_JS, 'i')
const ARTICLE_AUDIT_NOTE_RE_G = new RegExp(ARTICLE_AUDIT_NOTE_RE_SRC_JS, 'gi')

/** ¿El contenido de un artículo lleva incrustada una nota de auditoría del tipo «esa afirmación es incorrecta»? */
function isArticleAuditNote(texto) {
  if (!texto) return false
  return ARTICLE_AUDIT_NOTE_RE.test(String(texto))
}

/** Todas las apariciones (puede haber varias por artículo — Correos T3 tiene 16), para triaje. */
function matchedArticleAuditNotes(texto) {
  if (!texto) return []
  const re = new RegExp(ARTICLE_AUDIT_NOTE_RE_SRC_JS, 'gi')
  return String(texto).match(re) || []
}

module.exports = {
  ARTICLE_AUDIT_NOTE_RE_SRC_JS,
  ARTICLE_AUDIT_NOTE_RE_SRC_SQL,
  ARTICLE_AUDIT_NOTE_RE,
  ARTICLE_AUDIT_NOTE_RE_G,
  isArticleAuditNote,
  matchedArticleAuditNotes,
}
