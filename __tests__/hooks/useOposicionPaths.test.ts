// __tests__/hooks/useOposicionPaths.test.ts
// Tests para getHomeLink y las funciones de URL de oposiciones

import { getTestsLink, getTemarioLink, getHomeLink, getOposicionSlugFromPathname, ID_TO_SLUG } from '@/lib/config/oposiciones'

describe('getHomeLink', () => {
  it('devuelve la ruta home para auxiliar_administrativo_estado', () => {
    expect(getHomeLink('auxiliar_administrativo_estado')).toBe('/auxiliar-administrativo-estado')
  })

  it('devuelve la ruta home para auxiliar_administrativo_madrid', () => {
    expect(getHomeLink('auxiliar_administrativo_madrid')).toBe('/auxiliar-administrativo-madrid')
  })

  it('funciona con slug (hyphens)', () => {
    expect(getHomeLink('auxiliar-administrativo-estado')).toBe('/auxiliar-administrativo-estado')
  })

  it('devuelve / para identificador desconocido', () => {
    expect(getHomeLink('oposicion-inexistente')).toBe('/')
  })
})

describe('getTestsLink', () => {
  it('devuelve /slug/test para un ID válido', () => {
    expect(getTestsLink('auxiliar_administrativo_madrid')).toBe('/auxiliar-administrativo-madrid/test')
  })

  it('devuelve / para ID inválido', () => {
    expect(getTestsLink('no-existe')).toBe('/')
  })
})

describe('getTemarioLink', () => {
  it('devuelve /slug/temario para un ID válido', () => {
    expect(getTemarioLink('auxiliar_administrativo_madrid')).toBe('/auxiliar-administrativo-madrid/temario')
  })

  it('devuelve / para ID inválido', () => {
    expect(getTemarioLink('no-existe')).toBe('/')
  })
})

describe('getOposicionSlugFromPathname', () => {
  it('extrae slug de pathname válido', () => {
    expect(getOposicionSlugFromPathname('/auxiliar-administrativo-madrid/test')).toBe('auxiliar-administrativo-madrid')
  })

  it('extrae slug de pathname con más segmentos', () => {
    expect(getOposicionSlugFromPathname('/auxiliar-administrativo-estado/test/tema/5')).toBe('auxiliar-administrativo-estado')
  })

  it('devuelve primer slug disponible para pathname sin oposición', () => {
    const result = getOposicionSlugFromPathname('/premium')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('devuelve primer slug disponible para pathname null', () => {
    const result = getOposicionSlugFromPathname(null)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

describe('ID_TO_SLUG mapping', () => {
  it('mapea auxiliar_administrativo_estado correctamente', () => {
    expect(ID_TO_SLUG['auxiliar_administrativo_estado']).toBe('auxiliar-administrativo-estado')
  })

  it('mapea auxiliar_administrativo_madrid correctamente', () => {
    expect(ID_TO_SLUG['auxiliar_administrativo_madrid']).toBe('auxiliar-administrativo-madrid')
  })

  it('todas las oposiciones tienen mapping', () => {
    const ids = Object.keys(ID_TO_SLUG)
    expect(ids.length).toBeGreaterThan(10)
    for (const id of ids) {
      expect(ID_TO_SLUG[id]).toBeTruthy()
      expect(ID_TO_SLUG[id]).not.toContain('_')
    }
  })
})
