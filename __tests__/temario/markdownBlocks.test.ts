/**
 * @jest-environment node
 */
import { parseInline, parseMarkdownBlocks, blocksHaveContent } from '@/lib/temario/pdf/markdownBlocks'

describe('parseInline', () => {
  it('negrita, cursiva, código y enlace (solo el texto)', () => {
    expect(parseInline('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }])
    expect(parseInline('un *cursiva* fin')).toEqual([{ text: 'un ' }, { text: 'cursiva', italic: true }, { text: ' fin' }])
    expect(parseInline('ver `art. 5`')).toEqual([{ text: 'ver ' }, { text: 'art. 5', code: true }])
    // El enlace se queda con el texto (sin url); al ser plano, se fusiona con el texto contiguo.
    expect(parseInline('ver [el BOE](https://boe.es) hoy')).toEqual([{ text: 'ver el BOE hoy' }])
  })
  it('texto sin marcas → un span plano; no rompe con asteriscos sueltos', () => {
    expect(parseInline('texto normal')).toEqual([{ text: 'texto normal' }])
    expect(parseInline('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15' }])
  })
  it('elimina glifos de dibujo también inline', () => {
    expect(parseInline('a ─ b ● c')).toEqual([{ text: 'a b c' }])
  })
})

describe('parseMarkdownBlocks — tablas GFM', () => {
  it('parsea la tabla de reformas de CE art 0 en cabecera + filas', () => {
    const md = `CUADRO RESUMEN:
| Reforma | Año | Objeto |
|---|---|---|
| 1ª | 1992 | Sufragio pasivo UE |
| 2ª | 2011 | Estabilidad presupuestaria |`
    const blocks = parseMarkdownBlocks(md)
    expect(blocks[0]).toEqual({ kind: 'paragraph', spans: [{ text: 'CUADRO RESUMEN:' }] })
    const table = blocks[1]
    expect(table.kind).toBe('table')
    if (table.kind === 'table') {
      expect(table.header.map(c => c[0].text)).toEqual(['Reforma', 'Año', 'Objeto'])
      expect(table.rows).toHaveLength(2)
      expect(table.rows[0].map(c => c[0].text)).toEqual(['1ª', '1992', 'Sufragio pasivo UE'])
    }
  })
  it('NO confunde una línea con un solo pipe (sin separador) con tabla', () => {
    const blocks = parseMarkdownBlocks('El artículo | y algo más.')
    expect(blocks[0].kind).toBe('paragraph')
  })
})

describe('parseMarkdownBlocks — cabeceras, listas, párrafos', () => {
  it('cabecera # con nivel', () => {
    const b = parseMarkdownBlocks('# Título grande')
    expect(b[0]).toEqual({ kind: 'heading', level: 1, spans: [{ text: 'Título grande' }] })
  })
  it('lista con viñetas y lista ordenada', () => {
    const b = parseMarkdownBlocks('- uno\n- dos\n\n1. primero\n2. segundo')
    expect(b[0]).toMatchObject({ kind: 'list', ordered: false })
    expect((b[0] as any).items.map((it: any) => it[0].text)).toEqual(['uno', 'dos'])
    expect(b[1]).toMatchObject({ kind: 'list', ordered: true })
  })
  it('cada línea de texto es un párrafo; los saltos en blanco se ignoran', () => {
    const b = parseMarkdownBlocks('Párrafo uno.\n\nPárrafo dos con **negrita**.')
    expect(b).toHaveLength(2)
    expect(b[0]).toEqual({ kind: 'paragraph', spans: [{ text: 'Párrafo uno.' }] })
    expect((b[1] as any).spans.some((s: any) => s.bold)).toBe(true)
  })
  it('el ═══ decorativo (fix "PPPP") desaparece del todo', () => {
    const b = parseMarkdownBlocks('Texto.\n\n═══════════════\n\nMás texto.')
    expect(b).toEqual([
      { kind: 'paragraph', spans: [{ text: 'Texto.' }] },
      { kind: 'paragraph', spans: [{ text: 'Más texto.' }] },
    ])
  })
})

describe('blocksHaveContent', () => {
  it('detecta bloques con y sin texto', () => {
    expect(blocksHaveContent(parseMarkdownBlocks('hola'))).toBe(true)
    expect(blocksHaveContent(parseMarkdownBlocks('   \n  '))).toBe(false)
    expect(blocksHaveContent(parseMarkdownBlocks('| a | b |\n|---|---|\n| 1 | 2 |'))).toBe(true)
  })
})

describe('listas ordenadas — número real, no el índice (bug Lola 22/07)', () => {
  it('apartados separados por línea en blanco conservan su número (1,2,3), no todos "1"', () => {
    // El articulado legal separa apartados con \n\n → cada uno cae como lista de 1 ítem. Sin
    // capturar el número del origen, el marcador salía del índice (siempre 1) → todos "1" en el PDF.
    const md = '1. Primero.\n\n2. Segundo.\n\n3. Tercero.'
    const lists = parseMarkdownBlocks(md).filter((b) => b.kind === 'list')
    expect(lists).toHaveLength(3)
    expect(lists.map((l) => (l.kind === 'list' ? l.start : null))).toEqual([1, 2, 3])
    // El texto capturado es el del apartado, sin el número.
    expect(lists[1].kind === 'list' && lists[1].items[0][0].text).toBe('Segundo.')
  })

  it('lista ordenada consecutiva (sin líneas en blanco) empieza en su número y es un solo bloque', () => {
    const [list] = parseMarkdownBlocks('2. dos\n3. tres\n4. cuatro')
    expect(list.kind).toBe('list')
    if (list.kind === 'list') {
      expect(list.start).toBe(2)
      expect(list.items).toHaveLength(3)
    }
  })

  it('viñetas no llevan start (no son ordenadas)', () => {
    const [list] = parseMarkdownBlocks('- uno\n- dos')
    expect(list.kind === 'list' && list.ordered).toBe(false)
    expect(list.kind === 'list' && list.start).toBeUndefined()
  })
})
