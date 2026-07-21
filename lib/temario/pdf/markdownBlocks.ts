// lib/temario/pdf/markdownBlocks.ts — parser de markdown → bloques planos para el PDF.
//
// El contenido del temario está en markdown (la web lo pinta con react-markdown): tablas GFM
// (`| a | b |`), negrita (`**x**`), cursiva (`*x*`), cabeceras (`# x`), listas y enlaces. El PDF
// lo pintaba CRUDO (splitParagraphs solo troceaba líneas) → salían pipes, asteriscos y `#`.
//
// Aquí se parsea ese subconjunto de markdown a bloques que @react-pdf sabe maquetar. Función
// PURA y sin dependencias ESM (remark es ESM y complica jest + @react-pdf; el subconjunto que
// aparece en el contenido es acotado y se cubre con un parser propio bien testeado).

// Glifos de dibujo (box-drawing/bloques/formas, U+2500–U+25FF): artefactos de import que la
// fuente del PDF no tiene (═ = U+2550 → byte bajo 0x50 = 'P', de ahí las "PPPP"). Se eliminan.
const DECORATIVE_GLYPHS = /[\u2500-\u25ff]/g

export interface MdSpan {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
}

export type MdBlock =
  | { kind: 'paragraph'; spans: MdSpan[] }
  | { kind: 'heading'; level: number; spans: MdSpan[] }
  | { kind: 'list'; ordered: boolean; items: MdSpan[][] }
  | { kind: 'table'; header: MdSpan[][]; rows: MdSpan[][][] }

/**
 * Trocea texto inline en spans según marcas markdown: negrita, cursiva, código en línea y
 * enlaces (se queda el texto, se descarta la url). Robusto ante marcas sin cerrar: lo que no
 * casa sale como texto plano.
 */
export function parseInline(input: string): MdSpan[] {
  const text = (input || '').replace(DECORATIVE_GLYPHS, '')
  const spans: MdSpan[] = []
  // Orden importa: ** antes de *. La cursiva exige carácter no-espacio pegado al `*`, así
  // "5 * 3" (con espacios) no se toma por cursiva. Sin lookbehind (babel-jest no lo transpila).
  const re = /\*\*([^*]+?)\*\*|__([^_\n]+?)__|\*([^*\s][^*\n]*?)\*|_([^_\s][^_\n]*?)_|`([^`]+?)`|\[([^\]]+?)\]\([^)]*?\)/g
  let last = 0
  let m: RegExpExecArray | null
  const push = (t: string, mark?: Partial<MdSpan>) => {
    if (!t) return
    spans.push({ text: t, ...mark })
  }
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) push(text.slice(last, m.index))
    if (m[1] != null) push(m[1], { bold: true })
    else if (m[2] != null) push(m[2], { bold: true })
    else if (m[3] != null) push(m[3], { italic: true })
    else if (m[4] != null) push(m[4], { italic: true })
    else if (m[5] != null) push(m[5], { code: true })
    else if (m[6] != null) push(m[6]) // enlace: solo el texto
    last = re.lastIndex
  }
  if (last < text.length) push(text.slice(last))
  // Fusiona spans planos contiguos y recorta espacios sobrantes conservando separación.
  const merged: MdSpan[] = []
  for (const s of spans) {
    const prev = merged[merged.length - 1]
    if (prev && !prev.bold === !s.bold && !prev.italic === !s.italic && !prev.code === !s.code) {
      prev.text += s.text
    } else merged.push({ ...s })
  }
  return merged.map(s => ({ ...s, text: s.text.replace(/[ \t]+/g, ' ') }))
    .filter((s, i, arr) => s.text.trim() !== '' || (i > 0 && i < arr.length - 1))
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isTableSep = (l: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-')

/** Trocea una fila `| a | b | c |` en celdas (spans), quitando los pipes de borde. */
function parseRow(line: string): MdSpan[][] {
  let cells = line.trim().split('|')
  // quita el vacío inicial/final que dejan los pipes de borde
  if (cells.length && cells[0].trim() === '') cells = cells.slice(1)
  if (cells.length && cells[cells.length - 1].trim() === '') cells = cells.slice(0, -1)
  return cells.map(c => parseInline(c.trim()))
}

/**
 * Parsea el contenido markdown de un artículo a bloques (párrafos, cabeceras, listas, tablas).
 * Los saltos simples separan párrafos (el articulado usa ambos). Sanea glifos de dibujo.
 */
export function parseMarkdownBlocks(content: string | null | undefined): MdBlock[] {
  if (!content) return []
  const lines = content.replace(/\r\n/g, '\n').replace(DECORATIVE_GLYPHS, '').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.replace(/[ \t]+$/g, '')
    const trimmed = line.trim()
    if (trimmed === '') { i++; continue }

    // Tabla: fila con pipes + la SIGUIENTE es el separador |---|.
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = parseRow(line)
      i += 2 // salta cabecera + separador
      const rows: MdSpan[][][] = []
      while (i < lines.length && isTableRow(lines[i])) { rows.push(parseRow(lines[i])); i++ }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    // Cabecera markdown (# … ######).
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      blocks.push({ kind: 'heading', level: h[1].length, spans: parseInline(h[2]) })
      i++
      continue
    }

    // Lista: viñetas (- * • ·) u ordenada (N.). Se agrupan las líneas consecutivas.
    const bullet = /^\s*[-*•·]\s+(.*)$/
    const ordered = /^\s*\d+[.)]\s+(.*)$/
    if (bullet.test(trimmed) || ordered.test(trimmed)) {
      const isOrdered = ordered.test(trimmed) && !bullet.test(trimmed)
      const items: MdSpan[][] = []
      while (i < lines.length) {
        const t = lines[i].trim()
        const mb = t.match(bullet), mo = t.match(ordered)
        if (mb) items.push(parseInline(mb[1]))
        else if (mo) items.push(parseInline(mo[1]))
        else break
        i++
      }
      blocks.push({ kind: 'list', ordered: isOrdered, items })
      continue
    }

    // Párrafo normal (una línea = un párrafo, como el articulado).
    const spans = parseInline(trimmed)
    if (spans.length) blocks.push({ kind: 'paragraph', spans })
    i++
  }
  return blocks
}

/** ¿El bloque tiene texto renderizable? (para descartar artículos sin contenido útil). */
export function blocksHaveContent(blocks: MdBlock[]): boolean {
  return blocks.some(b =>
    b.kind === 'table' ? (b.header.length > 0 || b.rows.length > 0)
      : b.kind === 'list' ? b.items.length > 0
        : b.spans.some(s => s.text.trim() !== ''))
}
