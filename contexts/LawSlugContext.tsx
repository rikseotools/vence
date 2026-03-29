// contexts/LawSlugContext.tsx
// Context que provee acceso SÍNCRONO al mapping slug ↔ shortName en client components.
//
// El mapping se precarga en el server layout (SSR) y se pasa como prop al provider,
// evitando waterfalls y race conditions en el primer render.
//
// Uso:
//   const { getSlug, getShortName, getLawInfo } = useLawSlugs()

'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SlugMappingEntry } from '@/lib/api/laws/schemas'

// ============================================
// TIPOS
// ============================================

export interface LawSlugContextValue {
  /** short_name → slug */
  getSlug: (shortName: string | null | undefined) => string
  /** slug → short_name */
  getShortName: (slug: string) => string | null
  /** slug → { name, description } */
  getLawInfo: (slug: string) => { name: string; description: string } | null
  /** Normaliza variantes de short_name a forma canónica */
  normalizeName: (shortName: string) => string
  /** Número de leyes cargadas */
  count: number
  /** Si el mapping ya está disponible */
  ready: boolean
}

// ============================================
// NORMALIZATION (mínimo, solo excepciones conocidas)
// ============================================

const NORMALIZATION_MAP: Record<string, string> = {
  'RCD': 'Reglamento del Congreso',
  'RS': 'Reglamento del Senado',
  'Reglamento Congreso': 'Reglamento del Congreso',
}

// ============================================
// GENERACIÓN DE SLUG (fallback determinista)
// ============================================

function generateSlug(shortName: string): string {
  if (!shortName) return 'unknown'
  return shortName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============================================
// CONTEXT
// ============================================

const LawSlugContext = createContext<LawSlugContextValue | null>(null)

interface LawSlugProviderProps {
  /** Mapping precargado desde el server layout */
  initialMappings: SlugMappingEntry[]
  children: ReactNode
}

export function LawSlugProvider({ initialMappings, children }: LawSlugProviderProps) {
  const value = useMemo<LawSlugContextValue>(() => {
    // Construir Maps indexados para O(1) lookup
    const bySlug = new Map<string, SlugMappingEntry>()
    const byShortName = new Map<string, SlugMappingEntry>()

    for (const entry of initialMappings) {
      bySlug.set(entry.slug, entry)
      byShortName.set(entry.shortName, entry)
    }

    return {
      getSlug(shortName) {
        if (!shortName) return 'unknown'
        const entry = byShortName.get(shortName)
        return entry?.slug ?? generateSlug(shortName)
      },

      getShortName(slug) {
        return bySlug.get(slug)?.shortName ?? null
      },

      getLawInfo(slug) {
        const entry = bySlug.get(slug)
        if (!entry) return null
        return {
          name: entry.name,
          description: entry.description ?? `Test de ${entry.shortName}`,
        }
      },

      normalizeName(shortName) {
        return NORMALIZATION_MAP[shortName] ?? shortName
      },

      count: initialMappings.length,
      ready: initialMappings.length > 0,
    }
  }, [initialMappings])

  return (
    <LawSlugContext.Provider value={value}>
      {children}
    </LawSlugContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

/**
 * Hook para acceder al mapping de slugs de leyes.
 * Lanza error si se usa fuera del LawSlugProvider.
 */
export function useLawSlugs(): LawSlugContextValue {
  const ctx = useContext(LawSlugContext)
  if (!ctx) {
    throw new Error('useLawSlugs debe usarse dentro de <LawSlugProvider>')
  }
  return ctx
}
