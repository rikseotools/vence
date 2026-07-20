// lib/laws/boeVigencia.ts
//
// Extrae el articulado de un bloque del BOE consolidado SIN perder su información de VIGENCIA.
//
// ## El problema que resuelve (T-048, raíz de T-009)
//
// Cuando el TC anula un inciso y el legislador no reforma el texto, el BOE **mantiene la frase
// en el articulado**, la resalta con `<strong>` y le añade una nota al pie:
//
//   <p class="parrafo">6. La devolución acordada … <strong>Asimismo, toda devolución acordada en
//   aplicación del párrafo b) … por un plazo máximo de tres años.</strong></p>
//   <blockquote>
//     <p class="nota_pie_2">Se declara inconstitucional y nulo el inciso destacado del apartado 6
//     por Sentencia del TC 17/2013, de 31 de enero.</p>
//   </blockquote>
//
// Los importadores hacían `html.replace(/<[^>]+>/g, ' ')` y se llevaban por delante **el resaltado
// Y la nota** → guardábamos el inciso muerto como texto plano perfectamente válido. Importábamos
// *el qué*, no *con qué vigencia*. Ese es el incidente del art. 126.2 LBRL / STC 103/2013.
//
// ## Contrato
//
// `text` sale IGUAL que antes (articulado sin notas) → los importadores no cambian de
// comportamiento y las citas literales de las explicaciones siguen encajando. Lo nuevo va
// aparte, en `vigenciaNotes` + `highlightedFragments`, para persistirlo en `articles.vigencia_notes`.
//
// Estructura verificada contra la API real el 20/07:
//   GET …/legislacion-consolidada/id/<BOE-ID>/texto/bloque/<bloqueId>  con `Accept: application/xml`
//   (con `application/json` responde 400: mime type no soportado).

export interface VigenciaNote {
  /** `nota_pie`, `nota_pie_2`… tal como los clasifica el BOE. */
  clase: string
  texto: string
  /** Referencia al BOE de la norma/sentencia que causa la nota, si viene. */
  ref: string | null
  /** La nota declara inconstitucional/nulo algo. */
  esAnulacion: boolean
}

export interface BoeBlock {
  /** Articulado limpio, SIN las notas al pie. Equivale a lo que ya guardábamos. */
  text: string
  /** Notas de vigencia del bloque (modificaciones, derogaciones, anulaciones del TC…). */
  vigenciaNotes: VigenciaNote[]
  /**
   * Fragmentos que el BOE resalta con `<strong>` dentro del articulado. Cuando hay una nota de
   * anulación, la nota dice "el inciso **destacado**" → estos son los candidatos a inciso anulado.
   */
  highlightedFragments: string[]
}

const ANULACION_RE = /\b(inconstitucional|nulidad|nulos?|nulas?|se anula)\b/i

/** Decodifica las entidades que usa el BOE. Sin esto el texto queda con `&aacute;` y compañía. */
function decode(s: string): string {
  const named: Record<string, string> = {
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
    Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
    laquo: '«', raquo: '»', nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    deg: '°', ordm: 'º', ordf: 'ª', hellip: '…', mdash: '—', ndash: '–',
  }
  return s
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in named ? named[n] : m))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

function stripTags(s: string): string {
  return decode(s.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').trim()
}

/**
 * Parsea un bloque del BOE consolidado (XML o el HTML del `<data>`).
 * Nunca lanza: ante un bloque raro devuelve el texto y listas vacías, que es el
 * comportamiento de hoy. Un import no puede caerse por una nota mal formada.
 */
export function parseBoeBlock(raw: string): BoeBlock {
  if (!raw) return { text: '', vigenciaNotes: [], highlightedFragments: [] }

  // 1) Las notas viven dentro de <blockquote>. Se extraen ANTES de limpiar, y se apartan
  //    del articulado (que es lo que hacíamos ya, solo que ahora sin tirarlas).
  const vigenciaNotes: VigenciaNote[] = []
  for (const bq of raw.match(/<blockquote>[\s\S]*?<\/blockquote>/gi) ?? []) {
    for (const p of bq.match(/<p\s+class="(nota[^"]*)"[^>]*>([\s\S]*?)<\/p>/gi) ?? []) {
      const clase = (p.match(/class="([^"]+)"/i) ?? [])[1] ?? 'nota'
      const ref = (p.match(/Ref\.\s*(BOE-[A-Z]-\d{4}-\d+)/i) ?? [])[1] ?? null
      const texto = stripTags(p)
      // El bloque del BOE repite el historial de reformas (el art. 58 de la LO 4/2000 trae la
      // MISMA nota varias veces). Sin deduplicar, el JSONB guardado es ruido.
      if (texto && !vigenciaNotes.some((n) => n.texto === texto)) {
        vigenciaNotes.push({ clase, texto, ref, esAnulacion: ANULACION_RE.test(texto) })
      }
    }
  }

  const sinNotas = raw.replace(/<blockquote>[\s\S]*?<\/blockquote>/gi, ' ')

  // 2) Los <strong> del ARTICULADO (ya sin notas) son los fragmentos destacados.
  const highlightedFragments = [
    ...new Set(
      (sinNotas.match(/<strong>([\s\S]*?)<\/strong>/gi) ?? []).map((s) => stripTags(s)).filter(Boolean),
    ),
  ]

  // 3) El texto sale como siempre: sin etiquetas y sin las notas.
  const cuerpo = sinNotas.replace(/<\/p>/gi, '\n').replace(/<\/?(response|status|code|text|data)>/gi, ' ')
  const text = decode(cuerpo.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim()

  return { text, vigenciaNotes, highlightedFragments }
}

/**
 * Los incisos que una nota del TC declara nulos. Se cruza "hay nota de anulación" con
 * "hay fragmento destacado", que es justo la convención del BOE ("el inciso destacado").
 * Devuelve [] si no hay anulación: NO se marca nada por el mero hecho de haber un `<strong>`
 * (el BOE también resalta por otros motivos).
 */
export function getAnnulledFragments(block: BoeBlock): string[] {
  return block.vigenciaNotes.some((n) => n.esAnulacion) ? block.highlightedFragments : []
}

/** ¿Este bloque sirve texto que el TC tumbó? Sirve de guardarraíl al generar preguntas. */
export function hasAnnulledContent(block: BoeBlock): boolean {
  return getAnnulledFragments(block).length > 0
}
