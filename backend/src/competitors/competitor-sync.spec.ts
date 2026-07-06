import { lastmodDiffers } from './competitor-sync.service';

describe('lastmodDiffers (regresión: gateo de re-descarga)', () => {
  it('NO difiere si es el mismo instante en formato crudo vs normalizado por la BD', () => {
    // El sitemap da el crudo; la columna timestamptz lo devuelve normalizado.
    expect(lastmodDiffers('2025-05-06T10:18:38+00:00', '2025-05-06 10:18:38+00')).toBe(false)
  })

  it('difiere si el instante cambió', () => {
    expect(lastmodDiffers('2025-05-06T10:18:38+00:00', '2025-06-01 09:00:00+00')).toBe(true)
  })

  it('maneja nulls (uno tiene lastmod, el otro no)', () => {
    expect(lastmodDiffers(null, null)).toBe(false)
    expect(lastmodDiffers('2025-05-06T10:18:38+00:00', null)).toBe(true)
  })
})
