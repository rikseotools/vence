// lib/api/boe-changes/normalize.ts
//
// Normalización del texto legal del BOE para detección de cambios SIN falsos positivos.
//
// Gap real (24/07/2026): el detector marcaba `change_status='changed'` en RE-CONSOLIDACIONES
// del BOE (mismo contenido servido) porque decidía por (a) tamaño de bytes del HTML y (b) la
// fecha de "Última actualización PUBLICADA", que avanza cuando el BOE re-timbra el consolidado
// aunque no cambie ni una palabra del articulado. Verificado a mano: Ley 4/2021 FPV (art 8 100%
// idéntico) y Ley 1/2015 Hacienda GVA (155/182 exactos; el resto diferían solo por un espacio
// antes de coma que el HTML del BOE mete alrededor de los enlaces a leyes citadas).
//
// Solución (precisión arriba, recall INTACTO): normalizar el ruido DETERMINISTA (notas
// editoriales + espaciado de enlaces) y comparar SOLO el contenido legal contra NUESTROS
// artículos (la autoridad de lo que servimos). NO es una tolerancia difusa por tamaño: un
// cambio real de una sola palabra del mismo largo ("podrán"→"deberán") SÍ se detecta.

/** Marcadores que abren una NOTA EDITORIAL del BOE (metadatos de vigencia, no contenido legal). */
const EDITORIAL_MARKERS = [
  'Se modifica',
  'Se añade',
  'Se suprime',
  'Se deroga',
  'Se da nueva',
  'Se declara',
  'Se renumera',
  'Se sustituye',
  'Se suspende',
  'Se prorroga',
  'Se deja sin efecto',
  'Se corrige',
  'Se publica',
  'Ref.',
  'Última actualización',
  'Modificación publicada',
  'Texto original',
  'Seleccionar redacción',
  'Téngase en cuenta',
  'Subir',
]

/**
 * Cabeceras ESTRUCTURALES que terminan el cuerpo de un artículo (lo que viene después ya no
 * es de ese artículo). Sin esto, el último artículo se traga las Disposiciones y un "Artículo N"
 * citado dentro de una disposición contamina la extracción (simulación 24/07: FPV 191, HAC 78).
 */
const STRUCTURAL_TERMINATORS = [
  'Disposición',
  'Disposiciones',
  'TÍTULO',
  'CAPÍTULO',
  'Sección',
  'SECCIÓN',
  'LIBRO',
  'PARTE',
  'ANEXO',
  'Preámbulo',
  'PREÁMBULO',
]

const ENTITIES: Record<string, string> = {
  '&oacute;': 'ó', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&uacute;': 'ú',
  '&ntilde;': 'ñ', '&Oacute;': 'Ó', '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í',
  '&Uacute;': 'Ú', '&Ntilde;': 'Ñ', '&nbsp;': ' ', '&amp;': '&', '&laquo;': '«',
  '&raquo;': '»', '&aacute': 'á',
}

/** Decodifica las entidades HTML que usa el BOE + las numéricas comunes. */
export function decodeEntities(s: string): string {
  let out = s
  for (const [k, v] of Object.entries(ENTITIES)) out = out.split(k).join(v)
  return out
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

/**
 * Quita las notas editoriales del BOE de un bloque de texto (ya sin tags, una idea por línea).
 * Son metadatos ("Se modifica el apartado 1 por…", "Última actualización, publicada el…",
 * "[Bloque 13: #a9]") que NO forman parte del articulado y que NUESTRA BD ya no almacena.
 */
export function stripEditorialNotes(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      if (l.startsWith('[Bloque')) return false
      return !EDITORIAL_MARKERS.some((m) => l.startsWith(m))
    })
    .join('\n')
}

/**
 * Forma CANÓNICA del texto legal para comparar CONTENIDO (no para mostrar).
 * Neutraliza ruido determinista: espacio-antes-de-puntuación (artefacto de los enlaces del
 * BOE: "de 27 de abril , a las"), comillas tipográficas, NBSP y espacios múltiples. Case-
 * insensitive. NO recorta ni tolera contenido: dos textos con una palabra distinta divergen.
 */
export function normalizeLegalText(text: string): string {
  return decodeEntities(text)
    .normalize('NFC')
    .replace(/[«»“”„‟"']/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/ /g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1') // ESPACIO antes de puntuación de cierre → fuera
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Extrae el articulado del HTML consolidado del BOE → Map<numero, contenido>. El `numero`
 * incluye el modificador ("123 bis"). El contenido EXCLUYE la línea de título ("Artículo N.
 * Título.") —que en nuestra BD va en el campo `title`— y las notas editoriales posteriores.
 */
export function extractBoeArticles(html: string): Map<string, string> {
  const text = decodeEntities(html.replace(/<[^>]+>/g, '\n'))
  const map = new Map<string, string>()
  const splitRe = /(?=\nArtículo\s+\d+\s*(?:bis|ter|qu[aá]ter|quinquies)?\b)/g
  const headRe = /^\nArtículo\s+(\d+)\s*(bis|ter|qu[aá]ter|quinquies)?/

  for (const part of text.split(splitRe)) {
    const m = part.match(headRe)
    if (!m) continue
    const num = m[1] + (m[2] ? ' ' + m[2].replace('á', 'a') : '')
    const lines = part.split('\n').map((l) => l.trim()).filter(Boolean)
    // línea 0 = "Artículo N. Título."; el cuerpo va hasta la primera nota editorial.
    const body: string[] = []
    for (const l of lines.slice(1)) {
      if (l.startsWith('[Bloque')) break
      if (EDITORIAL_MARKERS.some((mk) => l.startsWith(mk))) break
      if (STRUCTURAL_TERMINATORS.some((mk) => l.startsWith(mk))) break
      body.push(l)
    }
    // Si el artículo se repite (raro), conserva el de MÁS contenido (evita quedarse un stub).
    const joined = body.join(' ')
    if (!map.has(num) || joined.length > (map.get(num) as string).length) map.set(num, joined)
  }
  return map
}

export interface OurArticle {
  content: string
  active: boolean
}

export interface ChangeVerdict {
  /** true SOLO si el contenido legal SERVIDO cambió de verdad (no ruido). */
  isRealChange: boolean
  /** Números de artículo con cambio real (":removed" si lo servimos y ya no está en el BOE). */
  changedArticles: string[]
  reason: string
}

/**
 * Decide si hay un cambio REAL comparando NUESTROS artículos (lo que servimos) contra los del
 * BOE, ambos normalizados. Un artículo cuenta SOLO si es `active` (lo servimos). Los inactivos
 * (suprimidos ya gestionados), las notas editoriales y el espaciado de enlaces NO disparan.
 * Un artículo activo que YA NO está en el BOE (derogado) SÍ es cambio real.
 */
export function classifyContentChange(
  ours: Map<string, OurArticle>,
  boe: Map<string, string>,
): ChangeVerdict {
  const changed: string[] = []

  for (const [num, boeText] of boe) {
    const our = ours.get(num)
    if (!our || !our.active) continue // no lo servimos → no es cambio de contenido servido
    if (normalizeLegalText(our.content) !== normalizeLegalText(boeText)) changed.push(num)
  }
  for (const [num, our] of ours) {
    // Solo artículos NUMERADOS: el preámbulo y las disposiciones (adicionales/transitorias/
    // finales) no los extrae `extractBoeArticles`, así que un "no está en el BOE" para ellos
    // sería un falso "removed" (simulación 24/07: preámbulo). Su vigencia se vigila aparte.
    if (our.active && /^\d/.test(num) && !boe.has(num)) changed.push(`${num}:removed`)
  }

  changed.sort((a, b) => parseInt(a) - parseInt(b))
  return {
    isRealChange: changed.length > 0,
    changedArticles: changed,
    reason: changed.length
      ? `contenido servido difiere en ${changed.length} artículo(s): ${changed.join(', ')}`
      : 'sin cambio real (solo notas editoriales / espaciado de enlaces del BOE / artículos inactivos)',
  }
}

/**
 * Fecha de vigencia como METADATO (informativa/corroborante, no decisoria): el BOE expone
 * "Última actualización, publicada el DD/MM/YYYY". NO se usa para decidir el cambio porque
 * avanza en re-consolidaciones; la decisión la da `classifyContentChange`. Se conserva para
 * mostrarla y auditar.
 */
export function extractVigenciaDate(html: string): string | null {
  const clean = decodeEntities(html)
  const patterns = [
    /Última actualización,? publicada el (\d{2}\/\d{2}\/\d{4})/i,
    /Texto consolidado.*?(\d{2}\/\d{2}\/\d{4})/i,
  ]
  for (const p of patterns) {
    const m = clean.match(p)
    if (m?.[1] && /^\d{2}\/\d{2}\/\d{4}$/.test(m[1])) return m[1]
  }
  return null
}
