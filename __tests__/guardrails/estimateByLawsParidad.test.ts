// GUARDARRAÍL: la estimación "por leyes" es UNA, en dos copias. [T-326]
//
// POR QUÉ EXISTE, y no es teórico: el arreglo de T-326 se escribió SOLO en el frontend
// (`lib/api/test-config/queries.ts`) y llegó a producción **inerte**. La familia `test-config`
// está enrutada al backend NestJS (`lib/api/backend-router.ts`), así que el camino que se
// ejecuta es el del backend, que seguía contestando «topicNumber es requerido para estimar».
// El código estaba desplegado, los tests en verde y la simulación contra la BD también: las
// dos capas eran correctas y ninguna podía ver que miraban el camino que nadie ejecuta.
//
// Este guardarraíl compara lo que IMPORTA —las decisiones de conteo— y no el formato: uno es
// TypeScript de Nest con `this.db` y el otro una función suelta con `db`, así que exigir
// identidad textual haría fallar el test por un punto y coma.

import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const front = readFileSync(join(raiz, 'lib/api/test-config/queries.ts'), 'utf8')
const back = readFileSync(join(raiz, 'backend/src/test-config/test-config.service.ts'), 'utf8')
const controller = readFileSync(join(raiz, 'backend/src/test-config/test-config.controller.ts'), 'utf8')

/** El cuerpo de `estimateByLaws` en cada copia, sin el resto del fichero. */
function cuerpoEstimateByLaws(src: string): string {
  const i = src.indexOf('estimateByLaws(')
  expect(i).toBeGreaterThan(-1)
  // Hasta la siguiente declaración de función/método a nivel de bloque.
  const resto = src.slice(i)
  const fin = resto.indexOf('\n  async estimateAvailableQuestions')
  return fin > 0 ? resto.slice(0, fin) : resto.slice(0, 8000)
}

describe('paridad de la estimación por leyes (frontend ↔ backend)', () => {
  it('LAS DOS existen — tenerla en un solo lado es exactamente el defecto de T-326', () => {
    expect(front).toContain('estimateByLaws')
    expect(back).toContain('estimateByLaws')
  })

  it('el backend YA NO contesta «topicNumber es requerido» cuando no hay tema', () => {
    // Ese mensaje era la prueba de que el camino vivo no sabía contar sin tema. Si alguien
    // lo reintroduce, la casilla de oficiales vuelve a no pintarse en /test/por-leyes.
    expect(back).not.toContain('topicNumber es requerido para estimar')
  })

  it('las dos cuentan oficiales SOLO de la propia oposición', () => {
    // Contar cross-oposición infla el número sobre leyes compartidas (CE, LOTC…) y la
    // casilla mentiría: el label diría 115 donde el test sirve 1.
    for (const src of [front, back]) {
      expect(cuerpoEstimateByLaws(src)).toContain('getValidExamPositions')
    }
  })

  it('las dos tienen el fail-safe de oposición sin oficiales propias', () => {
    // Sin este corte, una oposición fuera de EXAM_POSITION_MAP se quedaría sin filtro de
    // posiciones y contaría las oficiales de TODAS las demás.
    for (const src of [front, back]) {
      const cuerpo = cuerpoEstimateByLaws(src)
      expect(cuerpo).toMatch(/validPositions\.length === 0/)
    }
  })

  it('las dos aplican los mismos filtros de conteo', () => {
    for (const src of [front, back]) {
      const cuerpo = cuerpoEstimateByLaws(src)
      expect(cuerpo).toContain('applyArticleSectionFilter') // secciones → artículos
      expect(cuerpo).toContain('isOfficialExam')            // solo oficiales
      expect(cuerpo).toContain('examPosition')              // …y de esta oposición
      expect(cuerpo).toContain('globalDifficultyCategory')  // dificultad
    }
  })

  it('las dos respetan `article_numbers IS NULL` = toda la ley al acotar al temario', () => {
    // `x = ANY(NULL)` evalúa a NULL en Postgres: sin esta guarda, un scope de ley entera
    // (ley virtual) contaría CERO y el número saldría a 0 sin que nada fallase.
    expect(front).toContain('articleInPositionScopeExists')
    expect(back).toMatch(/ts\.article_numbers IS NULL OR/)
  })

  it('el controlador del backend LEE `scopeToPosition` del query', () => {
    // Si no lo lee, el servicio lo ve siempre `undefined` y cuenta la ley entera aunque el
    // usuario haya acotado al temario: el número no cuadraría con la lista que tiene delante.
    expect(controller).toContain("query.scopeToPosition === 'true'")
  })

  // El endpoint HERMANO. Encontrado al portar `estimate`: el mismo parámetro existía en el
  // frontend y el backend lo ignoraba entero, así que `/test/por-leyes` estaba enseñando
  // artículos FUERA del temario del usuario — el defecto que el filtro vino a arreglar.
  it('el endpoint `articles` del backend también acota al temario', () => {
    expect(back).toMatch(/params\.scopeToPosition && !topicNumber/)
    expect(controller).toMatch(/scopeToPosition: query\.scopeToPosition === 'true'/)
  })

  it('…y su clave de caché lo distingue', () => {
    const linea = controller.split('\n').find((l) => l.includes('`articles:'))
    expect(linea).toBeDefined()
    expect(linea).toContain('scopeToPosition')
  })

  it('y lo mete EN LA CLAVE DE CACHÉ', () => {
    // Omitirlo hace que dos selecciones distintas compartan entrada y la segunda lea el
    // número de la primera. Es el bug que ya se encontró en el normalizador del frontend.
    // Ojo: hay varios `const subKey` en el controlador (uno por endpoint). El que importa
    // aquí es el de `estimate`; buscar el primero a secas cogía el de `articles`.
    const linea = controller.split('\n').find((l) => l.includes('`estimate:t'))
    expect(linea).toBeDefined()
    expect(linea).toContain('scopeToPosition')
  })

  // [T-411] Mismo motivo que scopeToPosition, mismo sitio: la casilla "🏛️ Preguntas
  // oficiales" pasa de contar solo las propias a contar propias+compartidas — dos números
  // distintos que no pueden compartir entrada de caché.
  it('las dos cuentan las oficiales COMPARTIDAS cuando se pide includeSharedOfficials', () => {
    for (const src of [front, back]) {
      expect(cuerpoEstimateByLaws(src)).toContain('includeSharedOfficials')
    }
  })

  it('el controlador del backend LEE `includeSharedOfficials` en GET y POST', () => {
    expect(controller).toContain("query.includeSharedOfficials === 'true'")
    expect(controller).toContain('body?.includeSharedOfficials === true')
  })

  it('…y lo mete EN LA CLAVE DE CACHÉ de `estimate` (mismo riesgo que scopeToPosition)', () => {
    const linea = controller.split('\n').find((l) => l.includes('`estimate:t'))
    expect(linea).toBeDefined()
    expect(linea).toContain('includeSharedOfficials')
  })
})
