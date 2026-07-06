import { isVariantContainerLaw, VARIANT_LAW_SLUG_SUFFIXES } from '@/lib/isVariantContainerLaw'

describe('isVariantContainerLaw', () => {
  it('detecta las leyes-contenedor de variante por sufijo de slug', () => {
    expect(isVariantContainerLaw('word-365-solo-escritorio')).toBe(true)
    expect(isVariantContainerLaw('excel-365-solo-escritorio')).toBe(true)
    expect(isVariantContainerLaw('word-365-solo-web')).toBe(true)
    expect(isVariantContainerLaw('excel-365-solo-web')).toBe(true)
  })

  it('NO marca la ley común ni leyes normales', () => {
    expect(isVariantContainerLaw('procesadores-de-texto')).toBe(false) // Word 365 común
    expect(isVariantContainerLaw('hojas-de-calculo-excel')).toBe(false) // Excel 365 común
    expect(isVariantContainerLaw('constitucion-espanola')).toBe(false)
    expect(isVariantContainerLaw('ley-39-2015')).toBe(false)
  })

  it('maneja null/undefined/vacío sin romper', () => {
    expect(isVariantContainerLaw(null)).toBe(false)
    expect(isVariantContainerLaw(undefined)).toBe(false)
    expect(isVariantContainerLaw('')).toBe(false)
  })

  it('solo excluye por SUFIJO exacto, no por substring', () => {
    // un slug que contenga el texto en medio pero no como sufijo no debe marcarse
    expect(isVariantContainerLaw('solo-web-de-algo')).toBe(false)
    expect(isVariantContainerLaw('ley-solo-escritorio-2020')).toBe(false)
  })

  it('los sufijos declarados son los esperados', () => {
    expect([...VARIANT_LAW_SLUG_SUFFIXES]).toEqual(['-solo-escritorio', '-solo-web'])
  })
})
