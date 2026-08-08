/**
 * Tests del helper matchesOposicion — fuente única de filtrado por término
 * de búsqueda. Antes la lógica estaba duplicada en 3 componentes
 * (OnboardingModal, OposicionChangeModal, OposicionGuard) cada uno con
 * implementación ligeramente distinta. Ahora todos importan de aquí.
 *
 * Bug histórico que motivó la refactor (07-may-2026): buscar "gva" en el
 * modal de cambio de oposición no encontraba "Administrativo Generalitat
 * Valenciana" porque solo se filtraba por nombre/categoria/administracion,
 * ignorando aliases. La refactor mueve aliases al config central de
 * lib/config/oposiciones.ts y centraliza el filtrado aquí.
 */

import { matchesOposicion, coverageLevelRank, sortByCoverageLevel, findBuiltEquivalent, builtDisplayName } from '@/lib/utils/searchOposicion'

describe('matchesOposicion', () => {
  const opo = {
    id: 'admin_gva',
    nombre: 'Administrativo Generalitat Valenciana',
    categoria: 'C1',
    administracion: 'Autonómica',
    aliases: ['gva', 'c1-01 gva', 'administrativo valencia'],
  }

  test('término vacío matchea siempre', () => {
    expect(matchesOposicion(opo, '')).toBe(true)
    expect(matchesOposicion(opo, '   ')).toBe(true)
  })

  test('matchea por nombre completo', () => {
    expect(matchesOposicion(opo, 'administrativo')).toBe(true)
    expect(matchesOposicion(opo, 'generalitat')).toBe(true)
  })

  test('matchea por categoría', () => {
    expect(matchesOposicion(opo, 'c1')).toBe(true)
  })

  test('matchea por administración', () => {
    expect(matchesOposicion(opo, 'autonomica')).toBe(true)
    expect(matchesOposicion(opo, 'autonómica')).toBe(true) // con tilde también
  })

  test('matchea por alias exacto', () => {
    expect(matchesOposicion(opo, 'gva')).toBe(true)
  })

  test('matchea cuando alias es substring del término (caso "c1-01 gva")', () => {
    expect(matchesOposicion(opo, 'c1-01 gva')).toBe(true)
  })

  test('matchea cuando término es substring del alias', () => {
    // Usuario escribe "administrativo val" → debe matchear alias "administrativo valencia"
    expect(matchesOposicion(opo, 'administrativo val')).toBe(true)
  })

  test('NO matchea cuando no hay coincidencia', () => {
    expect(matchesOposicion(opo, 'cantabria')).toBe(false)
    expect(matchesOposicion(opo, 'sanidad')).toBe(false)
  })

  test('NO matchea por substring corto ambiguo (anti-falsos-positivos)', () => {
    // "ge" está en "generalitat" pero buscar "geometria" no debe matchear.
    // El bug viejo era `term.includes(alias) || alias.includes(term)` que
    // hacía match si alias era substring del término. Mantenemos esa
    // semántica para el caso real (`'c1-01 gva'.includes('gva')`) pero
    // un usuario escribiendo `geometria` no debería encontrar opos.
    // Solución: `term.includes(alias)` requiere alias de >=3 caracteres.
    const opoFalso = { ...opo, aliases: ['ge'] }
    expect(matchesOposicion(opoFalso, 'geometria')).toBe(false)
    expect(matchesOposicion(opoFalso, 'ge')).toBe(true)
  })

  test('case-insensitive en todos los campos', () => {
    expect(matchesOposicion(opo, 'GVA')).toBe(true)
    expect(matchesOposicion(opo, 'GeneraliTAT')).toBe(true)
  })

  test('funciona sin aliases definidos', () => {
    const sinAlias = { ...opo, aliases: undefined }
    expect(matchesOposicion(sinAlias, 'administrativo')).toBe(true)
    expect(matchesOposicion(sinAlias, 'gva')).toBe(false) // sin alias no encuentra
  })

  test('término con espacios al inicio/final se trim()-ea', () => {
    expect(matchesOposicion(opo, '  gva  ')).toBe(true)
  })
})

describe('coverageLevelRank / sortByCoverageLevel (T-562)', () => {
  test('la madurez ordena catalogada < monitorizada < con_temario < con_tests < con_landing < full', () => {
    expect(coverageLevelRank('catalogada')).toBeLessThan(coverageLevelRank('monitorizada'))
    expect(coverageLevelRank('monitorizada')).toBeLessThan(coverageLevelRank('con_temario'))
    expect(coverageLevelRank('con_temario')).toBeLessThan(coverageLevelRank('con_tests'))
    expect(coverageLevelRank('con_tests')).toBeLessThan(coverageLevelRank('con_landing'))
    expect(coverageLevelRank('con_landing')).toBeLessThan(coverageLevelRank('full'))
  })

  test('sin coverage_level (fallback estático OFFICIAL_OPOSICIONES) no revienta, va al rango 0', () => {
    expect(coverageLevelRank(null)).toBe(0)
    expect(coverageLevelRank(undefined)).toBe(0)
    expect(coverageLevelRank('')).toBe(0)
  })

  test('un nivel que no existe en el orden no revienta: va al rango 0, no -1 ni undefined', () => {
    expect(coverageLevelRank('algo_que_no_existe')).toBe(0)
  })

  test('EL CASO REAL (T-562): la construida con miles de preguntas queda por delante de la vacía', () => {
    // Datos reales del incidente: buscar "biblioteca" devolvía las dos, con
    // la catalogada-vacía ganando por orden alfabético/demanda.
    const vacia = { id: 'bibliotecario', nombre: 'Auxiliar de Biblioteca', coverage_level: 'catalogada' }
    const construida = { id: 'auxiliar_biblioteca_estado', nombre: 'Auxiliar de Archivos, Bibliotecas y Museos del Estado', coverage_level: 'con_tests' }
    expect(sortByCoverageLevel([vacia, construida])).toEqual([construida, vacia])
    // Y si ya venían en el orden bueno, se queda igual (no las intercambia sin motivo).
    expect(sortByCoverageLevel([construida, vacia])).toEqual([construida, vacia])
  })

  test('empate de coverage_level conserva el orden relativo (sort estable)', () => {
    const a = { id: 'a', coverage_level: 'con_tests' }
    const b = { id: 'b', coverage_level: 'con_tests' }
    const c = { id: 'c', coverage_level: 'con_tests' }
    expect(sortByCoverageLevel([a, b, c]).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  test('no muta el array original', () => {
    const items = [{ id: 'a', coverage_level: 'catalogada' }, { id: 'b', coverage_level: 'full' }]
    const copia = [...items]
    sortByCoverageLevel(items)
    expect(items).toEqual(copia)
  })
})

describe('findBuiltEquivalent (T-562)', () => {
  const construidas = [
    { id: 'auxiliar_biblioteca_estado', name: 'Auxiliar de Archivos, Bibliotecas y Museos del Estado', badge: 'C2', administracion: 'estado', aliases: ['bibliotecario', 'auxiliar biblioteca', 'auxiliar de biblioteca', 'biblioteca estado'] },
    { id: 'administrativo_estado', name: 'Administrativo del Estado', badge: 'C1', administracion: 'estado', aliases: [] },
  ]

  test('EL CASO REAL: elegir "Auxiliar de Biblioteca" (catalogada, 0 preguntas) encuentra la construida por su alias', () => {
    const eq = findBuiltEquivalent(construidas, 'Auxiliar de Biblioteca')
    expect(eq?.id).toBe('auxiliar_biblioteca_estado')
  })

  test('sin coincidencia devuelve undefined — no inventa una equivalencia que no existe', () => {
    expect(findBuiltEquivalent(construidas, 'Bombero de Alicante')).toBeUndefined()
  })

  test('término vacío no matchea con la primera de la lista por accidente', () => {
    // matchesOposicion('') === true SIEMPRE, así que aquí se corta antes de preguntarle.
    expect(findBuiltEquivalent(construidas, '')).toBeUndefined()
    expect(findBuiltEquivalent(construidas, '   ')).toBeUndefined()
  })

  test('lista de construidas vacía no revienta', () => {
    expect(findBuiltEquivalent([], 'Auxiliar de Biblioteca')).toBeUndefined()
  })
})

describe('builtDisplayName (T-562)', () => {
  test('EL CASO REAL: prefiere shortName sobre el nombre largo de BOE', () => {
    const construida = {
      name: 'Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas)',
      shortName: 'Auxiliar de Biblioteca (Estado)',
    }
    expect(builtDisplayName(construida)).toBe('Auxiliar de Biblioteca (Estado)')
  })

  test('sin shortName cae al nombre largo (mejor eso que un botón vacío)', () => {
    expect(builtDisplayName({ name: 'Administrativo del Estado' })).toBe('Administrativo del Estado')
  })

  test('shortName vacío ("") también cae al nombre — no muestra un botón "Ir a "', () => {
    expect(builtDisplayName({ name: 'Administrativo del Estado', shortName: '' })).toBe('Administrativo del Estado')
  })

  test('sin ninguno de los dos, cadena vacía (nunca undefined/null en un botón)', () => {
    expect(builtDisplayName({})).toBe('')
  })
})
