// lib/temario/pdf/stampChrome.ts
//
// Estampa el "chrome" por-página del PDF del temario: pie con "Página X de Y" y, de la 2ª hoja
// en adelante, el título del tema en la cabecera. Se hace en post-proceso con pdf-lib (NO con
// @react-pdf) A PROPÓSITO: el prop `render` de @react-pdf 4.5.1 (única vía para el nº de página)
// deja de pintar cuando el contenido va en <View wrap> — que este PDF usa en cada artículo
// (bug reproducido y aislado). pdf-lib recorre las páginas ya maquetadas y dibuja texto en los
// márgenes de forma determinista, sin tocar el flujo del contenido.
//
// Función PURA (buffer → buffer): la usan los DOS caminos de generación (worker pregenerate +
// ruta síncrona) para que el resultado sea idéntico. Nunca lanza al caller que quiera degradar:
// devuelve el buffer intacto si algo falla y deja que el caller lo registre.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface TopicPdfChromeMeta {
  /** Pie de página (p.ej. "Vence · <oposición> · Generado el <fecha>"). */
  footer: string
  /** Título del tema (se repite en la cabecera de la 2ª hoja en adelante). */
  title: string
}

const GRAY = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255) // #6b7280, igual que styles.footer
const SIZE = 8

/**
 * Devuelve un PDF nuevo con el nº de página (y el título del tema en cabecera desde la 2ª hoja).
 * `pageCount` en el resultado permite al caller registrar cuántas hojas se estamparon.
 */
export async function stampTopicPdfChrome(
  input: Uint8Array,
  meta: TopicPdfChromeMeta,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const pdf = await PDFDocument.load(input)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()
  const total = pages.length

  pages.forEach((page, i) => {
    const { width, height } = page.getSize()
    const centeredX = (text: string) => (width - font.widthOfTextAtSize(text, SIZE)) / 2

    // Pie: "<footer> · Página X de Y" — centrado abajo, dentro del margen inferior.
    const footerLine = `${meta.footer}  ·  Página ${i + 1} de ${total}`
    page.drawText(footerLine, { x: centeredX(footerLine), y: 26, size: SIZE, font, color: GRAY })

    // Cabecera repetida: título del tema, de la 2ª hoja en adelante (la 1ª ya lleva la cabecera grande).
    if (i > 0) {
      page.drawText(meta.title, { x: centeredX(meta.title), y: height - 30, size: SIZE, font, color: GRAY })
    }
  })

  const bytes = await pdf.save()
  return { bytes, pageCount: total }
}
