// app/perfil/page.tsx - CON PESTAÑAS Y EMAIL PREFERENCES
'use client'
import { useState, useEffect, useRef, Suspense, useMemo, useCallback, ChangeEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AvatarChanger from '@/components/AvatarChanger'
import { useAuth } from '@/contexts/AuthContext'
import { useOposicion } from '@/contexts/OposicionContext'
import { ALL_OPOSICION_IDS, getOposicion } from '@/lib/config/oposiciones'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { emitClientEvent } from '@/lib/observability/client'
import { effectiveBannerVisible, nextBannerVisible } from '@/components/DailyGoalBanner'
import { setTargetOposicion } from '@/lib/api/setTargetOposicion'
import CancellationFlow from '@/components/CancellationFlow'
import OposicionChangeModal from '@/components/OposicionChangeModal'
import type { User, SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TIPOS E INTERFACES
// ============================================

interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  preferred_language?: string
  study_goal?: number
  show_daily_goal_banner?: boolean
  target_oposicion?: string
  target_oposicion_data?: OposicionData | null
  nickname?: string
  age?: number | string
  gender?: string
  ciudad?: string
  daily_study_hours?: number | string
  plan_type?: string
  created_at?: string
  updated_at?: string
  is_active_student?: boolean
  stripe_customer_id?: string
}

interface AvatarData {
  type: 'default' | 'predefined' | 'custom'
  emoji?: string
  color?: string
  name?: string
  url?: string
}

interface EmailPreferences {
  receive_emails: boolean
  support_emails: boolean
  newsletter_emails: boolean
  unsubscribed_all: boolean
  email_reactivacion: boolean
  email_urgente: boolean
  email_bienvenida_motivacional: boolean
  email_bienvenida_inmediato: boolean
  email_resumen_semanal: boolean
  email_soporte_disabled: boolean
  email_newsletter_disabled: boolean
}

interface SubscriptionData {
  hasSubscription: boolean
  planType?: string
  stripeCustomerId?: string
  subscription?: {
    id: string
    status: string
    planAmount?: number
    planInterval?: string
    planIntervalCount?: number
    currentPeriodStart?: number
    currentPeriodEnd?: number
    cancelAtPeriodEnd?: boolean
    plan?: {
      id: string
      nickname?: string
      amount?: number
      interval?: string
    }
  }
  customer?: {
    id: string
    email?: string
  }
}

interface AutoProfile {
  id: string
  emoji: string
  name: string
  description: string
  color: string
}

interface MatchedBadge {
  id: string
  emoji: string
  name: string
  condition: string
}

interface FormData {
  nickname: string
  study_goal: string
  target_oposicion: string
  age: string
  gender: string
  ciudad: string
  daily_study_hours: string
}

interface OposicionData {
  name: string
  slug: string
  categoria: string
  administracion: string
}

interface OposicionOption {
  value: string
  label: string
  data?: OposicionData
}

// Fase 8 — fila de /api/profile/seguidas
interface SeguidaItem {
  id: string
  oposicionId: string
  rol: 'target' | 'favorita'
  notifyBell: boolean
  notifyEmail: boolean
  slug: string | null
  nombre: string | null
  isActive: boolean | null
}

type TabType = 'general' | 'emails' | 'suscripcion'

// Tipo para AuthContext (no está tipado)
interface AuthContextValue {
  user: User | null
  loading: boolean
  supabase: SupabaseClient
  isPremium: boolean
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

function PerfilPageContent() {
  const { user, loading: authLoading, supabase, isPremium } = useAuth() as AuthContextValue
  const { oposicionId } = useOposicion()
  const userOposicionName = oposicionId ? (getOposicion(oposicionId)?.name ?? null) : null
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [currentAvatar, setCurrentAvatar] = useState<AvatarData | null>(null)

  // 🆕 SISTEMA DE PESTAÑAS
  const [activeTab, setActiveTab] = useState<TabType>('general')

  // 🆕 EMAIL PREFERENCES - SIMPLIFICADO
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
    receive_emails: true,
    support_emails: true,
    newsletter_emails: true,
    unsubscribed_all: false,
    email_reactivacion: true,
    email_urgente: true,
    email_bienvenida_motivacional: true,
    email_bienvenida_inmediato: true,
    email_resumen_semanal: true,
    email_soporte_disabled: false,
    email_newsletter_disabled: false,
  })
  const [emailPrefLoading, setEmailPrefLoading] = useState<boolean>(true)
  const [emailPrefSaving, setEmailPrefSaving] = useState<boolean>(false)

  // 🆕 SUSCRIPCIÓN
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState<boolean>(true)
  const [portalLoading, setPortalLoading] = useState<boolean>(false)
  const [showCancellationFlow, setShowCancellationFlow] = useState<boolean>(false)
  const [reactivateLoading, setReactivateLoading] = useState<boolean>(false)
  const [showReactivatedBanner, setShowReactivatedBanner] = useState<boolean>(false)

  // 🤖 AVATAR AUTOMÁTICO - Por defecto activado
  const [avatarMode, setAvatarMode] = useState<'manual' | 'automatic'>('automatic')
  const [autoProfile, setAutoProfile] = useState<AutoProfile | null>(null)
  const [matchedBadges, setMatchedBadges] = useState<MatchedBadge[]>([])
  const [avatarModeLoading, setAvatarModeLoading] = useState<boolean>(true)
  const [avatarModeSaving, setAvatarModeSaving] = useState<boolean>(false)
  const [bannerToggleSaving, setBannerToggleSaving] = useState<boolean>(false)

  // Para evitar guardado en primera carga
  const isInitialLoad = useRef<boolean>(true)
  const [hasChanges, setHasChanges] = useState<boolean>(false)

  // 🗑️ ELIMINACIÓN DE CUENTA
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState<boolean>(false)
  // Paso del modal de baja: 'retention' (pantalla de retención previa) → 'confirm'
  // (escribir ELIMINAR). Retención: recuperar a quien se va por inactividad, no por enfado.
  const [deleteStep, setDeleteStep] = useState<'retention' | 'confirm'>('retention')
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('')
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false)
  const [deleteError, setDeleteError] = useState<string>('')
  const [deletionRequested, setDeletionRequested] = useState<boolean>(false)
  const [deletionSuccess, setDeletionSuccess] = useState<boolean>(false)
  // Lock síncrono basado en ref para prevenir doble-click rápido antes de
  // que React propague el state deletingAccount (caso real Cristina + Ana María)
  const deletingAccountRef = useRef<boolean>(false)
  
  // Form data - SINCRONIZADO CON useUserOposicion
  const [formData, setFormData] = useState<FormData>({
    nickname: '',
    study_goal: '25',
    target_oposicion: '',
    age: '',
    gender: '',
    ciudad: '',
    daily_study_hours: ''
  })

  // Estados para el selector de oposición con buscador
  const [showOposicionSelector, setShowOposicionSelector] = useState<boolean>(false)
  const [oposicionSearchTerm, setOposicionSearchTerm] = useState<string>('')

  // Fase 8 — oposiciones seguidas (target + favoritas) para avisos por hitos
  const [seguidas, setSeguidas] = useState<SeguidaItem[]>([])
  const [seguidasLoading, setSeguidasLoading] = useState<boolean>(true)
  const [seguidasBusy, setSeguidasBusy] = useState<boolean>(false)
  const [showAddFavorita, setShowAddFavorita] = useState<boolean>(false)
  const [favoritaSearchTerm, setFavoritaSearchTerm] = useState<string>('')

  // Oposiciones disponibles - SINCRONIZADO CON ONBOARDING MODAL
  const oposiciones: OposicionOption[] = [
    { value: '', label: 'Ninguna seleccionada' },
    // TOP MÁS POPULARES
    {
      value: 'auxiliar_administrativo_estado',
      label: 'Auxiliar Administrativo del Estado',
      data: {
        name: 'Auxiliar Administrativo del Estado',
        slug: 'auxiliar-administrativo-estado',
        categoria: 'C2',
        administracion: 'Estado'
      }
    },
    {
      value: 'auxiliar_enfermeria',
      label: 'Auxiliar de Enfermería (TCAE)',
      data: {
        name: 'Auxiliar de Enfermería (TCAE)',
        slug: 'auxiliar-enfermeria',
        categoria: 'C2',
        administracion: 'Sanitaria'
      }
    },
    {
      value: 'auxiliar_administrativo_sermas',
      label: 'Auxiliar Administrativo SERMAS',
      data: { name: 'Auxiliar Administrativo del SERMAS (Madrid)', slug: 'auxiliar-administrativo-sermas', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'tcae_sermas_madrid',
      label: 'TCAE SERMAS Madrid',
      data: { name: 'TCAE del Servicio Madrileño de Salud', slug: 'tcae-sermas-madrid', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'auxiliar_enfermeria_osakidetza',
      label: 'TCAE Osakidetza (País Vasco)',
      data: { name: 'TCAE de Osakidetza', slug: 'auxiliar-enfermeria-osakidetza', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'tcae_aragon',
      label: 'TCAE Aragón (SALUD)',
      data: { name: 'TCAE del Servicio Aragonés de Salud', slug: 'tcae-aragon', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'auxiliar_enfermeria_gva',
      label: 'Aux Enfermería GVA',
      data: { name: 'Auxiliar de Enfermería Generalitat Valenciana', slug: 'auxiliar-enfermeria-gva', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'tcae_canarias',
      label: 'TCAE Canarias (SCS)',
      data: { name: 'TCAE del Servicio Canario de Salud', slug: 'tcae-canarias', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'celador_scs_canarias',
      label: 'Celador/a SCS (Canarias)',
      data: { name: 'Celador/a del Servicio Canario de Salud', slug: 'celador-scs-canarias', categoria: 'E', administracion: 'Sanitaria' }
    },
    {
      value: 'auxiliar_administrativo_scs_canarias',
      label: 'Aux. Admin. SCS (Canarias)',
      data: { name: 'Auxiliar Administrativo del Servicio Canario de la Salud (SCS)', slug: 'auxiliar-administrativo-scs-canarias', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'auxiliar_administrativo_ingesa',
      label: 'Aux. Admin. INGESA (Ceuta y Melilla)',
      data: { name: 'Auxiliar Administrativo del INGESA (Ceuta y Melilla)', slug: 'auxiliar-administrativo-ingesa', categoria: 'C2', administracion: 'Estatal' }
    },
    {
      value: 'tcae_galicia',
      label: 'TCAE Galicia (SERGAS)',
      data: { name: 'TCAE del SERGAS', slug: 'tcae-galicia', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'auxiliar_administrativo_sms',
      label: 'Aux. Admin. SMS (Murcia)',
      data: { name: 'Auxiliar Administrativo del Servicio Murciano de Salud (SMS)', slug: 'auxiliar-administrativo-sms', categoria: 'C2', administracion: 'Autonómica' }
    },
    {
      value: 'tcae_murcia',
      label: 'TCAE Murcia (SMS)',
      data: { name: 'TCAE del Servicio Murciano de Salud', slug: 'tcae-murcia', categoria: 'C2', administracion: 'Sanitaria' }
    },
    {
      value: 'administrativo_estado',
      label: 'Administrativo del Estado',
      data: {
        name: 'Administrativo del Estado',
        slug: 'administrativo-estado',
        categoria: 'C1',
        administracion: 'Estado'
      }
    },
    {
      value: 'administrativo_seguridad_social',
      label: 'Administrativo de la Seguridad Social',
      data: {
        name: 'Administrativo de la Administración de la Seguridad Social',
        slug: 'administrativo-seguridad-social',
        categoria: 'C1',
        administracion: 'Estado'
      }
    },
    {
      value: 'maestro_primaria',
      label: 'Maestro de Educación Primaria',
      data: {
        name: 'Maestro de Educación Primaria',
        slug: 'maestro-primaria',
        categoria: 'A2',
        administracion: 'Educación'
      }
    },
    {
      value: 'maestro_infantil',
      label: 'Maestro de Educación Infantil',
      data: {
        name: 'Maestro de Educación Infantil',
        slug: 'maestro-infantil',
        categoria: 'A2',
        administracion: 'Educación'
      }
    },
    {
      value: 'policia_nacional',
      label: 'Policía Nacional (Escala Básica)',
      data: {
        name: 'Policía Nacional (Escala Básica)',
        slug: 'policia-nacional',
        categoria: 'C1',
        administracion: 'Estado'
      }
    },
    {
      value: 'guardia_civil',
      label: 'Guardia Civil',
      data: {
        name: 'Guardia Civil',
        slug: 'guardia-civil',
        categoria: 'C1',
        administracion: 'Estado'
      }
    },
    {
      value: 'enfermero',
      label: 'Enfermero/a',
      data: {
        name: 'Enfermero/a',
        slug: 'enfermero',
        categoria: 'A2',
        administracion: 'Sanitaria'
      }
    },
    {
      value: 'tramitacion_procesal',
      label: 'Tramitación Procesal y Administrativa',
      data: {
        name: 'Tramitación Procesal y Administrativa',
        slug: 'tramitacion-procesal',
        categoria: 'C2',
        administracion: 'Justicia'
      }
    },
    {
      value: 'gestion_procesal',
      label: 'Gestión Procesal y Administrativa',
      data: {
        name: 'Gestión Procesal y Administrativa',
        slug: 'gestion-procesal',
        categoria: 'C1',
        administracion: 'Justicia'
      }
    },
    {
      value: 'auxilio_judicial',
      label: 'Auxilio Judicial',
      data: {
        name: 'Auxilio Judicial',
        slug: 'auxilio-judicial',
        categoria: 'C2',
        administracion: 'Justicia'
      }
    },
    {
      value: 'auxiliar_administrativo_diputacion_zaragoza',
      label: 'Auxiliar Administrativo Dip. Zaragoza',
      data: {
        name: 'Auxiliar Administrativo Diputación Provincial de Zaragoza',
        slug: 'auxiliar-administrativo-diputacion-zaragoza',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'auxiliar_administrativo_ayuntamiento_zaragoza',
      label: 'Auxiliar Administrativo Ayto. Zaragoza',
      data: {
        name: 'Auxiliar Administrativo Ayuntamiento de Zaragoza',
        slug: 'auxiliar-administrativo-ayuntamiento-zaragoza',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'auxiliar_administrativo_diputacion_leon',
      label: 'Auxiliar Administrativo Dip. León',
      data: {
        name: 'Auxiliar Administrativo Diputación Provincial de León',
        slug: 'auxiliar-administrativo-diputacion-leon',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'correos_personal_operativo',
      label: 'Personal Operativo de Correos',
      data: {
        name: 'Personal Operativo de Correos',
        slug: 'correos-personal-operativo',
        categoria: 'C2',
        administracion: 'Empresa Pública'
      }
    },
    {
      value: 'auxiliar_administrativo_diputacion_cadiz',
      label: 'Auxiliar Administrativo Dip. Cádiz',
      data: {
        name: 'Auxiliar Administrativo de la Diputación Provincial de Cádiz',
        slug: 'auxiliar-administrativo-diputacion-cadiz',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'auxiliar_administrativo_ayuntamiento_murcia',
      label: 'Auxiliar Administrativo Ayto. Murcia',
      data: {
        name: 'Auxiliar Administrativo Ayuntamiento de Murcia',
        slug: 'auxiliar-administrativo-ayuntamiento-murcia',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'auxiliar_administrativo_ayuntamiento_badajoz',
      label: 'Auxiliar Administrativo Ayto. Badajoz',
      data: {
        name: 'Auxiliar Administrativo Ayuntamiento de Badajoz',
        slug: 'auxiliar-administrativo-ayuntamiento-badajoz',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'auxiliar_administrativo_carm',
      label: 'Auxiliar Administrativo CARM (Murcia)',
      data: {
        name: 'Auxiliar Administrativo CARM (Murcia)',
        slug: 'auxiliar-administrativo-carm',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_cyl',
      label: 'Auxiliar Administrativo de Castilla y León',
      data: {
        name: 'Auxiliar Administrativo de Castilla y León',
        slug: 'auxiliar-administrativo-cyl',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_andalucia',
      label: 'Auxiliar Administrativo Junta de Andalucía',
      data: {
        name: 'Auxiliar Administrativo Junta de Andalucía',
        slug: 'auxiliar-administrativo-andalucia',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_madrid',
      label: 'Auxiliar Administrativo Comunidad de Madrid',
      data: {
        name: 'Auxiliar Administrativo Comunidad de Madrid',
        slug: 'auxiliar-administrativo-madrid',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_canarias',
      label: 'Auxiliar Administrativo Gobierno de Canarias',
      data: {
        name: 'Auxiliar Administrativo Gobierno de Canarias',
        slug: 'auxiliar-administrativo-canarias',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_clm',
      label: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
      data: {
        name: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
        slug: 'auxiliar-administrativo-clm',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_extremadura',
      label: 'Auxiliar Administrativo Junta de Extremadura',
      data: {
        name: 'Auxiliar Administrativo Junta de Extremadura',
        slug: 'auxiliar-administrativo-extremadura',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_valencia',
      label: 'Auxiliar Administrativo Generalitat Valenciana',
      data: {
        name: 'Auxiliar Administrativo Generalitat Valenciana',
        slug: 'auxiliar-administrativo-valencia',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'administrativo_gva',
      label: 'Administrativo Generalitat Valenciana',
      data: {
        name: 'Administrativo Generalitat Valenciana',
        slug: 'administrativo-gva',
        categoria: 'C1',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_galicia',
      label: 'Auxiliar Administrativo Xunta de Galicia',
      data: {
        name: 'Auxiliar Administrativo Xunta de Galicia',
        slug: 'auxiliar-administrativo-galicia',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'administrativo_galicia',
      label: 'Administrativo Xunta de Galicia',
      data: {
        name: 'Administrativo Xunta de Galicia',
        slug: 'administrativo-galicia',
        categoria: 'C1',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_aragon',
      label: 'Auxiliar Administrativo de Aragón',
      data: {
        name: 'Auxiliar Administrativo de Aragón',
        slug: 'auxiliar-administrativo-aragon',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_asturias',
      label: 'Auxiliar Administrativo del Principado de Asturias',
      data: {
        name: 'Auxiliar Administrativo del Principado de Asturias',
        slug: 'auxiliar-administrativo-asturias',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_baleares',
      label: 'Auxiliar Administrativo de la CAIB (C2)',
      data: {
        name: 'Auxiliar Administrativo de la CAIB',
        slug: 'auxiliar-administrativo-baleares',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_ayuntamiento_valencia',
      label: 'Auxiliar Administrativo Ayuntamiento de Valencia (C2)',
      data: {
        name: 'Auxiliar Administrativo del Ayuntamiento de Valencia',
        slug: 'auxiliar-administrativo-ayuntamiento-valencia',
        categoria: 'C2',
        administracion: 'Local'
      }
    },
    {
      value: 'auxiliar_administrativo_cantabria',
      label: 'Auxiliar Administrativo Gobierno de Cantabria (C2)',
      data: {
        name: 'Auxiliar Administrativo Gobierno de Cantabria',
        slug: 'auxiliar-administrativo-cantabria',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'administrativo_navarra',
      label: 'Administrativo del Gobierno de Navarra (C1)',
      data: {
        name: 'Administrativo del Gobierno de Navarra',
        slug: 'administrativo-navarra',
        categoria: 'C1',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_la_rioja',
      label: 'Auxiliar Administrativo Gobierno de La Rioja (C2)',
      data: {
        name: 'Auxiliar Administrativo Gobierno de La Rioja',
        slug: 'auxiliar-administrativo-la-rioja',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_catalunya',
      label: 'Auxiliar Administrativo Generalitat de Catalunya (C2)',
      data: {
        name: 'Auxiliar Administrativo Generalitat de Catalunya',
        slug: 'auxiliar-administrativo-catalunya',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    },
    {
      value: 'auxiliar_administrativo_pais_vasco',
      label: 'Auxiliar Administrativo Gobierno Vasco (C2)',
      data: {
        name: 'Auxiliar Administrativo Gobierno Vasco',
        slug: 'auxiliar-administrativo-pais-vasco',
        categoria: 'C2',
        administracion: 'Autonómica'
      }
    }
  ]

  // Filtrar oposiciones por búsqueda
  const filteredOposiciones = useMemo(() => {
    const term = oposicionSearchTerm.toLowerCase().trim()
    if (!term) return oposiciones.filter(op => op.value) // Excluir la opción vacía

    return oposiciones.filter(op => {
      if (!op.value) return false // Excluir la opción vacía
      return op.label.toLowerCase().includes(term) ||
             (op.data?.categoria && op.data.categoria.toLowerCase().includes(term)) ||
             (op.data?.administracion && op.data.administracion.toLowerCase().includes(term))
    })
  }, [oposicionSearchTerm])

  // 🆕 DETECTAR TAB DESDE URL
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'emails') {
      setActiveTab('emails')

      // Si viene desde email, mostrar mensaje específico
      const utm_source = searchParams.get('utm_source')
      if (utm_source === 'email_unsubscribe') {
        setMessage('📧 Aquí puedes gestionar tus preferencias de email')
        setTimeout(() => setMessage(''), 5000)
      }
    } else if (tab === 'suscripcion') {
      setActiveTab('suscripcion')
    } else if (tab === 'notificaciones') {
      // Tab notificaciones eliminado 2026-05-03 (sistema push retirado).
      // Redirigir a 'emails' para preservar UX si llegan links viejos.
      setActiveTab('emails')
    }
  }, [searchParams])

  // 🗑️ VERIFICAR SI YA HAY SOLICITUD DE ELIMINACIÓN PENDIENTE
  useEffect(() => {
    async function checkPendingDeletion() {
      if (!user) return
      const { count } = await supabase
        .from('user_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'account_deletion')
        .eq('status', 'pending')
      if (count && count > 0) {
        setDeletionRequested(true)
      }
    }
    checkPendingDeletion()
  }, [user])

  // 🆕 CARGAR EMAIL PREFERENCES - VIA API TIPADA
  useEffect(() => {
    async function loadEmailPreferences() {
      if (!user) return

      try {
        setEmailPrefLoading(true)

        const response = await fetch(`/api/profile/email-preferences?userId=${user.id}`)
        const result = await response.json()

        if (!result.success || !result.data) {
          // Valores por defecto si no existe
          setEmailPreferences({
            receive_emails: true,
            support_emails: true,
            newsletter_emails: true,
            unsubscribed_all: false,
            email_reactivacion: true,
            email_urgente: true,
            email_bienvenida_motivacional: true,
            email_bienvenida_inmediato: true,
            email_resumen_semanal: true,
            email_soporte_disabled: false,
            email_newsletter_disabled: false,
          })
        } else {
          const prefs = result.data
          setEmailPreferences({
            receive_emails: !prefs.unsubscribedAll,
            support_emails: !prefs.emailSoporteDisabled,
            newsletter_emails: !prefs.emailNewsletterDisabled,
            unsubscribed_all: prefs.unsubscribedAll ?? false,
            email_reactivacion: prefs.emailReactivacion ?? true,
            email_urgente: prefs.emailUrgente ?? true,
            email_bienvenida_motivacional: prefs.emailBienvenidaMotivacional ?? true,
            email_bienvenida_inmediato: prefs.emailBienvenidaInmediato ?? true,
            email_resumen_semanal: prefs.emailResumenSemanal ?? true,
            email_soporte_disabled: prefs.emailSoporteDisabled ?? false,
            email_newsletter_disabled: prefs.emailNewsletterDisabled ?? false,
          })
        }
      } catch (error) {
        console.error('Error general cargando email preferences:', error)
        setEmailPreferences({
          receive_emails: true, support_emails: true, newsletter_emails: true,
          unsubscribed_all: false, email_reactivacion: true, email_urgente: true,
          email_bienvenida_motivacional: true, email_bienvenida_inmediato: true,
          email_resumen_semanal: true, email_soporte_disabled: false, email_newsletter_disabled: false,
        })
      } finally {
        setEmailPrefLoading(false)
      }
    }

    loadEmailPreferences()
  }, [user])

  // 🆕 CARGAR DATOS DE SUSCRIPCIÓN
  const reloadSubscription = async () => {
    if (!user) return
    try {
      setSubscriptionLoading(true)
      const response = await fetch(`/api/stripe/subscription?userId=${user.id}`)
      const data = await response.json()
      if (response.ok) {
        setSubscriptionData(data)
      } else {
        console.error('Error loading subscription:', data.error)
        setSubscriptionData({ hasSubscription: false })
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
      setSubscriptionData({ hasSubscription: false })
    } finally {
      setSubscriptionLoading(false)
    }
  }

  useEffect(() => {
    reloadSubscription()
  }, [user])

  // CARGAR PERFIL VIA API TIPADA
  useEffect(() => {
    async function loadUserProfile() {
      if (authLoading) return

      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Cargar datos del avatar desde user_metadata
        const avatarData = extractAvatarData(user.user_metadata)
        setCurrentAvatar(avatarData)

        // Cargar perfil del usuario via API
        const response = await fetch(`/api/profile?userId=${user.id}`)
        const result = await response.json()

        if (!result.success || !result.data) {
          // Crear perfil si no existe
          await createInitialProfile(user)
        } else {
          // Mapear datos de API (camelCase) a formato local (snake_case)
          const apiProfile = result.data
          const profileData = {
            id: apiProfile.id,
            email: apiProfile.email,
            full_name: apiProfile.fullName,
            avatar_url: apiProfile.avatarUrl,
            preferred_language: apiProfile.preferredLanguage,
            study_goal: apiProfile.studyGoal,
            show_daily_goal_banner: apiProfile.showDailyGoalBanner,
            target_oposicion: apiProfile.targetOposicion,
            target_oposicion_data: apiProfile.targetOposicionData,
            nickname: apiProfile.nickname,
            age: apiProfile.age,
            gender: apiProfile.gender,
            ciudad: apiProfile.ciudad,
            daily_study_hours: apiProfile.dailyStudyHours,
            plan_type: apiProfile.planType,
            created_at: apiProfile.createdAt,
            updated_at: apiProfile.updatedAt,
            is_active_student: apiProfile.isActiveStudent,
            stripe_customer_id: apiProfile.stripeCustomerId
          }
          setProfile(profileData)

          // ✅ Usar target_oposicion del perfil cargado
          let currentOposicion = profileData.target_oposicion || ''
          if (currentOposicion === 'auxiliar-administrativo-estado') {
            currentOposicion = 'auxiliar_administrativo_estado' // Migrar al nuevo formato
          }

          // Limpiar datos sucios (UUIDs, JSON, slugs desconocidos)
          if (currentOposicion && !ALL_OPOSICION_IDS.includes(currentOposicion)) {
            console.warn('⚠️ [Perfil] target_oposicion inválido:', currentOposicion)
            currentOposicion = ''
          }

          setFormData({
            nickname: profileData.nickname || getFirstName(user.user_metadata?.full_name),
            study_goal: String(profileData.study_goal || 25),
            target_oposicion: currentOposicion,
            // Campos del onboarding
            age: profileData.age?.toString() || '',
            gender: profileData.gender || '',
            ciudad: profileData.ciudad || '',
            daily_study_hours: profileData.daily_study_hours?.toString() || ''
          })
        }

      } catch (error) {
        console.error('Error general:', error)
      } finally {
        setLoading(false)
        // Marcar que la carga inicial ha terminado
        setTimeout(() => {
          isInitialLoad.current = false
        }, 1000)
      }
    }

    loadUserProfile()
  }, [user, authLoading])

  // 🤖 CARGAR CONFIGURACIÓN DE AVATAR AUTOMÁTICO
  useEffect(() => {
    async function loadAvatarSettings() {
      if (!user) {
        setAvatarModeLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/profile/avatar-settings?userId=${user.id}`)
        const data = await response.json()

        if (data.success && data.data) {
          setAvatarMode(data.data.mode || 'manual')
          if (data.data.mode === 'automatic' && data.data.currentProfile) {
            // Obtener descripción del perfil
            const profileDescription = data.profile?.descriptionEs || data.allProfiles?.find(
              (p: { id: string; descriptionEs: string }) => p.id === data.data.currentProfile
            )?.descriptionEs || 'Según tu actividad'

            // Obtener color del perfil
            const profileColor = data.profile?.color || data.allProfiles?.find(
              (p: { id: string; color: string }) => p.id === data.data.currentProfile
            )?.color || '#8b5cf6'

            setAutoProfile({
              id: data.data.currentProfile,
              emoji: data.data.currentEmoji,
              name: data.data.currentName,
              description: profileDescription,
              color: profileColor
            })

            // Calcular badges en tiempo real
            try {
              const calcResponse = await fetch('/api/profile/avatar-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'calculate', userId: user.id })
              })
              const calcData = await calcResponse.json()

              if (calcData.success && calcData.matchedConditions && data.allProfiles) {
                const badges: MatchedBadge[] = calcData.matchedConditions.map((condition: string) => {
                  const [profileId, ...conditionParts] = condition.split(': ')
                  const profile = data.allProfiles.find((p: { id: string }) => p.id === profileId)
                  return {
                    id: profileId,
                    emoji: profile?.emoji || '🏆',
                    name: profile?.nameEs || profileId,
                    condition: conditionParts.join(': ')
                  }
                }).filter((b: MatchedBadge) => b.id !== data.data.currentProfile)

                setMatchedBadges(badges)
              }
            } catch (calcError) {
              console.error('Error calculando badges:', calcError)
            }
          }
        }
      } catch (error) {
        console.error('Error cargando avatar settings:', error)
      } finally {
        setAvatarModeLoading(false)
      }
    }

    loadAvatarSettings()
  }, [user])

  // Toggle de la barra de meta diaria en la cabecera. Es el ÚNICO sitio donde se
  // puede re-activar tras ocultarla con la X (preferencia de cuenta). PUT inmediato
  // + dispatch 'profileUpdated' para que la cabecera reaccione al instante.
  const handleToggleDailyGoalBanner = async () => {
    if (!user || bannerToggleSaving) return
    const next = nextBannerVisible(effectiveBannerVisible(profile?.show_daily_goal_banner))
    setBannerToggleSaving(true)
    setProfile(prev => prev ? { ...prev, show_daily_goal_banner: next } : prev) // optimista
    emitClientEvent({ severity: 'info', eventType: 'daily_goal_banner_action', metadata: { action: next ? 'show' : 'hide', source: 'perfil' } })
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, data: { showDailyGoalBanner: next } }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || `HTTP ${response.status}`)
      window.dispatchEvent(new CustomEvent('profileUpdated'))
      setMessage(next ? '✅ Barra de meta diaria activada' : '✅ Barra de meta diaria ocultada')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setProfile(prev => prev ? { ...prev, show_daily_goal_banner: !next } : prev) // revertir
      const message = err instanceof Error ? err.message : 'unknown'
      emitClientEvent({
        severity: 'warn',
        eventType: 'daily_goal_banner_action',
        errorMessage: `perfil toggle PUT failed: ${message}`,
        metadata: { action: 'toggle_failed', source: 'perfil', intended: next ? 'show' : 'hide' },
      })
      setMessage('❌ No se pudo guardar la preferencia')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setBannerToggleSaving(false)
    }
  }

  // 🤖 CAMBIAR MODO DE AVATAR (manual/automático)
  const handleAvatarModeToggle = async () => {
    if (!user || avatarModeSaving) return

    setAvatarModeSaving(true)
    const newMode = avatarMode === 'manual' ? 'automatic' : 'manual'

    try {
      const response = await fetch('/api/profile/avatar-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          data: { mode: newMode }
        })
      })

      const data = await response.json()

      if (data.success) {
        setAvatarMode(newMode)

        if (newMode === 'automatic' && data.profile) {
          setAutoProfile({
            id: data.profile.id,
            emoji: data.profile.emoji,
            name: data.profile.nameEs,
            description: data.profile.descriptionEs || 'Según tu actividad',
            color: data.profile.color || '#8b5cf6'
          })
          // Actualizar avatar mostrado
          setCurrentAvatar({
            type: 'predefined',
            emoji: data.profile.emoji,
            name: data.profile.nameEs,
            color: data.profile.color
          })

          // Parsear badges conseguidos (matchedConditions: ["profile_id: condición", ...])
          if (data.matchedConditions && Array.isArray(data.matchedConditions)) {
            // Obtener perfiles disponibles para lookup
            const profilesResponse = await fetch(`/api/profile/avatar-settings?userId=${user.id}`)
            const profilesData = await profilesResponse.json()
            const allProfiles = profilesData.allProfiles || []

            const badges: MatchedBadge[] = data.matchedConditions.map((condition: string) => {
              const [profileId, ...conditionParts] = condition.split(': ')
              const profile = allProfiles.find((p: { id: string }) => p.id === profileId)
              return {
                id: profileId,
                emoji: profile?.emoji || '🏆',
                name: profile?.nameEs || profileId,
                condition: conditionParts.join(': ')
              }
            }).filter((b: MatchedBadge) => b.id !== data.profile.id) // Excluir el principal

            setMatchedBadges(badges)
          }
        } else {
          setMatchedBadges([])
        }
      }
    } catch (error) {
      console.error('Error cambiando modo avatar:', error)
    } finally {
      setAvatarModeSaving(false)
    }
  }

  // DETECCIÓN DE CAMBIOS - Sin guardado automático
  useEffect(() => {
    // No detectar cambios si no hay perfil cargado
    if (!user || !profile) return

    // Si es la carga inicial, esperar un poco antes de detectar cambios
    if (isInitialLoad.current) {
      setHasChanges(false)
      return
    }

    // Verificar si hay cambios REALES
    const currentNickname = profile.nickname || ''
    const currentStudyGoal = profile.study_goal || 25
    const currentOposicion = profile.target_oposicion || ''
    const currentAge = profile.age?.toString() || ''
    const currentGender = profile.gender || ''
    const currentCiudad = profile.ciudad || ''
    const currentDailyHours = profile.daily_study_hours?.toString() || ''

    const hasRealChanges =
      formData.nickname.trim() !== currentNickname ||
      parseInt(formData.study_goal) !== currentStudyGoal ||
      formData.target_oposicion !== currentOposicion ||
      formData.age !== currentAge ||
      formData.gender !== currentGender ||
      formData.ciudad.trim() !== currentCiudad ||
      formData.daily_study_hours !== currentDailyHours

    setHasChanges(hasRealChanges)
  }, [formData, user, profile, isInitialLoad.current]) // Escuchar todo formData y isInitialLoad

  // 🆕 GUARDAR EMAIL PREFERENCES - VIA API TIPADA
  const saveEmailPreferences = async (newPreferences: EmailPreferences) => {
    if (!user || emailPrefSaving) return

    try {
      setEmailPrefSaving(true)

      const response = await fetch('/api/profile/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          data: {
            unsubscribedAll: newPreferences.unsubscribed_all,
            emailReactivacion: newPreferences.email_reactivacion,
            emailUrgente: newPreferences.email_urgente,
            emailBienvenidaMotivacional: newPreferences.email_bienvenida_motivacional,
            emailBienvenidaInmediato: newPreferences.email_bienvenida_inmediato,
            emailResumenSemanal: newPreferences.email_resumen_semanal,
            emailSoporteDisabled: newPreferences.email_soporte_disabled,
            emailNewsletterDisabled: newPreferences.email_newsletter_disabled,
          }
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar preferencias')
      }

      setEmailPreferences(newPreferences)
      setMessage(`✅ Preferencias de email actualizadas`)
      setTimeout(() => setMessage(''), 3000)

    } catch (error) {
      console.error('Error guardando preferencias de email:', error)
      setMessage('❌ Error al guardar las preferencias')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setEmailPrefSaving(false)
    }
  }

  // 🆕 MANEJAR CAMBIOS EN EMAIL PREFERENCES - CON LÓGICA AUTOMÁTICA
  // Si se desactiva "Emails de Vence", desactivar todas las sub-opciones
  // Sobrecarga: puede recibir (value) para toggle principal o (field, value) para campos individuales
  const handleEmailPrefChange = (field: string, value: boolean) => {
    const newPreferences = { ...emailPreferences, [field]: value }

    // Sincronizar campos legacy con los reales
    if (field === 'unsubscribed_all') {
      newPreferences.receive_emails = !value
    }
    if (field === 'email_soporte_disabled') {
      newPreferences.support_emails = !value
    }
    if (field === 'email_newsletter_disabled') {
      newPreferences.newsletter_emails = !value
    }

    saveEmailPreferences(newPreferences)
  }
  // Función para extraer el primer nombre
  const getFirstName = (fullName: string | null | undefined) => {
    if (!fullName) return ''
    return fullName.split(' ')[0] || ''
  }

  // 🗑️ SOLICITAR ELIMINACIÓN DE CUENTA
  //
  // Flujo robusto contra doble-click, network hangs y pérdida de feedback
  // visual. Motivado por los casos Cristina (10-abr-2026) y Ana María
  // (07-feb-2026) — ambas clicaron "Confirmar eliminación" dos veces porque
  // el botón no parecía reaccionar. Ver docs/maintenance/eliminacion-cuentas.md.
  const requestAccountDeletion = async () => {
    // Lock SÍNCRONO via ref: no depende de que React re-renderice el
    // state deletingAccount. Previene el caso de doble-click rápido.
    if (deletingAccountRef.current) return
    if (!user) return
    if (deleteConfirmText !== 'ELIMINAR') {
      setDeleteError('Escribe ELIMINAR para confirmar')
      return
    }

    deletingAccountRef.current = true
    setDeletingAccount(true)
    setDeleteError('')

    // Timeout de seguridad: si la operación se cuelga más de 15s,
    // desbloqueamos el botón con mensaje para que la usuaria pueda
    // reintentar en vez de quedarse mirando "Enviando..." para siempre.
    const timeoutId = setTimeout(() => {
      if (deletingAccountRef.current) {
        setDeleteError('La operación está tardando más de lo normal. Comprueba tu conexión y vuelve a intentarlo.')
        setDeletingAccount(false)
        deletingAccountRef.current = false
      }
    }, 15000)

    try {
      // Verificar si ya existe una solicitud pendiente (evita duplicados)
      const { count } = await supabase
        .from('user_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'account_deletion')
        .eq('status', 'pending')

      if (count && count > 0) {
        // Ya había una solicitud pendiente: mostrar éxito igualmente
        // (la intención de la usuaria se cumplió). El usuario cierra el
        // modal manualmente con el botón "Entendido".
        setDeletionSuccess(true)
        setDeletionRequested(true)
        return
      }

      // Crear feedback automático con la solicitud
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user.id,
          message: '[Solicitud de eliminación de cuenta desde perfil]',
          type: 'account_deletion',
          status: 'pending',
          url: '/perfil'
        })

      if (error) throw error

      // ÉXITO: mostrar confirmación INLINE en el modal. El usuario cierra
      // manualmente con el botón "Entendido" (caso Helga 11-abr-2026:
      // auto-close de 2.5s no daba tiempo a leer y dejaba al usuario clicando
      // botones al azar por no encontrar feedback persistente).
      setDeletionSuccess(true)
      setDeletionRequested(true)

    } catch (error) {
      console.error('Error solicitando eliminación:', error)
      setDeleteError('Error al enviar la solicitud. Inténtalo de nuevo.')
    } finally {
      clearTimeout(timeoutId)
      deletingAccountRef.current = false
      setDeletingAccount(false)
    }
  }

  // GUARDAR PERFIL VIA API TIPADA
  // ── Fase 8: oposiciones seguidas (target + favoritas) ──
  const loadSeguidas = useCallback(async () => {
    if (!user) return
    try {
      // getAuthHeaders refresca sesión y puede colgarse → race con timeout para
      // que el fetch SIEMPRE se dispare y "Cargando…" nunca se quede fijo.
      const headers = await Promise.race<HeadersInit>([
        getAuthHeaders(),
        new Promise<HeadersInit>((r) => setTimeout(() => r({}), 4000)),
      ]).catch(() => ({} as HeadersInit))
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 8000)
      const res = await fetch('/api/profile/seguidas', { headers, signal: ac.signal })
      clearTimeout(t)
      const json = await res.json()
      if (json?.success) setSeguidas(json.data as SeguidaItem[])
    } catch {
      // silencioso: la sección es secundaria
    } finally {
      setSeguidasLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) loadSeguidas()
  }, [user, loadSeguidas])

  // Recargar cuando cambie el target (el trigger de BD reordena target/favorita)
  useEffect(() => {
    const handler = () => loadSeguidas()
    window.addEventListener('oposicionAssigned', handler)
    return () => window.removeEventListener('oposicionAssigned', handler)
  }, [loadSeguidas])

  const addFavorita = async (slug: string) => {
    if (!user || !slug || seguidasBusy) return
    setSeguidasBusy(true)
    try {
      const res = await fetch('/api/profile/seguidas', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ oposicionSlug: slug })
      })
      const json = await res.json()
      if (json?.success) {
        setSeguidas(json.data as SeguidaItem[])
        setShowAddFavorita(false)
        setFavoritaSearchTerm('')
        setMessage('✅ Añadida a favoritas')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(`❌ ${json?.error || 'No se pudo añadir'}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {
      setMessage('❌ Error al añadir favorita')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSeguidasBusy(false)
    }
  }

  const removeFavorita = async (oposicionId: string) => {
    if (!user || seguidasBusy) return
    setSeguidasBusy(true)
    try {
      const res = await fetch('/api/profile/seguidas', {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ oposicionId })
      })
      const json = await res.json()
      if (json?.success) setSeguidas(json.data as SeguidaItem[])
    } catch {
      // silencioso
    } finally {
      setSeguidasBusy(false)
    }
  }

  // Promover una favorita a objetivo = cambiar el target (el trigger degrada el anterior)
  const promoteToTarget = async (slug: string | null) => {
    if (!user || !slug || seguidasBusy) return
    const op = oposiciones.find(o => o.data?.slug === slug)
    if (!op) return
    setSeguidasBusy(true)
    try {
      handleDirectChange('target_oposicion', op.value)
      await setTargetOposicion(op.value)
      setProfile(prev => prev ? { ...prev, target_oposicion: op.value, target_oposicion_data: op.data || null } : prev)
      window.dispatchEvent(new CustomEvent('oposicionAssigned', { detail: { oposicionId: op.value } }))
      await loadSeguidas()
      setMessage('✅ Oposición objetivo actualizada')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('❌ Error al cambiar objetivo')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSeguidasBusy(false)
    }
  }

  const saveProfile = async () => {
    if (!user || saving || !hasChanges) return

    try {
      setSaving(true)

      // Preparar datos de la oposición
      let oposicionData = null
      if (formData.target_oposicion) {
        const selectedOposicion = oposiciones.find(op => op.value === formData.target_oposicion)
        if (selectedOposicion && selectedOposicion.data) {
          oposicionData = selectedOposicion.data
        }
      }

      // Validar meta diaria
      const studyGoalNum = parseInt(formData.study_goal)
      if (isNaN(studyGoalNum) || studyGoalNum < 1) {
        throw new Error('La meta diaria debe ser al menos 1 pregunta')
      }

      // Datos en formato camelCase para la API
      const apiData = {
        nickname: formData.nickname.trim(),
        studyGoal: studyGoalNum,
        targetOposicion: formData.target_oposicion,
        targetOposicionData: oposicionData,
        // Campos del onboarding
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        ciudad: formData.ciudad.trim() || null,
        dailyStudyHours: formData.daily_study_hours ? parseInt(formData.daily_study_hours) : null
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          data: apiData
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar perfil')
      }

      // Actualizar el perfil local (convertir a snake_case)
      const updateData: Partial<UserProfile> = {
        nickname: formData.nickname.trim(),
        study_goal: parseInt(formData.study_goal),
        target_oposicion: formData.target_oposicion,
        target_oposicion_data: oposicionData || null,
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender || undefined,
        ciudad: formData.ciudad.trim() || undefined,
        daily_study_hours: formData.daily_study_hours ? parseInt(formData.daily_study_hours) : undefined,
        updated_at: new Date().toISOString()
      }

      setProfile(prev => prev ? { ...prev, ...updateData } : null)

      // Limpiar estado de cambios
      setHasChanges(false)

      // Notificar a otros componentes del cambio de oposición
      window.dispatchEvent(new CustomEvent('oposicionAssigned'))

      // También notificar al AuthContext para que recargue el perfil
      window.dispatchEvent(new CustomEvent('profileUpdated'))

      // Mostrar mensaje de éxito
      setMessage('✅ Perfil guardado correctamente')
      setTimeout(() => setMessage(''), 3000)

    } catch (error) {
      console.error('Error guardando perfil:', error)
      setMessage('❌ Error al guardar el perfil')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  // Extraer datos del avatar del user_metadata
  const extractAvatarData = (metadata: Record<string, unknown> | undefined): AvatarData => {
    if (!metadata) return { type: 'default' as const }

    // Avatar personalizado (imagen subida)
    if (metadata.avatar_type === 'custom' && metadata.avatar_url) {
      return {
        type: 'custom' as const,
        url: metadata.avatar_url as string
      }
    }

    // Avatar predefinido (emoji)
    if (metadata.avatar_type === 'predefined' && metadata.avatar_emoji) {
      return {
        type: 'predefined' as const,
        emoji: metadata.avatar_emoji as string,
        color: metadata.avatar_color as string,
        name: metadata.avatar_name as string
      }
    }

    return { type: 'default' as const }
  }

  // Callback cuando cambia el avatar
  const handleAvatarChange = (newAvatarData: AvatarData) => {
    setCurrentAvatar(newAvatarData)
    setMessage('✅ Avatar actualizado')
    setTimeout(() => setMessage(''), 2000)
  }

  const createInitialProfile = async (user: User) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          nickname: getFirstName(user.user_metadata?.full_name),
          preferred_language: 'es',
          study_goal: 25,
          target_oposicion: '',
          target_oposicion_data: null
        })
        .select()
        .single()

      if (error) throw error
      
      setProfile(data)
      setFormData({
        nickname: data.nickname || getFirstName(user.user_metadata?.full_name),
        study_goal: String(data.study_goal || 25),
        target_oposicion: data.target_oposicion || '',
        age: data.age?.toString() || '',
        gender: data.gender || '',
        ciudad: data.ciudad || '',
        daily_study_hours: data.daily_study_hours?.toString() || ''
      })
    } catch (error) {
      console.error('Error creando perfil:', error)
    }
  }

  // MANEJADOR DE CAMBIOS - Solo actualiza estado local
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Función auxiliar para cambios directos (no desde eventos)
  const handleDirectChange = (name: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Obtener nombre de la oposición seleccionada
  const getSelectedOposicionName = () => {
    if (!formData.target_oposicion) return null
    
    const selected = oposiciones.find(op => op.value === formData.target_oposicion)
    if (selected) return selected.label
    
    // Fallback: usar datos del contexto
    if (userOposicionName) return userOposicionName

    return null
  }

  // 🆕 REACTIVAR SUSCRIPCIÓN
  const handleReactivate = async () => {
    if (!user) return
    try {
      setReactivateLoading(true)
      const response = await fetch('/api/stripe/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setShowReactivatedBanner(true)
        setTimeout(() => setShowReactivatedBanner(false), 8000)
        await reloadSubscription()
      } else {
        setMessage('Error al reactivar: ' + (data.error || 'Intenta de nuevo'))
        setTimeout(() => setMessage(''), 5000)
      }
    } catch {
      setMessage('Error de conexión. Intenta de nuevo.')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setReactivateLoading(false)
    }
  }

  // 🆕 ABRIR PORTAL DE STRIPE
  const openStripePortal = async () => {
    if (!user) return

    try {
      setPortalLoading(true)

      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })

      const data = await response.json()

      if (response.ok && data.url) {
        window.location.href = data.url
      } else {
        setMessage('❌ Error al abrir el portal de gestión')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error opening portal:', error)
      setMessage('❌ Error al abrir el portal de gestión')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setPortalLoading(false)
    }
  }

  // 🆕 COMPONENTE SUSCRIPCIÓN
  const SubscriptionTab = () => {
    if (subscriptionLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando suscripción...</span>
        </div>
      )
    }

    const formatDate = (dateInput: string | number | undefined) => {
      if (!dateInput) return 'N/A'
      return new Date(dateInput).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    const getStatusBadge = (status: string) => {
      const badges: Record<string, { bg: string; text: string; label: string }> = {
        active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Activa' },
        trialing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Periodo de prueba' },
        canceled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelada' },
        past_due: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pago pendiente' },
        unpaid: { bg: 'bg-red-100', text: 'text-red-800', label: 'Impagada' }
      }
      return badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status }
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            💳 Mi Suscripción
          </h3>
        </div>

        {subscriptionData?.hasSubscription && subscriptionData?.subscription ? (
          <div className="space-y-6">
            {/* Estado de la suscripción */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">👑</span>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 dark:text-white">Premium</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(subscriptionData.subscription.status).bg} ${getStatusBadge(subscriptionData.subscription.status).text}`}>
                      {getStatusBadge(subscriptionData.subscription.status).label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">
                    {subscriptionData.subscription.planAmount}€
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    / {subscriptionData.subscription.planIntervalCount === 1 ? '' : subscriptionData.subscription.planIntervalCount + ' '}
                    {subscriptionData.subscription.planInterval === 'month' ? 'mes' :
                     subscriptionData.subscription.planInterval === 'year' ? 'año' :
                     subscriptionData.subscription.planInterval}
                    {(subscriptionData.subscription.planIntervalCount ?? 1) > 1 ? 'es' : ''}
                  </div>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Inicio del periodo</div>
                  <div className="font-semibold text-gray-800 dark:text-white">
                    {formatDate(subscriptionData.subscription.currentPeriodStart)}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {subscriptionData.subscription.cancelAtPeriodEnd ? 'Finaliza el' : 'Próxima renovación'}
                  </div>
                  <div className="font-semibold text-gray-800 dark:text-white">
                    {formatDate(subscriptionData.subscription.currentPeriodEnd)}
                  </div>
                  {!subscriptionData.subscription.cancelAtPeriodEnd && subscriptionData.subscription.planAmount && (() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const loyalty = (subscriptionData.subscription as any)?.loyaltyDiscount
                    const amount = subscriptionData.subscription.planAmount!
                    if (loyalty?.percentOff) {
                      const discounted = (amount * (100 - loyalty.percentOff) / 100).toFixed(0)
                      return (
                        <div className="text-sm mt-1">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{discounted}€</span>
                          <span className="text-gray-400 line-through text-xs ml-1">{amount}€</span>
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs ml-1">(-{loyalty.percentOff}% fidelidad)</span>
                        </div>
                      )
                    }
                    return <div className="text-sm text-gray-500 mt-1">{amount}€</div>
                  })()}
                </div>
              </div>

              {/* Banner de descuento de fidelidad */}
              {!subscriptionData.subscription.cancelAtPeriodEnd && (
                <div className="mt-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-600">🎁</span>
                    <span className="text-emerald-800 dark:text-emerald-200 font-medium">
                      Tu precio de fidelidad
                    </span>
                  </div>
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const loyalty = (subscriptionData.subscription as any).loyaltyDiscount
                    const amount = subscriptionData.subscription.planAmount || 20
                    const intervalCount = subscriptionData.subscription.planIntervalCount || 1
                    const renewalDate = subscriptionData.subscription.currentPeriodEnd
                      ? new Date(subscriptionData.subscription.currentPeriodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                      : null

                    if (loyalty) {
                      const discountedPrice = +(amount * (1 - loyalty.percentOff / 100)).toFixed(2)
                      const monthlyPrice = +(discountedPrice / intervalCount).toFixed(2)
                      const monthlyFull = +(amount / intervalCount).toFixed(2)

                      return (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{discountedPrice}€</span>
                            <span className="text-sm line-through text-gray-400">{amount}€</span>
                            <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-medium">-{loyalty.percentOff}%</span>
                          </div>
                          {intervalCount > 1 && (
                            <p className="text-emerald-700 dark:text-emerald-300 text-sm">
                              Equivale a <strong>{monthlyPrice}€/mes</strong> <span className="text-gray-400 line-through text-xs">{monthlyFull}€/mes</span>
                            </p>
                          )}
                          {renewalDate && (
                            <p className="text-emerald-600 dark:text-emerald-400 text-xs">
                              Precio garantizado en tu renovación del {renewalDate}
                            </p>
                          )}
                          <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                            Este descuento es exclusivo para suscriptores activos. Si cancelas, se pierde y no se recupera.
                          </p>
                        </div>
                      )
                    }
                    return (
                      <p className="text-emerald-700 dark:text-emerald-300 text-sm mt-1">
                        A partir de tu próxima renovación{renewalDate ? ` (${renewalDate})` : ''} disfrutarás de un <strong>10% de descuento</strong> por mantenerte como suscriptor activo.
                      </p>
                    )
                  })()}
                </div>
              )}

              {/* Banner de reactivación exitosa */}
              {showReactivatedBanner && (
                <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600">✓</span>
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      Tu suscripción ha sido reactivada. Se renovará automáticamente el {formatDate(subscriptionData.subscription.currentPeriodEnd)}.
                    </span>
                  </div>
                </div>
              )}

              {/* Aviso de cancelación pendiente + botón reactivar */}
              {subscriptionData.subscription.cancelAtPeriodEnd && (
                <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-yellow-600">⚠️</span>
                    <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                      Tu suscripción se cancelará el {formatDate(subscriptionData.subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                    Seguirás teniendo acceso Premium hasta esa fecha. Si cambias de opinión, puedes reactivarla.
                  </p>
                  <button
                    onClick={handleReactivate}
                    disabled={reactivateLoading}
                    className="mt-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center space-x-2"
                  >
                    {reactivateLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Reactivando...</span>
                      </>
                    ) : (
                      <span>Reactivar suscripción</span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Botones de gestión */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={openStripePortal}
                disabled={portalLoading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {portalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Abriendo portal...</span>
                  </>
                ) : (
                  <>
                    <span>💳</span>
                    <span>Método de pago y facturas</span>
                  </>
                )}
              </button>
              {!subscriptionData.subscription.cancelAtPeriodEnd && (
                <button
                  onClick={() => setShowCancellationFlow(true)}
                  className="flex-1 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 py-3 px-6 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center space-x-2"
                >
                  <span>Cancelar suscripción</span>
                </button>
              )}
            </div>

            {/* Timeline / Historial */}
            {(subscriptionData as any)?.timeline && (subscriptionData as any).timeline.length > 1 && (() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const loyalty = (subscriptionData.subscription as any)?.loyaltyDiscount
              const amount = subscriptionData.subscription.planAmount || 0
              const discountedAmount = loyalty?.percentOff ? (amount * (100 - loyalty.percentOff) / 100).toFixed(0) : null

              const formatShortDate = (isoDate: string) => {
                try {
                  const d = new Date(isoDate)
                  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                } catch { return isoDate }
              }

              const icons: Record<string, string> = { activated: '🟢', cancelled: '🔴', reactivated: '🟢', renewal: '📅', refunded: '💸', compensation: '🎁' }
              const labels: Record<string, string> = { activated: 'Suscripción activada', cancelled: 'Cancelación solicitada', reactivated: 'Suscripción reactivada', renewal: 'Próxima renovación', refunded: 'Reembolso procesado', compensation: 'Compensación aplicada' }

              // Formatea el detalle de un adjustment event:
              //   - compensation + eur → "5€ crédito"
              //   - refunded + eur     → "5€" (sin la palabra "crédito" — es un reembolso real)
              //   - cualquier + days   → "+7 días"
              //   - cualquier + percent→ "20% dto"
              const formatAdjustmentAmount = (e: { type: string; amountValue?: number; amountUnit?: string; reasonDetail?: string | null }): string => {
                if (!e.amountValue || !e.amountUnit) return ''
                const v = e.amountValue
                const unit = e.amountUnit
                const isRefund = e.type === 'refunded'
                const amountStr = unit === 'days' ? `+${v} ${v === 1 ? 'día' : 'días'}`
                  : unit === 'eur' ? (isRefund ? `${v}€` : `${v}€ crédito`)
                  : unit === 'percent' ? `${v}% dto`
                  : `${v} ${unit}`
                return e.reasonDetail ? `${amountStr} — ${e.reasonDetail}` : amountStr
              }

              return (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                  <h5 className="font-medium text-gray-800 dark:text-white mb-3 text-sm">Historial</h5>
                  <div className="space-y-3">
                    {(subscriptionData as any).timeline.map((event: { type: string; date: string; amountValue?: number; amountUnit?: string; reasonDetail?: string | null }, i: number) => (
                      <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                        <span className="shrink-0">{icons[event.type] || '•'}</span>
                        <span className="text-gray-500 dark:text-gray-400 shrink-0">{formatShortDate(event.date)}</span>
                        <span className="text-gray-700 dark:text-gray-300">{labels[event.type] || event.type}</span>
                        {event.type === 'renewal' && discountedAmount && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {discountedAmount}€ <span className="line-through text-gray-400 text-xs">{amount}€</span>
                          </span>
                        )}
                        {event.type === 'renewal' && !discountedAmount && amount > 0 && (
                          <span className="text-gray-500">{amount}€</span>
                        )}
                        {event.type === 'compensation' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatAdjustmentAmount(event)}
                          </span>
                        )}
                        {event.type === 'refunded' && (event.amountValue || event.reasonDetail) && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatAdjustmentAmount(event)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <span className="text-blue-500 mt-0.5">💡</span>
                <div>
                  <h5 className="font-medium text-blue-800 dark:text-blue-200">Portal de gestión</h5>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Desde el portal de Stripe puedes actualizar tu método de pago y ver tus facturas anteriores.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Usuario sin suscripción */
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📭</div>
            <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              No tienes una suscripción activa
            </h4>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {subscriptionData?.planType === 'premium' ? (
                'Tu cuenta tiene acceso Premium pero no encontramos una suscripción activa en Stripe.'
              ) : subscriptionData?.planType === 'legacy_free' ? (
                'Tienes acceso gratuito ilimitado como usuario legacy.'
              ) : (
                'Hazte Premium para acceder a todas las funcionalidades sin límites.'
              )}
            </p>
            {subscriptionData?.planType !== 'premium' && subscriptionData?.planType !== 'legacy_free' && (
              <a
                href="/premium"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-all"
              >
                <span>👑</span>
                <span>Ver Planes Premium</span>
              </a>
            )}
          </div>
        )}

        {/* Info de cuenta */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-4">📋 Información de cuenta</h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Tipo de plan:</span>
                <span className="text-gray-600 dark:text-gray-400 ml-2 capitalize">
                  {subscriptionData?.planType === 'premium' ? '👑 Premium' :
                   subscriptionData?.planType === 'legacy_free' ? '🎁 Legacy (Gratis)' :
                   subscriptionData?.planType === 'trial' ? '🆓 Prueba' :
                   '📝 Free'}
                </span>
              </div>
              {subscriptionData?.stripeCustomerId && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">ID Cliente:</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2 font-mono text-xs">
                    {subscriptionData.stripeCustomerId}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 🆕 COMPONENTE NOTIFICACIONES
  const EmailPreferencesTab = () => {
    if (emailPrefLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando preferencias...</span>
        </div>
      )
    }

    const toggleClass = "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Configuracion de Emails
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Gestiona que emails quieres recibir de Vence. Puedes desactivar categorias enteras o tipos individuales.
          </p>
        </div>

        {/* === CATEGORIA: EMAILS DE VENCE (marketing) === */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white">Emails de Vence</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bienvenida, reactivacion, recordatorios y resumen semanal</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!emailPreferences.unsubscribed_all}
                onChange={(e) => handleEmailPrefChange('unsubscribed_all', !e.target.checked)}
                disabled={emailPrefSaving}
                className="sr-only peer"
              />
              <div className={`${toggleClass} peer-checked:bg-blue-500`}></div>
            </label>
          </div>
        </div>

        {/* === CATEGORIA: NEWSLETTER === */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white">Newsletter y novedades</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Boletines, alertas BOE, novedades de tu oposicion</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!emailPreferences.email_newsletter_disabled}
                onChange={(e) => handleEmailPrefChange('email_newsletter_disabled', !e.target.checked)}
                disabled={emailPrefSaving}
                className="sr-only peer"
              />
              <div className={`${toggleClass} peer-checked:bg-blue-500`}></div>
            </label>
          </div>
        </div>

        {/* === CATEGORIA: SOPORTE === */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white">Soporte y transaccional</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Respuestas a impugnaciones, soporte, recordatorio renovacion</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!emailPreferences.email_soporte_disabled}
                onChange={(e) => handleEmailPrefChange('email_soporte_disabled', !e.target.checked)}
                disabled={emailPrefSaving}
                className="sr-only peer"
              />
              <div className={`${toggleClass} peer-checked:bg-blue-500`}></div>
            </label>
          </div>
        </div>

        {/* Estado de guardado */}
        {emailPrefSaving && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-blue-600">Guardando preferencias...</span>
          </div>
        )}
      </div>
    )
  }

  // Loading mientras se verifica auth
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            Acceso Requerido
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Para ver tu perfil necesitas estar registrado.
          </p>
          <div className="space-y-3">
            <Link 
              href="/login"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity block"
            >
              🚀 Iniciar Sesión
            </Link>
            <Link 
              href="/es"
              className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors block"
            >
              ← Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
                👤 Mi Perfil
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Gestiona tu información personal y preferencias
              </p>
            </div>
          </div>

          {/* Barra de estado flotante - guardado preferencias email */}
          {emailPrefSaving && (
            <div className="fixed top-4 right-4 z-50">
              <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
                📧 Guardando preferencias...
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna izquierda - Info del usuario */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="text-center">
                {/* Avatar con cambio de avatar */}
                <div className="mb-2 flex justify-center">
                  <AvatarChanger
                    user={user}
                    currentAvatar={
                      avatarMode === 'automatic' && autoProfile
                        ? { type: 'predefined', emoji: autoProfile.emoji, name: autoProfile.name, color: autoProfile.color }
                        : currentAvatar
                    }
                    onAvatarChange={handleAvatarChange}
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
                  {formData.nickname || getFirstName(user.user_metadata?.full_name) || 'Usuario'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{user.email}</p>

                {/* 🤖 Toggle Avatar Automático - DENTRO DE LA TARJETA */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤖</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avatar Automático</span>
                    </div>
                    <button
                      onClick={handleAvatarModeToggle}
                      disabled={avatarModeLoading || avatarModeSaving}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                        avatarMode === 'automatic'
                          ? 'bg-blue-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      } ${(avatarModeLoading || avatarModeSaving) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                        avatarMode === 'automatic' ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {avatarMode === 'automatic'
                      ? 'Tu avatar cambia cada semana según cómo estudias'
                      : 'Actívalo para que tu avatar refleje tu estilo de estudio'}
                  </p>

                  {avatarMode === 'automatic' && autoProfile && (
                    <div className="mt-3 space-y-2">
                      {/* Avatar principal */}
                      <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-2 text-center">
                        <span className="text-2xl">{autoProfile.emoji}</span>
                        <p className="font-medium text-purple-700 dark:text-purple-300 text-sm">
                          {autoProfile.name}
                        </p>
                        <p className="text-xs text-purple-500 dark:text-purple-400">
                          {autoProfile.description}
                        </p>
                      </div>

                      {/* Otros badges conseguidos */}
                      {matchedBadges.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
                            También conseguido:
                          </p>
                          <div className="space-y-1">
                            {matchedBadges.map((badge) => (
                              <div
                                key={badge.id}
                                className="bg-white dark:bg-gray-700 rounded px-2 py-1 text-xs text-center"
                              >
                                <p className="font-medium text-gray-700 dark:text-gray-200">
                                  {badge.emoji} {badge.name}
                                </p>
                                <p className="text-gray-500 dark:text-gray-400 text-[10px]">{badge.condition}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {avatarModeSaving && (
                    <p className="text-xs text-center text-gray-500 mt-2">Guardando...</p>
                  )}
                </div>

                {/* Estadísticas básicas */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formData.target_oposicion ? '1' : '0'}
                    </div>
                    <div className="text-xs text-blue-500 dark:text-blue-400">Oposición</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-lg">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formData.study_goal}
                    </div>
                    <div className="text-xs text-green-500 dark:text-green-400">Meta diaria</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha - Pestañas */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              
              {/* 🆕 SISTEMA DE PESTAÑAS */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('general')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'general'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    ⚙️ General
                  </button>
                  <button
                    onClick={() => setActiveTab('suscripcion')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'suscripcion'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    💳 Suscripción
                  </button>
                </nav>
              </div>

              {/* CONTENIDO DE LAS PESTAÑAS */}
              {activeTab === 'general' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                      ⚙️ Configuración del Perfil
                    </h2>
                  </div>

                  <div className="space-y-6">

                    {/* Información Personal */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        👤 Información Personal
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            Nombre Completo (Google)
                          </label>
                          <input
                            type="text"
                            value={user.user_metadata?.full_name || 'No disponible'}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Este es tu nombre de Google y no se puede editar
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            Nickname (Nombre para mostrar)
                          </label>
                          <input
                            type="text"
                            name="nickname"
                            value={formData.nickname}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`Por ejemplo: ${getFirstName(user.user_metadata?.full_name) || 'Tu nombre preferido'}`}
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Si no lo completas, usaremos "{getFirstName(user.user_metadata?.full_name) || 'tu primer nombre'}"
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            Email (No editable)
                          </label>
                          <input
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Datos Demográficos (Onboarding) */}
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            🎂 Edad
                          </label>
                          <input
                            type="number"
                            name="age"
                            value={formData.age}
                            onChange={handleInputChange}
                            min="16"
                            max="100"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Tu edad"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            👤 Género
                          </label>
                          <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Sin especificar</option>
                            <option value="male">Masculino</option>
                            <option value="female">Femenino</option>
                            <option value="other">Otro</option>
                            <option value="prefer_not_say">Prefiero no decir</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            📍 Ciudad
                          </label>
                          <input
                            type="text"
                            name="ciudad"
                            value={formData.ciudad}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Tu ciudad"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            ⏰ Horas de estudio diarias
                            <span className="text-gray-500 text-xs ml-1">(Opcional)</span>
                          </label>
                          <input
                            type="number"
                            name="daily_study_hours"
                            value={formData.daily_study_hours}
                            onChange={handleInputChange}
                            min="1"
                            max="12"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Opcional"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Número aproximado de horas que estudias al día
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Preferencias de Estudio */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        📚 Preferencias de Estudio
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            🎯 Oposición Objetivo
                          </label>

                          {/* Oposición seleccionada */}
                          <div className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                                  {formData.target_oposicion ? `✓ ${getSelectedOposicionName()}` : 'Sin oposición seleccionada'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowOposicionSelector(true)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium"
                              >
                                {formData.target_oposicion ? 'Cambiar' : 'Seleccionar'}
                              </button>
                            </div>
                          </div>

                          <OposicionChangeModal
                            open={showOposicionSelector}
                            onClose={() => setShowOposicionSelector(false)}
                            onSelect={async (id) => {
                              // Actualizar state local
                              handleDirectChange('target_oposicion', id)
                              // Escritura centralizada (endpoint server, shape canónico)
                              const selectedOp = oposiciones.find(op => op.value === id)
                              const oposicionData = selectedOp?.data || null
                              await setTargetOposicion(id).catch(() => {})
                              // Sincronizar profile local para que hasChanges no detecte diff
                              setProfile(prev => prev ? { ...prev, target_oposicion: id, target_oposicion_data: oposicionData } : prev)
                              window.dispatchEvent(new CustomEvent('oposicionAssigned', { detail: { oposicionId: id } }))
                              setMessage('✅ Oposición actualizada')
                              setTimeout(() => setMessage(''), 3000)
                            }}
                          />

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Selecciona la oposición que estás preparando
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-2">
                            📊 Meta Diaria (preguntas)
                          </label>
                          <input
                            type="number"
                            name="study_goal"
                            value={formData.study_goal}
                            onChange={handleInputChange}
                            min="1"
                            max="9999"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Número de preguntas que quieres responder cada día
                          </p>
                        </div>

                        {/* Toggle: barra de meta diaria en la cabecera (premium). Único sitio
                            para re-activarla tras ocultarla con la X de la propia barra. */}
                        {isPremium && (
                          <div className="md:col-span-2">
                            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  📊 Mostrar barra de meta diaria en la cabecera
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  La barra de progreso (0/{formData.study_goal}) que aparece arriba. Si la ocultas con la ✕, se vuelve a activar desde aquí.
                                </p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={effectiveBannerVisible(profile?.show_daily_goal_banner)}
                                aria-label="Mostrar barra de meta diaria en la cabecera"
                                disabled={bannerToggleSaving}
                                onClick={handleToggleDailyGoalBanner}
                                className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  effectiveBannerVisible(profile?.show_daily_goal_banner) ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                                } ${bannerToggleSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    effectiveBannerVisible(profile?.show_daily_goal_banner) ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fase 8 — Mis oposiciones favoritas */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
                        ⭐ Mis oposiciones favoritas
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Te avisaremos en la campana 🔔 (y por email en los hitos clave) cuando haya novedades de tus oposiciones favoritas.
                      </p>

                      {seguidasLoading ? (
                        <div className="text-sm text-gray-400">Cargando…</div>
                      ) : (
                        <div className="space-y-2">
                          {seguidas.length === 0 && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Aún no sigues ninguna oposición. Añade favoritas para recibir avisos de sus novedades.
                            </div>
                          )}
                          {seguidas.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  s.rol === 'target'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}>
                                  {s.rol === 'target' ? '🎯 Objetivo' : '⭐ Favorita'}
                                </span>
                                <span className="text-sm text-gray-800 dark:text-gray-100 truncate">
                                  {s.nombre || s.slug}
                                </span>
                              </div>
                              {s.rol === 'favorita' && (
                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    type="button"
                                    disabled={seguidasBusy}
                                    onClick={() => promoteToTarget(s.slug)}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:opacity-50"
                                  >
                                    Hacer objetivo
                                  </button>
                                  <button
                                    type="button"
                                    disabled={seguidasBusy}
                                    onClick={() => removeFavorita(s.oposicionId)}
                                    className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Añadir favorita */}
                          {!showAddFavorita ? (
                            <button
                              type="button"
                              onClick={() => setShowAddFavorita(true)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 mt-1"
                            >
                              + Añadir favorita
                            </button>
                          ) : (
                            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 mt-1">
                              <input
                                type="text"
                                autoFocus
                                value={favoritaSearchTerm}
                                onChange={(e) => setFavoritaSearchTerm(e.target.value)}
                                placeholder="Busca una oposición…"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm mb-2"
                              />
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {oposiciones
                                  .filter(op => op.value && op.data?.slug)
                                  .filter(op => !seguidas.some(s => s.slug === op.data!.slug))
                                  .filter(op => {
                                    const t = favoritaSearchTerm.toLowerCase().trim()
                                    return !t || op.label.toLowerCase().includes(t)
                                  })
                                  .slice(0, 30)
                                  .map(op => (
                                    <button
                                      key={op.value}
                                      type="button"
                                      disabled={seguidasBusy}
                                      onClick={() => addFavorita(op.data!.slug)}
                                      className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
                                    >
                                      {op.label}
                                    </button>
                                  ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => { setShowAddFavorita(false); setFavoritaSearchTerm('') }}
                                className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Avatar Actual */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        🎨 Avatar Actual
                      </h3>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="text-sm">
                            {currentAvatar?.type === 'predefined' && currentAvatar.name && (
                              <span className="text-gray-700">
                                <strong>Avatar seleccionado:</strong> {currentAvatar.name} {currentAvatar.emoji}
                              </span>
                            )}
                            {currentAvatar?.type === 'default' && (
                              <span className="text-gray-700">
                                <strong>Avatar:</strong> Inicial por defecto
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Información de Cuenta */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                        🔐 Información de Cuenta
                      </h3>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Registrado:</span>
                            <span className="text-gray-600 dark:text-gray-300 ml-2">
                              {new Date(user.created_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Última actualización:</span>
                            <span className="text-gray-600 dark:text-gray-300 ml-2">
                              {profile?.updated_at ? 
                                new Date(profile.updated_at).toLocaleDateString('es-ES') : 
                                'Nunca'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botón Guardar y Feedback */}
                    {(hasChanges || message) && (
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {hasChanges && !saving && !message && (
                              <div className="text-amber-600 text-sm">
                                ⚠️ Tienes cambios pendientes sin guardar
                              </div>
                            )}
                            {message && (
                              <div className={`text-sm font-medium ${
                                message.includes('✅') ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {message}
                              </div>
                            )}
                          </div>

                          {hasChanges && (
                            <button
                              onClick={saveProfile}
                              disabled={saving}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                              {saving ? (
                                <span className="flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  <span>Guardando...</span>
                                </span>
                              ) : (
                                <span className="flex items-center space-x-2">
                                  <span>💾</span>
                                  <span>Guardar Cambios</span>
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 🗑️ ZONA DE PELIGRO - ELIMINAR CUENTA */}
                    <div className="mt-12 pt-8 border-t border-red-200 dark:border-red-900">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center">
                        <span className="mr-2">⚠️</span>
                        Zona de peligro
                      </h3>

                      {/* Banner persistente de solicitud pendiente — caso Helga 11-abr-2026.
                          Se muestra destacado cuando hay solicitud para que el usuario NO
                          se quede con la duda de si se envió correctamente. */}
                      {deletionRequested && (
                        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">⏳</span>
                            <div>
                              <h4 className="font-semibold text-amber-900 dark:text-amber-200">
                                Tu solicitud de eliminación está en curso
                              </h4>
                              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                                Procesaremos tu petición en 24-48 horas. Recibirás un email de confirmación cuando se complete. Hasta entonces puedes seguir usando la cuenta con normalidad.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <h4 className="font-medium text-red-800 dark:text-red-300">
                              Eliminar cuenta
                            </h4>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                              Esta acción es irreversible. Se eliminarán todos tus datos.
                            </p>
                          </div>
                          {deletionRequested ? (
                            <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg font-medium flex items-center justify-center space-x-2 whitespace-nowrap">
                              <span>⏳</span>
                              <span>Solicitud pendiente</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setDeleteStep('retention'); setShowDeleteAccountModal(true) }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                            >
                              <span>🗑️</span>
                              <span>Solicitar eliminación</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 🆕 PESTAÑA DE SUSCRIPCIÓN */}
              {activeTab === 'suscripcion' && <SubscriptionTab />}

              {/* 🆕 PESTAÑA DE EMAIL PREFERENCES (LEGACY) */}
              {activeTab === 'emails' && <EmailPreferencesTab />}
              
            </div>
          </div>
        </div>
      </div>

      {/* 🗑️ Modal de eliminación de cuenta */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            {deletionSuccess ? (
              // ✅ ESTADO DE ÉXITO — confirmación inline. Ya NO auto-cierra
              // (caso Helga 11-abr-2026: con auto-close de 2.5s seguía pinchando
              // botones tras cerrar porque no encontraba señal persistente del
              // cambio). Ahora el usuario cierra explícitamente y el banner
              // persistente en la página deja clara la situación.
              <div className="py-6 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">
                  Solicitud enviada correctamente
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Procesaremos tu petición en 24-48 horas.
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-3 mb-6">
                  Recibirás un email cuando se complete.
                </p>
                <button
                  onClick={() => {
                    setShowDeleteAccountModal(false)
                    setDeletionSuccess(false)
                    setDeleteConfirmText('')
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg font-medium transition-colors min-h-[44px]"
                >
                  Entendido
                </button>
              </div>
            ) : deleteStep === 'retention' ? (
              // 🔔 PASO 1 — Retención: recuperar a quien se va por inactividad (no por enfado).
              // Mantener la cuenta (aunque inactiva) habilita avisos de convocatorias de
              // su provincia/interés y actualizaciones de temario. Ver agenda: construir
              // esos envíos a inactivos para que la promesa sea real.
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <span className="mr-2">🔔</span>
                  Antes de irte…
                </h3>
                <div className="space-y-4">
                  <p className="text-gray-700 dark:text-gray-200">
                    ¿Seguro que quieres borrar tus datos? Puedes <strong>mantener tu cuenta aunque no la uses</strong> y seguir recibiendo:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2 ml-1">
                    <li className="flex gap-2"><span>📢</span><span>Avisos cuando se <strong>convoquen plazas</strong> de tu interés o en tu provincia.</span></li>
                    <li className="flex gap-2"><span>📚</span><span><strong>Actualizaciones del temario</strong> para estar siempre al día.</span></li>
                  </ul>
                </div>
                <div className="flex flex-col gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowDeleteAccountModal(false)
                      setDeleteStep('retention')
                      setDeleteConfirmText('')
                      setDeleteError('')
                    }}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold transition-colors min-h-[44px]"
                  >
                    Mantener mi cuenta
                  </button>
                  <button
                    onClick={() => setDeleteStep('confirm')}
                    className="w-full px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline transition-colors"
                  >
                    No me interesa estar al día, darme de baja
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4 flex items-center">
                  <span className="mr-2">⚠️</span>
                  Eliminar cuenta
                </h3>

                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-300">
                    Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente:
                  </p>

                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                    <li>• Tu perfil y datos personales</li>
                    <li>• Historial de tests y estadísticas</li>
                    <li>• Preferencias y configuración</li>
                  </ul>

                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <label className="block text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                      Escribe <strong>ELIMINAR</strong> para confirmar:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => {
                        setDeleteConfirmText(e.target.value.toUpperCase())
                        setDeleteError('')
                      }}
                      placeholder="ELIMINAR"
                      disabled={deletingAccount}
                      className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {deleteError && (
                      <p className="text-red-600 text-sm mt-1" role="alert">{deleteError}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowDeleteAccountModal(false)
                      setDeleteConfirmText('')
                      setDeleteError('')
                    }}
                    disabled={deletingAccount}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={requestAccountDeletion}
                    disabled={deletingAccount || deleteConfirmText !== 'ELIMINAR'}
                    aria-busy={deletingAccount}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    {deletingAccount ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Enviando solicitud…</span>
                      </>
                    ) : (
                      <>
                        <span>🗑️</span>
                        <span>Confirmar eliminación</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de cancelación de suscripción */}
      <CancellationFlow
        isOpen={showCancellationFlow}
        onClose={() => setShowCancellationFlow(false)}
        userId={user?.id}
        periodEndDate={subscriptionData?.subscription?.currentPeriodEnd}
        onCancelled={async () => {
          // Recargar datos completos (incluido timeline)
          await reloadSubscription()
        }}
      />
    </div>
  )
}


export default function PerfilPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🔄 Cargando página...
          </h2>
        </div>
      </div>
    }>
      <PerfilPageContent />
    </Suspense>
  )
}