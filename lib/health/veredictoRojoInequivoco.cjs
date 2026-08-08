// lib/health/veredictoRojoInequivoco.cjs — núcleo puro del detector `veredicto_verificacion_rojo`
// (T-405, 07/08/2026).
//
// ## Por qué existe
//
// La usuaria Estela impugnó `8cd4ee16` (RD 889/2022 art. 13): las cuatro opciones eran las de
// OTRA pregunta y la clave marcada tampoco respondía a la suya. Una verificación del 19/07 ya lo
// había escrito, literal: «OPCIONES CORRUPTAS: enunciado y explicacion sobre legalizacion/apostilla
// (art13.1) pero las 4 opciones hablan de recursos; opcion A marcada no responde a la pregunta».
// **Doce días `approved` y sirviéndose** hasta que lo cazó una persona. Escribir la fila en
// `ai_verification_results` no cambia `lifecycle_state`, no crea señal, no pinga ningún badge y no
// abre ninguna cola — el veredicto rojo se queda de dato histórico.
//
// ## Por qué DOS bandas, no una
//
// Medido el 31/07: 400 preguntas activas con `options_ok=false` (+19 `answer_ok=false`, +8
// `enunciado_ok=false`). Ese pool NO es «420 preguntas rotas» — el grueso son notas de una
// AUDITORÍA CIEGA cuya propia campaña de calibración (`scripts/answer-review/README.md`, junio
// 2026) midió en **~76% de ruido** contra el flag viejo pre-v2.0. Convertir CUALQUIER
// `options_ok=false` en alarma sería repetir el error de [T-317] (bandeja que grita todas las
// noches) sobre un pool mayormente equivocado.
//
// Lo que SÍ es fiable, y no depende de adjudicar caso a caso: un veredicto que describe el defecto
// como estructural e INEQUÍVOCO — las opciones pertenecen a otra pregunta, o la opción marcada no
// responde en absoluto al enunciado. Ese es el que tiene que sonar. El resto (la mayoría) va a una
// banda de COLA — visible, con dueño, pero sin pingear el badge — que es justamente el hueco de hoy:
// ninguna banda, ni siquiera esa.
//
// ## Calibración — LO QUE FALTA DECIR CLARO
//
// A diferencia de `lib/health/auditNoteExplanation.cjs` (calibrado sobre 96 casos reales del
// banco), este patrón se construyó sobre UN SOLO caso confirmado (el de Estela) porque
// `ai_verification_results` tiene RLS activo con CERO políticas para el rol de lectura del
// trabajador (`vence_lector`) — medido: `SELECT` da 0 filas sin error, `has_table_privilege=true`
// pero `pg_policies` vacío para esa tabla (mismo patrón que ya mordió en [T-573]/[T-579]/[T-581]).
// SOSPECHO que este patrón cubre razonablemente la familia del caso Estela, pero NO se puede
// afirmar que capture toda la variedad de fraseo con la que un verificador futuro describa el
// mismo defecto — la lección de `auditNoteExplanation` (dos recaídas por lista de literales
// demasiado estrecha) aplica aquí igual. Falta: correr esto contra RDS con una credencial que SÍ
// vea la tabla y medir cuántas filas caza cada banda, contrastando con una muestra leída a mano.

/**
 * Patrones INEQUÍVOCOS: el verificador describe el defecto como que las opciones NO PERTENECEN
 * a esta pregunta (vienen de otra) o que la opción marcada no responde en absoluto al enunciado.
 * No exige literalidad de "OPCIONES CORRUPTAS": ese texto es un caso, no todo el patrón — igual
 * que auditNoteExplanation dejó de fiarse de un catálogo cerrado de frases.
 */
const PATRON_ETIQUETA = /\bopciones?\s+corruptas?\b/i
const PATRON_NO_RESPONDE = /\bopci[oó]n(?:es)?\b[^.]{0,80}\bno\s+responde\b[^.]{0,30}\bpregunta\b/i
const PATRON_OTRA_PREGUNTA = /\bopciones?\b[^.]{0,60}\b(?:de|son de|pertenecen a)\s+otra\s+pregunta\b/i

const PATRONES_INEQUIVOCOS = [PATRON_ETIQUETA, PATRON_NO_RESPONDE, PATRON_OTRA_PREGUNTA]

/**
 * ¿Este texto de verificación describe un defecto INEQUÍVOCO (banda error) o es parte del pool
 * OPINABLE (banda cola)? Puro y total: nunca lanza con texto vacío/null.
 */
function esVeredictoInequivoco(explanation) {
  const texto = explanation || ''
  return PATRONES_INEQUIVOCOS.some((re) => re.test(texto))
}

/**
 * Clasifica una fila de `ai_verification_results` con al menos un flag en FALSE.
 * @param {{ options_ok?: boolean|null, answer_ok?: boolean|null, enunciado_ok?: boolean|null, explanation?: string|null }} fila
 * @returns {'error'|'warn'|null} null si ningún flag está en false (no debería llegar aquí, pero es total)
 */
function clasificarVeredicto(fila) {
  const rojo = fila.options_ok === false || fila.answer_ok === false || fila.enunciado_ok === false
  if (!rojo) return null
  return esVeredictoInequivoco(fila.explanation) ? 'error' : 'warn'
}

module.exports = {
  PATRON_ETIQUETA,
  PATRON_NO_RESPONDE,
  PATRON_OTRA_PREGUNTA,
  PATRONES_INEQUIVOCOS,
  esVeredictoInequivoco,
  clasificarVeredicto,
}
