'use strict'
/**
 * Explicaciones (plantilla de viñetas `- A) …`) que REPRODUCEN la opción FALSA casi carácter
 * por carácter, con la palabra corregida pegada detrás (o delante) y SIN decir en ningún
 * momento que esa opción es incorrecta. El opositor falla, lee la "explicación" y encuentra
 * una frase que no está en la ley y que no sabe distinguir del texto legal real (T-525).
 *
 * Caso que lo motiva (impugnación `b061898d`, Adrián Castelló):
 *
 *   Opción A: «La delimitación de las competencias de la Unión se rige por el principio de
 *              cooperación leal».
 *   Explicación: «- A) Art. 5.1: La delimitación de las competencias de la Unión se rige por
 *              el principio de cooperación leal atribución.»
 *
 * La corrección («atribución») está pegada al final de la frase FALSA, sin coma, sin veredicto
 * y sin decir cuál de las dos palabras es la buena. Ninguno de los detectores vivos lo ve:
 * `audit_note_explanation` busca notas de auditoría, `explicacion_estructura_rota` mira el
 * FORMATO, `explicacion_truncada` mira si falta texto, `cita_no_literal` solo juzga el
 * blockquote — aquí no hay blockquote y el formato está «bien».
 *
 * ## El criterio (calibrado el 04-05/08/2026 sobre las 2.816 activas con plantilla `- A)`)
 *
 * Por cada opción que NO es la correcta, se compara su SEGMENTO de explicación (el texto tras
 * su viñeta `- X)`) con el texto de la propia opción, normalizados (sin acentos, sin comillas,
 * sin puntuación de cierre, espacios colapsados):
 *
 *   1. el segmento CONTIENE la opción (o al revés) — es decir, uno es casi un prefijo/superset
 *      del otro, que es la forma que toma tanto la yuxtaposición («…leal atribución.») como la
 *      reproducción literal a secas («- B) [la opción, tal cual]»);
 *   2. la proporción de longitudes está en `[RATIO_MIN, RATIO_MAX]` = `[0.85, 1.7]` — un
 *      segmento mucho más largo que la opción ya no es "casi la opción", es una explicación de
 *      verdad que la CITA de paso;
 *   3. el segmento NO lleva ninguna palabra ni marca de veredicto (ver `pareceVeredicto`).
 *
 * Primera vuelta con el corte obvio («el segmento contiene la opción») sobre las 2.816: **970
 * preguntas**. La mayoría son legítimas — citar la opción falsa y decir después «esto es
 * incorrecto porque…» es lo normal. Con los tres filtros de arriba: **172 preguntas / 210
 * segmentos, 26 de examen oficial** (medido 05/08/2026; el número exacto respira con el banco,
 * no es una constante). Muestra aleatoria de 30 juzgada a mano: 28/30 son el fenómeno real (dos casos limítrofes citan
 * la opción con una distinción implícita — «Son identificadores, no tipos de asientos» — sin
 * usar ninguna palabra de veredicto reconocida; se aceptan como ruido, no como para ensanchar el
 * patrón y arriesgar falsos negativos).
 *
 * ## Las tres exclusiones que hacen falta para no ensuciar el corte
 *
 * 1. **Longitud mínima de la opción** (`MIN_LEN` = 20). Con opciones de 5-10 caracteres («Sumar»,
 *    «Recuento») el ratio de longitud es demasiado inestable — un carácter de más lo dispara
 *    fuera de rango o lo mete de casualidad — y son además el patrón típico de preguntas de
 *    ofimática con checklist, no de explicación legal.
 * 2. **Marca de veredicto por SÍMBOLO** (`✓ ✔ ✅ ❌ ✗`). En preguntas «señale la EXCEPCIÓN» es
 *    frecuente listar las demás opciones con un check: «- A) Sumar ✓ - B) Promedio ✓» — el
 *    símbolo YA comunica «esta sí está», y no es el defecto que se persigue.
 * 3. **Afirmación en prosa** (`pareceAfirmacion`): «: cierto.», «Sí es/está…», «también
 *    está/es…», «está/están en el listado», «está/están incluido/a(s)», «→ Existe». Es el mismo
 *    fenómeno que el símbolo pero escrito en palabras — típico de preguntas «señale cuál NO…»
 *    donde las demás opciones SÍ pertenecen a la lista y el autor lo dice así. Comunican un
 *    veredicto (aunque sea "sí", no "no"), así que no son el silencio que define el defecto.
 *    OJO: `existe` a secas NO se excluye (aparece como verbo normal dentro de options legales:
 *    «Existe provocación cuando…» es precisamente uno de los casos reales del defecto) — solo se
 *    excluye la forma corta `→ Existe` al final, que es la que se usa como checklist.
 *
 * Runbook: `docs/runbooks/salud-contenido.md`. Hermanos: `lib/health/explicacionEstructuraRota.cjs`
 * (mira el FORMATO, no el fondo), `lib/health/auditNoteExplanation.cjs` (nota de auditoría colada
 * como explicación), `lib/health/citaRecortada.cjs` / `cita_no_literal` (la cita en blockquote no
 * está en el artículo — aquí no hay blockquote).
 */

/** Opciones por debajo de esta longitud no se evalúan: el ratio se vuelve ruido. */
const MIN_LEN = 20

/** Banda de longitud segmento/opción que sigue pareciendo "casi la misma frase". */
const RATIO_MIN = 0.85
const RATIO_MAX = 1.7

const LETRAS = ['A', 'B', 'C', 'D', 'E']

/** Palabras que, si aparecen en el segmento, YA dicen que la opción es incorrecta. */
const VEREDICTO_RE =
  /\b(incorrect[oa]s?|correct[oa]s?|err[oó]ne[oa]s?|fals[oa]s?|no es|no lo es|sino|en realidad|mientras que|confunde|mezcla|se equivoca|no corresponde|no coincide|no se ajusta|contradice|verdader[oa]|no cumple|no se exige|no figura)\b/i

/** Símbolos que se usan como veredicto visual en preguntas tipo checklist. */
const MARCA_VEREDICTO_RE = /[✓✔✅❌✗]/

/**
 * Afirmaciones en prosa del mismo fenómeno que la marca visual (ver exclusión 3 arriba).
 *
 * GOTCHA: no se puede cerrar con `\b` tras una vocal acentuada («está», «así») — en JS `\b` se
 * define sobre `[A-Za-z0-9_]` y una vocal con tilde NO es "de palabra", así que el límite ya
 * ocurre ENTRE la consonante y la tilde (p.ej. entre la "t" y la "á" de "está") y `est[aá]\b`
 * deja de casar "está" seguida de espacio. Se cierra con un lookahead explícito en su lugar.
 */
const FIN_PALABRA = '(?=\\s|$|[.,;:])'
const AFIRMACION_RE = new RegExp(
  ':\\s*cierto\\.?\\s*$' +
    `|\\bs[ií]\\s+(?:es|est[aá]|lo es|lo est[aá]|son|est[aá]n)${FIN_PALABRA}` +
    `|\\btambi[eé]n\\s+(?:est[aá]n?|es|lo es|lo est[aá])${FIN_PALABRA}` +
    `|\\best[aá]n?\\s+(?:en el listado|inclu[ií]d[oa]s?)${FIN_PALABRA}` +
    `|\\bfigura(?:n)?\\s+en el listado${FIN_PALABRA}` +
    `|\\bconsta(?:n)?\\s+en el listado${FIN_PALABRA}` +
    '|→\\s*existe\\s*$',
  'i',
)

/** ¿El segmento ya comunica, de alguna forma, un veredicto sobre la opción? */
function pareceVeredicto(segmento) {
  const s = String(segmento || '')
  return VEREDICTO_RE.test(s) || MARCA_VEREDICTO_RE.test(s) || AFIRMACION_RE.test(s)
}

/** Normaliza para comparar: sin acentos, sin comillas/marcas, sin puntuación de cierre, espacios colapsados. */
function normaliza(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[«»"'`´]/g, '')
    .replace(/[✓✔✅❌✗×]/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Divide la explicación en segmentos por viñeta `- A)` / `- A.` (una por letra, hasta la
 * siguiente viñeta o el final del texto). Preguntas sin esta plantilla devuelven `{}`.
 * @param {string} explanation
 * @returns {Record<string, string>}
 */
function segmentosPorLetra(explanation) {
  const texto = String(explanation || '')
  const re = /(?:^|\n)\s*-\s*([A-E])[).]\s*/g
  const marcas = []
  let m
  while ((m = re.exec(texto))) marcas.push({ letra: m[1], fin: re.lastIndex, inicio: m.index })
  const out = {}
  for (let i = 0; i < marcas.length; i++) {
    const desde = marcas[i].fin
    const hasta = i + 1 < marcas.length ? marcas[i + 1].inicio : texto.length
    out[marcas[i].letra] = texto.slice(desde, hasta).trim()
  }
  return out
}

/**
 * ¿El segmento de una opción FALSA es "casi la misma frase" que la opción, sin veredicto?
 * @param {string} opcionTexto
 * @param {string} segmento
 * @returns {{yuxtapuesta: boolean, ratio: number|null}}
 */
function esYuxtaposicion(opcionTexto, segmento) {
  const opcion = String(opcionTexto || '')
  if (opcion.length < MIN_LEN) return { yuxtapuesta: false, ratio: null }
  if (pareceVeredicto(segmento)) return { yuxtapuesta: false, ratio: null }

  const nOpcion = normaliza(opcion)
  const nSegmento = normaliza(segmento)
  if (!nOpcion || !nSegmento) return { yuxtapuesta: false, ratio: null }

  const contenida = nSegmento.includes(nOpcion) || nOpcion.includes(nSegmento)
  if (!contenida) return { yuxtapuesta: false, ratio: null }

  const ratio = nSegmento.length / nOpcion.length
  if (ratio < RATIO_MIN || ratio > RATIO_MAX) return { yuxtapuesta: false, ratio }

  return { yuxtapuesta: true, ratio }
}

/**
 * Clasifica una pregunta completa: por cada opción FALSA con viñeta propia, dice si su
 * segmento reproduce la opción sin veredicto.
 *
 * @param {{option_a?: string, option_b?: string, option_c?: string, option_d?: string,
 *          option_e?: string, correct_option: number, explanation?: string}} q
 * @returns {{yuxtapuesta: boolean, hallazgos: Array<{letra: string, opcion: string, segmento: string, ratio: number}>}}
 */
function clasificaPregunta(q) {
  const segs = segmentosPorLetra(q && q.explanation)
  if (Object.keys(segs).length === 0) return { yuxtapuesta: false, hallazgos: [] }

  const opciones = {
    A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e,
  }
  const correcta = LETRAS[q.correct_option]

  const hallazgos = []
  for (const letra of Object.keys(segs)) {
    if (letra === correcta) continue
    const opcionTexto = opciones[letra]
    if (!opcionTexto) continue
    const { yuxtapuesta, ratio } = esYuxtaposicion(opcionTexto, segs[letra])
    if (yuxtapuesta) hallazgos.push({ letra, opcion: opcionTexto, segmento: segs[letra], ratio })
  }

  return { yuxtapuesta: hallazgos.length > 0, hallazgos }
}

/**
 * Filtra un lote y devuelve solo las que tienen el defecto, ordenadas por EXPOSICIÓN
 * descendente (se repara antes lo que más gente está viendo).
 * @param {Array<{id: string, servidas?: number}>} filas
 */
function filtrarLote(filas) {
  const out = []
  for (const f of filas || []) {
    const v = clasificaPregunta(f)
    if (v.yuxtapuesta) out.push({ id: f.id, hallazgos: v.hallazgos, servidas: Number(f.servidas || 0) })
  }
  return out.sort((a, b) => b.servidas - a.servidas)
}

module.exports = {
  MIN_LEN,
  RATIO_MIN,
  RATIO_MAX,
  VEREDICTO_RE,
  MARCA_VEREDICTO_RE,
  AFIRMACION_RE,
  pareceVeredicto,
  normaliza,
  segmentosPorLetra,
  esYuxtaposicion,
  clasificaPregunta,
  filtrarLote,
}
