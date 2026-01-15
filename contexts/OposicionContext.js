// contexts/OposicionContext.js
// 🎯 Context Provider para gestionar la oposición del usuario globalmente

'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from './AuthContext' // ← USAR AuthContext

const supabase = getSupabaseClient()

// 📋 Configuración de menús por oposición (sin cambios)
const OPOSICION_MENUS = {
  auxiliar_administrativo_estado: {
    name: 'Auxiliar Administrativo',
    shortName: 'Auxiliar Admin.',
    badge: 'C2',
    color: 'emerald',
    icon: '🏛️',
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-estado', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-estado/test', label: 'Tests', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/simulacros', label: 'Simulacros', icon: '🏆' }
    ]
  },
  administrativo_estado: {
    name: 'Administrativo Estado',
    shortName: 'Admin. Estado',
    badge: 'C1',
    color: 'blue',
    icon: '🏢',
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-estado', label: 'Mi Oposición', icon: '🏢', featured: true },
      { href: '/administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-estado/test', label: 'Tests', icon: '🎯' }
    ]
  },
  gestion_procesal: {
    name: 'Gestión Procesal',
    shortName: 'Gestión Proc.',
    badge: 'C1',
    color: 'purple',
    icon: '⚖️',
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/gestion-procesal', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/gestion-procesal/temario', label: 'Temario', icon: '📚' },
      { href: '/gestion-procesal/test', label: 'Tests', icon: '🎯' }
    ]
  }
}

// 📋 Menú genérico para usuarios sin oposición
const DEFAULT_MENU = {
  name: 'Explorar Oposiciones',
  shortName: 'Explorar',
  badge: '🎯',
  color: 'gray',
  icon: '🔍',
  navLinks: [
    { href: '/es', label: 'Inicio', icon: '🏠' },
    { href: '/auxiliar-administrativo-estado', label: 'Auxiliar Administrativo', icon: '🏛️', featured: true },
    { href: '/leyes', label: 'Leyes', icon: '📚' },
    { href: '/guardia-civil', label: 'Guardia Civil', icon: '🚔' },
    { href: '/policia-nacional', label: 'Policía Nacional', icon: '👮‍♂️' }
  ]
}

// 🎯 Crear el contexto
const OposicionContext = createContext({
  userOposicion: null,
  oposicionMenu: DEFAULT_MENU,
  loading: true,
  hasOposicion: false,
  showNotification: false,
  notificationData: null,
  dismissNotification: () => {},
  changeOposicion: () => {}
})

// 🎯 Provider del contexto - ARREGLADO PARA USAR AuthContext
export function OposicionProvider({ children }) {
  const { user, loading: authLoading } = useAuth() // ← USAR AuthContext
  const pathname = usePathname() // Para detectar cambios de ruta
  const [userOposicion, setUserOposicion] = useState(null)
  const [oposicionId, setOposicionId] = useState(null) // ID de la oposición (ej: 'auxiliar_administrativo_estado')
  const [oposicionMenu, setOposicionMenu] = useState(DEFAULT_MENU)
  const [loading, setLoading] = useState(true)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationData, setNotificationData] = useState(null)

  // 🔄 Cargar oposición del usuario cuando cambie el user del AuthContext
  useEffect(() => {
    async function loadUserOposicion() {
      try {
        setLoading(true)

        if (!user) {
          // Usuario no autenticado - menú genérico
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
          setLoading(false)
          return
        }

        // 2. Cargar oposición asignada
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('target_oposicion, target_oposicion_data')
          .eq('id', user.id)
          .single()

        if (profileError || !profile?.target_oposicion) {
          // Usuario sin oposición - menú genérico
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
        } else {
          // 3. Usuario con oposición asignada
          const opoId = profile.target_oposicion
          // NOTA: target_oposicion_data es JSONB, Supabase lo devuelve como objeto
          const oposicionData = profile.target_oposicion_data || null

          setUserOposicion(oposicionData)
          setOposicionId(opoId) // Guardar el ID (ej: 'auxiliar_administrativo_estado')

          // 4. Configurar menú personalizado
          const menuConfig = OPOSICION_MENUS[opoId] || DEFAULT_MENU
          setOposicionMenu(menuConfig)
        }

      } catch (error) {
        console.error('❌ Error cargando oposición de usuario:', error)
        setUserOposicion(null)
        setOposicionId(null)
        setOposicionMenu(DEFAULT_MENU)
      } finally {
        setLoading(false)
      }
    }

    // Solo cargar cuando authLoading termine
    if (!authLoading) {
      loadUserOposicion()
    }
  }, [user, authLoading, pathname]) // Recargar también cuando cambia la ruta

  // Verificar si hay notificación de cambio de oposición pendiente
  useEffect(() => {
    // Notificación de onboarding (asignación inicial)
    const newAssignment = localStorage.getItem('newOposicionAssigned')
    if (newAssignment) {
      const data = JSON.parse(newAssignment)
      const timeDiff = Date.now() - data.timestamp

      if (timeDiff < 5 * 60 * 1000) {
        setShowNotification(true)
        setNotificationData(data)

        setTimeout(() => {
          localStorage.removeItem('newOposicionAssigned')
          setShowNotification(false)
        }, 10000)
      } else {
        localStorage.removeItem('newOposicionAssigned')
      }
    }

    // Notificación de cambio de oposición desde breadcrumbs
    const oposicionChanged = localStorage.getItem('oposicionChanged')
    if (oposicionChanged) {
      const data = JSON.parse(oposicionChanged)
      const timeDiff = Date.now() - data.timestamp

      if (timeDiff < 30 * 1000) { // 30 segundos de validez
        localStorage.removeItem('oposicionChanged')
        setShowNotification(true)
        setNotificationData({
          type: 'oposicionChanged',
          message: data.message
        })

        // Ocultar después de 5 segundos
        setTimeout(() => {
          setShowNotification(false)
        }, 5000)
      } else {
        localStorage.removeItem('oposicionChanged')
      }
    }
  }, [pathname]) // Se ejecuta cada vez que cambia la ruta

  const changeOposicion = async (newOposicionId, showNotificationFlag = true) => {
    if (!user) {
      return false
    }

    try {
      // Obtener nombre legible de la oposición
      const menuConfig = OPOSICION_MENUS[newOposicionId]
      const oposicionName = menuConfig?.name || 'Nueva Oposición'

      const newOposicionData = {
        id: newOposicionId,
        name: oposicionName
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          target_oposicion: newOposicionId,
          target_oposicion_data: JSON.stringify(newOposicionData),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      // Oposición actualizada en BD
      setUserOposicion(newOposicionData)
      setOposicionMenu(menuConfig || DEFAULT_MENU)

      // Guardar en localStorage para mostrar notificación después de navegación
      if (showNotificationFlag) {
        localStorage.setItem('oposicionChanged', JSON.stringify({
          name: oposicionName,
          timestamp: Date.now()
        }))
      }

      return true
    } catch (error) {
      console.error('❌ Error cambiando oposición:', error)
      return false
    }
  }

  const dismissNotification = () => {
    setShowNotification(false)
    localStorage.removeItem('newOposicionAssigned')
    localStorage.removeItem('oposicionChanged')
  }

  // Función para mostrar notificación de cambio de oposición directamente
  const showOposicionChangeNotification = (oposicionName) => {
    setShowNotification(true)
    setNotificationData({
      type: 'oposicionChanged',
      name: oposicionName,
      message: `Tu oposición objetivo se ha cambiado a ${oposicionName}`
    })

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
      setShowNotification(false)
      setNotificationData(null)
    }, 5000)
  }

  const value = {
    userOposicion,
    oposicionId, // ID de la oposición (ej: 'auxiliar_administrativo_estado')
    oposicionMenu,
    loading,
    hasOposicion: !!userOposicion,
    showNotification,
    notificationData,
    dismissNotification,
    changeOposicion,
    showOposicionChangeNotification
  }

  return (
    <OposicionContext.Provider value={value}>
      {children}
    </OposicionContext.Provider>
  )
}

// 🎯 Hook para usar el contexto
export function useOposicion() {
  const context = useContext(OposicionContext)
  
  if (context === undefined) {
    throw new Error('useOposicion debe usarse dentro de un OposicionProvider')
  }
  
  return context
}
