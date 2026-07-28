/**
 * TRINQUETE: el criterio de «¿la cita está literal en el artículo?» es UNO solo.
 *
 * Historia: `barrido-citas.cjs` tenía su propia copia (`slice(0, 70)`) mientras el guardarraíl
 * `validar-explicacion.cjs` comparaba la cita entera. Consecuencia medida: la campaña «citas
 * ajenas» de julio (837 resueltas) inventarió solo las citas que divergen en sus primeras 70
 * letras — y el arranque de un precepto es genérico, mientras que lo que decide la respuesta
 * (plazos, mayorías, órgano competente) vive al final. 13.424 preguntas activas (30,7%) quedaron
 * fuera del inventario sin que nadie lo supiera.
 *
 * Lo que fija este test: que el barrido y el guardarraíl den el MISMO veredicto sobre el mismo
 * texto. Si alguien vuelve a escribir un criterio propio en cualquiera de los dos, esto se rompe.
 */
import path from 'path'
const { citaNoLiteral, validateQuotes } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

const ART_4_CE =
  'Artículo 4. 1. La bandera de España está formada por tres franjas horizontales, roja, amarilla y ' +
  'roja, siendo la amarilla de doble anchura que cada una de las rojas.'

describe('citaNoLiteral — núcleo único del criterio', () => {
  test('una cita literal pasa', () => {
    expect(citaNoLiteral('La bandera de España está formada por tres franjas horizontales', ART_4_CE)).toBeNull()
  })

  test('el defecto que la copia con slice(0,70) NO veía: el final alterado', () => {
    // Los primeros 70 caracteres coinciden; lo que está invertido es el final —y es justo lo que
    // esa pregunta examina—. Con el criterio viejo esto pasaba por bueno.
    const cita = 'La bandera de España está formada por tres franjas horizontales, roja, amarilla y roja, siendo la ROJA de doble anchura que cada una de las AMARILLAS'
    // El criterio VIEJO (los primeros 70 caracteres) lo habría dado por bueno…
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ]+/g, ' ').trim()
    expect(norm(ART_4_CE).includes(norm(cita).slice(0, 70))).toBe(true)
    // …y el nuevo lo caza, porque el error vive al final, que es donde está la respuesta.
    expect(citaNoLiteral(cita, ART_4_CE)).not.toBeNull()
  })

  test('el guardarraíl y el núcleo coinciden SIEMPRE (misma decisión, mismo texto)', () => {
    const casos = [
      ['> «La bandera de España está formada por tres franjas horizontales»', false],
      ['> «La bandera de España tiene cuatro franjas verticales de color verde»', true],
      ['> **Artículo 4.1 CE**\n> «siendo la amarilla de doble anchura que cada una de las rojas»', false],
    ] as const
    for (const [expl, esperaProblema] of casos) {
      const porValidador = validateQuotes(expl, ART_4_CE).length > 0
      const quote = expl.split('\n').map((l) => l.replace(/^>\s?/, '').trim())
        .filter((l) => l && !/^\*\*[^*]+\*\*\s*:?$/.test(l)).join(' ')
      const porNucleo = citaNoLiteral(quote, ART_4_CE) !== null
      expect({ caso: expl.slice(0, 40), porValidador, porNucleo })
        .toEqual({ caso: expl.slice(0, 40), porValidador: esperaProblema, porNucleo: esperaProblema })
    }
  })
})
