'use strict'
/**
 * Explicaciones que NO EXPLICAN: son un ECO de la propia opción correcta, y en la peor variante
 * traen la palabra/número/verbo FALSEADO pegado justo al lado del verdadero, sin conjunción ni
 * puntuación entre medias — el opositor no puede saber cuál de los dos es el bueno.
 *
 * ## De dónde sale (T-557, impugnación `c805e7c0` de Adrián, premium)
 *
 * La pregunta preguntaba por el fin del art. 2.e) de la LO 1/2004 y la explicación entera era:
 * *«Garantizar derechos económicos para las mujeres víctimas de violencia de género, con el fin
 * de mejorar su posición facilitar su integración social.»* — repite la opción correcta Y trae
 * la finalidad FALSEADA («mejorar su posición») pegada justo delante de la verdadera («facilitar
 * su integración social»), sin decir cuál es cuál.
 *
 * Ninguno de los detectores vivos lo ve: `audit_note_explanation` busca notas de auditoría IA,
 * `explicacion_estructura_rota` mira el FORMATO (asteriscos sin pareja), `explicacion_truncada`
 * mira si falta texto — aquí el texto está entero, bien formado, y no explica nada.
 *
 * ## Dos bandas, y piden remedios distintos
 *
 *   1. **ECO** — la explicación repite la opción correcta (y poco más). Molesto, pero no engaña.
 *   2. **ECO CONTAMINADO** — dentro del eco, dos candidatos para el MISMO hueco (dos números, dos
 *      verbos, dos palabras) aparecen PEGADOS sin conjunción. Esto SÍ desinforma: el opositor no
 *      sabe cuál de los dos es el correcto. Es la urgente.
 *
 * ## El criterio de ECO (calibrado 07/08/2026 contra las activas sin `explanation_data`)
 *
 * Sobre las **52.834** activas sin `explanation_data` con explicación de 40-400 caracteres:
 * contar cuántas palabras SIGNIFICATIVAS (≥3 letras, sin stopwords) de la opción CORRECTA
 * aparecen dentro de la explicación. Con el corte `ratio ≥ 0.85` salen 14.560 — demasiado
 * ancho, porque cualquier explicación que CITA la opción entera y LUEGO añade razonamiento
 * también lo cumple. Añadiendo que la explicación no sea sustancialmente más larga que la
 * propia opción (`≤ 1.6×` su longitud normalizada — un eco no añade texto, una explicación de
 * verdad sí) el corte baja a **1.811**, prácticamente el 1.785 medido en la ficha original
 * (05/08) — la pequeña diferencia es normal-esperable-por-inventario que cambia día a día.
 *
 * ## El criterio de CONTAMINACIÓN (dos sub-patrones, calibrados sobre una muestra real de 1.811)
 *
 * No hay un POS-tagger aquí, así que se buscan dos formas CONCRETAS de "dos candidatos pegados
 * sin conjunción", cada una con su lista de exclusiones — igual que hacen `explicacionTruncada`
 * y `explicacionYuxtaposicion`, que prefieren precisión a cobertura total:
 *
 *   - **NÚMEROS PEGADOS**: dos números (dígitos o palabra) DISTINTOS, con hasta un par de
 *     palabras cortas de hueco («a la», «de», «del»), sin coma/salto de línea entre medias.
 *     Casos reales: «un tercio a la mitad», «seis tres meses», «ocho cuatro años».
 *     Exclusiones (medidas, no supuestas): citas de artículo («Art. 17.2 2.» — el número de
 *     párrafo tras el de artículo NO es un candidato pegado) y fechas («Ley 9/2014 de 9 de
 *     mayo» — el día del mes no es un candidato pegado al año).
 *   - **VERBOS PEGADOS**: dos infinitivos (≥4 letras, acabados en -ar/-er/-ir) adyacentes, con
 *     hasta 3 palabras cortas de hueco (determinantes/preposiciones), sin coma ni conjunción
 *     «y»/«o» entre medias. Caso real, el que motiva la ficha: «Respetar Garantizar los
 *     derechos económicos…». Exclusión medida: muchas palabras españolas MUY comunes acaban
 *     en -ar/-er/-ir sin ser verbos («carácter», «cualquier», «particular», «tercer», les
 *     sobra un sufijo de participio) — lista `NO_ES_VERBO`. Y una construcción SÍ gramatical
 *     («podrá acordar continuar con…», un verbo modal que rige un infinitivo) se excluye por
 *     verbo1 ∈ `VERBO_CONTROL` (rige gramaticalmente un segundo infinitivo, no es un paste).
 *
 * Medido sobre la muestra real de 1.811 ecos: **13 números pegados, 9 verbos pegados** (antes de
 * filtrar exclusiones, salían 25 y 16 — casi la mitad eran ruido, de ahí las exclusiones). Sobre
 * esas 22, precisión a ojo: 11/13 números, 8/9 verbos — ambas por encima del ~85% que exige la
 * casa. **Punto ciego admitido, no arreglado aquí:** pares de ADJETIVOS pegados («mayores
 * menores de edad», visto en la muestra real) no tienen patrón propio — necesitaría una lista de
 * adjetivos-tipo tan grande como la de verbos, y no cupo en esta pasada. `SOSPECHO` (no medido)
 * que ensancha algo la banda contaminada si se construye.
 *
 * Runbook: `docs/runbooks/salud-contenido.md`. Hermanos: `explicacionTruncada.cjs` (falta texto,
 * no lo hay de más), `explicacionYuxtaposicion.cjs` (mismo espíritu — opción falsa pegada a su
 * corrección — pero exige plantilla de viñetas `- A)`; aquí la explicación es PROSA LIBRE sin
 * plantilla, población distinta: `explanation_data IS NULL`).
 */

const STOPWORDS = new Set(
  'de la el los las un una unos unas y o u a en con por para su sus que se no es son al del lo como este esta estos estas ese esa esos esas'.split(
    ' ',
  ),
)

function normaliza(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function palabrasSignificativas(s) {
  return normaliza(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/** Ratio de cobertura: cuánto de la opción correcta aparece dentro de la explicación. */
function ratioEco(opcionTexto, explicacion) {
  const palOpcion = palabrasSignificativas(opcionTexto)
  if (palOpcion.length === 0) return { ratio: 0, opcionLen: 0 }
  const nExp = normaliza(explicacion)
  const cubiertas = palOpcion.filter((w) => nExp.includes(w))
  return { ratio: cubiertas.length / palOpcion.length, opcionLen: palOpcion.length }
}

/**
 * ¿La explicación es un eco de la opción correcta? No añade explicación real: repite sus
 * palabras y no se alarga apenas.
 * @param {{explanation?: string, opcionTexto?: string}} p
 */
function esEco({ explanation, opcionTexto } = {}) {
  const { ratio, opcionLen } = ratioEco(opcionTexto, explanation)
  if (opcionLen < 3 || ratio < 0.85) return false
  const nExp = normaliza(explanation)
  const nOpcion = normaliza(opcionTexto)
  if (!nOpcion) return false
  return nExp.length <= nOpcion.length * 1.6
}

// ── NÚMEROS PEGADOS ──────────────────────────────────────────────────────────────────────────
const NUM_PALABRA =
  'cero|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|' +
  'treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|mitad|tercio|cuarto|medio|media'
// "un/una/uno" se excluyen a propósito: son también el artículo indefinido ("en un 15%"),
// y meterlos disparaba falsos positivos sobre cualquier cantidad con artículo delante.
const NUM_TOKEN = `(?:\\d+(?:[.,]\\d+)?|${NUM_PALABRA})`
const RE_NUMEROS = new RegExp(
  `\\b(${NUM_TOKEN})\\b((?:[ \\t]+(?:a[ \\t]+la|de|del)?)?[ \\t]*)\\b(${NUM_TOKEN})\\b`,
  'gi',
)
const RE_ANTES_ARTICULO = /art(?:[íi]culo)?\.?\s*$/i
const RE_MES = /\bde\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i

// Segunda forma: la UNIDAD se repite entera junto a cada número («12 horas 24 horas», «10 días
// 30 días») en vez de aparecer una sola vez al final («ocho cuatro años»). Patrón aparte porque
// el hueco entre los dos números NO es corto aquí — es la propia unidad, palabra completa.
const RE_NUMEROS_UNIDAD_REPETIDA = new RegExp(
  `\\b(${NUM_TOKEN})\\s+([a-záéíóúñ]{3,15})\\s+(${NUM_TOKEN})\\s+\\2\\b`,
  'gi',
)

/** @param {string} texto @returns {string[]} */
function numerosPegados(texto) {
  const t = String(texto || '')
  const hits = []
  const re = new RegExp(RE_NUMEROS.source, 'gi')
  let m
  while ((m = re.exec(t))) {
    const a = m[1].toLowerCase()
    const b = m[3].toLowerCase()
    if (a === b) continue
    const gap = m[2] || ''
    if (/[\r\n]/.test(gap)) continue
    const antes = t.slice(Math.max(0, m.index - 15), m.index)
    if (RE_ANTES_ARTICULO.test(antes)) continue // cita "Art. N.M" — el párrafo no es un candidato pegado
    const ventana = t.slice(Math.max(0, m.index - 5), re.lastIndex + 15)
    if (RE_MES.test(ventana)) continue // fecha "N de <mes>"
    hits.push(m[0])
  }
  const re2 = new RegExp(RE_NUMEROS_UNIDAD_REPETIDA.source, 'gi')
  while ((m = re2.exec(t))) {
    if (m[1].toLowerCase() === m[3].toLowerCase()) continue
    hits.push(m[0])
  }
  return hits
}

// ── VERBOS PEGADOS ───────────────────────────────────────────────────────────────────────────
// Palabras muy comunes que acaban en -ar/-er/-ir SIN ser infinitivos (medido: eran la mayoría
// de los falsos positivos del primer intento). Lista de EXCLUSIÓN, no de verbos válidos: crecer
// esta lista es más barato y más seguro que mantener un diccionario de verbos.
const NO_ES_VERBO = new Set([
  'caracter', 'cualquier', 'particular', 'tercer', 'mejor', 'peor', 'mayor', 'menor',
  'exterior', 'interior', 'anterior', 'posterior', 'militar', 'singular', 'regular',
  'familiar', 'popular', 'similar', 'titular', 'escolar', 'lugar', 'celular', 'solar',
  'vulgar', 'ejemplar', 'circular', 'auxiliar', 'secretar', 'secretaria', 'azar', 'hogar',
  'pilar', 'angular', 'peculiar', 'polar', 'nuclear', 'general', 'especial', 'social',
  'legal', 'fiscal', 'estatal', 'judicial', 'oficial', 'inicial', 'esencial', 'material',
  'tribunal', 'canal', 'capital', 'digital', 'mental', 'local', 'total', 'literal', 'moral',
  'laboral', 'natural', 'cultural', 'estructural', 'individual', 'anual', 'gradual', 'ritual',
  'actual', 'manual', 'usual', 'habitual', 'eventual', 'residual',
])
// Verbos MODALES/de control que rigen gramaticalmente un segundo infinitivo — "podrá acordar
// continuar con…" es una frase correcta, no dos candidatos pegados.
const VERBO_CONTROL = new Set(['acordar', 'decidir', 'optar', 'resolver', 'proceder', 'poder', 'deber', 'querer', 'intentar'])

function esVerboInfinitivo(tok) {
  const t = String(tok || '').toLowerCase()
  if (t.length < 4) return false
  if (!/(ar|er|ir)$/.test(t)) return false
  const sinAcentos = t.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (NO_ES_VERBO.has(sinAcentos)) return false
  return true
}

// OJO CON EL FIN DE CADA CANDIDATO: aquí NO vale `\b`.
// En JavaScript `\b` solo conoce [A-Za-z0-9_], así que la tilde de «prescribirá» cuenta como
// NO-palabra y `\b` ve una frontera falsa justo detrás de «prescribir» → el verbo conjugado se
// parte en «prescribir» + «á» y una frase perfectamente normal («el derecho a reclamar
// prescribirá al año…») se marcaba como dos infinitivos pegados. Medido en la revisión de
// [T-557] (08/08/2026): 1 falso positivo real sobre la cola de 21 contaminadas.
// El lookahead sí conoce las vocales acentuadas y la ñ, que es lo que hace falta.
const FIN_DE_PALABRA = '(?![a-záéíóúüñ])'
const RE_VERBOS = new RegExp(
  `\\b([a-záéíóúñ]{4,}(?:ar|er|ir))${FIN_DE_PALABRA}` +
    '((?:[ \\t]+(?:su|sus|el|la|los|las|al|del|de|en)\\b){0,3}[ \\t]*)' +
    `\\b([a-záéíóúñ]{4,}(?:ar|er|ir))${FIN_DE_PALABRA}`,
  'gi'
)
const RE_GAP_ROMPE = /[,.;\r\n]|\by\b|\bo\b/i

/** @param {string} texto @returns {string[]} */
function verbosPegados(texto) {
  const t = String(texto || '')
  const hits = []
  const re = new RegExp(RE_VERBOS.source, 'gi')
  let m
  while ((m = re.exec(t))) {
    const a = m[1]
    const b = m[3]
    if (!esVerboInfinitivo(a) || !esVerboInfinitivo(b)) continue
    if (VERBO_CONTROL.has(a.toLowerCase())) continue
    const gap = m[2] || ''
    if (RE_GAP_ROMPE.test(gap)) continue
    hits.push(m[0])
  }
  return hits
}

/**
 * Clasificación completa de una pregunta.
 * @param {{explanation?: string, option_a?: string, option_b?: string, option_c?: string,
 *          option_d?: string, correct_option?: number}} q
 */
function clasificaPregunta(q) {
  const opciones = [q.option_a, q.option_b, q.option_c, q.option_d]
  const opcionTexto = opciones[q.correct_option]
  const eco = esEco({ explanation: q.explanation, opcionTexto })
  if (!eco) return { eco: false, contaminado: false, numeros: [], verbos: [] }
  const numeros = numerosPegados(q.explanation)
  const verbos = verbosPegados(q.explanation)
  return { eco: true, contaminado: numeros.length > 0 || verbos.length > 0, numeros, verbos }
}

module.exports = {
  normaliza,
  palabrasSignificativas,
  ratioEco,
  esEco,
  numerosPegados,
  verbosPegados,
  esVerboInfinitivo,
  clasificaPregunta,
  NO_ES_VERBO,
  VERBO_CONTROL,
}
