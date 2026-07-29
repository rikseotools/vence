// lib/health/vinculoArticuloVecino.cjs — núcleo puro del detector `vinculo_articulo_vecino`:
// preguntas ACTIVAS colgadas de un artículo que NO las responde, teniendo un artículo VECINO de la
// misma ley que sí.
//
// ## De qué regla es esto
//
// Del modelo nuclear de CLAUDE.md: «la pregunta cuelga de un ARTÍCULO de una ley, y el artículo es la
// fuente única de la verdad del contenido de la pregunta». Si el artículo vinculado no dice lo que la
// pregunta pregunta, el vínculo está mal — y con él se rompen dos cosas a la vez: el opositor que
// abre el artículo desde la pregunta no encuentra la respuesta, y la pregunta se sirve en los temas
// que escopan el artículo equivocado.
//
// ## De dónde salió
//
// De la impugnación de un usuario (29/07/2026): *«Esta respuesta estaría bien considerada en el
// artículo 37, no en este que es el 36»*. Tenía razón — el contenido era del art. 37 de la LO 3/2007
// (Corporación RTVE) y estaba colgada del 36 (deber genérico de los medios públicos). Lo cazó él, no
// nosotros.
//
// ## ⚠️ Precisión BAJA a propósito: esto NO pinga el badge
//
// Medido el 29/07 sobre 38.860 preguntas de leyes reales: 326 candidatos en bruto. Al mirarlos:
//
//   · **122 son «señale la INCORRECTA / excepto»** — y ahí el desajuste es POR DISEÑO: la respuesta
//     correcta cita a propósito otro artículo, porque es la que no encaja. El caso de manual es una
//     pregunta sobre partidos políticos cuya respuesta correcta es el texto de los sindicatos
//     (art. 7 CE), y por eso el vínculo al art. 6 es el BUENO. Esos se excluyen aquí.
//   · Quedan 204, pero **ni esos son todos defectos**: siguen colándose preguntas que abarcan varios
//     artículos a la vez («¿en qué sección de la Constitución se reconoce el derecho de huelga?»).
//     En una muestra revisada a mano la precisión rondaba **1 de cada 3**.
//
// Por eso esto es un **runner BAJO DEMANDA** (`npm run audit:vinculo-vecino`) y no un hallazgo del
// barrido nocturno: un detector que acierta 1 de 3 en el panel enseña a ignorar el panel. Mismo
// criterio que la frontera de títulos del scope (CLAUDE.md: «runner ON-DEMAND, NO pinga el badge»).
//
// Runbook: `docs/runbooks/salud-contenido.md`.

/** Normalización compartida con el dossier de impugnaciones (`revisar-impugnacion.cjs`). */
const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Palabras significativas (>3 letras), igual que el recall del dossier. */
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3))

/** Recall: qué fracción de las palabras de la opción aparece en el artículo. */
function recall(opcion, articulo) {
  const O = words(opcion)
  const A = articulo instanceof Set ? articulo : words(articulo)
  if (!O.size) return 0
  let h = 0
  O.forEach((w) => A.has(w) && h++)
  return h / O.size
}

// ── Las DOS exclusiones que sostienen la precisión ────────────────────────────

/**
 * Enunciado de negación («señale la INCORRECTA», «todas EXCEPTO», «¿cuál NO es?»).
 * En estas preguntas la respuesta correcta es, por construcción, la que NO está en el artículo
 * vinculado — a menudo porque pertenece a otro. Marcarlas sería acusar al diseño de la pregunta.
 */
const RE_NEGATIVA =
  /\b(incorrect|falsa|no\s+es\s|no\s+ser[áa]|no\s+procede|excepto|salvo\b|no\s+corresponde|se[ñn]ale\s+la\s+que\s+no|cu[áa]l\s+de\s+.{0,30}\bno\b)/i

/**
 * Meta-opción: la respuesta correcta no tiene contenido propio («Todas son correctas», «A) y B)»),
 * así que su recall contra CUALQUIER artículo es cero y no dice nada.
 */
const RE_META = /^\s*(todas|ninguna|[a-d]\)\s*(y|,)|las\s+(dos|tres)|a\)\s*y|s[óo]lo\s+[a-d]\)|en\s+el\s+art)/i

/**
 * ¿Esta pregunta es examinable por el detector? Separado de la clasificación para poder testear
 * las exclusiones por su cuenta: son ellas las que deciden si el detector sirve o es ruido.
 */
function esExaminable({ questionText, correctText } = {}) {
  if (RE_NEGATIVA.test(String(questionText || ''))) return { ok: false, motivo: 'enunciado_de_negacion' }
  if (RE_META.test(String(correctText || ''))) return { ok: false, motivo: 'meta_opcion' }
  if (words(correctText).size < 4) return { ok: false, motivo: 'opcion_demasiado_corta' }
  return { ok: true, motivo: null }
}

/** Umbrales. Calibrados el 29/07; subirlos recorta cobertura, bajarlos dispara el ruido. */
const UMBRAL_PROPIO = 0.25 // por encima, el artículo vinculado ya responde: no se mira
const UMBRAL_VECINO = 0.55 // el vecino tiene que responder CLARAMENTE
const SALTO_MINIMO = 0.35 // y ganarle al propio por un margen amplio, no por un pelo
const RADIO = 3 // artículos a cada lado

/**
 * Veredicto por pregunta.
 *
 * @param {object} p
 * @param {string} p.questionText
 * @param {string} p.correctText  texto de la opción correcta
 * @param {string|number} p.articleNumber  artículo al que está vinculada
 * @param {Map<string, Set<string>|string>} p.articulosDeLaLey  número → contenido (o su Set de palabras)
 */
function clasificarVinculo({ questionText, correctText, articleNumber, articulosDeLaLey } = {}) {
  const ex = esExaminable({ questionText, correctText })
  if (!ex.ok) return { sospechoso: false, motivo: ex.motivo }

  const propio = articulosDeLaLey?.get(String(articleNumber))
  if (!propio) return { sospechoso: false, motivo: 'articulo_no_encontrado' }

  const r0 = recall(correctText, propio)
  if (r0 >= UMBRAL_PROPIO) return { sospechoso: false, motivo: 'el_propio_responde', recallPropio: r0 }

  const base = parseInt(String(articleNumber), 10)
  if (Number.isNaN(base)) return { sospechoso: false, motivo: 'articulo_no_numerico' }

  let mejor = null
  for (let d = -RADIO; d <= RADIO; d++) {
    if (d === 0) continue
    const cont = articulosDeLaLey.get(String(base + d))
    if (!cont) continue
    const r = recall(correctText, cont)
    if (r >= UMBRAL_VECINO && r - r0 >= SALTO_MINIMO && (!mejor || r > mejor.recall)) {
      mejor = { articulo: String(base + d), recall: r }
    }
  }

  if (!mejor) return { sospechoso: false, motivo: 'ningun_vecino_mejor', recallPropio: r0 }
  return { sospechoso: true, motivo: 'vecino_responde_mejor', recallPropio: r0, sugerido: mejor.articulo, recallSugerido: mejor.recall }
}

module.exports = {
  RE_NEGATIVA,
  RE_META,
  UMBRAL_PROPIO,
  UMBRAL_VECINO,
  SALTO_MINIMO,
  RADIO,
  norm,
  words,
  recall,
  esExaminable,
  clasificarVinculo,
}
