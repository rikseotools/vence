// lib/calidad/verificacionCosmetica.cjs — quien REESCRIBE no puede FIRMAR que ha verificado [T-465].
//
// ## El fallo que cierra
//
// Un usuario premium mandó ocho impugnaciones sobre preguntas cuyo contenido no estaba en el
// artículo del temario. Al mirar quién las había dado por buenas, las siete del mismo lote traían la
// misma firma, del mismo día y con confianza ALTA:
//
//     article_ok=true · answer_ok=true · explanation_ok=true · confidence=alta
//     «Revisión masiva uncited: explicación reescrita con formato didáctico, blockquote y análisis
//      por opción.»
//
// Ese pase **no verificaba nada**: su trabajo era reescribir explicaciones que no tenían cita. Pero
// escribió los tres flags de verificación de contenido como efecto colateral, y con eso las
// preguntas quedaron marcadas como comprobadas para siempre.
//
// Y hubo un segundo daño, peor: como al pase se le pidió añadir un blockquote y el artículo no
// contenía la respuesta, el modelo citó **el artículo real diciendo algo que no responde a la
// pregunta**. La cita es literal —así que `cita_no_literal` no la ve— pero le da al opositor
// apariencia de fundamento legal sobre una pregunta inestudiable. El pase no solo no detectó el
// defecto: lo CAMUFLÓ.
//
// Medido el 01/08/2026: 1.839 filas de verificación con propósito cosmético, **el 79 % firmando los
// tres flags en true**, y **1.240 preguntas activas (0,9 %) cuya ÚNICA verificación es un pase así**.
//
// ## La regla
//
// Reescribir una explicación es una operación de FORMA. Comprobar que el artículo contiene la
// respuesta es de FONDO. Un pase que hace lo primero no ha mirado lo segundo, así que no puede
// firmarlo — y menos con confianza alta, que es lo que apaga cualquier revisión posterior.
//
// No se prohíbe reescribir en masa: se prohíbe que ese pase deje `article_ok`/`answer_ok` escritos.
// Debe dejarlos a `null` (no lo he mirado), que es distinto de `false` (lo he mirado y está mal).

/**
 * Marcas de que el propósito declarado de una fila de verificación es COSMÉTICO: reescribir,
 * reformatear o re-vincular. La lista sale de las firmas reales encontradas en la tabla, no de
 * imaginar cuáles podrían existir.
 */
const RE_COSMETICO =
  /(revisi[oó]n masiva|explicaci[oó]n reescrita|reescrita al formato|fase2 relink|v2\.1 relink|needs_review v2\.1|formato did[aá]ctico)/i

/** Flags que afirman algo sobre el CONTENIDO y que un pase cosmético no está en posición de firmar. */
const FLAGS_DE_FONDO = ['article_ok', 'answer_ok']

/**
 * ¿Esta fila de verificación firma fondo sin haberlo mirado?
 *
 * `explanation_ok` NO entra en la lista: un pase que reescribe la explicación SÍ está en posición de
 * decir si la explicación quedó bien — es justo lo que ha hecho. Lo que no puede afirmar es que el
 * artículo contenga la respuesta ni que la clave sea correcta.
 *
 * @param {{explanation?:string, article_ok?:boolean|null, answer_ok?:boolean|null}} fila
 * @returns {{infractora:boolean, motivo:string, flags:string[]}}
 */
function clasificarFirma(fila) {
  const proposito = String(fila?.explanation || '')
  if (!RE_COSMETICO.test(proposito)) {
    return { infractora: false, motivo: 'proposito_no_cosmetico', flags: [] }
  }
  const firmados = FLAGS_DE_FONDO.filter((f) => fila?.[f] === true)
  if (!firmados.length) {
    // El caso correcto: reescribió y dejó los flags de fondo sin tocar.
    return { infractora: false, motivo: 'cosmetico_sin_firmar_fondo', flags: [] }
  }
  return { infractora: true, motivo: 'cosmetico_firma_fondo', flags: firmados }
}

/**
 * ¿La verificación de esta pregunta se sostiene SOLO sobre pases cosméticos?
 *
 * Es la pregunta que de verdad importa: una pregunta puede tener un pase cosmético y además una
 * verificación real, y entonces no hay problema. El daño está en las que solo tienen lo primero,
 * porque figuran como comprobadas sin que nadie haya mirado su contenido.
 *
 * @param {Array} filas todas las verificaciones de una pregunta
 */
function soloVerificadaPorPasesCosmeticos(filas) {
  const lista = filas || []
  if (!lista.length) return false // sin verificación es otro problema, no éste
  return lista.every((f) => RE_COSMETICO.test(String(f?.explanation || '')))
}

module.exports = { RE_COSMETICO, FLAGS_DE_FONDO, clasificarFirma, soloVerificadaPorPasesCosmeticos }
