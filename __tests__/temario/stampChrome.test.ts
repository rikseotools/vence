// Unit del post-proceso de chrome del PDF (nº de página + título del tema por hoja).
// Importa la función REAL de producción (stampTopicPdfChrome). Asserts estructurales robustos
// (sin poppler ni BD → corre en CI). La verificación VISUAL del texto estampado (que se lea
// "Página X de Y" y el título en su sitio) se hace con scripts/verify-temario-pdf-chrome.ts,
// que renderiza un tema real a imagen (necesita BD + poppler).
import { PDFDocument } from 'pdf-lib'
import { stampTopicPdfChrome } from '@/lib/temario/pdf/stampChrome'

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    doc.addPage([595, 842]).drawText(`Contenido de la hoja ${i + 1}`, { x: 60, y: 700, size: 12 })
  }
  return doc.save()
}

const meta = { footer: 'Vence · Oposición X · Generado el 24 de julio de 2026', title: 'Tema 7. Título de prueba' }

describe('stampTopicPdfChrome — chrome por página del PDF del temario', () => {
  it('devuelve el mismo nº de páginas que la entrada (no las duplica ni las pierde)', async () => {
    for (const n of [1, 2, 4, 20]) {
      const { pageCount } = await stampTopicPdfChrome(await makePdf(n), meta)
      expect(pageCount).toBe(n)
    }
  })

  it('produce un PDF VÁLIDO recargable con las mismas páginas (no corrompe)', async () => {
    const input = await makePdf(4)
    const { bytes } = await stampTopicPdfChrome(input, meta)
    const reloaded = await PDFDocument.load(bytes) // lanzaría si el PDF estuviera corrupto
    expect(reloaded.getPageCount()).toBe(4)
  })

  it('AÑADE contenido (el chrome estampado) — el buffer crece respecto a la entrada', async () => {
    const input = await makePdf(3)
    const { bytes } = await stampTopicPdfChrome(input, meta)
    expect(bytes.length).toBeGreaterThan(input.length)
  })

  it('rechaza entrada no-PDF (para que el caller degrade con su try/catch, no cuele basura)', async () => {
    await expect(stampTopicPdfChrome(Buffer.from('esto no es un pdf'), meta)).rejects.toBeDefined()
  })
})
