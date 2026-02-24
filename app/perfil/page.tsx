// app/perfil/page.tsx - CON PESTAÑAS Y EMAIL PREFERENCES
'use client'
import { useState, useEffect, useRef, Suspense, useMemo, ChangeEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AvatarChanger from '@/components/AvatarChanger'
import { useAuth } from '@/contexts/AuthContext'
import { useUserOposicion } from '@/components/useUserOposicion'
import notificationTracker from '@/lib/services/notificationTracker'
import CancellationFlow from '@/components/CancellationFlow'
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

interface PushNotificationSettings {
  push_enabled?: boolean
  push_subscription?: PushSubscriptionJSON | string | null
  preferred_times?: string[]
  timezone?: string
  frequency?: string
  oposicion_type?: string
  motivation_level?: string
}

interface PushNotifications {
  supported: boolean
  permission: NotificationPermission | 'default'
  enabled: boolean
  subscription: PushSubscription | string | null
  settings: PushNotificationSettings | null
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

type TabType = 'general' | 'emails' | 'notificaciones' | 'suscripcion'

// Tipo para AuthContext (no está tipado)
interface AuthContextValue {
  user: User | null
  loading: boolean
  supabase: SupabaseClient
}

// Tipo para UserOposicion hook
interface UserOposicionValue {
  userOposicion: { slug: string; name?: string; [key: string]: unknown } | null
  loading: boolean
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

function PerfilPageContent() {
  const { user, loading: authLoading, supabase } = useAuth() as AuthContextValue
  const { userOposicion, loading: oposicionLoading } = useUserOposicion() as UserOposicionValue
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

  // 🆕 PUSH NOTIFICATIONS
  const [pushNotifications, setPushNotifications] = useState<PushNotifications>({
    supported: false,
    permission: 'default',
    enabled: false,
    subscription: null,
    settings: null
  })
  const [pushLoading, setPushLoading] = useState<boolean>(true)
  const [pushSaving, setPushSaving] = useState<boolean>(false)

  // 🆕 SUSCRIPCIÓN
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState<boolean>(true)
  const [portalLoading, setPortalLoading] = useState<boolean>(false)
  const [showCancellationFlow, setShowCancellationFlow] = useState<boolean>(false)

  // 🤖 AVATAR AUTOMÁTICO - Por defecto activado
  const [avatarMode, setAvatarMode] = useState<'manual' | 'automatic'>('automatic')
  const [autoProfile, setAutoProfile] = useState<AutoProfile | null>(null)
  const [matchedBadges, setMatchedBadges] = useState<MatchedBadge[]>([])
  const [avatarModeLoading, setAvatarModeLoading] = useState<boolean>(true)
  const [avatarModeSaving, setAvatarModeSaving] = useState<boolean>(false)

  // Para evitar guardado en primera carga
  const isInitialLoad = useRef<boolean>(true)
  const [hasChanges, setHasChanges] = useState<boolean>(false)

  // 🗑️ ELIMINACIÓN DE CUENTA
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState<boolean>(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('')
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false)
  const [deleteError, setDeleteError] = useState<string>('')
  const [deletionRequested, setDeletionRequested] = useState<boolean>(false)
  
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
      setActiveTab('notificaciones')
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

  // 🆕 CARGAR PUSH NOTIFICATIONS - VIA API TIPADA
  useEffect(() => {
    async function loadPushNotifications() {
      if (!user) return

      try {
        setPushLoading(true)

        // Verificar soporte del navegador
        const supported = typeof window !== 'undefined' &&
          'Notification' in window &&
          'serviceWorker' in navigator &&
          'PushManager' in window

        const permission = supported ? Notification.permission : 'denied'

        // Cargar configuración via API
        const response = await fetch(`/api/profile/notification-settings?userId=${user.id}`)
        const result = await response.json()

        if (!result.success || !result.data || !result.data.id) {
          // No existe configuración, usar valores por defecto
          setPushNotifications({
            supported,
            permission,
            enabled: false,
            subscription: null,
            settings: null
          })
        } else {
          const settings = result.data
          setPushNotifications({
            supported,
            permission,
            enabled: settings.pushEnabled || false,
            subscription: settings.pushSubscription || null,
            settings: {
              push_enabled: settings.pushEnabled,
              push_subscription: settings.pushSubscription,
              preferred_times: settings.preferredTimes,
              timezone: settings.timezone,
              frequency: settings.frequency,
              oposicion_type: settings.oposicionType,
              motivation_level: settings.motivationLevel
            }
          })
        }
      } catch (error) {
        console.error('Error general cargando push notifications:', error)
        const supported = typeof window !== 'undefined' &&
          'Notification' in window &&
          'serviceWorker' in navigator &&
          'PushManager' in window
        setPushNotifications({
          supported,
          permission: supported ? Notification.permission : 'denied',
          enabled: false,
          subscription: null,
          settings: null
        })
      } finally {
        setPushLoading(false)
      }
    }

    loadPushNotifications()
  }, [user])

  // 🆕 CARGAR DATOS DE SUSCRIPCIÓN
  useEffect(() => {
    async function loadSubscription() {
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

    loadSubscription()
  }, [user])

  // CARGAR PERFIL VIA API TIPADA
  useEffect(() => {
    async function loadUserProfile() {
      if (authLoading || oposicionLoading) return

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

          // ✅ SINCRONIZAR CON userOposicion del hook
          // Migrar valor antiguo si es necesario
          let currentOposicion = userOposicion?.slug || profileData.target_oposicion || ''
          if (currentOposicion === 'auxiliar-administrativo-estado') {
            currentOposicion = 'auxiliar_administrativo_estado' // Migrar al nuevo formato
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
  }, [user, authLoading, oposicionLoading, userOposicion])

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

  // 🆕 FUNCIONES PARA PUSH NOTIFICATIONS - VIA API TIPADA
  const enablePushNotifications = async () => {
    if (!pushNotifications.supported) {
      setMessage('❌ Tu navegador no soporta notificaciones push')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setPushSaving(true)
    try {
      // Track permission request
      await notificationTracker.trackPermissionRequested(user)

      // Solicitar permiso
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        // Track permission granted
        await notificationTracker.trackPermissionGranted(user)

        // Registrar service worker
        const registration = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        // Obtener o crear suscripción push
        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey || '')
          })

          // Track subscription created
          await notificationTracker.trackSubscriptionCreated(user, subscription)
        }

        // Guardar en base de datos via API
        const settingsData = {
          pushEnabled: true,
          pushSubscription: subscription.toJSON(),
          preferredTimes: ['09:00', '14:00', '20:00'],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          frequency: 'smart',
          oposicionType: 'auxiliar-administrativo',
          motivationLevel: 'medium'
        }

        const response = await fetch('/api/profile/notification-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user!.id,
            data: settingsData
          })
        })

        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Error al guardar configuración')

        // Track settings updated
        await notificationTracker.trackSettingsUpdated(user, settingsData)

        // Actualizar estado local
        setPushNotifications(prev => ({
          ...prev,
          permission,
          enabled: true,
          subscription,
          settings: {
            push_enabled: true,
            push_subscription: subscription.toJSON(),
            preferred_times: ['09:00', '14:00', '20:00'],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            frequency: 'smart',
            oposicion_type: 'auxiliar-administrativo',
            motivation_level: 'medium'
          }
        }))

        // Mostrar notificación de bienvenida
        const welcomeNotification = new Notification('🎯 ¡Notificaciones activadas!', {
          body: 'Te ayudaremos a mantener tu racha de estudio. ¡A por todas!',
          icon: '/icon-192.png',
          tag: 'welcome'
        })

        // Track notification sent
        await notificationTracker.trackNotificationSent(user, {
          type: 'welcome',
          title: '🎯 ¡Notificaciones activadas!',
          body: 'Te ayudaremos a mantener tu racha de estudio. ¡A por todas!',
          tag: 'welcome'
        })

        setMessage('✅ Notificaciones push activadas correctamente')
      } else {
        // Track permission denied
        await notificationTracker.trackPermissionDenied(user)
        setMessage('❌ Permisos de notificación denegados')
      }
    } catch (error) {
      console.error('Error enabling push notifications:', error)
      setMessage('❌ Error al activar notificaciones push')
    } finally {
      setPushSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const disablePushNotifications = async () => {
    setPushSaving(true)
    try {
      // Actualizar en base de datos via API
      const response = await fetch('/api/profile/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user!.id,
          data: { pushEnabled: false }
        })
      })

      const result = await response.json()
      if (!result.success) throw new Error(result.error || 'Error al desactivar notificaciones')

      // Track subscription deleted (pasando usuario explícitamente)
      await notificationTracker.trackSubscriptionDeleted(user)

      // Track settings updated (pasando usuario explícitamente)
      await notificationTracker.trackSettingsUpdated(user, { push_enabled: false })

      // Actualizar estado local
      setPushNotifications(prev => ({
        ...prev,
        enabled: false,
        settings: { ...prev.settings, push_enabled: false }
      }))

      setMessage('✅ Notificaciones push desactivadas')
    } catch (error) {
      console.error('Error disabling push notifications:', error)
      setMessage('❌ Error al desactivar notificaciones push')
    } finally {
      setPushSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // Utility function para convertir VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // Función para extraer el primer nombre
  const getFirstName = (fullName: string | null | undefined) => {
    if (!fullName) return ''
    return fullName.split(' ')[0] || ''
  }

  // 🗑️ SOLICITAR ELIMINACIÓN DE CUENTA
  const requestAccountDeletion = async () => {
    if (!user || deletingAccount) return
    if (deleteConfirmText !== 'ELIMINAR') {
      setDeleteError('Escribe ELIMINAR para confirmar')
      return
    }

    try {
      setDeletingAccount(true)
      setDeleteError('')

      // Verificar si ya existe una solicitud pendiente (evita duplicados)
      const { count } = await supabase
        .from('user_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'account_deletion')
        .eq('status', 'pending')

      if (count && count > 0) {
        setDeletionRequested(true)
        setShowDeleteAccountModal(false)
        setDeleteConfirmText('')
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

      // Cerrar modal y mostrar confirmación
      setShowDeleteAccountModal(false)
      setDeleteConfirmText('')
      setDeletionRequested(true)
      alert('Solicitud recibida. Procesaremos tu petición en 24-48h. Recibirás un email de confirmación.')

    } catch (error) {
      console.error('Error solicitando eliminación:', error)
      setDeleteError('Error al enviar la solicitud. Inténtalo de nuevo.')
    } finally {
      setDeletingAccount(false)
    }
  }

  // GUARDAR PERFIL VIA API TIPADA
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

      // Datos en formato camelCase para la API
      const apiData = {
        nickname: formData.nickname.trim(),
        studyGoal: parseInt(formData.study_goal),
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
        headers: { 'Content-Type': 'application/json' },
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
    
    // Fallback: usar datos del hook si están disponibles
    if (userOposicion?.name) return userOposicion.name
    
    return null
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
                </div>
              </div>

              {/* Aviso de cancelación pendiente */}
              {subscriptionData.subscription.cancelAtPeriodEnd && (
                <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-yellow-600">⚠️</span>
                    <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                      Tu suscripción se cancelará el {formatDate(subscriptionData.subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                    Seguirás teniendo acceso Premium hasta esa fecha.
                  </p>
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
  const NotificationsTab = () => {
    if (pushLoading || emailPrefLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando configuración...</span>
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            🔔 Configuración de Notificaciones
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Gestiona todas tus notificaciones en un solo lugar. Configura tanto las notificaciones push del navegador como los emails automáticos.
          </p>
        </div>

        {/* NOTIFICACIONES PUSH */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">📱</span>
            <div>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Notificaciones Push</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">Recordatorios directos en tu navegador</p>
            </div>
          </div>

          {!pushNotifications.supported ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-red-800">
                <span>❌</span>
                <span className="font-medium">Navegador no compatible</span>
              </div>
              <p className="text-red-700 text-sm mt-1">
                Tu navegador no soporta notificaciones push. Prueba con Chrome, Firefox o Safari.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Estado actual */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 dark:border-gray-600 rounded-lg dark:bg-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-gray-800">
                      Notificaciones Push
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {pushNotifications.enabled 
                        ? 'Recibirás recordatorios para mantener tu racha de estudio'
                        : 'No recibirás notificaciones push en este navegador'
                      }
                    </p>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushNotifications.enabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          enablePushNotifications()
                        } else {
                          disablePushNotifications()
                        }
                      }}
                      disabled={pushSaving}
                      className="sr-only peer"
                    />
                    <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:bg-green-500 peer-disabled:opacity-50 transition-colors">
                      <div className="absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform peer-checked:translate-x-7 flex items-center justify-center">
                        {pushNotifications.enabled ? (
                          <span className="text-xs text-green-600">✓</span>
                        ) : (
                          <span className="text-xs text-gray-400">✕</span>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* NOTIFICACIONES POR EMAIL */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">📧</span>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Emails de Vence</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">Recibe alertas y noticias para tu oposición</p>
            </div>
          </div>

          {/* Opción única simplificada */}
          {/* Emails de Vence (marketing) */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800 dark:text-white">Emails de Vence</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Reactivacion, bienvenida, motivacion, resumen semanal
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!emailPreferences.unsubscribed_all}
                  onChange={(e) => handleEmailPrefChange('unsubscribed_all', !e.target.checked)}
                  disabled={emailPrefSaving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
          </div>

          {/* Emails de Soporte */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800 dark:text-white">Soporte</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Respuestas a impugnaciones, soporte y renovacion
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!emailPreferences.email_soporte_disabled}
                  onChange={(e) => handleEmailPrefChange('email_soporte_disabled', !e.target.checked)}
                  disabled={emailPrefSaving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>

          {/* Newsletter */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800 dark:text-white">Newsletter</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Boletines, alertas BOE, novedades de tu oposicion
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!emailPreferences.email_newsletter_disabled}
                  onChange={(e) => handleEmailPrefChange('email_newsletter_disabled', !e.target.checked)}
                  disabled={emailPrefSaving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>
          </div>

          {/* Estado de guardado de emails */}
          {emailPrefSaving && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              <span className="ml-2 text-green-600">Guardando preferencias de email...</span>
            </div>
          )}
        </div>

      </div>
    )
  }

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
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-white">Emails de Vence</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Reactivacion, bienvenida, motivacion, resumen semanal</p>
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

          {!emailPreferences.unsubscribed_all && (
            <div className="p-4 space-y-3">
              {[
                { key: 'email_reactivacion', label: 'Reactivacion', desc: 'Recordatorio cuando llevas 7-13 dias sin estudiar' },
                { key: 'email_urgente', label: 'Urgentes', desc: 'Recordatorio fuerte cuando llevas 14+ dias sin estudiar' },
                { key: 'email_bienvenida_motivacional', label: 'Motivacion', desc: 'Ayuda para dar el primer paso tras registrarte' },
                { key: 'email_bienvenida_inmediato', label: 'Bienvenida', desc: 'Email de bienvenida al registrarte' },
                { key: 'email_resumen_semanal', label: 'Resumen semanal', desc: 'Resumen de tu progreso y articulos a repasar' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between pl-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(emailPreferences as unknown as Record<string, boolean>)[key] ?? true}
                      onChange={(e) => handleEmailPrefChange(key, e.target.checked)}
                      disabled={emailPrefSaving}
                      className="sr-only peer"
                    />
                    <div className={`${toggleClass} peer-checked:bg-blue-500 peer-disabled:opacity-50`}></div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* === CATEGORIA: NEWSLETTER === */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 p-4">
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
                <div className={`${toggleClass} peer-checked:bg-purple-500`}></div>
              </label>
            </div>
          </div>
        </div>

        {/* === CATEGORIA: SOPORTE === */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-700 p-4">
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
                <div className={`${toggleClass} peer-checked:bg-orange-500`}></div>
              </label>
            </div>
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
  if (authLoading || loading || oposicionLoading) {
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

          {/* Barra de estado flotante - Solo para email y push */}
          {(emailPrefSaving || pushSaving) && (
            <div className="fixed top-4 right-4 z-50">
              <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
                {emailPrefSaving ? '📧 Guardando preferencias...' :
                 pushSaving ? '🔔 Configurando notificaciones...' : ''}
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
                          ? 'bg-purple-500'
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
                    onClick={() => setActiveTab('notificaciones')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'notificaciones'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    🔔 Notificaciones
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
                          {formData.target_oposicion && !showOposicionSelector ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-blue-600 font-semibold text-sm">
                                    ✓ {getSelectedOposicionName()}
                                  </div>
                                  {(() => {
                                    const selectedOp = oposiciones.find(op => op.value === formData.target_oposicion)
                                    return selectedOp?.data?.categoria && selectedOp?.data?.administracion ? (
                                      <div className="text-xs text-gray-600 mt-1">
                                        {selectedOp.data.categoria} · {selectedOp.data.administracion}
                                      </div>
                                    ) : null
                                  })()}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowOposicionSelector(true)
                                    setOposicionSearchTerm('')
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                >
                                  Cambiar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Buscador */}
                              <input
                                type="text"
                                placeholder="🔍 Buscar oposición..."
                                value={oposicionSearchTerm}
                                onChange={(e) => setOposicionSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />

                              {/* Lista de oposiciones */}
                              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 p-2">
                                {filteredOposiciones.length === 0 ? (
                                  <div className="text-center py-4 text-gray-500">
                                    No se encontraron oposiciones
                                  </div>
                                ) : (
                                  <>
                                    {/* Opción para quitar selección */}
                                    {!formData.target_oposicion && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDirectChange('target_oposicion', '')
                                          setShowOposicionSelector(false)
                                          setOposicionSearchTerm('')
                                        }}
                                        className="w-full text-left p-2 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 hover:bg-gray-50 transition-all text-sm"
                                      >
                                        <div className="text-gray-600">
                                          ❌ Ninguna seleccionada
                                        </div>
                                      </button>
                                    )}

                                    {/* Lista de oposiciones */}
                                    {filteredOposiciones.map((op) => (
                                      <button
                                        key={op.value}
                                        type="button"
                                        onClick={() => {
                                          handleDirectChange('target_oposicion', op.value)
                                          setShowOposicionSelector(false)
                                          setOposicionSearchTerm('')
                                        }}
                                        className={`w-full text-left p-2 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-sm ${
                                          formData.target_oposicion === op.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200'
                                        }`}
                                      >
                                        <div className="font-medium text-gray-900 dark:text-white">
                                          {op.label}
                                        </div>
                                        {op.data?.categoria && op.data?.administracion && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {op.data.categoria} · {op.data.administracion}
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>

                              {/* Cancelar si ya había una selección */}
                              {formData.target_oposicion && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowOposicionSelector(false)
                                    setOposicionSearchTerm('')
                                  }}
                                  className="mt-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800"
                                >
                                  Cancelar
                                </button>
                              )}
                            </>
                          )}

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
                            min="5"
                            max="100"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Número de preguntas que quieres responder cada día
                          </p>
                        </div>
                      </div>
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
                              onClick={() => setShowDeleteAccountModal(true)}
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

              {/* 🆕 PESTAÑA DE NOTIFICACIONES */}
              {activeTab === 'notificaciones' && <NotificationsTab />}

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
                  className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {deleteError && (
                  <p className="text-red-600 text-sm mt-1">{deleteError}</p>
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
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={requestAccountDeletion}
                disabled={deletingAccount || deleteConfirmText !== 'ELIMINAR'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                {deletingAccount ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>Confirmar eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cancelación de suscripción */}
      <CancellationFlow
        isOpen={showCancellationFlow}
        onClose={() => setShowCancellationFlow(false)}
        userId={user?.id}
        periodEndDate={subscriptionData?.subscription?.currentPeriodEnd}
        onCancelled={(_periodEnd: string | number | undefined) => {
          // Actualizar datos de suscripción localmente
          setSubscriptionData((prev: SubscriptionData | null): SubscriptionData | null => {
            if (!prev) return null
            return {
              ...prev,
              subscription: prev.subscription ? {
                ...prev.subscription,
                cancelAtPeriodEnd: true
              } : undefined
            }
          })
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