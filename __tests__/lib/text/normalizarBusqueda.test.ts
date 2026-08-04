/**
 * Normalizar texto para BUSCAR. [T-521]
 *
 * El desplegable de las migas —que es el único sitio donde se cambia de oposición— filtraba con
 * `label.toLowerCase().includes(term)`, o sea que EXIGÍA la tilde. Los casos de aquí no son
 * inventados: son etiquetas reales del catálogo, y con ese filtro escribir «almeria» o «leon»
 * no encontraba nada.
 *
 * La función es la que ya usaba el catálogo del chat: se extrajo para que no hubiera dos copias
 * del mismo criterio. NO es la de los slugs (`lawSlugSync`), que tiene otro propósito y no debe
 * unificarse — cambiar la búsqueda no puede renombrar URLs.
 */
import { normalizarBusqueda, coincideBusqueda } from '@/lib/text/normalizarBusqueda'

describe('normalizarBusqueda', () => {
  it('quita tildes y baja a minúsculas', () => {
    expect(normalizarBusqueda('Almería')).toBe('almeria')
    expect(normalizarBusqueda('LEÓN')).toBe('leon')
    expect(normalizarBusqueda('Cádiz')).toBe('cadiz')
  })

  it('la ñ también cae a n, y para buscar está BIEN', () => {
    // El código engaña: el `[^a-z0-9ñ\s]` parece conservarla, pero cuando se ejecuta la ñ ya se
    // descompuso en n + virgulilla y el barrido de tildes se llevó la segunda. Se fija aquí para
    // que nadie lo «arregle» creyendo que es un fallo: quien escribe «espana» encuentra «España»,
    // y distinguir «año» de «ano» no importa en un nombre de oposición.
    expect(normalizarBusqueda('España')).toBe('espana')
    expect(coincideBusqueda('Ayuntamiento de La Coruña', 'coruna')).toBe(true)
  })

  it('colapsa espacios y quita puntuación y emojis', () => {
    expect(normalizarBusqueda('  🎓 Auxiliar   Administrativo  ')).toBe('auxiliar administrativo')
  })

  it('null/undefined dan cadena vacía, no revientan', () => {
    expect(normalizarBusqueda(null)).toBe('')
    expect(normalizarBusqueda(undefined)).toBe('')
  })
})

describe('coincideBusqueda — los casos que fallaban de verdad', () => {
  const ALMERIA = '🎓 Auxiliar Administrativo de la Universidad de Almería'
  const LEON = '🎓 Administrativo Universidad de León'

  it('SIN tilde encuentra CON tilde (el fallo que lo motiva)', () => {
    expect(coincideBusqueda(ALMERIA, 'almeria')).toBe(true)
    expect(coincideBusqueda(LEON, 'leon')).toBe(true)
  })

  it('con tilde sigue encontrando (no se rompe lo que ya iba)', () => {
    expect(coincideBusqueda(ALMERIA, 'almería')).toBe(true)
    expect(coincideBusqueda(LEON, 'león')).toBe(true)
  })

  it('da igual mayúsculas', () => {
    expect(coincideBusqueda(ALMERIA, 'ALMERIA')).toBe(true)
    expect(coincideBusqueda(ALMERIA, 'Universidad')).toBe(true)
  })

  it('sigue sin encontrar lo que NO está (no se ha vuelto permisiva)', () => {
    expect(coincideBusqueda(ALMERIA, 'granada')).toBe(false)
    expect(coincideBusqueda(LEON, 'almeria')).toBe(false)
  })

  it('sin término no filtra: el desplegable enseña todo', () => {
    expect(coincideBusqueda(ALMERIA, '')).toBe(true)
    expect(coincideBusqueda(ALMERIA, '   ')).toBe(true)
    expect(coincideBusqueda(ALMERIA, null)).toBe(true)
  })

  it('el emoji de la etiqueta no estorba a la búsqueda', () => {
    expect(coincideBusqueda(ALMERIA, 'auxiliar administrativo')).toBe(true)
  })
})
