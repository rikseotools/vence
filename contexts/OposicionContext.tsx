// contexts/OposicionContext.tsx
// Context Provider para gestionar la oposición del usuario globalmente

'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { OPOSICIONES, ALL_OPOSICION_IDS, type NavLink } from '@/lib/config/oposiciones'

const supabase = getSupabaseClient()

// ============================================
// TIPOS
// ============================================

export interface OposicionMenu {
  name: string
  shortName: string
  badge: string
  color: string
  icon: string
  navLinks: NavLink[]
}

export interface OposicionData {
  id: string
  name: string
}

export interface NotificationData {
  type?: string
  name?: string
  message?: string
}

export interface OposicionContextValue {
  userOposicion: OposicionData | null
  oposicionId: string | null
  oposicionMenu: OposicionMenu
  loading: boolean
  hasOposicion: boolean
  showNotification: boolean
  notificationData: NotificationData | null
  dismissNotification: () => void
  changeOposicion: (newOposicionId: string, showNotificationFlag?: boolean) => Promise<boolean>
  showOposicionChangeNotification: (oposicionName: string) => void
  needsOposicionFix: boolean
}

// ============================================
// CONFIGURACIÓN DE MENÚS
// ============================================

const OPOSICION_MENUS: Record<string, OposicionMenu> = Object.fromEntries(
  OPOSICIONES.map(o => [o.id, {
    name: o.name,
    shortName: o.shortName,
    badge: o.badge,
    color: o.color,
    icon: o.emoji,
    navLinks: o.navLinks,
  }])
)

const DEFAULT_MENU: OposicionMenu = {
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

// ============================================
// CONTEXT
// ============================================

const OposicionContext = createContext<OposicionContextValue>({
  userOposicion: null,
  oposicionId: null,
  oposicionMenu: DEFAULT_MENU,
  loading: true,
  hasOposicion: false,
  showNotification: false,
  notificationData: null,
  dismissNotification: () => {},
  changeOposicion: async () => false,
  showOposicionChangeNotification: () => {},
  needsOposicionFix: false
})

// ============================================
// PROVIDER
// ============================================

export function OposicionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const pathname = usePathname()
  const [userOposicion, setUserOposicion] = useState<OposicionData | null>(null)
  const [oposicionId, setOposicionId] = useState<string | null>(null)
  const [oposicionMenu, setOposicionMenu] = useState<OposicionMenu>(DEFAULT_MENU)
  const [loading, setLoading] = useState(true)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationData, setNotificationData] = useState<NotificationData | null>(null)
  const [needsOposicionFix, setNeedsOposicionFix] = useState(false)

  // Cargar oposición del usuario cuando cambie el user del AuthContext
  useEffect(() => {
    async function loadUserOposicion() {
      try {
        setLoading(true)

        if (!user) {
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
          setLoading(false)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('target_oposicion, target_oposicion_data')
          .eq('id', user.id)
          .single()

        if (profileError || !profile?.target_oposicion) {
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
          setNeedsOposicionFix(false)
        } else {
          const opoId = profile.target_oposicion

          // Detectar datos sucios: UUIDs, JSON, slugs desconocidos
          const isValidOposicion = ALL_OPOSICION_IDS.includes(opoId)

          if (!isValidOposicion) {
            console.warn('⚠️ [OposicionContext] target_oposicion inválido:', opoId)
            setNeedsOposicionFix(true)
            setUserOposicion(null)
            setOposicionId(null)
            setOposicionMenu(DEFAULT_MENU)
          } else {
            setNeedsOposicionFix(false)
            // NOTA: target_oposicion_data es JSONB, Supabase lo devuelve como objeto
            const oposicionData = (profile.target_oposicion_data as OposicionData | null) || null

            setUserOposicion(oposicionData)
            setOposicionId(opoId)

            const menuConfig = OPOSICION_MENUS[opoId] || DEFAULT_MENU
            setOposicionMenu(menuConfig)
          }
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

    if (!authLoading) {
      loadUserOposicion()
    }
  }, [user, authLoading, pathname])

  // Recargar oposición cuando se cambia desde perfil u otro componente
  useEffect(() => {
    const handleOposicionAssigned = () => {
      if (user && !authLoading) {
        // Re-fetch from DB to update context (including needsOposicionFix)
        ;(async () => {
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('target_oposicion, target_oposicion_data')
              .eq('id', user.id)
              .single()

            if (profile?.target_oposicion) {
              const opoId = profile.target_oposicion
              const isValid = ALL_OPOSICION_IDS.includes(opoId)

              if (!isValid) {
                setNeedsOposicionFix(true)
                setUserOposicion(null)
                setOposicionId(null)
                setOposicionMenu(DEFAULT_MENU)
              } else {
                setNeedsOposicionFix(false)
                const oposicionData = (profile.target_oposicion_data as OposicionData | null) || null
                setUserOposicion(oposicionData)
                setOposicionId(opoId)
                setOposicionMenu(OPOSICION_MENUS[opoId] || DEFAULT_MENU)
              }
            }
          } catch (error) {
            console.warn('Error recargando oposición tras cambio:', error)
          }
        })()
      }
    }

    window.addEventListener('oposicionAssigned', handleOposicionAssigned)
    return () => window.removeEventListener('oposicionAssigned', handleOposicionAssigned)
  }, [user, authLoading])

  // Verificar si hay notificación de cambio de oposición pendiente
  useEffect(() => {
    // Notificación de onboarding (asignación inicial)
    const newAssignment = localStorage.getItem('newOposicionAssigned')
    if (newAssignment) {
      const data = JSON.parse(newAssignment) as { timestamp: number }
      const timeDiff = Date.now() - data.timestamp

      if (timeDiff < 5 * 60 * 1000) {
        setShowNotification(true)
        setNotificationData(data as NotificationData)

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
      const data = JSON.parse(oposicionChanged) as { timestamp: number; message?: string }
      const timeDiff = Date.now() - data.timestamp

      if (timeDiff < 30 * 1000) {
        localStorage.removeItem('oposicionChanged')
        setShowNotification(true)
        setNotificationData({
          type: 'oposicionChanged',
          message: data.message
        })

        setTimeout(() => {
          setShowNotification(false)
        }, 5000)
      } else {
        localStorage.removeItem('oposicionChanged')
      }
    }
  }, [pathname])

  const changeOposicion = async (newOposicionId: string, showNotificationFlag = true): Promise<boolean> => {
    if (!user) {
      return false
    }

    try {
      const menuConfig = OPOSICION_MENUS[newOposicionId]
      const oposicionName = menuConfig?.name || 'Nueva Oposición'

      const newOposicionData: OposicionData = {
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

      setUserOposicion(newOposicionData)
      setOposicionId(newOposicionId)
      setOposicionMenu(menuConfig || DEFAULT_MENU)
      setNeedsOposicionFix(false)

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

  const showOposicionChangeNotification = (oposicionName: string) => {
    setShowNotification(true)
    setNotificationData({
      type: 'oposicionChanged',
      name: oposicionName,
      message: `Tu oposición objetivo se ha cambiado a ${oposicionName}`
    })

    setTimeout(() => {
      setShowNotification(false)
      setNotificationData(null)
    }, 5000)
  }

  const value: OposicionContextValue = {
    userOposicion,
    oposicionId,
    oposicionMenu,
    loading,
    hasOposicion: !!userOposicion,
    showNotification,
    notificationData,
    dismissNotification,
    changeOposicion,
    showOposicionChangeNotification,
    needsOposicionFix
  }

  return (
    <OposicionContext.Provider value={value}>
      {children}
    </OposicionContext.Provider>
  )
}

// Hook para usar el contexto
export function useOposicion(): OposicionContextValue {
  const context = useContext(OposicionContext)

  if (context === undefined) {
    throw new Error('useOposicion debe usarse dentro de un OposicionProvider')
  }

  return context
}
