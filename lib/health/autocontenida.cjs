// lib/health/autocontenida.cjs — núcleo puro del detector `enunciado_norma_sin_nombrar`:
// preguntas ACTIVAS cuyo enunciado invoca una norma que NO nombra en ninguna parte
// («Según el artículo 75 **de la ley**, ¿cuál es el contenido mínimo…?»).
//
// ## De qué regla es esto
//
// Es la §2.2-quater del manual de generación: **cada pregunta debe ser AUTOCONTENIDA**. Los tests
// salen barajados y sueltos, así que una pregunta no puede apoyarse en un contexto que el opositor
// no tiene delante. Esa regla ya tenía UNA mitad vigilada —`lib/generacion/siglasSinDesarrollar.js`,
// que caza la sigla usada sin desarrollar («IGIC» a pelo)— y le faltaba la otra: la referencia
// DESNUDA a la norma. Este módulo es esa otra mitad, no un detector nuevo de otra cosa.
//
// Y tienen el mismo origen, que es lo que convence de que hace falta: el gate de siglas nació de la
// impugnación de Laura García (02/07/2026, «LBRL» a pelo) y este nace de la de Esther Lázaro
// (29/07/2026, `6ed11712`): *«Porque no indica a qué normativa se refiere»*. Su enunciado decía
// «El artículo 1 de la normativa…» y las cuatro opciones repetían «esta normativa».
//
// ## El hueco que cierra
//
// El gate de siglas corre en `simularBatch` y en `verificar-batch-generado`: solo mira **lotes
// nuevos**. §2.2-quater **nunca ha barrido el banco vivo**, así que lo generado antes de la regla
// no lo mira nadie. Medido el 29/07 sobre las 139.464 activas: **274** con este defecto, 443
// exposiciones acumuladas y **ninguna de examen oficial**. No es ruido disperso: 270 salen de 6
// leyes y 198 de un mismo lote de Extremadura — una remesa de generación que escribió el enunciado
// como si el lector ya supiera de qué norma se habla.
//
// ## Se repara con lo que ya está en la BD
//
// La pregunta cuelga de un artículo y ese artículo tiene su ley: el hueco se rellena con el dato
// que ya tenemos (medido: las 274 tienen ley vinculada). Aun así **la reparación no es automática**
// —hay que leer el enunciado para colocar el nombre donde encaje— y las de examen OFICIAL no se
// tocan: ahí el enunciado es el que salió publicado.
//
// Runbook: `docs/runbooks/salud-contenido.md`. Gate hermano: `lib/generacion/siglasSinDesarrollar.js`.

// La traducción Postgres→JS se REUTILIZA del núcleo hermano en vez de copiarla: es el mismo
// contrato (`\y` → `\b`, flag `s`) y mantener dos copias las dejaría divergir en silencio.
const { toJsRegex } = require('./visualDeixis.cjs')

// ── Patrón 1: la referencia DESNUDA a la norma ────────────────────────────────
// Sintaxis de Postgres (ARE); se compara con `~*`. Exige que tras el sustantivo NO venga nada que
// lo identifique: puntuación, una palabra funcional o el final. Sin esa exigencia entraban
// «normativa **de permanencia de la UC3M**» o «norma **UNE 50-103-90**», que sí dicen cuál es.
//
// Va ANCLADO a la cita de un artículo («artículo 75 **de la ley**»), y no es un capricho: sin el
// ancla entraba «los actos procesales que ordenan, **conforme a la ley**, una conducta», donde esa
// coletilla es una fórmula jurídica DENTRO del contenido, no un puntero a la norma de la pregunta.
// Medido sobre 20 al azar: sin ancla 16/20 de precisión; con ancla, la clase entera de falsos
// positivos desaparece. Quien cita un artículo por su número sí está señalando una norma concreta,
// y ahí callarse cuál es el defecto.
const AC_DESNUDA =
  '\\yart[íi]culo\\s+[0-9]+(\\.[0-9]+)*\\s*(bis|ter|qu[áa]ter)?\\s*' +
  '(,\\s*(p[áa]rrafo|apartado)[^,]{0,20},?\\s*)?' +
  '(de|seg[úu]n)\\s+(la|dicha|esta|citada|presente|mencionada|referida)\\s+' +
  '(normativa|norma|ley|reglamento|disposici[óo]n)\\y' +
  '([,.:;?)]|\\s+(en|se|que|si|no|para|cuando)\\y|$)'

// ── Patrón 2: el enunciado SÍ identifica su norma en algún punto ──────────────
// Parte insensible a mayúsculas. Una pregunta puede nombrar la norma al principio y luego decir
// «dicha ley»: eso es prosa correcta, no el defecto.
const AC_IDENTIFICA =
  '([0-9]+/[0-9]{2,4})' +                                   // Ley 39/2015, DL 1/1999
  '|(\\yconstituci[óo]n\\y)' +
  '|(\\y(universidad|ayuntamiento|ordenanza|estatuto|convenio|tratado)\\y)' +
  '|(\\yley\\s+(de|del|org[áa]nica)\\y)' +                    // «Ley de Enjuiciamiento Criminal»
  '|(\\yreglamento\\s+(de|del)\\y)' +
  '|(\\yc[óo]digo\\s+[a-z])'                                 // «Código Civil», «Código Penal»

// Las SIGLAS van aparte porque su detección es sensible a mayúsculas: con `~*` esta clase casaría
// dos letras cualesquiera y daría por identificada CUALQUIER pregunta. Se compara con `~`.
const AC_SIGLA = '[A-ZÁÉÍÓÚÑ]{2,}'

/** ¿El enunciado invoca una norma sin ningún dato que la identifique ahí mismo? */
function citaNormaDesnuda(questionText) {
  return toJsRegex(AC_DESNUDA).test(String(questionText || ''))
}

/** ¿El enunciado identifica su norma en algún punto (número, nombre propio o sigla)? */
function identificaSuNorma(questionText) {
  const t = String(questionText || '')
  return toJsRegex(AC_IDENTIFICA).test(t) || toJsRegex(AC_SIGLA, 's').test(t)
}

/**
 * Veredicto por pregunta — espejo en JS del `WHERE` que corre en Postgres.
 * La detección autoritativa la hace Postgres; este predicado debe coincidir con ella, y existe
 * para poder CALIBRARLO en tests con enunciados reales, sin BD.
 *
 * @returns {{flagged: boolean, reason: string}} `reason` explica por qué NO se marca.
 */
function classifyAutocontenida({ questionText } = {}) {
  if (!citaNormaDesnuda(questionText)) return { flagged: false, reason: 'sin_referencia_desnuda' }
  if (identificaSuNorma(questionText)) return { flagged: false, reason: 'nombra_su_norma' }
  return { flagged: true, reason: 'norma_sin_nombrar' }
}

module.exports = {
  AC_DESNUDA,
  AC_IDENTIFICA,
  AC_SIGLA,
  citaNormaDesnuda,
  identificaSuNorma,
  classifyAutocontenida,
}
