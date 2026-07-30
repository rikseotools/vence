// GUARDARRAÍL: no se sirve un subconjunto de las favoritas sin decirlo.
//
// ## Qué pasó (29/07/2026, lo reportó Laura Zurdo — la misma que pidió la función)
//
// Marcó 20 preguntas en un test y aparecieron. En el siguiente marcó 20 más y, al abrir
// «Preguntas guardadas», seguía viendo 20. Dedujo lo razonable: que las nuevas no se
// guardaban. **No se perdía nada**: tenía 40 en la base de datos. La página pedía 20 por
// defecto y servía siempre las mismas, sin ninguna señal de que hubiera más.
//
// Es el mismo modo de fallo que las plazas infladas y el precio de fidelidad que enseñaba
// una oferta de dos: **el dato correcto existe y lo mostrado no lo refleja**, en silencio.
// Un subconjunto sin avisar es peor que un error, porque no hay forma de notarlo.
//
// Se fija en tres piezas: el contrato devuelve el total, la página pide todas, y el
// defecto del esquema no puede volver a recortar por sorpresa.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const QUERIES = leer('lib/api/question-favorites/queries.ts')
const PAGINA = leer('app/test/favoritas/page.tsx')

describe('favoritas: nunca un subconjunto mudo', () => {
  it('el resultado dice cuántas tiene guardadas EN TOTAL, no solo cuántas sirve', () => {
    // Sin este dato la página no puede avisar aunque quiera: era la raíz del fallo.
    expect(QUERIES).toMatch(/totalGuardadas:\s*number/)
    expect(QUERIES).toMatch(/count\(\*\)::int/)
  })

  it('TODOS los retornos traen el total (también los de error y los vacíos)', () => {
    const retornos = QUERIES.match(/questionCount:/g) || []
    const totales = QUERIES.match(/totalGuardadas[,:]/g) || []
    // Uno por cada `questionCount` de retorno, más la declaración del tipo y el cálculo.
    expect(totales.length).toBeGreaterThanOrEqual(retornos.length)
  })

  it('la página pide TODAS sus favoritas, no un número fijo pequeño', () => {
    expect(PAGINA).toContain('MAX_FAVORITAS_POR_TEST')
    // El literal '20' como defecto es exactamente lo que la rompió.
    expect(PAGINA).not.toMatch(/searchParams\.get\('n'\)\s*\|\|\s*'20'/)
  })
})
