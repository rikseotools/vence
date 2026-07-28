/**
 * Una CITA escrita entera en negrita sigue siendo una cita: hay que verificarla.
 *
 * Qué defiende: al arreglar T-204 (cabo 1) se añadió `esLineaDeReferencia` para que la línea del
 * rótulo —`> **Artículo 4.1 CE**`— no se exigiera literal dentro del artículo. La regla quedó
 * demasiado laxa: «línea entera en negrita» = referencia. Y en el banco hay un formato muy común
 * que escribe la CITA COMPLETA en negrita (`> **«Se entiende por expediente administrativo…»**`),
 * así que el check la descartaba entera, se quedaba sin nada que comparar y devolvía «sin
 * problemas». Un guardarraíl ciego es peor que no tenerlo: da una garantía que no existe.
 *
 * Medido el 28/07 sobre el banco vivo: **2.885 activas** con la cita así, o sea el 6,8 % de las que
 * tienen blockquote, nunca verificadas. Al afinar la regla, **1.113 de ellas (38,6 %) resultan no
 * literales** — defectos que llevaban ahí desde siempre.
 *
 * Cazado resolviendo la impugnación `533cb8db` (art. 70 LPAC), cuya cita fusiona dos apartados en
 * un único entrecomillado y pasaba limpia.
 */
const path = require('path')
const { validateQuotes } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

const ART_70 = [
  '1. Se entiende por expediente administrativo el conjunto ordenado de documentos y actuaciones que sirven de antecedente y fundamento a la resolución administrativa, así como las diligencias encaminadas a ejecutarla.',
  '',
  '2. Los expedientes tendrán formato electrónico y se formarán mediante la agregación ordenada de cuantos documentos deban integrarlos. Asimismo, deberá constar en el expediente copia electrónica certificada de la resolución adoptada.',
].join('\n')

describe('la cita en negrita se verifica igual', () => {
  it('CAZA la cita en negrita que fusiona dos apartados (no existe así en el artículo)', () => {
    const fusionada =
      '> **«Se entiende por expediente administrativo el conjunto ordenado de documentos y actuaciones que sirven de antecedente y fundamento a la resolución administrativa, así como las diligencias encaminadas a ejecutarla. Los expedientes tendrán formato electrónico y se formarán mediante la agregación ordenada de cuantos documentos deban integrarlos.»**'
    expect(validateQuotes(fusionada, ART_70)).toHaveLength(1)
  })

  it('acepta la cita en negrita que SÍ es literal', () => {
    const literal =
      '> **«Se entiende por expediente administrativo el conjunto ordenado de documentos y actuaciones que sirven de antecedente y fundamento a la resolución administrativa, así como las diligencias encaminadas a ejecutarla.»**'
    expect(validateQuotes(literal, ART_70)).toEqual([])
  })

  it('sigue sin inventar problemas cuando la negrita es de verdad el RÓTULO (lo de T-204)', () => {
    expect(validateQuotes('> **Artículo 70 de la Ley 39/2015**', ART_70)).toEqual([])
    expect(validateQuotes('> **Art. 70.2 LPAC:**', ART_70)).toEqual([])
    expect(validateQuotes('> **Ley 39/2015, artículo 70**', ART_70)).toEqual([])
  })

  it('rótulo + cita en dos líneas: se verifica solo la cita', () => {
    const dos = ['> **Artículo 70.2 de la Ley 39/2015**', '> Los expedientes tendrán formato electrónico'].join('\n')
    expect(validateQuotes(dos, ART_70)).toEqual([])
  })
})
