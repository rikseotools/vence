// components/useUserOposicion.tsx - CORREGIDO PARA USAR EL CAMPO CORRECTO
// Hook para leer la oposición YA ASIGNADA del usuario

'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface NavLink {
  href: string
  label: string
  icon: string
  featured?: boolean
}

interface OposicionMenuConfig {
  name: string
  shortName: string
  badge: string
  color: string
  icon: string
  navLinks: NavLink[]
}

interface OposicionData {
  name: string
  slug: string
  [key: string]: unknown
}

// Configuración de menús por oposición - SOPORTA AMBOS FORMATOS
const OPOSICION_MENUS: Record<string, OposicionMenuConfig> = {
  'auxiliar-administrativo-estado': {
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
  // SOPORTE PARA FORMATO CON UNDERSCORES (BD)
  'auxiliar_administrativo_estado': {
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
  'administrativo-estado': {
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
  'administrativo_estado': {
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
  'gestion-procesal': {
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
  },
  'gestion_procesal': {
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

// Menú genérico para usuarios sin oposición
const DEFAULT_MENU: OposicionMenuConfig = {
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

export function useUserOposicion() {
  const { user, userProfile, supabase, loading: authLoading } = useAuth() as {
    user: { id: string } | null
    userProfile: Record<string, unknown> | null
    supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => Promise<{ error: Error | null }> } } }
    loading: boolean
  }
  const [userOposicion, setUserOposicion] = useState<OposicionData | null>(null)
  const [oposicionMenu, setOposicionMenu] = useState<OposicionMenuConfig>(DEFAULT_MENU)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function loadUserOposicion() {
      try {
        setLoading(true)

        // 1. Esperar a que termine la autenticación
        if (authLoading) {
          // Esperando auth...
          return
        }

        if (!user) {
          // Usuario no autenticado - menú genérico
          setUserOposicion(null)
          setOposicionMenu(DEFAULT_MENU)
          setLoading(false)
          return
        }

        // 2. Esperar a que el perfil esté cargado desde AuthContext
        if (userProfile === null) {
          // Aún cargando el perfil, esperar
          return
        }

        // Usuario autenticado

        // 3. Usar userProfile del AuthContext (evita query que puede fallar con 406)
        const profile = userProfile

        if (!profile?.target_oposicion) {
          // Usuario sin oposición - menú genérico
          setUserOposicion(null)
          setOposicionMenu(DEFAULT_MENU)
        } else {
          // 3. Usuario con oposición asignada
          const oposicionId = profile.target_oposicion as string
          // NOTA: target_oposicion_data es JSONB, Supabase lo devuelve como objeto
          const oposicionData = (profile.target_oposicion_data as OposicionData | null) || null

          setUserOposicion(oposicionData)

          // 4. Configurar menú personalizado
          const menuConfig = OPOSICION_MENUS[oposicionId] || DEFAULT_MENU
          setOposicionMenu(menuConfig)
        }

      } catch (error) {
        console.error('Error general cargando oposición de usuario:', error)
        setUserOposicion(null)
        setOposicionMenu(DEFAULT_MENU)
      } finally {
        setLoading(false)
      }
    }

    loadUserOposicion()

    // Escuchar asignación de nueva oposición
    const handleOposicionAssigned = () => {
      // Nueva oposición asignada - recargar
      loadUserOposicion()
    }

    window.addEventListener('oposicionAssigned', handleOposicionAssigned)

    return () => {
      window.removeEventListener('oposicionAssigned', handleOposicionAssigned)
    }
  }, [user, userProfile, authLoading, supabase])

  // Función para cambiar oposición manualmente
  const changeOposicion = async (newOposicionId: string): Promise<boolean> => {
    if (!user) return false

    try {
      // Preparar datos básicos de la oposición
      const oposicionData: OposicionData = {
        name: OPOSICION_MENUS[newOposicionId]?.name || 'Oposición',
        slug: newOposicionId
      }

      // NOTA: target_oposicion_data es JSONB, no necesita JSON.stringify
      const { error } = await supabase
        .from('user_profiles')
        .update({
          target_oposicion: newOposicionId,
          target_oposicion_data: oposicionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      // Recargar datos
      setUserOposicion(oposicionData)
      setOposicionMenu(OPOSICION_MENUS[newOposicionId] || DEFAULT_MENU)

      // Disparar evento para otros componentes
      window.dispatchEvent(new CustomEvent('oposicionAssigned'))
      window.dispatchEvent(new CustomEvent('profileUpdated'))

      return true
    } catch (error) {
      console.error('Error cambiando oposición:', error)
      return false
    }
  }

  return {
    userOposicion,
    oposicionMenu,
    loading,
    user,
    changeOposicion,
    hasOposicion: !!userOposicion
  }
}

interface NotificationData {
  timestamp: number
  [key: string]: unknown
}

// Helper para detectar si necesita mostrar notificación de bienvenida
export function useNewOposicionNotification() {
  const [showNotification, setShowNotification] = useState(false)
  const [notificationData, setNotificationData] = useState<NotificationData | null>(null)

  useEffect(() => {
    // Verificar si hay una nueva asignación reciente
    const newAssignment = localStorage.getItem('newOposicionAssigned')

    if (newAssignment) {
      const data: NotificationData = JSON.parse(newAssignment)
      const timeDiff = Date.now() - data.timestamp

      // Mostrar solo si es reciente (menos de 5 minutos)
      if (timeDiff < 5 * 60 * 1000) {
        setShowNotification(true)
        setNotificationData(data)

        // Limpiar después de mostrar
        setTimeout(() => {
          localStorage.removeItem('newOposicionAssigned')
          setShowNotification(false)
        }, 10000) // 10 segundos
      } else {
        localStorage.removeItem('newOposicionAssigned')
      }
    }
  }, [])

  const dismissNotification = () => {
    setShowNotification(false)
    localStorage.removeItem('newOposicionAssigned')
  }

  return {
    showNotification,
    notificationData,
    dismissNotification
  }
}
