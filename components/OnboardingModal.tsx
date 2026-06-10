// components/OnboardingModal.tsx
// Modal de Onboarding Compacto - Una sola pantalla
'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { OPOSICIONES } from '../lib/config/oposiciones'
import { matchesOposicion } from '../lib/utils/searchOposicion'
import { useOposicionesCatalog } from '../lib/hooks/useOposicionesCatalog'
import { resolveEscudo } from './CcaaFlag'

// Icono de una oposición en las listas: escudo/logo oficial real (Guardia Civil,
// Policía Nacional) si lo tiene, o el emoji configurado como fallback.
function OposicionIcon({ id, icon }: { id: string; icon: string }) {
  const escudo = resolveEscudo(id)
  if (escudo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={escudo.src} alt={escudo.alt} className="inline-block w-6 h-6 object-contain align-middle" loading="lazy" decoding="async" />
  }
  return <span className="text-lg">{icon}</span>
}

// Set de ids de oposiciones ya implementadas (con temario/tests reales).
// Se usa para marcar las aspiracionales con badge "🔜 En elaboración".
// Ver docs/maintenance/crear-nueva-oposicion.md §0.
const IMPLEMENTED_OPOSICION_IDS = new Set(OPOSICIONES.map(o => o.id))

export interface OposicionItem {
  id: string
  nombre: string
  categoria: string
  administracion: string
  icon: string
}

interface SelectedOposicion {
  id: string
  nombre: string
  categoria: string
  administracion: string
  tipo: 'oficial' | 'custom'
}

interface FormData {
  selectedOposicion: SelectedOposicion | null
  age: string
  gender: string
  daily_study_hours: string
  ciudad: string
}

interface CompletedFields {
  oposicion: boolean
  age: boolean
  gender: boolean
  ciudad: boolean
  daily_study_hours: boolean
}

interface CustomOposicionData {
  nombre: string
  categoria: string
  administracion: string
}

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
  onSkip: () => void
  user: { id: string; user_metadata?: any; email?: string }
}

const supabase = getSupabaseClient()

// Función para normalizar nombres de oposiciones (quitar acentos, minúsculas)
const normalizeOposicionName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s]/g, ' ') // Reemplazar caracteres especiales con espacios
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim()
}

// Función para detectar si una oposición personalizada coincide con una oficial
const findMatchingOfficialOposicion = (customName: string): OposicionItem | undefined => {
  const normalizedCustom = normalizeOposicionName(customName)
  const customWords = normalizedCustom.split(' ').filter(w => w.length > 0)

  return OFFICIAL_OPOSICIONES.find(official => {
    const normalizedOfficial = normalizeOposicionName(official.nombre)

    // Coincidencia exacta después de normalizar
    if (normalizedCustom === normalizedOfficial) return true

    // Coincidencia parcial: al menos 70% de las palabras del usuario deben estar en la oficial
    const officialWords = normalizedOfficial.split(' ').filter(w => w.length > 0)
    const matchingWords = customWords.filter(word =>
      officialWords.some(officialWord =>
        // Coincidencia exacta de palabra o palabra oficial contiene la del usuario
        officialWord === word || officialWord.includes(word) || word.includes(officialWord)
      )
    )

    const matchPercentage = matchingWords.length / customWords.length

    // Si al menos 70% de las palabras coinciden, considerarlo un match
    return matchPercentage >= 0.7
  })
}

// Aliases de búsqueda viven en lib/config/oposiciones.ts (campo `aliases` de
// cada OposicionConfig). El filtrado se hace con matchesOposicion en
// lib/utils/searchOposicion.ts — usado también por OposicionChangeModal y
// OposicionGuard. Para añadir un alias nuevo: edita la oposición en
// oposiciones.ts.

// Oposiciones oficiales ordenadas por POPULARIDAD (más demandadas primero)
export const OFFICIAL_OPOSICIONES: OposicionItem[] = [
  // === TOP 10 MÁS POPULARES ===
  {
    id: 'auxiliar_administrativo_estado',
    nombre: 'Auxiliar Administrativo del Estado',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_enfermeria',
    nombre: 'Auxiliar de Enfermería (TCAE)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'administrativo_estado',
    nombre: 'Administrativo del Estado',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🏢'
  },
  {
    id: 'auxiliar_administrativo_universidad_uned',
    nombre: 'Auxiliar Administrativo de la UNED',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🎓'
  },
  {
    id: 'administrativo_seguridad_social',
    nombre: 'Administrativo de la Seguridad Social',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🩺'
  },
  {
    id: 'auxiliar_administrativo_seguridad_social',
    nombre: 'Auxiliar Administrativo de la Seguridad Social',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🩺'
  },
  {
    id: 'maestro_primaria',
    nombre: 'Maestro de Educación Primaria',
    categoria: 'A2',
    administracion: 'Educación',
    icon: '👨‍🏫'
  },
  {
    id: 'maestro_infantil',
    nombre: 'Maestro de Educación Infantil',
    categoria: 'A2',
    administracion: 'Educación',
    icon: '👶'
  },
  {
    id: 'policia_nacional',
    nombre: 'Policía Nacional (Escala Básica)',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🛡️'
  },
  {
    id: 'guardia_civil',
    nombre: 'Guardia Civil',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🛡️'
  },
  {
    id: 'enfermero',
    nombre: 'Enfermero/a',
    categoria: 'A2',
    administracion: 'Sanitaria',
    icon: '👨‍⚕️'
  },
  {
    id: 'auxiliar_enfermeria_gva',
    nombre: 'Auxiliar de Enfermería Generalitat Valenciana',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_aragon',
    nombre: 'TCAE del Servicio Aragonés de Salud',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_canarias',
    nombre: 'TCAE del Servicio Canario de Salud',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_galicia',
    nombre: 'TCAE del SERGAS (Galicia)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'auxiliar_administrativo_sms',
    nombre: 'Auxiliar Administrativo del Servicio Murciano de Salud (SMS)',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏥'
  },
  {
    id: 'tcae_murcia',
    nombre: 'TCAE del Servicio Murciano de Salud',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_sas',
    nombre: 'TCAE del Servicio Andaluz de Salud (SAS)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_sespa',
    nombre: 'TCAE del SESPA (Asturias)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_ibsalut',
    nombre: 'TCAE del IB-Salut (Baleares)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_scs_cantabria',
    nombre: 'TCAE del Servicio Cántabro de Salud',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_sescam',
    nombre: 'TCAE del SESCAM (Castilla-La Mancha)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_sacyl',
    nombre: 'TCAE del SACYL (Castilla y León)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_ics',
    nombre: 'TCAE del ICS (Institut Català de la Salut)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_ses',
    nombre: 'TCAE del SES (Servicio Extremeño de Salud)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_seris',
    nombre: 'TCAE del SERIS (Servicio Riojano de Salud)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_navarra',
    nombre: 'TCAE del Servicio Navarro de Salud-Osasunbidea',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tcae_ingesa',
    nombre: 'TCAE del INGESA (Ceuta y Melilla)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '💉'
  },
  {
    id: 'tramitacion_procesal',
    nombre: 'Tramitación Procesal y Administrativa',
    categoria: 'C1',
    administracion: 'Justicia',
    icon: '⚖️'
  },
  {
    id: 'gestion_procesal',
    nombre: 'Gestión Procesal y Administrativa',
    categoria: 'C1',
    administracion: 'Justicia',
    icon: '⚖️'
  },

  // === CORREOS ===
  {
    id: 'correos_personal_operativo',
    nombre: 'Personal Operativo de Correos',
    categoria: 'C2',
    administracion: 'Empresa Pública',
    icon: '📮'
  },

  // === AYUNTAMIENTOS (MUY POPULARES) ===
  {
    id: 'auxiliar_ayuntamiento',
    nombre: 'Auxiliar Administrativo de Ayuntamiento',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'administrativo_ayuntamiento',
    nombre: 'Administrativo de Ayuntamiento',
    categoria: 'C1',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'policia_local',
    nombre: 'Policía Local',
    categoria: 'C1',
    administracion: 'Local',
    icon: '👮‍♂️'
  },
  {
    id: 'bombero',
    nombre: 'Bombero',
    categoria: 'C1',
    administracion: 'Local',
    icon: '🚒'
  },

  // === JUSTICIA (AUXILIAR) ===
  {
    id: 'auxilio_judicial',
    nombre: 'Auxilio Judicial',
    categoria: 'C2',
    administracion: 'Justicia',
    icon: '⚖️'
  },

  // === DIPUTACIÓN DE ZARAGOZA ===
  {
    id: 'auxiliar_administrativo_diputacion_zaragoza',
    nombre: 'Auxiliar Administrativo Dip. Zaragoza',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIÓN DE CÁDIZ ===
  {
    id: 'auxiliar_administrativo_diputacion_cadiz',
    nombre: 'Auxiliar Administrativo Dip. Cádiz',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIÓN DE LEÓN ===
  {
    id: 'auxiliar_administrativo_diputacion_leon',
    nombre: 'Auxiliar Administrativo Dip. León',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES ANDALUCÍA ===
  {
    id: 'auxiliar_administrativo_diputacion_almeria',
    nombre: 'Auxiliar Administrativo Dip. Almería',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_cordoba',
    nombre: 'Auxiliar Administrativo Dip. Córdoba',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_granada',
    nombre: 'Auxiliar Administrativo Dip. Granada',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_huelva',
    nombre: 'Auxiliar Administrativo Dip. Huelva',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_jaen',
    nombre: 'Auxiliar Administrativo Dip. Jaén',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_malaga',
    nombre: 'Auxiliar Administrativo Dip. Málaga',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_sevilla',
    nombre: 'Auxiliar Administrativo Dip. Sevilla',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES ARAGÓN ===
  {
    id: 'auxiliar_administrativo_diputacion_huesca',
    nombre: 'Auxiliar Administrativo Dip. Huesca',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_teruel',
    nombre: 'Auxiliar Administrativo Dip. Teruel',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES CASTILLA-LA MANCHA ===
  {
    id: 'auxiliar_administrativo_diputacion_albacete',
    nombre: 'Auxiliar Administrativo Dip. Albacete',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_ciudad_real',
    nombre: 'Auxiliar Administrativo Dip. Ciudad Real',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_cuenca',
    nombre: 'Auxiliar Administrativo Dip. Cuenca',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_guadalajara',
    nombre: 'Auxiliar Administrativo Dip. Guadalajara',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_toledo',
    nombre: 'Auxiliar Administrativo Dip. Toledo',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES CASTILLA Y LEÓN ===
  {
    id: 'auxiliar_administrativo_diputacion_avila',
    nombre: 'Auxiliar Administrativo Dip. Ávila',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_burgos',
    nombre: 'Auxiliar Administrativo Dip. Burgos',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_palencia',
    nombre: 'Auxiliar Administrativo Dip. Palencia',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_salamanca',
    nombre: 'Auxiliar Administrativo Dip. Salamanca',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_segovia',
    nombre: 'Auxiliar Administrativo Dip. Segovia',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_soria',
    nombre: 'Auxiliar Administrativo Dip. Soria',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_valladolid',
    nombre: 'Auxiliar Administrativo Dip. Valladolid',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_zamora',
    nombre: 'Auxiliar Administrativo Dip. Zamora',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES CATALUÑA ===
  {
    id: 'auxiliar_administrativo_diputacion_barcelona',
    nombre: 'Auxiliar Administrativo Dip. Barcelona',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_girona',
    nombre: 'Auxiliar Administrativo Dip. Girona',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_lleida',
    nombre: 'Auxiliar Administrativo Dip. Lleida',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_tarragona',
    nombre: 'Auxiliar Administrativo Dip. Tarragona',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES COMUNIDAD VALENCIANA ===
  {
    id: 'auxiliar_administrativo_diputacion_alicante',
    nombre: 'Auxiliar Administrativo Dip. Alicante',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_castellon',
    nombre: 'Auxiliar Administrativo Dip. Castellón',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_valencia',
    nombre: 'Auxiliar Administrativo Dip. Valencia',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES EXTREMADURA ===
  {
    id: 'auxiliar_administrativo_diputacion_badajoz',
    nombre: 'Auxiliar Administrativo Dip. Badajoz',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_caceres',
    nombre: 'Auxiliar Administrativo Dip. Cáceres',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES GALICIA ===
  {
    id: 'auxiliar_administrativo_diputacion_a_coruna',
    nombre: 'Auxiliar Administrativo Dip. A Coruña',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_lugo',
    nombre: 'Auxiliar Administrativo Dip. Lugo',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_ourense',
    nombre: 'Auxiliar Administrativo Dip. Ourense',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_pontevedra',
    nombre: 'Auxiliar Administrativo Dip. Pontevedra',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === DIPUTACIONES FORALES (PAÍS VASCO) ===
  {
    id: 'auxiliar_administrativo_diputacion_alava',
    nombre: 'Auxiliar Administrativo Dip. Foral de Álava',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_bizkaia',
    nombre: 'Auxiliar Administrativo Dip. Foral de Bizkaia',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_diputacion_gipuzkoa',
    nombre: 'Auxiliar Administrativo Dip. Foral de Gipuzkoa',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === CABILDOS CANARIAS ===
  {
    id: 'auxiliar_administrativo_cabildo_tenerife',
    nombre: 'Auxiliar Administrativo Cabildo de Tenerife',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_cabildo_gran_canaria',
    nombre: 'Auxiliar Administrativo Cabildo de Gran Canaria',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_cabildo_lanzarote',
    nombre: 'Auxiliar Administrativo Cabildo de Lanzarote',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_cabildo_fuerteventura',
    nombre: 'Auxiliar Administrativo Cabildo de Fuerteventura',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_cabildo_la_palma',
    nombre: 'Auxiliar Administrativo Cabildo de La Palma',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_cabildo_la_gomera',
    nombre: 'Auxiliar Administrativo Cabildo de La Gomera',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_cabildo_el_hierro',
    nombre: 'Auxiliar Administrativo Cabildo de El Hierro',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },

  // === CONSELLS INSULARS BALEARES ===
  {
    id: 'auxiliar_administrativo_consell_mallorca',
    nombre: 'Auxiliar Administrativo Consell de Mallorca',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_consell_menorca',
    nombre: 'Auxiliar Administrativo Consell de Menorca',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_consell_eivissa',
    nombre: 'Auxiliar Administrativo Consell d\'Eivissa',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_consell_formentera',
    nombre: 'Auxiliar Administrativo Consell de Formentera',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏝️'
  },

  // === AYUNTAMIENTOS GRANDES (TOP CAPITALES) ===
  {
    id: 'auxiliar_administrativo_ayuntamiento_madrid',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Madrid',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_barcelona',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Barcelona',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_sevilla',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Sevilla',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_zaragoza',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Zaragoza',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_malaga',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Málaga',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_bilbao',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Bilbao',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_las_palmas',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Las Palmas de Gran Canaria',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_palma',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Palma',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_badajoz',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Badajoz',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === AYUNTAMIENTO DE MURCIA ===
  {
    id: 'auxiliar_administrativo_ayuntamiento_murcia',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Murcia',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },

  // === COMUNIDADES AUTÓNOMAS ===
  {
    id: 'auxiliar_administrativo_carm',
    nombre: 'Auxiliar Administrativo CARM (Murcia)',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_cyl',
    nombre: 'Auxiliar Administrativo de Castilla y León',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_andalucia',
    nombre: 'Auxiliar Administrativo Junta de Andalucía',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_madrid',
    nombre: 'Auxiliar Administrativo Comunidad de Madrid',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_sermas',
    nombre: 'Auxiliar Administrativo del SERMAS (Madrid)',
    categoria: 'C2',
    administracion: 'Sanitaria',
    icon: '🏥'
  },
  {
    id: 'auxiliar_administrativo_canarias',
    nombre: 'Auxiliar Administrativo Gobierno de Canarias',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_scs_canarias',
    nombre: 'Auxiliar Administrativo del Servicio Canario de la Salud (SCS)',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏥'
  },
  {
    id: 'auxiliar_administrativo_ingesa',
    nombre: 'Auxiliar Administrativo del INGESA (Ceuta y Melilla)',
    categoria: 'C2',
    administracion: 'Estatal',
    icon: '🏥'
  },
  {
    id: 'auxiliar_administrativo_clm',
    nombre: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏰'
  },
  {
    id: 'auxiliar_administrativo_extremadura',
    nombre: 'Auxiliar Administrativo Junta de Extremadura',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏰'
  },
  {
    id: 'auxiliar_administrativo_valencia',
    nombre: 'Auxiliar Administrativo Generalitat Valenciana',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🍊'
  },
  {
    id: 'administrativo_diputacion_valencia',
    nombre: 'Administrativo Diputación de Valencia',
    categoria: 'C1',
    administracion: 'Local',
    icon: '🍊'
  },
  {
    id: 'administrativo_gva',
    nombre: 'Administrativo Generalitat Valenciana',
    categoria: 'C1',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_galicia',
    nombre: 'Auxiliar Administrativo Xunta de Galicia',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🐚'
  },
  {
    id: 'administrativo_galicia',
    nombre: 'Administrativo Xunta de Galicia',
    categoria: 'C1',
    administracion: 'Autonómica',
    icon: '🐚'
  },
  {
    id: 'auxiliar_administrativo_aragon',
    nombre: 'Auxiliar Administrativo de Aragón',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏔️'
  },
  {
    id: 'auxiliar_administrativo_asturias',
    nombre: 'Auxiliar Administrativo del Principado de Asturias',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '⛰️'
  },
  {
    id: 'auxiliar_administrativo_baleares',
    nombre: 'Auxiliar Administrativo de la CAIB',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏝️'
  },
  {
    id: 'auxiliar_administrativo_ayuntamiento_valencia',
    nombre: 'Auxiliar Administrativo Ayuntamiento de Valencia',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_cantabria',
    nombre: 'Auxiliar Administrativo Gobierno de Cantabria',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '⛰️'
  },
  {
    id: 'auxiliar_administrativo_catalunya',
    nombre: 'Auxiliar Administrativo Generalitat de Catalunya',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🎗️'
  },
  {
    id: 'auxiliar_administrativo_pais_vasco',
    nombre: 'Auxiliar Administrativo Gobierno Vasco',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🌳'
  },
  {
    id: 'auxiliar_administrativo_navarra',
    nombre: 'Auxiliar Administrativo Gobierno de Navarra',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏰'
  },
  {
    id: 'auxiliar_administrativo_ceuta',
    nombre: 'Auxiliar Administrativo Ciudad Autónoma de Ceuta',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'auxiliar_administrativo_melilla',
    nombre: 'Auxiliar Administrativo Ciudad Autónoma de Melilla',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'administrativo_navarra',
    nombre: 'Administrativo del Gobierno de Navarra',
    categoria: 'C1',
    administracion: 'Autonómica',
    icon: '🏰'
  },
  {
    id: 'auxiliar_administrativo_la_rioja',
    nombre: 'Auxiliar Administrativo Gobierno de La Rioja',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🍇'
  },
  {
    id: 'auxiliar_comunidad_autonoma',
    nombre: 'Auxiliar Administrativo Comunidad Autónoma',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
  },
  {
    id: 'administrativo_comunidad_autonoma',
    nombre: 'Administrativo Comunidad Autónoma',
    categoria: 'C1',
    administracion: 'Autonómica',
    icon: '🏛️'
  },

  // === EDUCACIÓN (OTROS) ===
  {
    id: 'profesor_secundaria',
    nombre: 'Profesor de Secundaria',
    categoria: 'A1',
    administracion: 'Educación',
    icon: '📚'
  },
  {
    id: 'profesor_tecnicos_fp',
    nombre: 'Profesor Técnico de FP',
    categoria: 'A2',
    administracion: 'Educación',
    icon: '🔧'
  },

  // === SANIDAD (OTROS) ===
  {
    id: 'celador_scs_canarias',
    nombre: 'Celador/a SCS (Canarias)',
    categoria: 'E',
    administracion: 'Sanitaria',
    icon: '🏥'
  },
  {
    id: 'celador',
    nombre: 'Celador (otras CCAA)',
    categoria: 'E',
    administracion: 'Sanitaria',
    icon: '🏥'
  },
  {
    id: 'fisioterapeuta',
    nombre: 'Fisioterapeuta',
    categoria: 'A2',
    administracion: 'Sanitaria',
    icon: '💪'
  },
  {
    id: 'matrona',
    nombre: 'Matrona',
    categoria: 'A2',
    administracion: 'Sanitaria',
    icon: '🤱'
  },

  // === CORREOS Y OTROS POPULARES ===
  {
    id: 'correos',
    nombre: 'Correos y Telégrafos',
    categoria: 'C2',
    administracion: 'Estatal',
    icon: '📬'
  },

  // === HACIENDA ===
  {
    id: 'agente_hacienda',
    nombre: 'Agente de la Hacienda Pública',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '💰'
  },
  {
    id: 'tecnico_hacienda',
    nombre: 'Técnico de Hacienda',
    categoria: 'A2',
    administracion: 'Estado',
    icon: '📊'
  },

  // === INSTITUCIONES PENITENCIARIAS ===
  {
    id: 'ayudante_instituciones_penitenciarias',
    nombre: 'Ayudante de Instituciones Penitenciarias',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🔒'
  },

  // === ADMINISTRACIÓN A2/A1 ===
  {
    id: 'gestor_administrativo_estado',
    nombre: 'Gestor Administrativo del Estado',
    categoria: 'A2',
    administracion: 'Estado',
    icon: '📋'
  },
  {
    id: 'tecnico_gestion_estado',
    nombre: 'Técnico de Gestión del Estado',
    categoria: 'A2',
    administracion: 'Estado',
    icon: '💼'
  },
  {
    id: 'tecnico_administracion_general',
    nombre: 'Técnico de Administración General',
    categoria: 'A1',
    administracion: 'Local',
    icon: '💼'
  },

  // === SANIDAD SUPERIOR ===
  {
    id: 'medico_familia',
    nombre: 'Médico de Familia',
    categoria: 'A1',
    administracion: 'Sanitaria',
    icon: '👨‍⚕️'
  },
  {
    id: 'medico_especialista',
    nombre: 'Médico Especialista',
    categoria: 'A1',
    administracion: 'Sanitaria',
    icon: '🩺'
  },
  {
    id: 'farmaceutico',
    nombre: 'Farmacéutico',
    categoria: 'A1',
    administracion: 'Sanitaria',
    icon: '💊'
  },
  {
    id: 'psicologo_sanitario',
    nombre: 'Psicólogo Sanitario',
    categoria: 'A1',
    administracion: 'Sanitaria',
    icon: '🧠'
  },
  {
    id: 'trabajador_social',
    nombre: 'Trabajador Social',
    categoria: 'A2',
    administracion: 'Sanitaria',
    icon: '🤝'
  },

  // === EDUCACIÓN ESPECIALIZADA ===
  {
    id: 'profesor_escuela_oficial_idiomas',
    nombre: 'Profesor de Escuela Oficial de Idiomas',
    categoria: 'A1',
    administracion: 'Educación',
    icon: '🌍'
  },
  {
    id: 'profesor_musica_artes',
    nombre: 'Profesor de Música y Artes Escénicas',
    categoria: 'A1',
    administracion: 'Educación',
    icon: '🎵'
  },

  // === SEGURIDAD (ESCALAS SUPERIORES) ===
  {
    id: 'subinspector_policia',
    nombre: 'Subinspector de Policía Nacional',
    categoria: 'A2',
    administracion: 'Estado',
    icon: '👮‍♂️'
  },
  {
    id: 'inspector_policia',
    nombre: 'Inspector de Policía Nacional',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '🎖️'
  },

  // === JUSTICIA (SUPERIOR) ===
  {
    id: 'letrado_administracion_justicia',
    nombre: 'Letrado de la Administración de Justicia',
    categoria: 'A1',
    administracion: 'Justicia',
    icon: '👨‍⚖️'
  },
  {
    id: 'medico_forense',
    nombre: 'Médico Forense',
    categoria: 'A1',
    administracion: 'Justicia',
    icon: '🩺'
  },

  // === OTROS CUERPOS ===
  {
    id: 'tecnico_informatica',
    nombre: 'Técnico Auxiliar de Informática',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '💻'
  },
  {
    id: 'tecnico_instituciones_penitenciarias',
    nombre: 'Técnico de Instituciones Penitenciarias',
    categoria: 'A2',
    administracion: 'Estado',
    icon: '🔐'
  },
  {
    id: 'secretario_intervencion_local',
    nombre: 'Secretario-Interventor de Administración Local',
    categoria: 'A1',
    administracion: 'Local',
    icon: '🏛️'
  },
  {
    id: 'arquitecto_ayuntamiento',
    nombre: 'Arquitecto',
    categoria: 'A1',
    administracion: 'Local',
    icon: '🏗️'
  },
  {
    id: 'ingeniero_ayuntamiento',
    nombre: 'Ingeniero',
    categoria: 'A1',
    administracion: 'Local',
    icon: '⚙️'
  },
  {
    id: 'bibliotecario',
    nombre: 'Auxiliar de Biblioteca',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '📚'
  },
  {
    id: 'conductor',
    nombre: 'Conductor',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🚗'
  },
  {
    id: 'subalterno',
    nombre: 'Subalterno',
    categoria: 'E',
    administracion: 'Estado',
    icon: '👤'
  },

  // === CUERPOS SUPERIORES (A1 ESPECIALIZADOS) ===
  {
    id: 'inspector_hacienda',
    nombre: 'Inspector de Hacienda del Estado',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '💼'
  },
  {
    id: 'interventor_auditor',
    nombre: 'Interventor y Auditor del Estado',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '📈'
  },
  {
    id: 'administradores_civiles',
    nombre: 'Administradores Civiles del Estado',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '🎓'
  },
  {
    id: 'abogacia_estado',
    nombre: 'Abogacía del Estado',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '⚖️'
  },
  {
    id: 'notarias',
    nombre: 'Notarías',
    categoria: 'A1',
    administracion: 'Justicia',
    icon: '📝'
  },
  {
    id: 'registros_propiedad',
    nombre: 'Registros de la Propiedad',
    categoria: 'A1',
    administracion: 'Justicia',
    icon: '🏠'
  },
  {
    id: 'juez',
    nombre: 'Juez',
    categoria: 'A1',
    administracion: 'Justicia',
    icon: '⚖️'
  },
  {
    id: 'fiscal',
    nombre: 'Fiscal',
    categoria: 'A1',
    administracion: 'Justicia',
    icon: '⚖️'
  },
  {
    id: 'diplomado_comercial',
    nombre: 'Diplomado Comercial del Estado',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '🌐'
  },
  {
    id: 'archivero',
    nombre: 'Archivero, Bibliotecario y Arqueólogo',
    categoria: 'A1',
    administracion: 'Estado',
    icon: '📜'
  },

  // === UNIVERSIDADES ===
  {
    id: 'auxiliar_administrativo_universidad',
    nombre: 'Auxiliar Administrativo de Universidad',
    categoria: 'C2',
    administracion: 'Universidad',
    icon: '🎓'
  },

  // === OTROS CUERPOS ESTATALES C2 ===
  {
    id: 'auxiliar_catastro',
    nombre: 'Auxiliar del Catastro',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🗺️'
  },
  {
    id: 'auxiliar_vigilancia_aduanera',
    nombre: 'Auxiliar de Vigilancia Aduanera',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🛃'
  },
  {
    id: 'auxiliar_sepe',
    nombre: 'Auxiliar del SEPE (Servicio Público de Empleo Estatal)',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '💼'
  },
  {
    id: 'mecanico_conductor_estado',
    nombre: 'Mecánico-Conductor del Parque Móvil del Estado',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🚗'
  },
  {
    id: 'auxiliar_estadistica_ine',
    nombre: 'Auxiliar de Estadística del INE',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '📊'
  },
  {
    id: 'auxiliar_inspeccion_soivre',
    nombre: 'Auxiliar de Inspección del SOIVRE',
    categoria: 'C2',
    administracion: 'Estado',
    icon: '🌾'
  },

  // === SERVICIOS SOCIALES (CCAA) ===
  {
    id: 'auxiliar_servicios_sociales',
    nombre: 'Auxiliar de Servicios Sociales',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🤝'
  },
  {
    id: 'auxiliar_educador_centros_menores',
    nombre: 'Auxiliar Educador de Centros de Menores',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🧒'
  },
  {
    id: 'auxiliar_residencia_mayores',
    nombre: 'Auxiliar de Residencia de Mayores',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '👵'
  },

  // === LOCALES ESPECIALIZADOS ===
  {
    id: 'ayudante_recaudacion',
    nombre: 'Ayudante de Recaudación (Diputaciones)',
    categoria: 'C2',
    administracion: 'Local',
    icon: '💰'
  },
  {
    id: 'auxiliar_inspeccion_tributos_locales',
    nombre: 'Auxiliar de Inspección de Tributos Locales',
    categoria: 'C2',
    administracion: 'Local',
    icon: '🧾'
  },
  {
    id: 'operador_emergencias_112',
    nombre: 'Operador de Emergencias 112',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🚨'
  },

  // === MEDIOAMBIENTE / FORESTAL (CCAA) ===
  {
    id: 'agente_forestal',
    nombre: 'Agente Forestal',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🌲'
  },
  {
    id: 'agente_medioambiental',
    nombre: 'Agente Medioambiental',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🌿'
  }
]

// Mapa de regiones (ipapi.co) → oposiciones prioritarias de esa comunidad autónoma
// Las oposiciones estatales (Estado, Justicia) siempre se incluyen como relevantes
const REGION_PRIORITY_OPOSICIONES: Record<string, string[]> = {
  'Madrid': ['auxiliar_administrativo_madrid', 'auxiliar_administrativo_sermas', 'tcae_sermas_madrid', 'celador_sermas_madrid', 'auxiliar_administrativo_universidad_uned', 'auxiliar_administrativo_estado', 'administrativo_estado'],
  'Community of Madrid': ['auxiliar_administrativo_madrid', 'auxiliar_administrativo_estado', 'administrativo_estado'],
  'Murcia': ['auxiliar_administrativo_ayuntamiento_murcia', 'auxiliar_administrativo_carm', 'tcae_murcia', 'auxiliar_administrativo_estado'],
  'Region of Murcia': ['auxiliar_administrativo_ayuntamiento_murcia', 'auxiliar_administrativo_carm', 'tcae_murcia', 'auxiliar_administrativo_estado'],
  'Castilla y León': ['auxiliar_administrativo_cyl', 'auxiliar_administrativo_estado'],
  'Castile and León': ['auxiliar_administrativo_cyl', 'auxiliar_administrativo_estado'],
  'Andalucía': ['auxiliar_administrativo_andalucia', 'enfermero_sas_andalucia', 'tcae_sas', 'auxiliar_administrativo_estado'],
  'Andalusia': ['auxiliar_administrativo_andalucia', 'enfermero_sas_andalucia', 'tcae_sas', 'auxiliar_administrativo_estado'],
  'Canarias': ['auxiliar_administrativo_canarias', 'auxiliar_administrativo_scs_canarias', 'celador_scs_canarias', 'tcae_canarias', 'auxiliar_administrativo_estado'],
  'Canary Islands': ['auxiliar_administrativo_canarias', 'auxiliar_administrativo_scs_canarias', 'celador_scs_canarias', 'auxiliar_administrativo_estado'],
  'Castilla-La Mancha': ['auxiliar_administrativo_clm', 'auxiliar_administrativo_estado'],
  'Extremadura': ['auxiliar_administrativo_extremadura', 'auxiliar_administrativo_estado'],
  'Aragón': ['auxiliar_administrativo_aragon', 'tcae_aragon', 'auxiliar_administrativo_estado'],
  'Aragon': ['auxiliar_administrativo_aragon', 'auxiliar_administrativo_estado'],
  'Asturias': ['auxiliar_administrativo_asturias', 'auxiliar_administrativo_estado'],
  'Principality of Asturias': ['auxiliar_administrativo_asturias', 'auxiliar_administrativo_estado'],
  'Islas Baleares': ['auxiliar_administrativo_baleares', 'auxiliar_administrativo_estado'],
  'Balearic Islands': ['auxiliar_administrativo_baleares', 'auxiliar_administrativo_estado'],
  'Cantabria': ['auxiliar_administrativo_cantabria', 'auxiliar_administrativo_estado'],
  'Navarra': ['administrativo_navarra', 'auxiliar_administrativo_estado'],
  'Chartered Community of Navarre': ['administrativo_navarra', 'auxiliar_administrativo_estado'],
  'La Rioja': ['auxiliar_administrativo_la_rioja', 'auxiliar_administrativo_estado'],
  'Ceuta': ['auxiliar_administrativo_ingesa', 'auxiliar_administrativo_estado'],
  'Melilla': ['auxiliar_administrativo_ingesa', 'auxiliar_administrativo_estado'],
  'País Vasco': ['auxiliar_enfermeria_osakidetza', 'auxiliar_administrativo_estado'],
  'Basque Country': ['auxiliar_enfermeria_osakidetza', 'auxiliar_administrativo_estado'],
  'Euskadi': ['auxiliar_enfermeria_osakidetza', 'auxiliar_administrativo_estado'],
  'Galicia': ['auxiliar_administrativo_galicia', 'administrativo_galicia', 'tcae_galicia', 'auxiliar_administrativo_estado'],
  'Comunidad Valenciana': ['auxiliar_administrativo_valencia', 'administrativo_gva', 'administrativo_diputacion_valencia', 'auxiliar_administrativo_ayuntamiento_valencia', 'auxiliar_enfermeria_gva', 'auxiliar_administrativo_estado'],
  'Valencian Community': ['auxiliar_administrativo_valencia', 'administrativo_gva', 'administrativo_diputacion_valencia', 'auxiliar_administrativo_ayuntamiento_valencia', 'auxiliar_enfermeria_gva', 'auxiliar_administrativo_estado'],
  'Valencia': ['auxiliar_administrativo_valencia', 'administrativo_gva', 'administrativo_diputacion_valencia', 'auxiliar_administrativo_ayuntamiento_valencia', 'auxiliar_administrativo_estado'],
}

// Oposiciones con contenido disponible, ordenadas por demanda real de usuarios
const AVAILABLE_OPOSICIONES_BY_DEMAND: string[] = [
  'auxiliar_administrativo_estado',       // 527 usuarios
  'administrativo_estado',               // 284
  'tramitacion_procesal',                // incluida por relevancia
  'auxilio_judicial',                    // incluida por relevancia
  'auxiliar_administrativo_cyl',         // 24
  'auxiliar_administrativo_diputacion_zaragoza', // 20
  'auxiliar_administrativo_diputacion_leon',     // 25
  'auxiliar_administrativo_diputacion_cadiz',    // 24
  'auxiliar_administrativo_ayuntamiento_murcia', // 20
  'auxiliar_administrativo_carm',        // 21
  'auxiliar_administrativo_canarias',    // 10
  'auxiliar_administrativo_scs_canarias', // sanitaria Canarias (Aux Admin SCS)
  'auxiliar_administrativo_ingesa',       // INGESA Ceuta/Melilla (Aux Admin estatal sanitario)
  'auxiliar_administrativo_andalucia',   // 7
  'auxiliar_administrativo_madrid',      // 4+
  'auxiliar_administrativo_aragon',      // 3
  'auxiliar_administrativo_asturias',    // 3
  'auxiliar_administrativo_ayuntamiento_valencia', // 3
  'auxiliar_administrativo_baleares',    // 3
  'auxiliar_administrativo_galicia',     // 2+
  'administrativo_galicia',              // nueva C1
  'auxiliar_administrativo_valencia',    // 2+
  'administrativo_gva',                  // nueva C1
  'administrativo_diputacion_valencia',  // nueva C1 (Diputación Valencia, feedback Mª José)
  'auxiliar_administrativo_clm',         // 1+
  'auxiliar_administrativo_extremadura', // 1+
  'auxiliar_administrativo_cantabria',  // nueva
  'administrativo_navarra',            // nueva
  'auxiliar_administrativo_la_rioja',  // nueva
  'enfermero_sas_andalucia',          // sanitaria
  'auxiliar_administrativo_sermas',   // administrativo sanitaria Madrid
  'tcae_sermas_madrid',               // sanitaria Madrid
  'celador_sermas_madrid',            // sanitaria Madrid
  'auxiliar_enfermeria_osakidetza',   // sanitaria País Vasco (TCAE)
  'auxiliar_enfermeria_gva',          // sanitaria Valencia (TCAE)
  'tcae_aragon',                      // sanitaria Aragón (TCAE)
  'tcae_sas',                         // sanitaria Andalucía (TCAE SAS)
  'tcae_canarias',                    // sanitaria Canarias (TCAE)
  'tcae_galicia',                     // sanitaria Galicia (TCAE)
  'tcae_murcia',                      // sanitaria Murcia (TCAE)
]

/** Reordena oposiciones: 1) región del usuario, 2) disponibles por demanda, 3) resto */
function sortByRegionPriority(oposiciones: OposicionItem[], region: string | null): OposicionItem[] {
  const regionIds = region ? (REGION_PRIORITY_OPOSICIONES[region] || []) : []
  const regionSet = new Set(regionIds)
  const availableSet = new Set(AVAILABLE_OPOSICIONES_BY_DEMAND)

  const tier1: OposicionItem[] = [] // Región del usuario
  const tier2: OposicionItem[] = [] // Disponibles por demanda (no en región)
  const tier3: OposicionItem[] = [] // Resto (captación, sin contenido)

  // Tier 1: región del usuario (en orden del mapa)
  for (const id of regionIds) {
    const found = oposiciones.find(o => o.id === id)
    if (found) tier1.push(found)
  }

  // Tier 2: disponibles por demanda (en orden de demanda, excluyendo los de región)
  for (const id of AVAILABLE_OPOSICIONES_BY_DEMAND) {
    if (regionSet.has(id)) continue
    const found = oposiciones.find(o => o.id === id)
    if (found) tier2.push(found)
  }

  // Tier 3: resto (mantener orden original)
  for (const op of oposiciones) {
    if (!regionSet.has(op.id) && !availableSet.has(op.id)) {
      tier3.push(op)
    }
  }

  return [...tier1, ...tier2, ...tier3]
}

export default function OnboardingModal({ isOpen, onComplete, onSkip, user }: OnboardingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // Campo que se está guardando

  // Estados
  const [searchTerm, setSearchTerm] = useState('')
  const [customOposiciones, setCustomOposiciones] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null)
  const [ciudadTemp, setCiudadTemp] = useState('')
  const [editingCiudad, setEditingCiudad] = useState(false)

  // Datos del formulario (TODO OBLIGATORIO)
  const [formData, setFormData] = useState<FormData>({
    selectedOposicion: null,
    age: '',
    gender: '',
    daily_study_hours: '', // Sin valor por defecto - campo opcional
    ciudad: ''
  })

  // Estado para rastrear qué campos ya estaban completos
  const [completedFields, setCompletedFields] = useState<CompletedFields>({
    oposicion: false,
    age: false,
    gender: false,
    ciudad: false,
    daily_study_hours: false
  })

  // Datos para crear oposición custom
  const [customOposicionData, setCustomOposicionData] = useState<CustomOposicionData>({
    nombre: '',
    categoria: '',
    administracion: ''
  })

  // Cargar oposiciones custom populares, perfil existente y detectar ubicación
  useEffect(() => {
    if (isOpen && user) {
      loadExistingProfile()
      loadCustomOposiciones()
      detectUserLocation()
    }
  }, [isOpen, user])

  // Cargar perfil existente del usuario
  const loadExistingProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('target_oposicion, target_oposicion_data, age, gender, daily_study_hours, ciudad')
        .eq('id', user.id)
        .single()

      if (error) {
        console.log('No hay perfil previo, iniciando desde cero')
        setProfileLoaded(true)
        return
      }

      if (data) {
        console.log('📋 Perfil existente cargado:', data)
        console.log('📋 target_oposicion_data:', data.target_oposicion_data)
        console.log('📋 target_oposicion (ID):', data.target_oposicion)

        // Determinar oposición preseleccionada
        let preselectedOposicion = data.target_oposicion_data || null

        // Si no hay target_oposicion_data pero sí target_oposicion (ID),
        // buscar en la lista de oposiciones oficiales
        if (!preselectedOposicion && data.target_oposicion) {
          const found = OFFICIAL_OPOSICIONES.find(o => o.id === data.target_oposicion)
          if (found) {
            preselectedOposicion = found
            console.log('📋 Oposición preseleccionada desde ID:', found.nombre)
          }
        }

        // Rastrear qué campos ya están completos
        const completed = {
          oposicion: !!preselectedOposicion,
          age: !!data.age,
          gender: !!data.gender,
          ciudad: !!data.ciudad,
          daily_study_hours: !!data.daily_study_hours
        }

        // Pre-rellenar con datos existentes
        setFormData(prev => ({
          ...prev,
          selectedOposicion: preselectedOposicion,
          age: data.age?.toString() || '',
          gender: data.gender || '',
          daily_study_hours: data.daily_study_hours || '', // Sin valor por defecto
          ciudad: data.ciudad || ''
        }))

        setCompletedFields(completed)
        console.log('📋 Campos completados:', completed)
        console.log('📋 selectedOposicion final:', preselectedOposicion)
      }

      setProfileLoaded(true)
    } catch (err) {
      console.error('Error cargando perfil:', err)
      setProfileLoaded(true)
    }
  }

  // Detectar ubicación por IP (solo si no tiene ciudad ya)
  const detectUserLocation = async () => {
    try {
      setDetectingLocation(true)
      const response = await fetch('https://ipapi.co/json/')
      const data = await response.json()

      console.log('📍 Ubicación detectada:', data)

      // Guardar región para reordenar oposiciones
      if (data.region) {
        setDetectedRegion(data.region)
        console.log('📍 Región detectada:', data.region)
      }

      // Pre-rellenar y guardar ciudad automáticamente si está vacía
      if (data.city) {
        setFormData(prev => {
          // No sobreescribir si ya tiene ciudad
          if (prev.ciudad) return prev

          // 🔄 CAMBIO UX: Guardar directamente en formData (sin necesidad de clic en "Guardar")
          console.log('📍 Auto-rellenando ciudad detectada:', data.city)

          return {
            ...prev,
            ciudad: data.city
          }
        })
      }
    } catch (err) {
      console.error('Error detectando ubicación:', err)
      // No es crítico, el usuario puede llenar manualmente
    } finally {
      setDetectingLocation(false)
    }
  }

  // 🆕 Auto-guardar ciudad detectada cuando el perfil esté listo
  useEffect(() => {
    if (!profileLoaded || !formData.ciudad) return
    // Si hay ciudad en formData pero no estaba completa previamente, guardarla
    if (!completedFields.ciudad && formData.ciudad.trim()) {
      console.log('💾 Auto-guardando ciudad en BD:', formData.ciudad)
      saveField('ciudad', formData.ciudad)
    }
  }, [profileLoaded, formData.ciudad, completedFields.ciudad])

  // 💾 FUNCIÓN CLAVE: Guardar campo individual progresivamente
  const saveField = async (fieldName: string, value: any): Promise<boolean> => {
    if (!user?.id || !profileLoaded) return false

    try {
      setSaving(fieldName)
      console.log(`💾 Guardando ${fieldName}:`, value)

      // Preparar el update
      const updates = { [fieldName]: value }

      // Actualizar directamente (el perfil ya existe)
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      console.log(`✅ ${fieldName} guardado exitosamente`)
      return true // ✅ Devolver true si tuvo éxito
    } catch (err) {
      console.error(`Error guardando ${fieldName}:`, err)
      // No mostrar error al usuario, es guardado en background
      return false // ❌ Devolver false si falló
    } finally {
      setSaving(null)
    }
  }

  // Auto-save edad cuando es válida
  useEffect(() => {
    if (!formData.age || !profileLoaded) return

    const ageNum = parseInt(formData.age)
    if (ageNum >= 16 && ageNum <= 100) {
      // Guardar inmediatamente si es válida
      saveField('age', ageNum)
    }
  }, [formData.age, profileLoaded])

  // Auto-save horas de estudio cuando es válida (campo opcional)
  useEffect(() => {
    if (!formData.daily_study_hours || !profileLoaded) return

    const hours = parseInt(formData.daily_study_hours)
    if (hours >= 1 && hours <= 12) {
      // Guardar inmediatamente si es válida
      saveField('daily_study_hours', hours)
    }
  }, [formData.daily_study_hours, profileLoaded])

  const loadCustomOposiciones = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_popular_custom_oposiciones', { p_limit: 10 })

      if (error) throw error
      setCustomOposiciones(data || [])
    } catch (err) {
      console.error('Error cargando oposiciones custom:', err)
    }
  }

  // Filtrar y reordenar oposiciones por búsqueda y región detectada.
  // Catálogo desde BD (fallback al array estático para SSR + zero downtime).
  // Sprint B del roadmap oposiciones-coverage-level-y-promocion-automatica.md:
  // hook con triple cache (memoria → localStorage → fallback estático).
  const catalog = useOposicionesCatalog(OFFICIAL_OPOSICIONES)

  // Filtrado central en lib/utils/searchOposicion.ts (compartido con
  // OposicionChangeModal y OposicionGuard). Aliases viven en lib/config/oposiciones.ts.
  const filteredOposiciones = useMemo(() => {
    const sorted = sortByRegionPriority(catalog, detectedRegion)
    const term = searchTerm.trim()
    if (!term) return { official: sorted, custom: customOposiciones }

    // Lookup de aliases para cada item desde OPOSICIONES config (single source of truth)
    const aliasesById = Object.fromEntries(OPOSICIONES.map(o => [o.id, o.aliases || []]))

    return {
      official: sorted.filter(op =>
        matchesOposicion({ ...op, aliases: aliasesById[op.id] }, term)
      ),
      custom: customOposiciones.filter(op =>
        matchesOposicion(op, term)
      ),
    }
  }, [searchTerm, customOposiciones, detectedRegion, catalog])

  // Seleccionar oposición oficial
  const handleSelectOfficial = (oposicion: OposicionItem) => {
    const oposicionData: SelectedOposicion = {
      id: oposicion.id,
      nombre: oposicion.nombre,
      categoria: oposicion.categoria,
      administracion: oposicion.administracion,
      tipo: 'oficial'
    }

    setFormData({
      ...formData,
      selectedOposicion: oposicionData
    })
    setError(null)

    // 💾 Guardar inmediatamente
    saveField('target_oposicion', oposicion.id)
    saveField('target_oposicion_data', oposicionData)
  }

  // Seleccionar oposición custom
  const handleSelectCustom = (oposicion: any) => {
    const oposicionData: SelectedOposicion = {
      id: oposicion.id,
      nombre: oposicion.nombre,
      categoria: oposicion.categoria,
      administracion: oposicion.administracion,
      tipo: 'custom'
    }

    setFormData({
      ...formData,
      selectedOposicion: oposicionData
    })
    setError(null)

    // 💾 Guardar inmediatamente
    saveField('target_oposicion', oposicion.id)
    saveField('target_oposicion_data', oposicionData)
  }

  // Crear oposición personalizada
  const handleCreateCustom = async () => {
    if (!customOposicionData.nombre.trim()) {
      setError('Por favor, ingresa el nombre de la oposición')
      return
    }

    // 🔍 DETECCIÓN DE DUPLICADOS: Verificar si coincide con una oficial
    const matchingOfficial = findMatchingOfficialOposicion(customOposicionData.nombre)

    if (matchingOfficial) {
      // Mostrar alerta y sugerir usar la oficial
      const useOfficial = window.confirm(
        `⚠️ Ya existe una oposición oficial similar: "${matchingOfficial.nombre}"\n\n` +
        `¿Quieres usar la oposición oficial en lugar de crear una personalizada?\n\n` +
        `Recomendamos usar la oficial para acceder a todas las funcionalidades.`
      )

      if (useOfficial) {
        // Usar la oposición oficial
        handleSelectOfficial(matchingOfficial)
        setShowCreateForm(false)
        setCustomOposicionData({ nombre: '', categoria: '', administracion: '' })
        return
      }
      // Si dice que no, continuar creando la personalizada
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .rpc('create_or_select_custom_oposicion', {
          p_user_id: user.id,
          p_nombre: customOposicionData.nombre,
          p_categoria: customOposicionData.categoria || null,
          p_administracion: customOposicionData.administracion || null,
          p_is_public: true,
          p_created_by_username: user.user_metadata?.full_name || user.email?.split('@')[0]
        })

      if (error) throw error

      // Seleccionar la oposición recién creada
      const oposicionData: SelectedOposicion = {
        id: data.oposicion_id,
        nombre: customOposicionData.nombre,
        categoria: customOposicionData.categoria,
        administracion: customOposicionData.administracion,
        tipo: 'custom'
      }

      setFormData({
        ...formData,
        selectedOposicion: oposicionData
      })

      // 💾 Guardar inmediatamente - NOTA: Para custom seguimos guardando UUID
      // porque no hay un slug oficial para oposiciones personalizadas
      saveField('target_oposicion', data.oposicion_id)
      saveField('target_oposicion_data', oposicionData)

      setShowCreateForm(false)
      setCustomOposicionData({ nombre: '', categoria: '', administracion: '' })

      // Recargar lista
      loadCustomOposiciones()
    } catch (err) {
      console.error('Error creando oposición:', err)
      setError((err as Error).message || 'Error al crear oposición')
    } finally {
      setLoading(false)
    }
  }

  // Validar formulario completo
  const isFormValid = () => {
    return (
      formData.selectedOposicion &&
      formData.age &&
      parseInt(formData.age) >= 16 &&
      parseInt(formData.age) <= 100 &&
      formData.gender &&
      // formData.daily_study_hours && // ❌ REMOVIDO - Campo opcional
      formData.ciudad &&
      formData.ciudad.trim().length > 0
    )
  }

  // Completar onboarding - MEJORADO: Verifica que todos los campos estén guardados
  const completingRef = useRef(false)

  const handleComplete = async () => {
    if (!isFormValid()) {
      setError('Por favor, completa todos los campos obligatorios')
      return
    }
    if (completingRef.current) return
    completingRef.current = true

    try {
      setLoading(true)
      setError(null)

      const { completeOnboardingOnServer } = await import('@/lib/api/v2/complete-onboarding/client')
      const result = await completeOnboardingOnServer({
        targetOposicion: formData.selectedOposicion!.id,
        targetOposicionData: formData.selectedOposicion as unknown as Record<string, unknown>,
        age: parseInt(formData.age),
        gender: formData.gender,
        ciudad: formData.ciudad.trim(),
        dailyStudyHours: formData.daily_study_hours ? parseInt(formData.daily_study_hours) : null,
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al completar onboarding')
      }

      console.log('✅ Onboarding completado via API v2')
      onComplete()
    } catch (err) {
      console.error('Error completando onboarding:', err)
      setError((err as Error).message || 'Error al completar onboarding')
    } finally {
      setLoading(false)
      completingRef.current = false
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sm:p-6 sticky top-0 z-10">
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-bold">
              Para personalizar tu experiencia, necesitamos saber estos datos
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-6">

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Resumen de campos completados (solo si hay algunos completos) */}
          {Object.values(completedFields).some(v => v) && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <p className="text-green-800 dark:text-green-300 text-sm font-medium mb-2">
                ✅ Ya tenemos estos datos:
              </p>
              <div className="flex flex-wrap gap-2">
                {completedFields.oposicion && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    🎯 {formData.selectedOposicion?.nombre || 'Oposición'}
                  </span>
                )}
                {completedFields.age && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    🎂 Edad
                  </span>
                )}
                {completedFields.gender && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    👤 Género
                  </span>
                )}
                {completedFields.ciudad && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    📍 Ciudad
                  </span>
                )}
                {completedFields.daily_study_hours && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    ⏰ Horas de estudio
                  </span>
                )}
              </div>
              <p className="text-green-700 dark:text-green-400 text-xs mt-2">
                Solo necesitamos completar los campos faltantes
              </p>
            </div>
          )}

          {/* Modal crear oposición custom */}
          {showCreateForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                  Crear Oposición Personalizada
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre de la oposición *
                    </label>
                    <input
                      type="text"
                      value={customOposicionData.nombre}
                      onChange={(e) => setCustomOposicionData({...customOposicionData, nombre: e.target.value})}
                      placeholder="Ej: Bombero Comunidad de Madrid"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Categoría
                      </label>
                      <input
                        type="text"
                        value={customOposicionData.categoria}
                        onChange={(e) => setCustomOposicionData({...customOposicionData, categoria: e.target.value})}
                        placeholder="C1, A2..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Administración
                      </label>
                      <input
                        type="text"
                        value={customOposicionData.administracion}
                        onChange={(e) => setCustomOposicionData({...customOposicionData, administracion: e.target.value})}
                        placeholder="Local..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateCustom}
                      disabled={loading || !customOposicionData.nombre.trim()}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:opacity-50"
                    >
                      {loading ? 'Creando...' : 'Crear'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección: Oposición - Solo mostrar si no está completa */}
          {!completedFields.oposicion && (
          <div id="onboarding-oposicion" className={`${error && !formData.selectedOposicion ? 'ring-2 ring-amber-400 rounded-lg p-2 -m-2' : ''}`}>
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
              ¿Qué oposición estás preparando? *
            </h3>

            {/* Oposición seleccionada */}
            {formData.selectedOposicion && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      ✓ {formData.selectedOposicion.nombre || formData.selectedOposicion.id || 'Oposición seleccionada'}
                    </span>
                    {formData.selectedOposicion.categoria && formData.selectedOposicion.administracion && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {formData.selectedOposicion.categoria} · {formData.selectedOposicion.administracion}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setFormData({...formData, selectedOposicion: null})
                      console.log('🔄 Oposición deseleccionada')
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs ml-2"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            )}

            {/* Buscador y lista (solo si no hay seleccionada) */}
            {!formData.selectedOposicion && (
              <>
                {/* Buscador */}
                <input
                  type="text"
                  placeholder="🔍 Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />

                {/* Lista de oposiciones */}
                <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto">
                {/* Oficiales */}
                {filteredOposiciones.official.slice(0, 10).map((op) => {
                  const isImplemented = IMPLEMENTED_OPOSICION_IDS.has(op.id)
                  return (
                    <button
                      key={op.id}
                      onClick={() => handleSelectOfficial(op)}
                      className="w-full text-left p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <OposicionIcon id={op.id} icon={op.icon} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {op.nombre}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {op.categoria} · {op.administracion}
                          </div>
                        </div>
                        {!isImplemented && (
                          <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
                            🔜 En elaboración
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}

                {/* Custom */}
                {filteredOposiciones.custom.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => handleSelectCustom(op)}
                    className="w-full text-left p-2 border border-purple-200 dark:border-purple-700 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👥</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {op.nombre}
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          ⭐ {op.times_selected} usuarios
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Botón crear otra */}
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full p-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-gray-600 dark:text-gray-400 text-sm font-medium"
                >
                  ➕ Otra oposición
                </button>
                </div>
              </>
            )}
          </div>
          )}

          {/* Divisor - solo si hay campos para mostrar */}
          {(!completedFields.age || !completedFields.gender || !completedFields.ciudad) && (
            <div className="border-t border-gray-200 dark:border-gray-700"></div>
          )}

          {/* Sección: Datos Personales - solo si falta algún campo */}
          {(!completedFields.age || !completedFields.gender || !completedFields.ciudad) && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
              Información personal
            </h3>

            {/* Edad - solo si no está completa */}
            {!completedFields.age && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Edad *
              </label>
              {formData.age && parseInt(formData.age) >= 16 && parseInt(formData.age) <= 100 ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                      ✓ {formData.age} años
                    </span>
                    <button
                      onClick={() => setFormData({...formData, age: ''})}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="number"
                  min="16"
                  max="100"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  placeholder="Ej: 25"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              )}
            </div>
            )}

            {/* Género - solo si no está completo */}
            {!completedFields.gender && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Género *
              </label>
              {formData.gender ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                      ✓ {formData.gender === 'male' ? 'Hombre' : 'Mujer'}
                    </span>
                    <button
                      onClick={() => setFormData({...formData, gender: ''})}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setFormData({...formData, gender: 'male'})
                      saveField('gender', 'male') // 💾 Guardar inmediatamente
                    }}
                    className="py-2 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 transition-all"
                  >
                    Hombre
                  </button>
                  <button
                    onClick={() => {
                      setFormData({...formData, gender: 'female'})
                      saveField('gender', 'female') // 💾 Guardar inmediatamente
                    }}
                    className="py-2 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 transition-all"
                  >
                    Mujer
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Horas de estudio - OPCIONAL - No mostrar si ya está completo */}
            {!completedFields.daily_study_hours && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Horas de estudio al día
                <span className="text-gray-500 text-xs ml-1">(Opcional)</span>
              </label>
              {formData.daily_study_hours && parseInt(formData.daily_study_hours) >= 1 && parseInt(formData.daily_study_hours) <= 12 ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                      ✓ {formData.daily_study_hours} {parseInt(formData.daily_study_hours) === 1 ? 'hora' : 'horas'} al día
                    </span>
                    <button
                      onClick={() => setFormData({...formData, daily_study_hours: ''})}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={formData.daily_study_hours}
                  onChange={(e) => setFormData({...formData, daily_study_hours: e.target.value})}
                  placeholder="Ej: 3 (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              )}
            </div>
            )}

            {/* Ciudad - solo si no está completa */}
            {!completedFields.ciudad && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ciudad *
                {detectingLocation && <span className="ml-2 text-xs text-blue-500">📍 Detectando...</span>}
              </label>
              {formData.ciudad && formData.ciudad.trim() && !editingCiudad ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                      ✓ {formData.ciudad}
                    </span>
                    <button
                      onClick={() => {
                        setCiudadTemp(formData.ciudad)
                        setEditingCiudad(true)
                      }}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ciudadTemp}
                    onChange={(e) => setCiudadTemp(e.target.value)}
                    placeholder="Ej: Madrid"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={() => {
                      if (ciudadTemp.trim()) {
                        setFormData({...formData, ciudad: ciudadTemp.trim()})
                        saveField('ciudad', ciudadTemp.trim())
                        setEditingCiudad(false)
                      }
                    }}
                    disabled={!ciudadTemp.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                  >
                    ✓ Guardar
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
          )}

          {/* Botón Continuar */}
          <button
            onClick={handleComplete}
            disabled={loading || !isFormValid()}
            className={`w-full py-2.5 sm:py-4 rounded-lg font-bold text-sm sm:text-lg transition-all ${
              isFormValid() && !loading
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Finalizando...' : '✨ Finalizar'}
          </button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            💾 Todos tus datos se guardan automáticamente
          </p>

          {/* Botón Completar después — requiere oposición seleccionada */}
          <button
            onClick={() => {
              if (!formData.selectedOposicion) {
                setError('Selecciona tu oposición para continuar. Puedes buscarla o crear una personalizada.')
                // Scroll al selector de oposición
                document.getElementById('onboarding-oposicion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                return
              }
              onSkip()
            }}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            Completar después
          </button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            🔒 Tus datos son privados y seguros
          </p>
        </div>
      </div>
    </div>
  )
}
