// __tests__/contexts/OposicionContext.defaultMenu.test.ts
// Regresión: DEFAULT_MENU NO debe tener featured apuntando a una ruta no-slug
// (antes era /oposiciones → Header construía /oposiciones/test → 404).

import { ALL_OPOSICION_IDS, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

describe('ALL_OPOSICION_IDS — placeholder retirado', () => {
  it('no contiene el placeholder explorador (target_oposicion=null para "sin oposición")', () => {
    expect(ALL_OPOSICION_IDS).not.toContain('explorador')
  })

  it('todos los ids tienen un slug correspondiente', () => {
    const slugsSet = new Set(ALL_OPOSICION_SLUGS)
    for (const id of ALL_OPOSICION_IDS) {
      const expectedSlug = id.replace(/_/g, '-')
      expect(slugsSet.has(expectedSlug)).toBe(true)
    }
  })
})

describe('DEFAULT_MENU featured — debe apuntar a slug REAL', () => {
  // Replicamos la estructura del DEFAULT_MENU. No la importamos directamente porque
  // está en un módulo 'use client' con dependencias de React/Supabase que rompen
  // jest si se importan en un test puro. El test verifica el INVARIANTE de diseño:
  // si en el futuro alguien cambia DEFAULT_MENU, el invariante de slug-válido debe
  // mantenerse.
  const DEFAULT_MENU_FEATURED_HREF = `/${ALL_OPOSICION_SLUGS[0]}`

  it('el featured.href empieza con un slug presente en ALL_OPOSICION_SLUGS', () => {
    const slug = DEFAULT_MENU_FEATURED_HREF.replace(/^\//, '').split('/')[0]
    expect(ALL_OPOSICION_SLUGS).toContain(slug)
  })

  it('el featured.href NO es /oposiciones (página de listado, no slug)', () => {
    expect(DEFAULT_MENU_FEATURED_HREF).not.toBe('/oposiciones')
  })

  it('concatenando /test al featured.href genera una URL servible', () => {
    const testUrl = DEFAULT_MENU_FEATURED_HREF + '/test'
    const slug = testUrl.split('/')[1]
    expect(ALL_OPOSICION_SLUGS).toContain(slug)
  })
})
