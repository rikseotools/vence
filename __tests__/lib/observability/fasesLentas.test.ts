/**
 * @jest-environment node
 */
// Unitarios de la decisión PURA que dice si una petición merece desglose y qué fase se llevó el
// tiempo (T-312). Importa el módulo REAL de producción, nunca una copia.
//
// El caso de origen (30/07): una petición de `answer-and-save` de 25.134 ms que devolvió 200 OK y
// de la que no se podía decir NADA. Entre 0,3% y 1,3% de los guardados superan los 5 s todos los
// días — 50-200 opositores diarios sin explicación posible.

import { evaluarFases, UMBRAL_LENTA_MS } from '@/lib/observability/fasesLentas'

describe('evaluarFases — cuándo merece explicación', () => {
  it('una petición rápida NO se registra (un desglose de 40 ms no informa de nada)', () => {
    expect(evaluarFases({ validarMs: 20, guardarMs: 15, scoreMs: 5, totalMs: 40 }).lenta).toBe(false)
  })

  it('justo en el umbral ya cuenta como lenta', () => {
    expect(evaluarFases({ validarMs: 1, guardarMs: 1, scoreMs: 1, totalMs: UMBRAL_LENTA_MS }).lenta).toBe(true)
  })

  it('el caso REAL de 25 s se registra', () => {
    expect(evaluarFases({ validarMs: 120, guardarMs: 24_800, scoreMs: 40, totalMs: 25_134 }).lenta).toBe(true)
  })
})

describe('evaluarFases — qué fase se llevó el tiempo', () => {
  it('señala la BD cuando el guardado domina', () => {
    const v = evaluarFases({ validarMs: 120, guardarMs: 24_800, scoreMs: 40, totalMs: 25_134 })
    expect(v.dominante).toBe('guardar')
    expect(v.pctDominante).toBeGreaterThan(90)
  })

  it('señala la validación cuando es ella', () => {
    expect(evaluarFases({ validarMs: 9_000, guardarMs: 80, scoreMs: 20, totalMs: 9_200 }).dominante).toBe('validar')
  })

  it('señala el score cuando es él', () => {
    expect(evaluarFases({ validarMs: 50, guardarMs: 60, scoreMs: 8_000, totalMs: 8_200 }).dominante).toBe('score')
  })

  it('🎯 «fuera_de_fases» cuando el tiempo NO está en ninguna fase medida', () => {
    // Es la respuesta MÁS valiosa: si el handler solo consumió 200 ms de 25 s, el problema no es su
    // lógica sino el entorno (event-loop bloqueado, espera de pool, GC, throttle). Distinguir «la BD
    // tardó» de «el proceso no llegó a ejecutarme» es lo que faltaba el 29/07 y costó medio día.
    const v = evaluarFases({ validarMs: 100, guardarMs: 80, scoreMs: 20, totalMs: 25_000 })
    expect(v.dominante).toBe('fuera_de_fases')
    expect(v.noExplicadoMs).toBe(24_800)
  })
})

describe('evaluarFases — entradas degeneradas', () => {
  it('no inventa tiempo no explicado cuando las fases suman más que el total', () => {
    // Puede pasar con fases en paralelo: nunca debe salir un negativo.
    const v = evaluarFases({ validarMs: 500, guardarMs: 500, scoreMs: 500, totalMs: 600 })
    expect(v.noExplicadoMs).toBe(0)
  })

  it('tolera valores ausentes o basura sin romper', () => {
    // @ts-expect-error — entrada inválida a propósito
    const v = evaluarFases({ validarMs: undefined, guardarMs: null, scoreMs: 'x', totalMs: 3000 })
    expect(v.lenta).toBe(true)
    expect(v.dominante).toBe('fuera_de_fases')
  })

  it('un total de 0 no divide por cero', () => {
    expect(evaluarFases({ validarMs: 0, guardarMs: 0, scoreMs: 0, totalMs: 0 }).pctDominante).toBe(0)
  })
})
