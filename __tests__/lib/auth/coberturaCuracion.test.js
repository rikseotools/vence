const { sinNingunaCobertura } = require('../../../lib/auth/coberturaCuracion.cjs')

describe('sinNingunaCobertura (T-633)', () => {
  it('devuelve los afectados que NO aparecen en curados', () => {
    expect(sinNingunaCobertura(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c'])
  })

  it('sin duplicados en la salida, aunque los afectados los traigan', () => {
    expect(sinNingunaCobertura(['a', 'a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('todos cubiertos -> lista vacía', () => {
    expect(sinNingunaCobertura(['a', 'b'], ['a', 'b', 'c'])).toEqual([])
  })

  it('ninguno cubierto -> devuelve todos los afectados (sin duplicar)', () => {
    expect(sinNingunaCobertura(['a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('listas vacías o undefined no revientan', () => {
    expect(sinNingunaCobertura([], [])).toEqual([])
    expect(sinNingunaCobertura(undefined, undefined)).toEqual([])
    expect(sinNingunaCobertura(['a'], undefined)).toEqual(['a'])
  })

  it('caso real medido el 06/08/2026: 140ef91a (el caso original de T-434) sigue sin cobertura', () => {
    // No es un fixture arbitrario: es el user_id citado en la ficha original de T-434 (30/07,
    // "intentó contratar premium y recibió 404"). Se deja como regresión nombrada porque si
    // algún día aparece en `curados`, es una señal real de que el hueco se cerró para él.
    const afectados = ['140ef91a-2d5a-4f36-a38a-c872467763a8', 'sano-1']
    const curados = ['sano-1']
    expect(sinNingunaCobertura(afectados, curados)).toEqual(['140ef91a-2d5a-4f36-a38a-c872467763a8'])
  })
})
