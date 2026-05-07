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

import { matchesOposicion } from '@/lib/utils/searchOposicion'

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
