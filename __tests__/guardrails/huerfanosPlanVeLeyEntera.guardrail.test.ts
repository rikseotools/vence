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

const REPO = join(__dirname, '..', '..')
const FUENTE = readFileSync(join(REPO, 'scripts', 'huerfanos-plan.cjs'), 'utf8')

// ── EL MISMO PUNTO CIEGO ESTABA EN EL BARRIDO NOCTURNO (T-451, 2ª mitad) ────────────────────
// El planificador se arregló el 01/08 y quedó escrito que el patrón vivía en dos sitios más: el
// detector `article_no_coverage` del CLI y su espejo del `@Cron`. Mientras siguieran con el
// `unnest`, el BADGE arrastraba la misma ceguera — o sea, la herramienta con la que se prioriza
// veía la deuda y el panel que la vigila, no.
//
// Medido contra producción ANTES de aplicarlo, que es lo que la ficha exigía porque mueve un
// badge: **371 → 491 temas** con hallazgo (+132) y **106 → 120 oposiciones** (+14). Y **12 temas
// DEJAN de salir**, que es la señal de que el arreglo es el correcto: al entrar los artículos de
// las leyes enteras, su cobertura cae por debajo del 60 % y los excluye el filtro que el propio
// comentario del detector decía que se encargaba de las «oposiciones poco desarrolladas» — algo
// que no podía hacer mientras el `unnest` las tiraba antes de llegar a él.
//
// Los OTROS dos sitios que citaba la ficha (`scope_phantom_article`) NO son este defecto: llevan
// un `WHERE ts.article_numbers IS NOT NULL` deliberado, porque su trabajo es «un NÚMERO escopado
// sin artículo activo» y con NULL no hay números escopados que puedan ser fantasma.
const SWEEP = readFileSync(join(REPO, 'scripts', 'health-sweep.cjs'), 'utf8')
const BACKEND = readFileSync(
  join(REPO, 'backend', 'src', 'content-health-sweep', 'content-health-sweep.service.ts'),
  'utf8',
)

/** El bloque del detector de cobertura, acotado por su propio kind. */
function detectorCobertura(fuente: string): string {
  const fin = fuente.indexOf('article_no_coverage')
  expect(fin).toBeGreaterThan(0)
  const ini = fuente.lastIndexOf('FROM topic_scope ts', fin)
  expect(ini).toBeGreaterThan(0)
  return fuente.slice(ini, fin)
}

describe('[T-451] el BADGE article_no_coverage ve los scopes de «ley entera»', () => {
  it.each([
    ['CLI (health-sweep.cjs)', () => detectorCobertura(SWEEP)],
    ['backend @Cron (el writer real)', () => detectorCobertura(BACKEND)],
  ])('%s no vuelve al unnest, que con NULL no devuelve filas', (_donde, leer) => {
    expect(leer()).not.toMatch(/unnest\(\s*ts\.article_numbers\s*\)/)
  })

  it.each([
    ['CLI (health-sweep.cjs)', () => detectorCobertura(SWEEP)],
    ['backend @Cron (el writer real)', () => detectorCobertura(BACKEND)],
  ])('%s trata el NULL como toda la ley', (_donde, leer) => {
    expect(leer()).toMatch(
      /ts\.article_numbers\s+IS\s+NULL\s+OR\s+a\.article_number\s*=\s*ANY\(\s*ts\.article_numbers\s*\)/i,
    )
  })

  // La paridad CLI↔@Cron la vigila `content-sweep-parity`; aquí se fija que los DOS lados
  // llevan el arreglo, que es lo que ese otro guardarraíl no puede ver (compara kinds, no SQL).
  it('los dos gemelos llevan el arreglo, no solo uno', () => {
    for (const f of [SWEEP, BACKEND]) expect(f).toMatch(/LEY ENTERA \(T-451\)/i)
  })

  // Su exclusión del NULL es CORRECTA y no debe «arreglarse» por simetría: sin números escopados
  // no hay número que pueda ser fantasma.
  it('el detector de artículos FANTASMA conserva su IS NOT NULL a propósito', () => {
    for (const f of [SWEEP, BACKEND]) expect(f).toMatch(/ts\.article_numbers\s+IS\s+NOT\s+NULL/)
  })
})

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
