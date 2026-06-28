// contexts/OposicionContext.tsx
// Context Provider para gestionar la oposición del usuario globalmente

'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { getAuthHeaders } from '../lib/api/authHeaders'
import { useAuth } from './AuthContext'
import { OPOSICIONES, ALL_OPOSICION_IDS, ALL_OPOSICION_SLUGS, type NavLink } from '@/lib/config/oposiciones'
import { setTargetOposicion } from '@/lib/api/setTargetOposicion'
import { decideOposicionLoad } from '@/lib/oposicion/decideLoad'

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
  changeOposicion: (newOposicionId: string | null, showNotificationFlag?: boolean) => Promise<boolean>
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

// Para usuarios sin oposición elegida (target_oposicion = null), el menú destacado
// (featured) debe apuntar a un slug de oposición REAL — no a /oposiciones (página de
// listado). Si apuntara a /oposiciones, el Header construiría '/oposiciones/test' →
// 404. Usar el primer slug oficial garantiza que Test/Temario carguen siempre.
const DEFAULT_FEATURED_SLUG = ALL_OPOSICION_SLUGS[0]
const DEFAULT_MENU: OposicionMenu = {
  name: 'Explorar Oposiciones',
  shortName: 'Explorar',
  badge: '🎯',
  color: 'gray',
  icon: '🔍',
  navLinks: [
    { href: '/es', label: 'Inicio', icon: '🏠' },
    { href: `/${DEFAULT_FEATURED_SLUG}`, label: 'Oposiciones', icon: '🏛️', featured: true },
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
    let cancelled = false

    async function loadUserOposicion(retry = 0): Promise<void> {
      if (!user) {
        if (cancelled) return
        setUserOposicion(null)
        setOposicionId(null)
        setOposicionMenu(DEFAULT_MENU)
        setLoading(false)
        return
      }

      try {
        if (retry === 0) setLoading(true)

        // Fase C1: vía endpoint Drizzle (user_id del token), no PostgREST/RLS.
        const headers = await getAuthHeaders()
        const res = await fetch('/api/v2/oposicion/target', { headers })

        // ⚠️ ROBUSTEZ (fix bug Nila, heavy user móvil): el endpoint SIEMPRE
        // devuelve 200 con target_oposicion:null para un usuario sin oposición.
        // Un no-2xx (401 por race del token al reanudar en móvil, 5xx por
        // saturación) NO significa "sin oposición": significa que la consulta
        // falló. NUNCA borrar la oposición conocida ante un fallo transitorio
        // —eso rompía tests en curso y mostraba "Selecciona tu oposición" en
        // falso—. Reintentar con backoff y, si se agota, MANTENER el estado
        // actual (mismo criterio que AuthContext con su perfil cacheado).
        if (!res.ok) {
          if (retry < 2 && !cancelled) {
            await new Promise(r => setTimeout(r, 600 * 2 ** retry))
            if (cancelled) return
            return loadUserOposicion(retry + 1)
          }
          console.warn(`⚠️ [OposicionContext] target fetch ${res.status} tras reintentos — mantengo oposición actual`)
          if (!cancelled) setLoading(false)
          return
        }

        const profile = await res.json()
        if (cancelled) return

        const opoId: string | null = profile?.target_oposicion ?? null
        const isValidOposicion = !!opoId && ALL_OPOSICION_IDS.includes(opoId)
        // res.ok es true aquí (el !res.ok se trató arriba con retry). El helper
        // PURO decide la acción; aquí solo la aplicamos. Ver lib/oposicion/decideLoad.
        const action = decideOposicionLoad(true, opoId, isValidOposicion)

        if (action === 'clear') {
          // 200 OK con target null = el usuario genuinamente no tiene oposición.
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
          setNeedsOposicionFix(false)
        } else if (action === 'invalid') {
          // Detectar datos sucios: UUIDs, JSON, slugs desconocidos
          console.warn('⚠️ [OposicionContext] target_oposicion inválido:', opoId)
          setNeedsOposicionFix(true)
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
        } else {
          // 'set'
          setNeedsOposicionFix(false)
          // NOTA: target_oposicion_data es JSONB, Supabase lo devuelve como objeto
          const oposicionData = (profile.target_oposicion_data as OposicionData | null) || null

          setUserOposicion(oposicionData)
          setOposicionId(opoId as string)

          const menuConfig = OPOSICION_MENUS[opoId as string] || DEFAULT_MENU
          setOposicionMenu(menuConfig)
        }
        if (!cancelled) setLoading(false)

      } catch (error) {
        // Error de red/excepción: mismo criterio — reintentar y, si se agota,
        // MANTENER el estado actual (NO nullear la oposición conocida).
        if (retry < 2 && !cancelled) {
          await new Promise(r => setTimeout(r, 600 * 2 ** retry))
          if (cancelled) return
          return loadUserOposicion(retry + 1)
        }
        console.error('❌ [OposicionContext] error cargando oposición tras reintentos — mantengo estado:', error)
        if (!cancelled) setLoading(false)
      }
    }

    if (!authLoading) {
      loadUserOposicion()
    }

    return () => { cancelled = true }
  }, [user, authLoading, pathname])

  // Recargar oposición cuando se cambia desde perfil u otro componente
  useEffect(() => {
    const handleOposicionAssigned = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const newOpoId = detail?.oposicionId || detail?.oposicion

      // Si el evento trae el ID, actualizar inmediatamente sin esperar fetch
      if (newOpoId) {
        const isValid = ALL_OPOSICION_IDS.includes(newOpoId)
        if (isValid) {
          setNeedsOposicionFix(false)
          setOposicionId(newOpoId)
          setOposicionMenu(OPOSICION_MENUS[newOpoId] || DEFAULT_MENU)
        } else {
          setNeedsOposicionFix(true)
          setUserOposicion(null)
          setOposicionId(null)
          setOposicionMenu(DEFAULT_MENU)
        }
        return
      }

      // Fallback: si no trae ID, refetch de BD
      if (user && !authLoading) {
        ;(async () => {
          try {
            const headers = await getAuthHeaders()
            const res = await fetch('/api/v2/oposicion/target', { headers })
            const profile = res.ok ? await res.json() : null

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

  const changeOposicion = async (newOposicionId: string | null, showNotificationFlag = true): Promise<boolean> => {
    if (!user) {
      return false
    }

    try {
      const menuConfig = newOposicionId ? OPOSICION_MENUS[newOposicionId] : null
      const oposicionName = menuConfig?.name || (newOposicionId ? 'Nueva Oposición' : null)

      const newOposicionData: OposicionData | null = newOposicionId
        ? { id: newOposicionId, name: oposicionName! }
        : null

      // Escritura centralizada (endpoint server, shape canónico, sin stringify).
      const result = await setTargetOposicion(newOposicionId)
      if (!result.ok) throw new Error(result.error || 'No se pudo cambiar la oposición')

      setUserOposicion(newOposicionData)
      setOposicionId(newOposicionId)
      setOposicionMenu(menuConfig || DEFAULT_MENU)
      setNeedsOposicionFix(false)

      if (showNotificationFlag && oposicionName) {
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
