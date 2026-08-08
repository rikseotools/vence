// __tests__/support/badgeSoporte.test.ts
// [T-378] Núcleo puro del badge del botón 💬 Soporte — mismo patrón de test que
// __tests__/referrals/estadoIconoRecompensas.test.ts: llamar la función directa con
// números planos, sin mocks ni DOM.
import { estadoBadgeSoporte } from '../../lib/support/badgeSoporte'

describe('estadoBadgeSoporte', () => {
  it('sin novedad cuando no hay nada sin leer', () => {
    expect(estadoBadgeSoporte(0)).toEqual({ hayNovedad: false, etiqueta: null })
  })

  it('muestra la cifra exacta entre 1 y 9', () => {
    expect(estadoBadgeSoporte(1)).toEqual({ hayNovedad: true, etiqueta: '1' })
    expect(estadoBadgeSoporte(9)).toEqual({ hayNovedad: true, etiqueta: '9' })
  })

  it('topa en "9+" a partir de 10 — mismo tope que ya usaba la campana', () => {
    expect(estadoBadgeSoporte(10)).toEqual({ hayNovedad: true, etiqueta: '9+' })
    expect(estadoBadgeSoporte(13)).toEqual({ hayNovedad: true, etiqueta: '9+' }) // caso real (T-378)
    expect(estadoBadgeSoporte(9999)).toEqual({ hayNovedad: true, etiqueta: '9+' })
  })

  describe('entrada sucia — nunca debe romper ni prometer una cifra falsa', () => {
    it('negativos cuentan como 0', () => {
      expect(estadoBadgeSoporte(-5)).toEqual({ hayNovedad: false, etiqueta: null })
    })

    it('NaN/Infinity cuentan como 0', () => {
      expect(estadoBadgeSoporte(NaN)).toEqual({ hayNovedad: false, etiqueta: null })
      expect(estadoBadgeSoporte(Infinity)).toEqual({ hayNovedad: false, etiqueta: null })
    })

    it('decimales se truncan, no se redondean al alza', () => {
      expect(estadoBadgeSoporte(1.9)).toEqual({ hayNovedad: true, etiqueta: '1' })
    })
  })
})
