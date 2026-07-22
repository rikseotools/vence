import { topicPdfContentHash, topicPdfCacheKey, TOPIC_PDF_BUCKET } from '@/lib/temario/pdf/pdfCache'

const contentA = {
  laws: [
    { articles: [{ articleNumber: '1', content: 'España se constituye…' }, { articleNumber: '2', content: 'La soberanía…' }] },
  ],
}

describe('topicPdfContentHash', () => {
  it('es determinista: mismo contenido → mismo hash', () => {
    expect(topicPdfContentHash(contentA)).toBe(topicPdfContentHash(structuredClone(contentA)))
  })

  it('16 hex chars', () => {
    expect(topicPdfContentHash(contentA)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('cambia si cambia el TEXTO de un artículo (→ invalidación automática)', () => {
    const changed = structuredClone(contentA)
    changed.laws[0].articles[0].content = 'España se constituye… (reformado)'
    expect(topicPdfContentHash(changed)).not.toBe(topicPdfContentHash(contentA))
  })

  it('cambia si cambia el NÚMERO de artículo (scope distinto)', () => {
    const changed = structuredClone(contentA)
    changed.laws[0].articles[0].articleNumber = '1 bis'
    expect(topicPdfContentHash(changed)).not.toBe(topicPdfContentHash(contentA))
  })

  it('el orden importa (no colisiona por concatenación ambigua)', () => {
    const swapped = { laws: [{ articles: [contentA.laws[0].articles[1], contentA.laws[0].articles[0]] }] }
    expect(topicPdfContentHash(swapped)).not.toBe(topicPdfContentHash(contentA))
  })

  it('no revienta con contenido vacío/nulo', () => {
    expect(topicPdfContentHash({})).toMatch(/^[0-9a-f]{16}$/)
    expect(topicPdfContentHash({ laws: [{ articles: [{ content: null }] }] })).toMatch(/^[0-9a-f]{16}$/)
  })

  it('quitar un artículo cambia el hash (separadores hacen su trabajo)', () => {
    const shorter = { laws: [{ articles: [contentA.laws[0].articles[0]] }] }
    expect(topicPdfContentHash(shorter)).not.toBe(topicPdfContentHash(contentA))
  })
})

describe('topicPdfCacheKey', () => {
  it('formato <oposicion>/<tema>-<hash>.pdf', () => {
    expect(topicPdfCacheKey('auxiliar-administrativo-madrid', 19, 'abc123def4567890'))
      .toBe('auxiliar-administrativo-madrid/19-abc123def4567890.pdf')
  })

  it('bucket lógico estable', () => {
    expect(TOPIC_PDF_BUCKET).toBe('temario-pdf')
  })
})
