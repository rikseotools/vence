// Ofertas de precio personalizadas (precio heredado) — caso Rocío, 29/07/2026.
//
// La política es la MISMA para la página y para el guardia del checkout: si cada uno
// razonara por su cuenta, la página podría enseñar un precio que el checkout rechaza,
// que es la peor cara posible ante alguien a quien ya le hemos fallado una vez.
import {
  ofertaVigente,
  formatearImporte,
  euroPorMes,
  ETIQUETA_INTERVALO,
  MESES_INTERVALO,
} from '@/lib/api/premium/ofertas'

const AHORA = new Date('2026-07-29T12:00:00Z')
const viva = { expiresAt: null, redeemedAt: null, revokedAt: null }

describe('ofertaVigente', () => {
  it('una oferta recién concedida vale', () => {
    expect(ofertaVigente(viva, AHORA)).toBe(true)
  })

  it('no existe → no vale (nunca "por si acaso")', () => {
    expect(ofertaVigente(null, AHORA)).toBe(false)
    expect(ofertaVigente(undefined, AHORA)).toBe(false)
  })

  it('ya usada → no vale (si no, se podría contratar dos veces al precio especial)', () => {
    expect(ofertaVigente({ ...viva, redeemedAt: new Date('2026-07-29T10:00:00Z') }, AHORA)).toBe(false)
  })

  it('retirada a mano → no vale', () => {
    expect(ofertaVigente({ ...viva, revokedAt: new Date('2026-07-29T11:00:00Z') }, AHORA)).toBe(false)
  })

  it('caducada → no vale; con caducidad futura → sí', () => {
    expect(ofertaVigente({ ...viva, expiresAt: new Date('2026-07-29T11:59:59Z') }, AHORA)).toBe(false)
    expect(ofertaVigente({ ...viva, expiresAt: new Date('2026-08-30T00:00:00Z') }, AHORA)).toBe(true)
  })

  it('el instante EXACTO de caducidad ya no vale (frontera cerrada)', () => {
    expect(ofertaVigente({ ...viva, expiresAt: AHORA }, AHORA)).toBe(false)
  })

  it('sin caducidad es indefinida: es un precio mantenido, no una promoción', () => {
    expect(ofertaVigente({ ...viva, expiresAt: null }, new Date('2030-01-01T00:00:00Z'))).toBe(true)
  })
})

describe('presentación del importe', () => {
  it('sin céntimos no pinta decimales (18 €, no 18,00 €)', () => {
    expect(formatearImporte(1800)).toBe('18 €')
    expect(formatearImporte(2900)).toBe('29 €')
  })

  it('con céntimos usa la coma española', () => {
    expect(formatearImporte(1850)).toBe('18,50 €')
    expect(formatearImporte(999)).toBe('9,99 €')
  })

  it('el €/mes reparte según la periodicidad', () => {
    expect(euroPorMes(1800, 'mensual')).toBe('18 €')
    expect(euroPorMes(3900, 'trimestral')).toBe('13 €')
    expect(euroPorMes(6900, 'semestral')).toBe('11,50 €')
    expect(euroPorMes(9900, 'anual')).toBe('8,25 €')
  })

  it('la periodicidad se dice en cristiano', () => {
    expect(ETIQUETA_INTERVALO.mensual).toBe('al mes')
    expect(ETIQUETA_INTERVALO.trimestral).toBe('cada 3 meses')
    expect(ETIQUETA_INTERVALO.anual).toBe('al año')
  })

  it('los meses por intervalo cuadran con el catálogo', () => {
    expect(MESES_INTERVALO).toEqual({ mensual: 1, trimestral: 3, semestral: 6, anual: 12 })
  })
})
