/**
 * @jest-environment node
 */
// Contrato entre las DOS herramientas del pipeline de generación: `insertar-batch-generado.cjs`
// acepta la ley del lote como argumento de CLI, y el manual manda escribir los borradores sin
// `law_slug` por pregunta cuando el lote es de una sola ley. El simulador (Paso 3.bis, obligatorio
// ANTES de insertar) resolvía el artículo únicamente por `law_slug` + número, así que ese mismo
// borrador simulaba con la ley `undefined` y devolvía "artículo inexistente o inactivo" en TODAS
// las preguntas: un bloqueante que parece de datos y era de firma (28/07/2026, Ley 7/1985, 13/13).
//
// Se testea la función REAL de producción, no una copia.
const { aplicarLeyPorDefecto } = require('@/lib/generacion/simularBatch.js')

const q = (over = {}) => ({ primary_article_number: '89', question_text: 'x', ...over })

describe('aplicarLeyPorDefecto — el borrador del INSERTER también se puede simular', () => {
  it('rellena la ley del lote en las preguntas que no la traen', () => {
    const out = aplicarLeyPorDefecto([q(), q({ primary_article_number: '90' })], 'ley-7-1985')
    expect(out.map((x) => x.law_slug)).toEqual(['ley-7-1985', 'ley-7-1985'])
  })

  it('NO pisa la ley propia de la pregunta (lotes multi-ley)', () => {
    const out = aplicarLeyPorDefecto([q({ law_slug: 'ley-40-2015' }), q()], 'ley-7-1985')
    expect(out.map((x) => x.law_slug)).toEqual(['ley-40-2015', 'ley-7-1985'])
  })

  it('deja intactas las preguntas ancladas por primary_article_id (el otro formato que circula)', () => {
    const out = aplicarLeyPorDefecto([{ primary_article_id: 'uuid-1' }], 'ley-7-1985')
    expect(out[0].law_slug).toBeUndefined()
    expect(out[0].primary_article_id).toBe('uuid-1')
  })

  it('sin ley por CLI no inventa nada (se conserva el comportamiento anterior)', () => {
    const out = aplicarLeyPorDefecto([q()], null)
    expect(out[0].law_slug).toBeUndefined()
  })

  it('no muta el borrador de entrada', () => {
    const entrada = [q()]
    aplicarLeyPorDefecto(entrada, 'ley-7-1985')
    expect(entrada[0].law_slug).toBeUndefined()
  })
})
