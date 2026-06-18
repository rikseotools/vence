/**
 * Escudo UI del bug "unknown" (feedback Rosa 14/06): el "Análisis Inteligente"
 * pintaba "Ver artículo" usando law_name guardado. Cuando ese valor era el
 * literal "unknown" (bug del WRITE) o vacío, el enlace iba a /api/teoria/unknown/N
 * y daba 404. `isResolvableLaw` decide si la ley es enlazable a teoría.
 */

import { isResolvableLaw } from '@/components/test/ArticulosEstudioPrioritario'

describe('isResolvableLaw — escudo contra enlaces de teoría rotos', () => {
  test('ley real → enlazable', () => {
    expect(isResolvableLaw('LO 4/1982 Estatuto de Murcia')).toBe(true)
    expect(isResolvableLaw('CE')).toBe(true)
    expect(isResolvableLaw('Ley 39/2015')).toBe(true)
  })

  test('el literal "unknown" (en cualquier caja/espacios) → NO enlazable', () => {
    expect(isResolvableLaw('unknown')).toBe(false)
    expect(isResolvableLaw('UNKNOWN')).toBe(false)
    expect(isResolvableLaw('  Unknown  ')).toBe(false)
  })

  test('vacío / null / undefined → NO enlazable', () => {
    expect(isResolvableLaw('')).toBe(false)
    expect(isResolvableLaw(null)).toBe(false)
    expect(isResolvableLaw(undefined)).toBe(false)
  })

  test('una ley que contiene "unknown" como subcadena SÍ es enlazable (no falso positivo)', () => {
    expect(isResolvableLaw('Ley Unknown Foo')).toBe(true) // no es exactamente "unknown"
  })
})
