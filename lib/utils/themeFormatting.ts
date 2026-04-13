// lib/utils/themeFormatting.ts
// Helpers para formatear y validar números de tema (topic_number en BD)
// en contexto de visualización al usuario ("Bloque I - Tema N").
//
// Fuente de verdad: lib/config/oposiciones.ts → blocks[].themes[].
// NUNCA hardcodear rangos por oposición: hacerlo rompía para cualquier usuario
// que no fuera Aux Admin Estado (incidente abr 2026 con user Madrid
// viendo temas de Galicia/Policía mezclados en /mis-estadisticas).

import { getOposicionBySlug, type Oposicion } from '@/lib/config/oposiciones'

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

/** Localiza un theme dentro de una oposición por su `topic_number` (theme.id). */
export function findThemeInOposicion(
  opo: Oposicion,
  themeId: number,
): { blockRoman: string; displayNum: number; themeName: string } | null {
  for (let i = 0; i < opo.blocks.length; i++) {
    const theme = opo.blocks[i].themes.find(t => t.id === themeId)
    if (theme) {
      return {
        blockRoman: ROMAN_NUMERALS[i] ?? String(i + 1),
        displayNum: theme.displayNumber ?? theme.id,
        themeName: theme.name,
      }
    }
  }
  return null
}

/**
 * Formatea un topic_number a texto legible ("Bloque I - Tema N") según la
 * oposición indicada por su slug. Lookup directo en la config — soporta
 * TODAS las oposiciones, no solo Aux Admin Estado.
 *
 * Fallback: si no hay oposición o el tema no pertenece a ella, devuelve
 * simplemente `Tema ${num}`.
 */
export function formatThemeName(num: number, oposicionSlug?: string | null): string {
  if (!oposicionSlug) return `Tema ${num}`
  const opo = getOposicionBySlug(oposicionSlug)
  if (!opo) return `Tema ${num}`
  const found = findThemeInOposicion(opo, num)
  if (!found) return `Tema ${num}`
  return `Bloque ${found.blockRoman} - Tema ${found.displayNum}`
}

/**
 * Verifica si un topic_number pertenece a la oposición indicada por su slug.
 * Reemplaza el antiguo `getValidThemeRanges` basado en rangos hardcoded.
 */
export function isThemeValidForOposicion(themeNumber: number, oposicionSlug?: string | null): boolean {
  if (!oposicionSlug) return false
  const opo = getOposicionBySlug(oposicionSlug)
  if (!opo) return false
  return opo.blocks.some(b => b.themes.some(t => t.id === themeNumber))
}
