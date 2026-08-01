/**
 * @jest-environment node
 */
// TRINQUETE de T-451: el planificador de huérfanos NO puede volver a ignorar los scopes
// que valen «la ley entera».
//
// Por qué hace falta un guardarraíl de código fuente y no basta con un unitario: el fallo
// no estaba en ninguna decisión, estaba en una línea de SQL. `article_numbers = NULL` es la
// convención del proyecto para «toda la ley», y el `JOIN LATERAL unnest(ts.article_numbers)`
// lo trataba como «ningún artículo» —`unnest(NULL)` no devuelve filas—, así que el scope
// entero desaparecía del análisis sin error, sin aviso y sin dejar rastro.
//
// Lo que costó, medido el 01/08 contra producción: la deuda real pasó de **10.200 a 17.730**
// artículos con texto y sin una sola pregunta (+7.530). Entre ellos, leyes con 320 huecos y
// una sola oposición detrás, y el caso que lo destapó — la Ley 4/2005 de Euskadi, con 83
// artículos y 10 preguntas, para la que la herramienta respondía «0 artículos huérfanos».
// Y esta es la herramienta por la que CLAUDE.md manda empezar ANTES de escribir preguntas:
// mientras estuvo ciega, se priorizaba sobre dos tercios del problema creyendo que era el
// total.
import { readFileSync } from 'fs'
import { join } from 'path'

const FUENTE = readFileSync(
  join(__dirname, '..', '..', 'scripts', 'huerfanos-plan.cjs'),
  'utf8',
)

describe('[T-451] huerfanos:plan cuenta los scopes de «ley entera»', () => {
  it('NO recorre los artículos con unnest(ts.article_numbers): con NULL no devuelve filas', () => {
    expect(FUENTE).not.toMatch(/unnest\(\s*ts\.article_numbers\s*\)/)
  })

  it('trata el NULL como toda la ley, con el mismo criterio que articleInScope()', () => {
    // `x = ANY(NULL)` evalúa a NULL, así que el `IS NULL OR` no es adorno: es lo único
    // que hace entrar a esos artículos.
    expect(FUENTE).toMatch(/ts\.article_numbers\s+IS\s+NULL\s+OR\s+a\.article_number\s*=\s*ANY\(\s*ts\.article_numbers\s*\)/i)
  })

  it('deja escrito POR QUÉ, para que el siguiente no lo «simplifique» de vuelta', () => {
    expect(FUENTE).toMatch(/LEY ENTERA/i)
    expect(FUENTE).toMatch(/T-451/)
  })
})
