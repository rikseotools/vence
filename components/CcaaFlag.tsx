// components/CcaaFlag.tsx
// Banderas SVG (CCAA + España) para usar como iconos inline.
// Reemplaza el emoji genérico 🏛️ con la bandera real de la región a la que
// pertenece CADA oposición (autonómica, ayuntamiento, diputación, cabildo,
// consell, sanitaria o universidad). El componente recibe el oposicionId
// (position_type o slug) y resuelve la bandera por palabra clave.

import { type ReactNode } from 'react'

type FlagSize = 'sm' | 'md' | 'lg'

interface CcaaFlagProps {
  oposicionId: string
  size?: FlagSize
  className?: string
}

// viewBox siempre 0 0 20 14, el tamaño real se controla con width/height.
// Claves = CCAA (no oposición concreta): una bandera sirve a todas sus
// oposiciones (comunidad + ayuntamientos + diputaciones + sanitaria + uni).
const FLAG_PATHS: Record<string, ReactNode> = {
  // ── Banderas de LUGAR (más específicas que la CCAA) ──
  // Zaragoza ciudad (Ayuntamiento): gules (rojo) con león rampante de oro coronado
  'zaragoza-ciudad': (
    <>
      <rect width="20" height="14" fill="#C60B1E"/>
      {/* corona real (oro) */}
      <path d="M7.6 2.6 l0.85 0.95 0.9-1.15 0.9 1.15 0.9-1.15 0.9 1.15 0.85-0.95 0 1.5 -6.05 0z" fill="#F4C400"/>
      {/* león rampante (oro), silueta estilizada */}
      <path d="M8.3 5 c0.5-0.5 1.3-0.55 1.85-0.15 0.3-0.25 0.75-0.05 0.75 0.35 0.35 0 0.6 0.35 0.45 0.7 0.4 0.05 0.55 0.55 0.25 0.85 0.35 0.15 0.4 0.65 0.05 0.9 0.25 0.25 0.1 0.75-0.3 0.85 l0.5 2.7 -1.1 0 -0.35-1.7 c-0.25 0.1-0.55 0.15-0.85 0.15 l0.3 1.55 -1.1 0 -0.3-1.7 c-0.95-0.35-1.6-1.3-1.55-2.35 -0.4-0.25-0.5-0.8-0.2-1.2 -0.25-0.35-0.1-0.85 0.3-1.05 -0.05-0.45 0.35-0.8 0.8-0.7 0.05-0.4 0.4-0.6 0.75-0.45z" fill="#F4C400"/>
    </>
  ),
  // Zaragoza provincia (Diputación): blanco con cruz de San Jorge (gules) + escudo central
  'zaragoza-provincia': (
    <>
      <rect width="20" height="14" fill="#fff"/>
      <rect x="8.6" width="2.8" height="14" fill="#C60B1E"/>
      <rect y="5.6" width="20" height="2.8" fill="#C60B1E"/>
      {/* escudo central simplificado: cuartelado oro + palos de Aragón */}
      <rect x="7.6" y="4" width="4.8" height="6" rx="0.5" fill="#F4C400" stroke="#fff" strokeWidth="0.4"/>
      <rect x="9.8" y="5.4" width="0.5" height="3.2" fill="#C60B1E"/>
      <rect x="10.6" y="5.4" width="0.5" height="3.2" fill="#C60B1E"/>
      <rect x="8.2" y="4.5" width="1.2" height="1.2" fill="#C60B1E"/>
    </>
  ),
  // Región de Murcia: fondo carmesí, 4 castillos dorados arriba-izq, 7 coronas abajo-der
  murcia: (
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
  cyl: (
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
  // Comunidad de Madrid: fondo rojo carmesí con 7 estrellas blancas
  madrid: (
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
  // Canarias: franjas blanco-azul-amarillo (3 verticales)
  canarias: (
    <>
      <rect width="6.67" height="14" fill="#fff"/>
      <rect x="6.67" width="6.67" height="14" fill="#003DA5"/>
      <rect x="13.33" width="6.67" height="14" fill="#FECB00"/>
    </>
  ),
  // Castilla-La Mancha: cuartelada rojo con castillo dorado / blanco
  clm: (
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
  extremadura: (
    <>
      <rect width="20" height="4.67" fill="#007844"/>
      <rect y="4.67" width="20" height="4.67" fill="#fff"/>
      <rect y="9.33" width="20" height="4.67" fill="#1a1a1a"/>
    </>
  ),
  // Comunitat Valenciana: Senyera coronada - 4 franjas rojas sobre amarillo + franja azul en asta
  valencia: (
    <>
      <rect width="20" height="14" fill="#FCDD09"/>
      <rect y="0" width="20" height="1.75" fill="#DA121A"/>
      <rect y="3.5" width="20" height="1.75" fill="#DA121A"/>
      <rect y="7" width="20" height="1.75" fill="#DA121A"/>
      <rect y="10.5" width="20" height="1.75" fill="#DA121A"/>
      <rect x="0" width="3.2" height="14" fill="#0050A0"/>
    </>
  ),
  // Galicia: franja azul con banda diagonal blanca (simplificada)
  galicia: (
    <>
      <rect width="20" height="14" fill="#fff"/>
      <rect width="20" height="14" fill="#0070B8" opacity="0.9"/>
      <line x1="0" y1="14" x2="20" y2="0" stroke="#fff" strokeWidth="3"/>
    </>
  ),
  // Aragón: Senyera aragonesa - 4 franjas rojas (gules) sobre fondo dorado (oro)
  aragon: (
    <>
      <rect width="20" height="14" fill="#FCDD09"/>
      <rect y="1.56" width="20" height="1.56" fill="#DA121A"/>
      <rect y="4.67" width="20" height="1.56" fill="#DA121A"/>
      <rect y="7.78" width="20" height="1.56" fill="#DA121A"/>
      <rect y="10.89" width="20" height="1.56" fill="#DA121A"/>
    </>
  ),
  // Catalunya: Senyera - 9 franjas (5 amarillas + 4 rojas finas)
  catalunya: (
    <>
      <rect width="20" height="14" fill="#FCDD09"/>
      <rect y="1.555" width="20" height="1.555" fill="#DA121A"/>
      <rect y="4.665" width="20" height="1.555" fill="#DA121A"/>
      <rect y="7.775" width="20" height="1.555" fill="#DA121A"/>
      <rect y="10.885" width="20" height="1.555" fill="#DA121A"/>
    </>
  ),
  // País Vasco: Ikurriña - fondo rojo, aspa verde, cruz blanca
  pais_vasco: (
    <>
      <rect width="20" height="14" fill="#D52B1E"/>
      <line x1="0" y1="0" x2="20" y2="14" stroke="#009B48" strokeWidth="2.4"/>
      <line x1="20" y1="0" x2="0" y2="14" stroke="#009B48" strokeWidth="2.4"/>
      <rect x="8.6" y="0" width="2.8" height="14" fill="#fff"/>
      <rect x="0" y="5.6" width="20" height="2.8" fill="#fff"/>
    </>
  ),
  // La Rioja: 4 franjas horizontales rojo-blanco-verde-amarillo
  rioja: (
    <>
      <rect width="20" height="3.5" fill="#C8102E"/>
      <rect y="3.5" width="20" height="3.5" fill="#fff"/>
      <rect y="7" width="20" height="3.5" fill="#00843D"/>
      <rect y="10.5" width="20" height="3.5" fill="#FFCD00"/>
    </>
  ),
  // Asturias: fondo azul con Cruz de la Victoria dorada
  asturias: (
    <>
      <rect width="20" height="14" fill="#0054A6"/>
      <rect x="9" y="1" width="2" height="12" fill="#FFC300"/>
      <rect x="4" y="4" width="12" height="2" fill="#FFC300"/>
    </>
  ),
  // Illes Balears: Senyera con castillo morado en el cantón
  baleares: (
    <>
      <rect width="20" height="14" fill="#FCDD09"/>
      <rect y="0" width="20" height="1.75" fill="#DA121A"/>
      <rect y="3.5" width="20" height="1.75" fill="#DA121A"/>
      <rect y="7" width="20" height="1.75" fill="#DA121A"/>
      <rect y="10.5" width="20" height="1.75" fill="#DA121A"/>
      <rect x="0" y="0" width="7" height="7" fill="#7B2D8B" opacity="0.8"/>
      <rect x="2.5" y="1" width="2" height="5" rx="0.3" fill="#fff" opacity="0.7"/>
    </>
  ),
  // Cantabria: blanca con franja roja horizontal y escudo simplificado
  cantabria: (
    <>
      <rect width="20" height="14" fill="#fff"/>
      <rect y="5.25" width="20" height="3.5" fill="#DA121A"/>
      <rect x="8.5" y="3" width="3" height="3" rx="0.5" fill="#DA121A" opacity="0.6"/>
    </>
  ),
  // Navarra: fondo rojo con cadenas doradas (simplificado)
  navarra: (
    <>
      <rect width="20" height="14" fill="#D4213D"/>
      <rect x="8" y="5" width="4" height="4" rx="0.5" fill="#FFD700" opacity="0.7"/>
      <rect x="6" y="6" width="1.5" height="2" fill="#FFD700" opacity="0.5"/>
      <rect x="12.5" y="6" width="1.5" height="2" fill="#FFD700" opacity="0.5"/>
    </>
  ),
  // Andalucía: franjas verde-blanco-verde horizontales
  andalucia: (
    <>
      <rect width="20" height="4.67" fill="#006633"/>
      <rect y="4.67" width="20" height="4.67" fill="#fff"/>
      <rect y="9.33" width="20" height="4.67" fill="#006633"/>
      <circle cx="10" cy="7" r="1.8" fill="#006633" opacity="0.5"/>
    </>
  ),
  // España: rojo-amarillo-rojo (1:2:1) — para oposiciones estatales (AGE, Justicia,
  // Correos, Guardia Civil, Policía Nacional, UNED) y Ceuta/Melilla.
  espana: (
    <>
      <rect width="20" height="3.5" fill="#AD1519"/>
      <rect y="3.5" width="20" height="7" fill="#FABD00"/>
      <rect y="10.5" width="20" height="3.5" fill="#AD1519"/>
    </>
  ),
}

// Resolución oposición → CCAA por palabra clave (provincia, isla, ciudad,
// servicio sanitario o universidad). Orden IMPORTA: lo más específico primero
// (p.ej. castilla-la-mancha antes que castilla, las-palmas/cabildo antes que palma).
const KEYWORD_TO_FLAG: Array<[string[], string]> = [
  // Estatales / sin CCAA → bandera de España (AGE, Justicia y cuerpos estatales).
  // OJO: guardia-civil y policia-nacional NO van aquí: tienen su escudo oficial
  // propio (ver ESCUDO_KEYWORDS), que tiene prioridad sobre la bandera.
  [['estado', 'estatal', 'tramitacion-procesal', 'auxilio-judicial', 'gestion-procesal', 'justicia', 'correos', 'uned', 'ceuta', 'melilla', 'seguridad-social', 'agente-hacienda', 'aduanera', 'soivre', 'estadistica-ine', 'sepe', 'penitenciaria', 'catastro', 'ingesa'], 'espana'],
  // Castilla-La Mancha (antes que "castilla")
  [['castilla-la-mancha', 'clm', 'sescam', 'albacete', 'ciudad-real', 'cuenca', 'guadalajara', 'toledo'], 'clm'],
  // Castilla y León
  [['castilla-y-leon', 'castilla-leon', 'cyl', 'leon', 'valladolid', 'burgos', 'salamanca', 'segovia', 'soria', 'avila', 'palencia', 'zamora'], 'cyl'],
  // País Vasco (antes que genéricos)
  [['pais-vasco', 'vasco', 'euskadi', 'eusko', 'osakidetza', 'ehu', 'bilbao', 'bizkaia', 'vizcaya', 'alava', 'araba', 'gipuzkoa', 'guipuzcoa', 'vitoria', 'donostia', 'san-sebastian'], 'pais_vasco'],
  // Catalunya
  [['catalunya', 'cataluna', 'catalan', 'tcae-ics', 'barcelona', 'girona', 'gerona', 'lleida', 'lerida', 'tarragona'], 'catalunya'],
  // Galicia
  [['galicia', 'sergas', 'a-coruna', 'coruna', 'lugo', 'ourense', 'orense', 'pontevedra', 'santiago', 'compostela', 'vigo'], 'galicia'],
  // Andalucía
  [['andalucia', 'andaluz', 'sas-', '-sas', 'sevilla', 'malaga', 'cadiz', 'cordoba', 'granada', 'huelva', 'jaen', 'almeria'], 'andalucia'],
  // Aragón (incl. servicio SALUD aragonés y Zaragoza/Huesca/Teruel)
  [['aragon', 'zaragoza', 'huesca', 'teruel'], 'aragon'],
  // Comunitat Valenciana
  [['valencia', 'gva', 'alicante', 'castellon', 'elche'], 'valencia'],
  // Murcia
  [['murcia', 'carm', 'cartagena', '-sms', 'sms-'], 'murcia'],
  // Canarias (cabildos + islas; antes que Baleares por "palma")
  [['canarias', 'canario', '-scs', 'scs-', 'las-palmas', 'palmas', 'tenerife', 'gran-canaria', 'lanzarote', 'fuerteventura', 'la-gomera', 'la-palma', 'el-hierro', 'la-laguna', 'ulpgc', 'cabildo'], 'canarias'],
  // Illes Balears (consells + islas)
  [['baleares', 'balear', 'illes', 'caib', 'ibsalut', 'mallorca', 'menorca', 'ibiza', 'eivissa', 'formentera', 'palma', 'consell'], 'baleares'],
  // Madrid (comunidad, ayto, sanidad, universidades madrileñas)
  [['madrid', 'sermas', 'carlos-iii', 'complutense'], 'madrid'],
  // Asturias (antes que Extremadura: 'tcae-sespa' contiene 'tcae-ses')
  [['asturias', 'sespa', 'oviedo', 'gijon', 'principado'], 'asturias'],
  // Extremadura
  [['extremadura', 'tcae-ses', 'badajoz', 'caceres', 'merida'], 'extremadura'],
  // Cantabria
  [['cantabria', 'santander'], 'cantabria'],
  // Navarra
  [['navarra', 'pamplona', 'nafarroa'], 'navarra'],
  // La Rioja
  [['rioja', 'seris', 'logrono'], 'rioja'],
]

/**
 * Resuelve la clave de bandera (CCAA o España) para una oposición, a partir de
 * su id (position_type con underscores o slug con guiones). Devuelve null si no
 * se reconoce ninguna región (entonces el llamador usa el emoji de fallback).
 */
// Banderas de LUGAR específico (ciudad/provincia/isla), más prioritarias que la
// CCAA. Se comprueban ANTES que KEYWORD_TO_FLAG. Cada lote nuevo se añade aquí.
const PLACE_KEYWORDS: Array<[string[], string]> = [
  [['ayuntamiento-zaragoza'], 'zaragoza-ciudad'],
  [['diputacion-zaragoza'], 'zaragoza-provincia'],
]

// Cuerpos con ESCUDO/LOGO oficial propio (no una bandera): se renderiza el
// emblema real como <img> y tiene PRIORIDAD sobre la bandera de la CCAA/España.
// Los SVG viven en /public/escudos/. Orden: lo más específico primero
// (policia-municipal-* NO entra aquí; solo el cuerpo nacional).
const ESCUDO_KEYWORDS: Array<[string[], { src: string; alt: string }]> = [
  [['guardia-civil'], { src: '/escudos/guardia-civil.svg', alt: 'Escudo de la Guardia Civil' }],
  [['policia-nacional'], { src: '/escudos/policia-nacional.svg', alt: 'Escudo de la Policía Nacional' }],
  // INGESA (Instituto Nacional de Gestión Sanitaria): logo institucional oficial,
  // con prioridad sobre la bandera de España. Aplica a todos sus cuerpos
  // (aux-admin, tcae, celador, enfermero), que contienen 'ingesa' en el id/slug.
  [['ingesa'], { src: '/escudos/ingesa.png', alt: 'Logo del INGESA (Instituto Nacional de Gestión Sanitaria)' }],
  // Servicio Murciano de Salud (SMS): logo institucional oficial (Murcia Salud),
  // con prioridad sobre la bandera de Murcia. Cubre la oposición Aux. Admin. del
  // SMS (slug …-sms). Lo más específico ('-sms'/'sms-') para no pisar CARM (regional).
  [['-sms', 'sms-', 'servicio-murciano'], { src: '/escudos/sms.svg', alt: 'Logo del Servicio Murciano de Salud (SMS)' }],
  // Seguridad Social: emblema rojo oficial (símbolo de la Seguridad Social/TGSS),
  // con prioridad sobre la bandera de España. Cubre Administrativo y Auxiliar
  // Administrativo de la Administración de la Seguridad Social (slug …seguridad-social).
  [['seguridad-social'], { src: '/escudos/seguridad-social.png', alt: 'Emblema de la Seguridad Social' }],
]

export function resolveEscudo(oposicionId: string): { src: string; alt: string } | null {
  if (!oposicionId) return null
  const norm = oposicionId.toLowerCase().replace(/_/g, '-')
  for (const [keywords, escudo] of ESCUDO_KEYWORDS) {
    if (keywords.some(k => norm.includes(k))) return escudo
  }
  return null
}

export function resolveFlagKey(oposicionId: string): string | null {
  if (!oposicionId) return null
  const norm = oposicionId.toLowerCase().replace(/_/g, '-')
  // 1) Bandera de lugar específico (ciudad/provincia/isla)
  for (const [keywords, flag] of PLACE_KEYWORDS) {
    if (keywords.some(k => norm.includes(k))) return flag
  }
  // 2) Bandera de la CCAA (fallback para los lugares aún sin bandera propia)
  for (const [keywords, flag] of KEYWORD_TO_FLAG) {
    if (keywords.some(k => norm.includes(k))) return flag
  }
  return null
}

// Tamaños predefinidos (width x height, proporción 20:14)
const SIZES: Record<FlagSize, { width: number; height: number }> = {
  sm: { width: 20, height: 14 },   // breadcrumbs, badges
  md: { width: 30, height: 21 },   // cards, home
  lg: { width: 40, height: 28 },   // headers grandes
}

export default function CcaaFlag({ oposicionId, size = 'sm', className = '' }: CcaaFlagProps) {
  const { width, height } = SIZES[size as FlagSize] || SIZES.sm

  // 1) Escudo/logo oficial del cuerpo (Guardia Civil, Policía Nacional): imagen
  // real con prioridad sobre la bandera. Caja cuadrada (lado = alto de la
  // bandera grande del mismo tamaño) y object-contain para no deformar.
  const escudo = resolveEscudo(oposicionId)
  if (escudo) {
    const box = width // lado del cuadro (≈ ancho de la bandera del mismo size)
    return (
      <span className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={escudo.src}
          alt={escudo.alt}
          width={box}
          height={box}
          className="inline-block align-middle object-contain"
          style={{ width: box, height: box }}
          loading="lazy"
          decoding="async"
        />
      </span>
    )
  }

  // 2) Bandera de la CCAA / España (SVG inline)
  const key = resolveFlagKey(oposicionId)
  const paths = key ? FLAG_PATHS[key] : null
  if (!paths) return null
  return (
    <span className={className}>
      <svg width={width} height={height} viewBox="0 0 20 14" className="inline-block align-middle rounded-sm" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)' }}>
        {paths}
      </svg>
    </span>
  )
}

export function hasCcaaFlag(oposicionId: string): boolean {
  return resolveEscudo(oposicionId) !== null || resolveFlagKey(oposicionId) !== null
}
