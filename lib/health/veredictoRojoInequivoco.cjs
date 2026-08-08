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
// ## Calibración — CERRADA el 08/08/2026 (T-405, con `VENCE_LECTOR_URL`, que desde entonces SÍ
// tiene política de lectura sobre esta tabla — el RLS-sin-política de [T-573]/[T-579]/[T-581] que
// bloqueaba al rol de la flota se arregló por otro camino)
//
// Corrida la query real del detector contra los 223.064 registros de `ai_verification_results`:
// sobre el POOL VIVO (preguntas activas, última verificación no descartada, sin `fix_applied`,
// 393 filas) la banda `error` daba **0** — ninguna recaída, consistente con que el único caso
// real (Estela) ya está `fix_applied`. Pero sobre el HISTÓRICO COMPLETO (11.313 filas rojas,
// incluidas descartadas/corregidas) `PATRON_NO_RESPONDE` SÍ enganchaba a otras **5** filas
// además de la de Estela — y las 5 eran FALSOS POSITIVOS: notas normales de verificación
// explicando por qué una opción no es la mejor respuesta («no responde ADECUADAMENTE a la
// pregunta», «no responde LÓGICAMENTE», «no responde AL CONTENIDO PRINCIPAL»), no el defecto
// estructural de Estela («las 4 opciones hablan de recursos; opcion A MARCADA no responde a la
// pregunta» — sin matiz, y nombrando expresamente que es la MARCADA la que no encaja).
//
// Exactamente la recaída que ya le pasó DOS VECES a `auditNoteExplanation` por una lista de
// literales corta — aquí se detectó ANTES de que ocurriera en vivo (las 5 estaban `discarded`,
// invisibles para el detector hoy) gracias a poder correr la query contra el histórico completo.
// `PATRON_NO_RESPONDE` se ajustó para exigir la palabra "marcada" (la opción ELEGIDA, no
// cualquier opción comentada) cerca de "no responde", y que "no responde" vaya seguido
// directamente de "pregunta" sin un adverbio de por medio («adecuadamente», «lógicamente») que es
// la señal de una nota de matiz, no de corrupción total. Verificado: sigue reconociendo el caso
// real de Estela y sus 3 variantes de fraseo (tests de abajo), y deja de marcar las 5 filas falsas
// (fixture con paráfrasis de las 5, sin copiar contenido real de BD). `PATRON_ETIQUETA` y
// `PATRON_OTRA_PREGUNTA` no engancharon ningún falso positivo (0 y 0 sobre las 11.313).

/**
 * Patrones INEQUÍVOCOS: el verificador describe el defecto como que las opciones NO PERTENECEN
 * a esta pregunta (vienen de otra) o que la opción marcada no responde en absoluto al enunciado.
 * No exige literalidad de "OPCIONES CORRUPTAS": ese texto es un caso, no todo el patrón — igual
 * que auditNoteExplanation dejó de fiarse de un catálogo cerrado de frases.
 */
const PATRON_ETIQUETA = /\bopciones?\s+corruptas?\b/i
// Exige "marcada" (la opción ELEGIDA) cerca de "no responde", y "no responde" pegado a "pregunta"
// sin adverbio de matiz en medio — ver la calibración de 08/08/2026 arriba: sin esto enganchaba
// notas normales de verificación ("no responde ADECUADAMENTE/LÓGICAMENTE a la pregunta") que no
// son el defecto estructural que este patrón existe para cazar.
const PATRON_NO_RESPONDE = /\bopci[oó]n(?:es)?\b[^.]{0,30}\bmarcada\b[^.]{0,20}\bno\s+responde\b\s*(?:en\s+absoluto\s+)?(?:a\s+(?:la|esta|dicha)\s+|al\s+)?pregunta\b/i
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
