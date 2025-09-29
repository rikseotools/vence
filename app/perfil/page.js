// app/perfil/page.js - CON PESTAÑAS Y EMAIL PREFERENCES
'use client'
import { useState, useEffect, useRef } from 'react'
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
    receive_emails: true // Una sola opción simple
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
  
  // Para evitar guardado en primera carga
  const isInitialLoad = useRef(true)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Form data - SINCRONIZADO CON useUserOposicion
  const [formData, setFormData] = useState({
    nickname: '',
    study_goal: 25,
    target_oposicion: ''
  })

  // Oposiciones disponibles
  const oposiciones = [
    { value: '', label: 'Ninguna seleccionada' },
    { 
      value: 'auxiliar-administrativo-estado', 
      label: 'Auxiliar Administrativo del Estado',
      data: {
        name: 'Auxiliar Administrativo del Estado',
        slug: 'auxiliar-administrativo-estado'
      }
    },
    { 
      value: 'auxiliar_administrativo_estado', 
      label: 'Auxiliar Administrativo del Estado (BD)',
      data: {
        name: 'Auxiliar Administrativo del Estado',
        slug: 'auxiliar-administrativo-estado'
      }
    }
  ]

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
            receive_emails: true // Por defecto, recibir emails
          })
        } else if (error) {
          console.error('Error cargando preferencias de email:', error)
          setEmailPreferences({ receive_emails: true })
        } else {
          // Mapear las preferencias complejas a nuestra opción simple
          const receiveEmails = !preferences.unsubscribed_all
          setEmailPreferences({
            receive_emails: receiveEmails
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
          const currentOposicion = userOposicion?.slug || profile.target_oposicion || ''
          
          setFormData({
            nickname: profile.nickname || getFirstName(user.user_metadata?.full_name),
            study_goal: profile.study_goal || 25,
            target_oposicion: currentOposicion
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
    // No detectar cambios en la carga inicial
    if (isInitialLoad.current || !user || !profile) return
    
    // Verificar si hay cambios REALES
    const currentNickname = profile.nickname || ''
    const currentStudyGoal = profile.study_goal || 25
    const currentOposicion = profile.target_oposicion || ''
    
    const hasRealChanges = 
      formData.nickname.trim() !== currentNickname ||
      parseInt(formData.study_goal) !== currentStudyGoal ||
      formData.target_oposicion !== currentOposicion
    
    setHasChanges(hasRealChanges)
  }, [formData.nickname, formData.study_goal, formData.target_oposicion, user, profile])

  // 🆕 GUARDAR EMAIL PREFERENCES - SIMPLIFICADO
  const saveEmailPreferences = async (newPreferences) => {
    if (!user || emailPrefSaving) return
    
    try {
      setEmailPrefSaving(true)
      
      // Convertir nuestra opción simple al formato de BD existente
      const updateData = {
        user_id: user.id,
        unsubscribed_all: !newPreferences.receive_emails,
        email_reactivacion: newPreferences.receive_emails,
        email_urgente: newPreferences.receive_emails,
        email_bienvenida_motivacional: newPreferences.receive_emails,
        updated_at: new Date().toISOString()
      }

      // Usar upsert para simplicidad
      const { error } = await supabase
        .from('email_preferences')
        .upsert(updateData, { onConflict: 'user_id' })

      if (error) throw error

      setEmailPreferences(newPreferences)
      setMessage(`✅ ${newPreferences.receive_emails ? 'Activados' : 'Desactivados'} los emails`)
      setTimeout(() => setMessage(''), 3000)

    } catch (error) {
      console.error('Error guardando preferencias de email:', error)
      setMessage('❌ Error al guardar las preferencias')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setEmailPrefSaving(false)
    }
  }

  // 🆕 MANEJAR CAMBIOS EN EMAIL PREFERENCES - SIMPLIFICADO
  const handleEmailPrefChange = (value) => {
    const newPreferences = { receive_emails: value }
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
        target_oposicion: data.target_oposicion || ''
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

  // Obtener nombre de la oposición seleccionada
  const getSelectedOposicionName = () => {
    if (!formData.target_oposicion) return null
    
    const selected = oposiciones.find(op => op.value === formData.target_oposicion)
    if (selected) return selected.label
    
    // Fallback: usar datos del hook si están disponibles
    if (userOposicion?.name) return userOposicion.name
    
    return null
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🔔 Configuración de Notificaciones
          </h3>
          <p className="text-gray-600 mb-6">
            Gestiona todas tus notificaciones en un solo lugar. Configura tanto las notificaciones push del navegador como los emails automáticos.
          </p>
        </div>

        {/* NOTIFICACIONES PUSH */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">📱</span>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Notificaciones Push</h4>
              <p className="text-sm text-gray-600">Recordatorios directos en tu navegador</p>
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
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium text-gray-800">
                      Notificaciones Push
                    </h5>
                    <p className="text-sm text-gray-600">
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
              <h4 className="text-lg font-semibold text-gray-800">Emails de ILoveTest</h4>
              <p className="text-sm text-gray-600">Recibe alertas y noticias para tu oposición</p>
            </div>
          </div>

          {/* Opción única simplificada */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-gray-800">
                  Recibir emails, incluidas alertas y noticias para tu oposición
                </h5>
                <p className="text-sm text-gray-600">
                  {emailPreferences.receive_emails ? (
                    <>Recibes emails útiles para tu preparación</>
                  ) : (
                    <>No recibes ningún email de ILoveTest</>
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            📧 Configuración de Emails
          </h3>
          <p className="text-gray-600 mb-6">
            Gestiona qué emails quieres recibir de iLoveTest. Puedes desactivar todos o configurar cada tipo por separado.
          </p>
        </div>

        {/* Desactivar todos los emails */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-800">🚫 Desactivar todos los emails</h4>
              <p className="text-sm text-gray-600">No recibirás ningún email automático de iLoveTest</p>
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
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-blue-500">🔄</span>
                <h5 className="font-medium text-gray-800">Emails de Reactivación</h5>
              </div>
              <p className="text-sm text-gray-600 mt-1">
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
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-red-500">🚨</span>
                <h5 className="font-medium text-gray-800">Emails Urgentes</h5>
              </div>
              <p className="text-sm text-gray-600 mt-1">
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
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-green-500">🚀</span>
                <h5 className="font-medium text-gray-800">Emails de Motivación</h5>
              </div>
              <p className="text-sm text-gray-600 mt-1">
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
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Acceso Requerido
          </h2>
          <p className="text-gray-600 mb-6">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                👤 Mi Perfil
              </h1>
              <p className="text-gray-600">
                Gestiona tu información personal y preferencias
              </p>
            </div>
          </div>

          {/* Barra de estado flotante */}
          {(message || saving || emailPrefSaving || pushSaving) && (
            <div className="fixed top-4 right-4 z-50">
              <div className={`px-4 py-2 rounded-lg shadow-lg ${
                message.includes('✅') 
                  ? 'bg-green-500 text-white'
                  : (saving || emailPrefSaving || pushSaving)
                    ? 'bg-blue-500 text-white'
                    : 'bg-red-500 text-white'
              }`}>
                {saving ? '💾 Guardando perfil...' : 
                 emailPrefSaving ? '📧 Guardando preferencias...' :
                 pushSaving ? '🔔 Configurando notificaciones...' :
                 message}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna izquierda - Info del usuario */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center">
                {/* Avatar con cambio de avatar */}
                <div className="mb-4">
                  <AvatarChanger
                    user={user}
                    currentAvatar={currentAvatar}
                    onAvatarChange={handleAvatarChange}
                  />
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {formData.nickname || getFirstName(user.user_metadata?.full_name) || 'Usuario'}
                </h3>
                <p className="text-gray-600 mb-4">{user.email}</p>
                
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
            <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
              <h4 className="font-bold text-gray-800 mb-4">🔗 Enlaces Rápidos</h4>
              <div className="space-y-2">
                <Link 
                  href="/mis-estadisticas"
                  className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span>📊</span>
                  <span>Mis Estadísticas</span>
                </Link>
                <Link 
                  href="/auxiliar-administrativo-estado/test"
                  className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span>🎯</span>
                  <span>Hacer Tests</span>
                </Link>
                <Link 
                  href="/auxiliar-administrativo-estado/temario"
                  className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span>📚</span>
                  <span>Ver Temario</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Columna derecha - Pestañas */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              
              {/* 🆕 SISTEMA DE PESTAÑAS */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('general')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'general'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    ⚙️ General
                  </button>
                  <button
                    onClick={() => setActiveTab('notificaciones')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'notificaciones'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    🔔 Notificaciones
                  </button>
                </nav>
              </div>

              {/* CONTENIDO DE LAS PESTAÑAS */}
              {activeTab === 'general' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      ⚙️ Configuración del Perfil
                    </h2>
                    {hasChanges && (
                      <button
                        onClick={saveProfile}
                        disabled={saving}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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

                  <div className="space-y-6">
                    
                    {/* Información Personal */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        👤 Información Personal
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nombre Completo (Google)
                          </label>
                          <input
                            type="text"
                            value={user.user_metadata?.full_name || 'No disponible'}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Este es tu nombre de Google y no se puede editar
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nickname (Nombre para mostrar)
                          </label>
                          <input
                            type="text"
                            name="nickname"
                            value={formData.nickname}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`Por ejemplo: ${getFirstName(user.user_metadata?.full_name) || 'Tu nombre preferido'}`}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Si no lo completas, usaremos "{getFirstName(user.user_metadata?.full_name) || 'tu primer nombre'}"
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email (No editable)
                          </label>
                          <input
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preferencias de Estudio */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        📚 Preferencias de Estudio
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            🎯 Oposición Objetivo
                          </label>
                          <select
                            name="target_oposicion"
                            value={formData.target_oposicion}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {oposiciones.map(oposicion => (
                              <option key={oposicion.value} value={oposicion.value}>
                                {oposicion.label}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Selecciona la oposición que estás preparando
                          </p>

                          {/* Mostrar oposición actual si está seleccionada */}
                          {formData.target_oposicion && (
                            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-600">🎯</span>
                                <div>
                                  <div className="text-sm font-medium text-emerald-800">
                                    Estudiando actualmente
                                  </div>
                                  <div className="text-sm text-emerald-700">
                                    {getSelectedOposicionName()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            📊 Meta Diaria (preguntas)
                          </label>
                          <input
                            type="number"
                            name="study_goal"
                            value={formData.study_goal}
                            onChange={handleInputChange}
                            min="5"
                            max="100"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Número de preguntas que quieres responder cada día
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Avatar Actual */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
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
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        🔐 Información de Cuenta
                      </h3>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Registrado:</span>
                            <span className="text-gray-600 ml-2">
                              {new Date(user.created_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Última actualización:</span>
                            <span className="text-gray-600 ml-2">
                              {profile?.updated_at ? 
                                new Date(profile.updated_at).toLocaleDateString('es-ES') : 
                                'Nunca'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Indicador de cambios sin guardar */}
                    {hasChanges && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-amber-800">
                          <span>⚠️</span>
                          <span className="font-medium">Cambios sin guardar</span>
                        </div>
                        <p className="text-amber-700 text-sm mt-1">
                          Tienes cambios pendientes. Haz clic en "Guardar Cambios" para aplicarlos.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 🆕 PESTAÑA DE NOTIFICACIONES */}
              {activeTab === 'notificaciones' && <NotificationsTab />}
              
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