/**
 * @jest-environment node
 */
// El worker pre-genera las MISMAS partes que la ruta pedirá (T-273).
//
// ## Lo que se juega aquí
//
// La ruta busca cada parte en S3 por una clave que sale del hash de SU contenido recortado. Si el
// worker generase las partes con otro recorte, otro plan o en otro orden, las claves NO coincidirían
// y la ruta no encontraría nada: volvería a renderizar en línea, con el opositor esperando, que es
// exactamente el trabajo pesado que el 29/07 tumbó la plataforma.
//
// Y el defecto sería INVISIBLE, porque todo "funcionaría": el usuario recibiría su PDF, solo que
// pagándolo con la web de todos. Por eso esto se fija con un test y no con una lectura del código.

import { topicPdfContentHash, topicPdfCacheKey } from '@/lib/temario/pdf/pdfCache'
import { PDF_MAX_CHARS, countContentChars, fitsSyncPdf, maxArticleChars } from '@/lib/temario/pdf/topicPdfModel'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { planPartes } = require('@/lib/temario/pdf/planPartes.cjs')

/** Un tema con varias leyes grandes: el caso real que no cabe entero. */
function temaGrande() {
  const ley = (id: string, nArts: number, chars: number) => ({
    law: { id, short_name: `Ley ${id}`, name: `Ley ${id}` },
    articles: Array.from({ length: nArts }, (_, i) => ({
      // camelCase: es la grafía que produce `lib/api/temario/queries.ts` en producción.
      id: `${id}-a${i}`, articleNumber: String(i + 1), title: `Art ${i + 1}`,
      content: `${id}-${i} ` + 'x'.repeat(chars),
    })),
  })
  return {
    topic: { topic_number: 9, title: 'Tema grande' },
    laws: [ley('A', 6, 40_000), ley('B', 6, 40_000), ley('C', 6, 40_000)],
  } as never
}

describe('pre-generación de partes en el worker', () => {
  const tema = temaGrande()

  it('el tema de prueba efectivamente NO cabe entero (si no, el test no probaría nada)', () => {
    expect(fitsSyncPdf(countContentChars(tema), maxArticleChars(tema))).toBe(false)
    expect(planPartes(tema, PDF_MAX_CHARS).total).toBeGreaterThan(1)
  })

  it('🎯 la clave que genera el worker es la MISMA que la que busca la ruta', () => {
    const plan = planPartes(tema, PDF_MAX_CHARS)

    for (const parte of plan.partes) {
      // Worker: copia del contenido con las leyes de la parte (`pregenerarPartes`).
      const delWorker = topicPdfCacheKey('x-op', 9, topicPdfContentHash({ ...tema, laws: parte.laws } as never))

      // Ruta: MUTA `content.laws` con las leyes de la parte elegida y hashea (route.ts §PARTE).
      const comoLaRuta = { ...tema } as { laws: unknown }
      comoLaRuta.laws = parte.laws
      const deLaRuta = topicPdfCacheKey('x-op', 9, topicPdfContentHash(comoLaRuta as never))

      expect(delWorker).toBe(deLaRuta)
    }
  })

  it('cada parte tiene clave DISTINTA: cambiar un capítulo no invalida las demás', () => {
    const plan = planPartes(tema, PDF_MAX_CHARS)
    const claves = plan.partes.map((p: { laws: unknown }) =>
      topicPdfCacheKey('x-op', 9, topicPdfContentHash({ ...tema, laws: p.laws } as never)))
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('ninguna parte comparte clave con el tema ENTERO (no se pisan en S3)', () => {
    const entero = topicPdfCacheKey('x-op', 9, topicPdfContentHash(tema))
    const plan = planPartes(tema, PDF_MAX_CHARS)
    for (const p of plan.partes) {
      expect(topicPdfCacheKey('x-op', 9, topicPdfContentHash({ ...tema, laws: p.laws } as never))).not.toBe(entero)
    }
  })

  it('el plan es DETERMINISTA: dos ejecuciones dan las mismas partes en el mismo orden', () => {
    // Si no lo fuera, el worker y la ruta podrían trocear distinto en momentos distintos.
    const a = planPartes(tema, PDF_MAX_CHARS).partes.map((p: { etiqueta: string }) => p.etiqueta)
    const b = planPartes(tema, PDF_MAX_CHARS).partes.map((p: { etiqueta: string }) => p.etiqueta)
    expect(a).toEqual(b)
  })

  it('🎯 las partes de una MISMA ley se distinguen por su rango de artículos', () => {
    // Regresión: `etiqueta()` leía `article_number` y el contenido real trae `articleNumber`, así
    // que al partir una ley el rango salía vacío y todas las partes se llamaban IGUAL. El usuario
    // se descargaba varios ficheros sin poder distinguirlos.
    const unaLeyEnorme = {
      topic: { topic_number: 5, title: 'Una sola ley' },
      laws: [{
        law: { id: 'Z', short_name: 'Ley Z', name: 'Ley Z' },
        articles: Array.from({ length: 12 }, (_, i) => ({
          id: `z${i}`, articleNumber: String(i + 1), title: `Art ${i + 1}`,
          content: `z${i} ` + 'x'.repeat(40_000),
        })),
      }],
    } as never
    const plan = planPartes(unaLeyEnorme, PDF_MAX_CHARS)
    expect(plan.total).toBeGreaterThan(1)
    const etiquetas = plan.partes.map((p: { etiqueta: string }) => p.etiqueta)
    expect(new Set(etiquetas).size).toBe(etiquetas.length)
    expect(etiquetas.join(' ')).toMatch(/arts?\. /)
  })

  it('un tema que SÍ cabe no se trocea (no se cambia lo que ya funciona)', () => {
    const pequeno = {
      topic: { topic_number: 1, title: 'Tema normal' },
      laws: [{ law: { id: 'A', short_name: 'Ley A', name: 'Ley A' }, articles: [{ id: 'a1', article_number: '1', title: 'Art 1', content: 'x'.repeat(500) }] }],
    } as never
    expect(fitsSyncPdf(countContentChars(pequeno), maxArticleChars(pequeno))).toBe(true)
  })
})
