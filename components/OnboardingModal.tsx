// components/OnboardingModal.tsx
// Modal de Onboarding Compacto - Una sola pantalla
'use client'
import { useState, useEffect, useMemo } from 'react'
import { getSupabaseClient } from '../lib/supabase'

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
    icon: '👮'
  },
  {
    id: 'guardia_civil',
    nombre: 'Guardia Civil',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🚔'
  },
  {
    id: 'enfermero',
    nombre: 'Enfermero/a',
    categoria: 'A2',
    administracion: 'Sanitaria',
    icon: '👨‍⚕️'
  },
  {
    id: 'tramitacion_procesal',
    nombre: 'Tramitación Procesal y Administrativa',
    categoria: 'C2',
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
    id: 'auxiliar_administrativo_canarias',
    nombre: 'Auxiliar Administrativo Gobierno de Canarias',
    categoria: 'C2',
    administracion: 'Autonómica',
    icon: '🏛️'
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
    id: 'auxiliar_administrativo_galicia',
    nombre: 'Auxiliar Administrativo Xunta de Galicia',
    categoria: 'C2',
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
    id: 'celador',
    nombre: 'Celador',
    categoria: 'C2',
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
  {
    id: 'administrativo_seguridad_social',
    nombre: 'Administrativo Seguridad Social',
    categoria: 'C1',
    administracion: 'Estado',
    icon: '🏛️'
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
  }
]

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

  // Filtrar oposiciones por búsqueda
  const filteredOposiciones = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return { official: OFFICIAL_OPOSICIONES, custom: customOposiciones }

    return {
      official: OFFICIAL_OPOSICIONES.filter(op =>
        op.nombre.toLowerCase().includes(term) ||
        op.categoria.toLowerCase().includes(term) ||
        op.administracion.toLowerCase().includes(term)
      ),
      custom: customOposiciones.filter(op =>
        op.nombre.toLowerCase().includes(term) ||
        (op.categoria && op.categoria.toLowerCase().includes(term)) ||
        (op.administracion && op.administracion.toLowerCase().includes(term))
      )
    }
  }, [searchTerm, customOposiciones])

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
  const handleComplete = async () => {
    if (!isFormValid()) {
      setError('Por favor, completa todos los campos obligatorios')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // 🔴 NUEVO: Verificar que los campos críticos estén en BD antes de marcar completado
      const { data: currentProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('target_oposicion, age, gender, ciudad')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      // Validar que los campos obligatorios estén guardados
      const missingFields = []
      if (!currentProfile.target_oposicion) missingFields.push('oposición')
      if (!currentProfile.age) missingFields.push('edad')
      if (!currentProfile.gender) missingFields.push('género')
      if (!currentProfile.ciudad) missingFields.push('ciudad')

      if (missingFields.length > 0) {
        console.error('❌ Campos faltantes en BD:', missingFields)
        setError(`Error: No se guardaron algunos campos (${missingFields.join(', ')}). Por favor, intenta nuevamente.`)

        // 🔴 NUEVO: Intentar guardar los campos faltantes
        const updates: Record<string, any> = {}
        if (!currentProfile.target_oposicion && formData.selectedOposicion) {
          updates.target_oposicion = formData.selectedOposicion.id
          updates.target_oposicion_data = formData.selectedOposicion
        }
        if (!currentProfile.age && formData.age) {
          updates.age = parseInt(formData.age)
        }
        if (!currentProfile.gender && formData.gender) {
          updates.gender = formData.gender
        }
        if (!currentProfile.ciudad && formData.ciudad) {
          updates.ciudad = formData.ciudad
        }

        // Si hay campos para actualizar, intentar guardarlos
        if (Object.keys(updates).length > 0) {
          console.log('🔄 Intentando guardar campos faltantes:', Object.keys(updates))
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', user.id)

          if (updateError) {
            console.error('❌ Error guardando campos faltantes:', updateError)
            throw new Error('No se pudieron guardar todos los datos. Por favor, recarga la página e intenta nuevamente.')
          }
          console.log('✅ Campos faltantes guardados exitosamente')
        }
      }

      // Guardar daily_study_hours si está presente (opcional)
      if (formData.daily_study_hours) {
        const { error: hoursError } = await supabase
          .from('user_profiles')
          .update({ daily_study_hours: formData.daily_study_hours })
          .eq('id', user.id)

        if (hoursError) {
          console.warn('⚠️ No se pudo guardar horas de estudio (opcional):', hoursError)
          // No es crítico, continuar
        }
      }

      // Ahora sí marcar onboarding como completado
      const { error } = await supabase
        .from('user_profiles')
        .update({
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      console.log('✅ Onboarding completado con todos los campos verificados!')
      onComplete()
    } catch (err) {
      console.error('Error completando onboarding:', err)
      setError((err as Error).message || 'Error al completar onboarding')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
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
          <div>
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
                {filteredOposiciones.official.slice(0, 10).map((op) => (
                  <button
                    key={op.id}
                    onClick={() => handleSelectOfficial(op)}
                    className="w-full text-left p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{op.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {op.nombre}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {op.categoria} · {op.administracion}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

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

          {/* Botón Completar después */}
          <button
            onClick={onSkip}
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
