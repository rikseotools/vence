// app/perfil/page.js - CON PESTAÑAS Y EMAIL PREFERENCES
'use client'
import { useState, useEffect, useRef, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AvatarChanger from '@/components/AvatarChanger'
import { useAuth } from '@/contexts/AuthContext'
import { useUserOposicion } from '@/components/useUserOposicion'
import notificationTracker from '@/lib/services/notificationTracker'

function PerfilPageContent() {
  const { user, loading: authLoading, supabase } = useAuth()
  const { userOposicion, loading: oposicionLoading } = useUserOposicion()
  const searchParams = useSearchParams()
  
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [currentAvatar, setCurrentAvatar] = useState(null)
  
  // 🆕 SISTEMA DE PESTAÑAS
  const [activeTab, setActiveTab] = useState('general')
  
  // 🆕 EMAIL PREFERENCES - SIMPLIFICADO
  const [emailPreferences, setEmailPreferences] = useState({
    receive_emails: true, // Opción principal (unsubscribed_all)
    support_emails: true, // Emails de soporte
    newsletter_emails: true // Emails de newsletter/información de oposición
  })
  const [emailPrefLoading, setEmailPrefLoading] = useState(true)
  const [emailPrefSaving, setEmailPrefSaving] = useState(false)
  
  // 🆕 PUSH NOTIFICATIONS
  const [pushNotifications, setPushNotifications] = useState({
    supported: false,
    permission: 'default',
    enabled: false,
    subscription: null,
    settings: null
  })
  const [pushLoading, setPushLoading] = useState(true)
  const [pushSaving, setPushSaving] = useState(false)

  // 🆕 SUSCRIPCIÓN
  const [subscriptionData, setSubscriptionData] = useState(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  
  // Para evitar guardado en primera carga
  const isInitialLoad = useRef(true)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Form data - SINCRONIZADO CON useUserOposicion
  const [formData, setFormData] = useState({
    nickname: '',
    study_goal: 25,
    target_oposicion: '',
    // Campos del onboarding
    age: '',
    gender: '',
    ciudad: '',
    daily_study_hours: ''
  })

  // Estados para el selector de oposición con buscador
  const [showOposicionSelector, setShowOposicionSelector] = useState(false)
  const [oposicionSearchTerm, setOposicionSearchTerm] = useState('')

  // Oposiciones disponibles - SINCRONIZADO CON ONBOARDING MODAL
  const oposiciones = [
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

  // 🆕 CARGAR EMAIL PREFERENCES
  useEffect(() => {
    async function loadEmailPreferences() {
      if (!user) return
      
      try {
        setEmailPrefLoading(true)
        
        const { data: preferences, error } = await supabase
          .from('email_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code === 'PGRST116') {
          // No existe, crear con valores por defecto
          setEmailPreferences({
            receive_emails: true,
            support_emails: true,
            newsletter_emails: true
          })
        } else if (error) {
          console.error('Error cargando preferencias de email:', error)
          setEmailPreferences({ receive_emails: true, support_emails: true, newsletter_emails: true })
        } else {
          // Mapear las preferencias complejas a nuestra opción simple
          // Si las columnas no existen (undefined), usar true como default
          const receiveEmails = !preferences.unsubscribed_all
          const supportEmails = preferences.email_soporte_disabled === undefined
            ? true
            : !preferences.email_soporte_disabled
          const newsletterEmails = preferences.email_newsletter_disabled === undefined
            ? true
            : !preferences.email_newsletter_disabled
          setEmailPreferences({
            receive_emails: receiveEmails,
            support_emails: supportEmails,
            newsletter_emails: newsletterEmails
          })
        }
      } catch (error) {
        console.error('Error general cargando email preferences:', error)
      } finally {
        setEmailPrefLoading(false)
      }
    }

    loadEmailPreferences()
  }, [user, supabase])

  // 🆕 CARGAR PUSH NOTIFICATIONS
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
        
        // Cargar configuración de la base de datos
        const { data: settings, error } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error && error.code === 'PGRST116') {
          // No existe configuración, crear valores por defecto
          setPushNotifications({
            supported,
            permission,
            enabled: false,
            subscription: null,
            settings: null
          })
        } else if (error) {
          console.error('Error cargando configuración de push:', error)
          setPushNotifications({
            supported,
            permission,
            enabled: false,
            subscription: null,
            settings: null
          })
        } else {
          setPushNotifications({
            supported,
            permission,
            enabled: settings.push_enabled || false,
            subscription: settings.push_subscription ? JSON.parse(settings.push_subscription) : null,
            settings
          })
        }
      } catch (error) {
        console.error('Error general cargando push notifications:', error)
      } finally {
        setPushLoading(false)
      }
    }

    loadPushNotifications()
  }, [user, supabase])

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

        // Cargar perfil del usuario
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error cargando perfil:', profileError)
        } else if (profile) {
          setProfile(profile)

          // ✅ SINCRONIZAR CON userOposicion del hook
          // Migrar valor antiguo si es necesario
          let currentOposicion = userOposicion?.slug || profile.target_oposicion || ''
          if (currentOposicion === 'auxiliar-administrativo-estado') {
            currentOposicion = 'auxiliar_administrativo_estado' // Migrar al nuevo formato
          }

          setFormData({
            nickname: profile.nickname || getFirstName(user.user_metadata?.full_name),
            study_goal: profile.study_goal || 25,
            target_oposicion: currentOposicion,
            // Campos del onboarding
            age: profile.age?.toString() || '',
            gender: profile.gender || '',
            ciudad: profile.ciudad || '',
            daily_study_hours: profile.daily_study_hours?.toString() || ''
          })
          
        } else {
          // Crear perfil si no existe
          await createInitialProfile(user)
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
  }, [user, authLoading, supabase, oposicionLoading, userOposicion])

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

  // 🆕 GUARDAR EMAIL PREFERENCES - CON LÓGICA AUTOMÁTICA
  const saveEmailPreferences = async (newPreferences) => {
    if (!user || emailPrefSaving) return

    try {
      setEmailPrefSaving(true)

      // Convertir nuestra opción simple al formato de BD existente (TODOS los tipos)
      const receiveEmails = newPreferences.receive_emails
      const supportEmails = newPreferences.support_emails
      const newsletterEmails = newPreferences.newsletter_emails

      // Datos base (siempre existen)
      const updateData = {
        user_id: user.id,
        unsubscribed_all: !receiveEmails,
        email_reactivacion: receiveEmails,
        email_urgente: receiveEmails,
        email_bienvenida_motivacional: receiveEmails,
        email_bienvenida_inmediato: receiveEmails,
        email_resumen_semanal: receiveEmails,
        unsubscribed_at: receiveEmails ? null : new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Intentar guardar con las nuevas columnas
      let { error } = await supabase
        .from('email_preferences')
        .upsert({
          ...updateData,
          email_soporte_disabled: !supportEmails,
          email_newsletter_disabled: !newsletterEmails
        }, { onConflict: 'user_id' })

      // Si falla por columnas inexistentes, guardar solo los campos base
      if (error && error.message?.includes('column')) {
        console.warn('Columnas nuevas no existen aún, guardando solo campos base')
        const result = await supabase
          .from('email_preferences')
          .upsert(updateData, { onConflict: 'user_id' })
        error = result.error
      }

      if (error) throw error

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
  const handleEmailPrefChange = (value) => {
    if (!value) {
      // Desactivar todo
      const newPreferences = {
        receive_emails: false,
        support_emails: false,
        newsletter_emails: false
      }
      saveEmailPreferences(newPreferences)
    } else {
      // Activar emails de Vence y mantener las sub-opciones como estaban
      // (o activarlas si todas estaban desactivadas)
      const anySubOptionActive = emailPreferences.support_emails || emailPreferences.newsletter_emails
      const newPreferences = {
        receive_emails: true,
        support_emails: anySubOptionActive ? emailPreferences.support_emails : true,
        newsletter_emails: anySubOptionActive ? emailPreferences.newsletter_emails : true
      }
      saveEmailPreferences(newPreferences)
    }
  }

  // 🆕 MANEJAR CAMBIOS EN SOPORTE
  // Si se activa y "Emails de Vence" está desactivado, activarlo automáticamente
  // Si se desactiva y es la última opción activa, desactivar "Emails de Vence"
  const handleSupportEmailChange = (value) => {
    const newNewsletterEmails = emailPreferences.newsletter_emails

    // Si activamos soporte y Vence está desactivado, activar Vence
    const newReceiveEmails = value ? true : (newNewsletterEmails ? emailPreferences.receive_emails : false)

    const newPreferences = {
      receive_emails: newReceiveEmails,
      support_emails: value,
      newsletter_emails: newNewsletterEmails
    }
    saveEmailPreferences(newPreferences)
  }

  // 🆕 MANEJAR CAMBIOS EN NEWSLETTER
  // Misma lógica que soporte
  const handleNewsletterEmailChange = (value) => {
    const newSupportEmails = emailPreferences.support_emails

    // Si activamos newsletter y Vence está desactivado, activar Vence
    const newReceiveEmails = value ? true : (newSupportEmails ? emailPreferences.receive_emails : false)

    const newPreferences = {
      receive_emails: newReceiveEmails,
      support_emails: newSupportEmails,
      newsletter_emails: value
    }
    saveEmailPreferences(newPreferences)
  }

  // 🆕 FUNCIONES PARA PUSH NOTIFICATIONS
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
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          })
          
          // Track subscription created
          await notificationTracker.trackSubscriptionCreated(user, subscription)
        }

        // Guardar en base de datos
        const settingsData = {
          user_id: user.id,
          push_enabled: true,
          push_subscription: JSON.stringify(subscription),
          preferred_times: ['09:00', '14:00', '20:00'],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          frequency: 'smart',
          oposicion_type: 'auxiliar-administrativo',
          motivation_level: 'medium'
        }

        const { error } = await supabase
          .from('user_notification_settings')
          .upsert(settingsData, { onConflict: 'user_id' })

        if (error) throw error

        // Track settings updated
        await notificationTracker.trackSettingsUpdated(user, settingsData)

        // Actualizar estado local
        setPushNotifications(prev => ({
          ...prev,
          permission,
          enabled: true,
          subscription,
          settings: settingsData
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
      // Actualizar en base de datos
      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: user.id,
          push_enabled: false
        }, { onConflict: 'user_id' })

      if (error) throw error

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
  function urlBase64ToUint8Array(base64String) {
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
  const getFirstName = (fullName) => {
    if (!fullName) return ''
    return fullName.split(' ')[0] || ''
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
          oposicionData = JSON.stringify(selectedOposicion.data)
        }
      }
      
      const updateData = {
        nickname: formData.nickname.trim(),
        study_goal: parseInt(formData.study_goal),
        target_oposicion: formData.target_oposicion,
        target_oposicion_data: oposicionData,
        // Campos del onboarding
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        ciudad: formData.ciudad.trim() || null,
        daily_study_hours: formData.daily_study_hours ? parseInt(formData.daily_study_hours) : null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) throw error

      // Actualizar el perfil local
      setProfile(prev => ({
        ...prev,
        ...updateData
      }))

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
  const extractAvatarData = (metadata) => {
    if (!metadata) return { type: 'default' }

    // Avatar personalizado (imagen subida)
    if (metadata.avatar_type === 'custom' && metadata.avatar_url) {
      return {
        type: 'custom',
        url: metadata.avatar_url
      }
    }

    // Avatar predefinido (emoji)
    if (metadata.avatar_type === 'predefined' && metadata.avatar_emoji) {
      return {
        type: 'predefined',
        emoji: metadata.avatar_emoji,
        color: metadata.avatar_color,
        name: metadata.avatar_name
      }
    }

    return { type: 'default' }
  }

  // Callback cuando cambia el avatar
  const handleAvatarChange = (newAvatarData) => {
    setCurrentAvatar(newAvatarData)
    setMessage('✅ Avatar actualizado')
    setTimeout(() => setMessage(''), 2000)
  }

  const createInitialProfile = async (user) => {
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
        study_goal: data.study_goal || 25,
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
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Función auxiliar para cambios directos (no desde eventos)
  const handleDirectChange = (name, value) => {
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

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    }

    const getStatusBadge = (status) => {
      const badges = {
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
                    {subscriptionData.subscription.planIntervalCount > 1 ? 'es' : ''}
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
                    <span>⚙️</span>
                    <span>Gestionar Suscripción</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <span className="text-blue-500 mt-0.5">💡</span>
                <div>
                  <h5 className="font-medium text-blue-800 dark:text-blue-200">Portal de gestión</h5>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Desde el portal de Stripe puedes actualizar tu método de pago, ver facturas anteriores,
                    o cancelar tu suscripción.
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
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 dark:border-gray-600 rounded-lg dark:bg-gray-700 p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800">
                  Emails de Vence
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {emailPreferences.receive_emails ? (
                    <>Recibes todos los tipos: bienvenida, reactivación, urgentes, resumenes semanales y noticias</>
                  ) : (
                    <>No recibes ningún email de Vence (todos los tipos desactivados)</>
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailPreferences.receive_emails}
                  onChange={(e) => handleEmailPrefChange(e.target.checked)}
                  disabled={emailPrefSaving}
                  className="sr-only peer"
                />
                <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:bg-green-500 transition-colors">
                  <div className="absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform peer-checked:translate-x-7 flex items-center justify-center">
                    {emailPreferences.receive_emails ? (
                      <span className="text-xs text-green-600">✓</span>
                    ) : (
                      <span className="text-xs text-gray-400">✕</span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Opción específica para emails de soporte */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800 dark:text-white">
                  💬 Emails de Soporte
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {emailPreferences.support_emails ? (
                    <>Recibes emails cuando el equipo responde a tus consultas e impugnaciones</>
                  ) : (
                    <>No recibes emails de respuestas del equipo de soporte</>
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailPreferences.support_emails}
                  onChange={(e) => handleSupportEmailChange(e.target.checked)}
                  disabled={emailPrefSaving}
                  className="sr-only peer"
                />
                <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-500 transition-colors">
                  <div className="absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform peer-checked:translate-x-7 flex items-center justify-center">
                    {emailPreferences.support_emails ? (
                      <span className="text-xs text-blue-600">✓</span>
                    ) : (
                      <span className="text-xs text-gray-400">✕</span>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Opción específica para emails de newsletter */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800 dark:text-white">
                  📰 Newsletter de tu Oposición
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {emailPreferences.newsletter_emails ? (
                    <>Recibes información relevante y novedades sobre tu oposición</>
                  ) : (
                    <>No recibes emails con novedades de tu oposición</>
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailPreferences.newsletter_emails}
                  onChange={(e) => handleNewsletterEmailChange(e.target.checked)}
                  disabled={emailPrefSaving}
                  className="sr-only peer"
                />
                <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:bg-purple-500 transition-colors">
                  <div className="absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-6 w-6 transition-transform peer-checked:translate-x-7 flex items-center justify-center">
                    {emailPreferences.newsletter_emails ? (
                      <span className="text-xs text-purple-600">✓</span>
                    ) : (
                      <span className="text-xs text-gray-400">✕</span>
                    )}
                  </div>
                </div>
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

  // 🆕 COMPONENTE EMAIL PREFERENCES (LEGACY - MANTENER POR COMPATIBILIDAD)
  const EmailPreferencesTab = () => {
    if (emailPrefLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Cargando preferencias...</span>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            📧 Configuración de Emails
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Gestiona qué emails quieres recibir de iLoveTest. Puedes desactivar todos o configurar cada tipo por separado.
          </p>
        </div>

        {/* Desactivar todos los emails */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">🚫 Desactivar todos los emails</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">No recibirás ningún email automático de iLoveTest</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailPreferences.unsubscribed_all}
                onChange={(e) => handleEmailPrefChange('unsubscribed_all', e.target.checked)}
                disabled={emailPrefSaving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
        </div>

        {/* Configuración individual */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-800">📋 Configuración por tipo de email</h4>
          
          {/* Email de reactivación */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-blue-500">🔄</span>
                <h5 className="font-medium text-gray-800">Emails de Reactivación</h5>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Te recordamos volver cuando llevas 7-13 días sin estudiar
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailPreferences.email_reactivacion && !emailPreferences.unsubscribed_all}
                onChange={(e) => handleEmailPrefChange('email_reactivacion', e.target.checked)}
                disabled={emailPrefSaving || emailPreferences.unsubscribed_all}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 peer-disabled:opacity-50"></div>
            </label>
          </div>

          {/* Email urgente */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-red-500">🚨</span>
                <h5 className="font-medium text-gray-800">Emails Urgentes</h5>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Recordatorio más fuerte cuando llevas 14+ días sin estudiar
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailPreferences.email_urgente && !emailPreferences.unsubscribed_all}
                onChange={(e) => handleEmailPrefChange('email_urgente', e.target.checked)}
                disabled={emailPrefSaving || emailPreferences.unsubscribed_all}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 peer-disabled:opacity-50"></div>
            </label>
          </div>

          {/* Email de bienvenida motivacional */}
          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-green-500">🚀</span>
                <h5 className="font-medium text-gray-800">Emails de Motivación</h5>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Te ayudamos a dar el primer paso si te registraste pero no has empezado
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailPreferences.email_bienvenida_motivacional && !emailPreferences.unsubscribed_all}
                onChange={(e) => handleEmailPrefChange('email_bienvenida_motivacional', e.target.checked)}
                disabled={emailPrefSaving || emailPreferences.unsubscribed_all}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        {/* Información adicional */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <span className="text-blue-500 mt-0.5">💡</span>
            <div>
              <h5 className="font-medium text-blue-800">¿Por qué estos emails?</h5>
              <p className="text-sm text-blue-700 mt-1">
                Los emails automáticos te ayudan a mantener la constancia en tu preparación. 
                Están diseñados para motivarte y recordarte volver cuando más lo necesitas.
              </p>
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
                <div className="mb-4">
                  <AvatarChanger
                    user={user}
                    currentAvatar={currentAvatar}
                    onAvatarChange={handleAvatarChange}
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  {formData.nickname || getFirstName(user.user_metadata?.full_name) || 'Usuario'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{user.email}</p>
                
                {/* Estadísticas básicas */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">
                      {formData.target_oposicion ? '1' : '0'}
                    </div>
                    <div className="text-xs text-blue-500">Oposición</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {formData.study_goal}
                    </div>
                    <div className="text-xs text-green-500">Meta diaria</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enlaces rápidos */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mt-6">
              <h4 className="font-bold text-gray-800 dark:text-white mb-4">🔗 Enlaces Rápidos</h4>
              <div className="space-y-2">
                <Link
                  href="/mis-estadisticas"
                  className="flex items-center space-x-3 p-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span>📊</span>
                  <span>Mis Estadísticas</span>
                </Link>
                <Link
                  href="/auxiliar-administrativo-estado/test"
                  className="flex items-center space-x-3 p-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span>🎯</span>
                  <span>Hacer Tests</span>
                </Link>
                <Link
                  href="/auxiliar-administrativo-estado/temario"
                  className="flex items-center space-x-3 p-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span>📚</span>
                  <span>Ver Temario</span>
                </Link>
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