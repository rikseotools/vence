// components/CcaaFlag.tsx
// Banderas SVG de CCAA para usar como iconos inline
// Reemplaza emojis genéricos 🏛️ con banderas reales reconocibles

import { type ReactNode } from 'react'

type OposicionId = keyof typeof FLAG_PATHS

type FlagSize = 'sm' | 'md' | 'lg'

interface CcaaFlagProps {
  oposicionId: string
  size?: FlagSize
  className?: string
}

// viewBox siempre 0 0 20 14, el tamaño real se controla con width/height
const FLAG_PATHS: Record<string, ReactNode> = {
  // Región de Murcia: fondo carmesí (rojo Cartagena), 4 castillos dorados arriba-izq, 7 coronas doradas abajo-der
  auxiliar_administrativo_carm: (
    <>
      <rect width="20" height="14" fill="#9B154A"/>
      <rect x="1.5" y="1.5" width="3" height="3.5" rx="0.3" fill="#F5C400" opacity="0.85"/>
      <rect x="5.5" y="1.5" width="3" height="3.5" rx="0.3" fill="#F5C400" opacity="0.85"/>
      <circle cx="14" cy="9.5" r="1" fill="#F5C400" opacity="0.85"/>
      <circle cx="11.5" cy="11.5" r="1" fill="#F5C400" opacity="0.85"/>
      <circle cx="14" cy="11.5" r="1" fill="#F5C400" opacity="0.85"/>
      <circle cx="16.5" cy="11.5" r="1" fill="#F5C400" opacity="0.85"/>
    </>
  ),
  // Castilla y León: cuartelada rojo/blanco, castillos dorados y leones púrpura
  auxiliar_administrativo_cyl: (
    <>
      <rect width="10" height="7" fill="#BF0000"/>
      <rect x="10" width="10" height="7" fill="#fff"/>
      <rect y="7" width="10" height="7" fill="#fff"/>
      <rect x="10" y="7" width="10" height="7" fill="#BF0000"/>
      <rect x="3.5" y="1.5" width="3" height="4" rx="0.3" fill="#F5C400" opacity="0.8"/>
      <circle cx="15" cy="3.5" r="1.8" fill="#7B2D8B" opacity="0.7"/>
      <circle cx="5" cy="10.5" r="1.8" fill="#7B2D8B" opacity="0.7"/>
      <rect x="13.5" y="8.5" width="3" height="4" rx="0.3" fill="#F5C400" opacity="0.8"/>
    </>
  ),
  // Comunidad de Madrid: fondo rojo carmesí con 7 estrellas blancas (5 puntas)
  auxiliar_administrativo_madrid: (
    <>
      <rect width="20" height="14" fill="#BF0000"/>
      <circle cx="5" cy="3.5" r="1" fill="#fff"/>
      <circle cx="10" cy="3.5" r="1" fill="#fff"/>
      <circle cx="15" cy="3.5" r="1" fill="#fff"/>
      <circle cx="3.5" cy="7" r="1" fill="#fff"/>
      <circle cx="8" cy="7" r="1" fill="#fff"/>
      <circle cx="12" cy="7" r="1" fill="#fff"/>
      <circle cx="16.5" cy="7" r="1" fill="#fff"/>
    </>
  ),
  // Canarias: franjas blanco-azul-amarillo (3 franjas verticales)
  auxiliar_administrativo_canarias: (
    <>
      <rect width="6.67" height="14" fill="#fff"/>
      <rect x="6.67" width="6.67" height="14" fill="#003DA5"/>
      <rect x="13.33" width="6.67" height="14" fill="#FECB00"/>
    </>
  ),
  // Castilla-La Mancha: cuartelada rojo con castillo dorado / blanco con escudo
  auxiliar_administrativo_clm: (
    <>
      <rect width="10" height="7" fill="#BF0000"/>
      <rect x="10" width="10" height="7" fill="#fff"/>
      <rect y="7" width="10" height="7" fill="#fff"/>
      <rect x="10" y="7" width="10" height="7" fill="#BF0000"/>
      <rect x="3.5" y="1.5" width="3" height="4" rx="0.3" fill="#F5C400" opacity="0.8"/>
      <rect x="13.5" y="8.5" width="3" height="4" rx="0.3" fill="#F5C400" opacity="0.8"/>
    </>
  ),
  // Extremadura: franjas verde-blanco-negro horizontales
  auxiliar_administrativo_extremadura: (
    <>
      <rect width="20" height="4.67" fill="#007844"/>
      <rect y="4.67" width="20" height="4.67" fill="#fff"/>
      <rect y="9.33" width="20" height="4.67" fill="#1a1a1a"/>
    </>
  ),
  // Comunitat Valenciana: Senyera - 4 franjas rojas sobre fondo amarillo (dorado)
  auxiliar_administrativo_valencia: (
    <>
      <rect width="20" height="14" fill="#FCDD09"/>
      <rect y="0" width="20" height="1.75" fill="#DA121A"/>
      <rect y="3.5" width="20" height="1.75" fill="#DA121A"/>
      <rect y="7" width="20" height="1.75" fill="#DA121A"/>
      <rect y="10.5" width="20" height="1.75" fill="#DA121A"/>
    </>
  ),
  // Andalucía: franjas verde-blanco-verde horizontales
  auxiliar_administrativo_andalucia: (
    <>
      <rect width="20" height="4.67" fill="#006633"/>
      <rect y="4.67" width="20" height="4.67" fill="#fff"/>
      <rect y="9.33" width="20" height="4.67" fill="#006633"/>
      <circle cx="10" cy="7" r="1.8" fill="#006633" opacity="0.5"/>
    </>
  ),
}

// Tamaños predefinidos (width x height, proporción 20:14)
const SIZES: Record<FlagSize, { width: number; height: number }> = {
  sm: { width: 20, height: 14 },   // breadcrumbs, badges
  md: { width: 30, height: 21 },   // cards, home
  lg: { width: 40, height: 28 },   // headers grandes
}

export default function CcaaFlag({ oposicionId, size = 'sm', className = '' }: CcaaFlagProps) {
  const paths = FLAG_PATHS[oposicionId]
  if (!paths) return null
  const { width, height } = SIZES[size as FlagSize] || SIZES.sm
  return (
    <span className={className}>
      <svg width={width} height={height} viewBox="0 0 20 14" className="inline-block align-middle rounded-sm" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)' }}>
        {paths}
      </svg>
    </span>
  )
}

export function hasCcaaFlag(oposicionId: string): boolean {
  return !!FLAG_PATHS[oposicionId]
}
