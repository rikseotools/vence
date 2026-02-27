// components/CcaaFlag.js
// Banderas SVG de CCAA para usar como iconos inline (~20x14px)
// Reemplaza emojis genéricos 🏛️ con banderas reales reconocibles

const FLAGS = {
  // Región de Murcia: fondo carmesí (rojo Cartagena), 4 castillos dorados arriba-izq, 7 coronas doradas abajo-der
  auxiliar_administrativo_carm: (
    <svg width="20" height="14" viewBox="0 0 20 14" className="inline-block align-middle rounded-sm" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)' }}>
      <rect width="20" height="14" fill="#9B154A"/>
      <rect x="1.5" y="1.5" width="3" height="3.5" rx="0.3" fill="#F5C400" opacity="0.85"/>
      <rect x="5.5" y="1.5" width="3" height="3.5" rx="0.3" fill="#F5C400" opacity="0.85"/>
      <circle cx="14" cy="9.5" r="1" fill="#F5C400" opacity="0.85"/>
      <circle cx="11.5" cy="11.5" r="1" fill="#F5C400" opacity="0.85"/>
      <circle cx="14" cy="11.5" r="1" fill="#F5C400" opacity="0.85"/>
      <circle cx="16.5" cy="11.5" r="1" fill="#F5C400" opacity="0.85"/>
    </svg>
  ),
  // Castilla y León: cuartelada rojo/blanco, castillos dorados y leones púrpura
  auxiliar_administrativo_cyl: (
    <svg width="20" height="14" viewBox="0 0 20 14" className="inline-block align-middle rounded-sm" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)' }}>
      <rect width="10" height="7" fill="#BF0000"/>
      <rect x="10" width="10" height="7" fill="#fff"/>
      <rect y="7" width="10" height="7" fill="#fff"/>
      <rect x="10" y="7" width="10" height="7" fill="#BF0000"/>
      <rect x="3.5" y="1.5" width="3" height="4" rx="0.3" fill="#F5C400" opacity="0.8"/>
      <circle cx="15" cy="3.5" r="1.8" fill="#7B2D8B" opacity="0.7"/>
      <circle cx="5" cy="10.5" r="1.8" fill="#7B2D8B" opacity="0.7"/>
      <rect x="13.5" y="8.5" width="3" height="4" rx="0.3" fill="#F5C400" opacity="0.8"/>
    </svg>
  ),
  // Andalucía: franjas verde-blanco-verde horizontales
  auxiliar_administrativo_andalucia: (
    <svg width="20" height="14" viewBox="0 0 20 14" className="inline-block align-middle rounded-sm" style={{ boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)' }}>
      <rect width="20" height="4.67" fill="#006633"/>
      <rect y="4.67" width="20" height="4.67" fill="#fff"/>
      <rect y="9.33" width="20" height="4.67" fill="#006633"/>
      <circle cx="10" cy="7" r="1.8" fill="#006633" opacity="0.5"/>
    </svg>
  ),
}

export default function CcaaFlag({ oposicionId, className = '' }) {
  const flag = FLAGS[oposicionId]
  if (!flag) return null
  return <span className={className}>{flag}</span>
}

export function hasCcaaFlag(oposicionId) {
  return !!FLAGS[oposicionId]
}
