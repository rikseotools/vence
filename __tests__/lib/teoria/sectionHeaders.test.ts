import { sectionForArticle, sectionHeadersByArticle } from '@/lib/teoria/sectionHeaders'

const S = (title: string, start: number, end: number, orderPosition: number) => ({
  title, articleRange: { start, end }, sectionType: 'titulo', sectionNumber: orderPosition, orderPosition,
})
const secs = [S('Título I', 1, 5, 1), S('Título II', 6, 10, 2), S('Título III', 11, 20, 3)]

describe('sectionForArticle', () => {
  it('encuentra la sección que contiene el artículo', () => {
    expect(sectionForArticle('3', secs)?.title).toBe('Título I')
    expect(sectionForArticle('6', secs)?.title).toBe('Título II')
    expect(sectionForArticle('20', secs)?.title).toBe('Título III')
  })
  it('artículo con sufijo (10 bis) usa el número base', () => {
    expect(sectionForArticle('10 bis', secs)?.title).toBe('Título II')
  })
  it('artículo fuera de todo rango → null', () => {
    expect(sectionForArticle('99', secs)).toBeNull()
  })
  it('artículo no numérico (preámbulo) → null', () => {
    expect(sectionForArticle('preambulo', secs)).toBeNull()
  })
})

describe('sectionHeadersByArticle', () => {
  const art = (id: string, n: string) => ({ id, article_number: n })

  it('marca solo el PRIMER artículo de cada sección', () => {
    const m = sectionHeadersByArticle(
      [art('a', '1'), art('b', '2'), art('c', '6'), art('d', '7')],
      secs,
    )
    expect(m.get('a')?.title).toBe('Título I')   // abre Título I
    expect(m.has('b')).toBe(false)                // sigue en Título I
    expect(m.get('c')?.title).toBe('Título II')  // abre Título II
    expect(m.has('d')).toBe(false)
  })

  it('con artículos FILTRADOS, el primer visible de cada sección abre su cabecera', () => {
    // solo se muestran arts 3 y 8 (filtro por título): cada uno abre su sección
    const m = sectionHeadersByArticle([art('c', '3'), art('h', '8')], secs)
    expect(m.get('c')?.title).toBe('Título I')
    expect(m.get('h')?.title).toBe('Título II')
  })

  it('artículos sin sección no rompen (no marcan cabecera)', () => {
    const m = sectionHeadersByArticle([art('x', '99'), art('a', '1')], secs)
    expect(m.has('x')).toBe(false)
    expect(m.get('a')?.title).toBe('Título I')
  })

  it('ley sin secciones → mapa vacío (la teoría se ve igual que hoy)', () => {
    expect(sectionHeadersByArticle([art('a', '1'), art('b', '2')], []).size).toBe(0)
  })
})
