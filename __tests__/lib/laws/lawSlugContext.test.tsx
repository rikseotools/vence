// __tests__/lib/laws/lawSlugContext.test.tsx
// Tests para LawSlugContext: verifica que el Context provee
// acceso síncrono correcto al mapping de slugs.

import React from 'react'
import { renderHook } from '@testing-library/react'
import { LawSlugProvider, useLawSlugs } from '@/contexts/LawSlugContext'
import type { SlugMappingEntry } from '@/lib/api/laws/schemas'

// ============================================
// TEST DATA
// ============================================

const MOCK_MAPPINGS: SlugMappingEntry[] = [
  { slug: 'constitucion-espanola', shortName: 'CE', name: 'Constitución Española', description: 'La ley fundamental del Estado' },
  { slug: 'ley-39-2015', shortName: 'Ley 39/2015', name: 'Ley 39/2015 del Procedimiento Administrativo Común', description: 'Procedimiento administrativo común' },
  { slug: 'ley-40-2015', shortName: 'Ley 40/2015', name: 'Ley 40/2015 del Régimen Jurídico del Sector Público', description: 'Organización del sector público' },
  { slug: 'codigo-civil', shortName: 'Código Civil', name: 'Código Civil', description: 'Derecho privado español' },
  { slug: 'lo-6-1985', shortName: 'LO 6/1985', name: 'Ley Orgánica 6/1985 del Poder Judicial', description: null },
  { slug: 'informatica-basica', shortName: 'Informática Básica', name: 'Informática Básica', description: null },
]

// ============================================
// WRAPPER
// ============================================

function createWrapper(mappings: SlugMappingEntry[] = MOCK_MAPPINGS) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <LawSlugProvider initialMappings={mappings}>{children}</LawSlugProvider>
  }
}

// ============================================
// TESTS
// ============================================

describe('LawSlugContext', () => {
  // ─── useLawSlugs sin provider ──────────────────────────────

  describe('sin provider', () => {
    it('lanza error si se usa fuera del provider', () => {
      // Suppress console.error for expected error
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useLawSlugs())
      }).toThrow('useLawSlugs debe usarse dentro de <LawSlugProvider>')

      spy.mockRestore()
    })
  })

  // ─── getSlug (shortName → slug) ────────────────────────────

  describe('getSlug', () => {
    it('resuelve shortName → slug desde mapping', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.getSlug('CE')).toBe('constitucion-espanola')
      expect(result.current.getSlug('Ley 39/2015')).toBe('ley-39-2015')
      expect(result.current.getSlug('Código Civil')).toBe('codigo-civil')
      expect(result.current.getSlug('LO 6/1985')).toBe('lo-6-1985')
    })

    it('genera slug para shortNames no en mapping', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      // No está en el mapping, así que genera automáticamente
      const generated = result.current.getSlug('Ley Imaginaria 2026')
      expect(generated).toBe('ley-imaginaria-2026')
    })

    it('devuelve "unknown" para null/undefined/vacío', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.getSlug(null)).toBe('unknown')
      expect(result.current.getSlug(undefined)).toBe('unknown')
      expect(result.current.getSlug('')).toBe('unknown')
    })

    it('auto-genera con transliteración correcta', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.getSlug('Ley Orgánica 3/2018')).toBe('ley-organica-3-2018')
    })
  })

  // ─── getShortName (slug → shortName) ───────────────────────

  describe('getShortName', () => {
    it('resuelve slug → shortName desde mapping', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.getShortName('constitucion-espanola')).toBe('CE')
      expect(result.current.getShortName('ley-39-2015')).toBe('Ley 39/2015')
      expect(result.current.getShortName('codigo-civil')).toBe('Código Civil')
    })

    it('devuelve null para slugs no en mapping', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.getShortName('slug-no-existe')).toBeNull()
    })
  })

  // ─── getLawInfo (slug → {name, description}) ───────────────

  describe('getLawInfo', () => {
    it('devuelve name y description', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      const info = result.current.getLawInfo('constitucion-espanola')
      expect(info).toEqual({
        name: 'Constitución Española',
        description: 'La ley fundamental del Estado',
      })
    })

    it('genera description fallback para leyes sin descripción', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      const info = result.current.getLawInfo('informatica-basica')
      expect(info).toEqual({
        name: 'Informática Básica',
        description: 'Test de Informática Básica',
      })
    })

    it('devuelve null para slugs no en mapping', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.getLawInfo('slug-no-existe')).toBeNull()
    })
  })

  // ─── normalizeName ─────────────────────────────────────────

  describe('normalizeName', () => {
    it('normaliza variantes conocidas', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.normalizeName('RCD')).toBe('Reglamento del Congreso')
      expect(result.current.normalizeName('RS')).toBe('Reglamento del Senado')
      expect(result.current.normalizeName('Reglamento Congreso')).toBe('Reglamento del Congreso')
    })

    it('passthrough para nombres no normalizados', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.normalizeName('CE')).toBe('CE')
      expect(result.current.normalizeName('Ley 39/2015')).toBe('Ley 39/2015')
    })
  })

  // ─── count y ready ─────────────────────────────────────────

  describe('count y ready', () => {
    it('count refleja número de mappings', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.count).toBe(MOCK_MAPPINGS.length)
    })

    it('ready es true con mappings', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      expect(result.current.ready).toBe(true)
    })

    it('ready es false sin mappings', () => {
      const { result } = renderHook(() => useLawSlugs(), { wrapper: createWrapper([]) })

      expect(result.current.ready).toBe(false)
      expect(result.current.count).toBe(0)
    })
  })

  // ─── Estabilidad referencial ───────────────────────────────

  describe('estabilidad referencial', () => {
    it('value no cambia entre renders con mismos mappings', () => {
      const { result, rerender } = renderHook(() => useLawSlugs(), { wrapper: createWrapper() })

      const first = result.current
      rerender()
      const second = result.current

      expect(first.getSlug).toBe(second.getSlug)
      expect(first.getShortName).toBe(second.getShortName)
      expect(first.getLawInfo).toBe(second.getLawInfo)
    })
  })

  // ─── Edge cases ────────────────────────────────────────────

  describe('edge cases', () => {
    it('funciona con una sola ley', () => {
      const wrapper = createWrapper([MOCK_MAPPINGS[0]])
      const { result } = renderHook(() => useLawSlugs(), { wrapper })

      expect(result.current.getSlug('CE')).toBe('constitucion-espanola')
      expect(result.current.getShortName('constitucion-espanola')).toBe('CE')
      expect(result.current.count).toBe(1)
    })

    it('funciona con mapping vacío (graceful degradation)', () => {
      const wrapper = createWrapper([])
      const { result } = renderHook(() => useLawSlugs(), { wrapper })

      expect(result.current.getShortName('constitucion-espanola')).toBeNull()
      // getSlug genera automáticamente con fallback
      expect(result.current.getSlug('Ley 39/2015')).toBe('ley-39-2015')
      expect(result.current.ready).toBe(false)
    })
  })
})
