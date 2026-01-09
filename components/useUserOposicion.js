// components/useUserOposicion.js - CORREGIDO PARA USAR EL CAMPO CORRECTO
// 🎯 Hook para leer la oposición YA ASIGNADA del usuario

'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

// 📋 Configuración de menús por oposición - SOPORTA AMBOS FORMATOS
const OPOSICION_MENUS = {
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
  // ✅ AGREGAR SOPORTE PARA FORMATO CON UNDERSCORES (BD)
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

export function useUserOposicion() {
  const { user, userProfile, supabase, loading: authLoading } = useAuth()
  const [userOposicion, setUserOposicion] = useState(null)
  const [oposicionMenu, setOposicionMenu] = useState(DEFAULT_MENU)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function loadUserOposicion() {
      try {
        setLoading(true)

        // 1. Esperar a que termine la autenticación
        if (authLoading) {
          console.log('⏳ Esperando autenticación...')
          return
        }

        if (!user) {
          console.log('👤 Usuario no autenticado - usando menú genérico')
          setUserOposicion(null)
          setOposicionMenu(DEFAULT_MENU)
          setLoading(false)
          return
        }

        // 2. Esperar a que el perfil esté cargado desde AuthContext
        if (userProfile === null) {
          // Aún cargando el perfil, esperar
          console.log('⏳ Esperando perfil de usuario...')
          return
        }

        console.log('👤 Usuario autenticado:', user.id)

        // 3. Usar userProfile del AuthContext (evita query que puede fallar con 406)
        const profile = userProfile

        if (!profile?.target_oposicion) {
          console.log('📋 Usuario sin oposición asignada - usando menú genérico')
          setUserOposicion(null)
          setOposicionMenu(DEFAULT_MENU)
        } else {
          // 3. Usuario con oposición asignada
          const oposicionId = profile.target_oposicion
          // NOTA: target_oposicion_data es JSONB, Supabase lo devuelve como objeto
          // No necesita JSON.parse()
          const oposicionData = profile.target_oposicion_data || null

          console.log('✅ Oposición del usuario:', oposicionId, oposicionData)

          setUserOposicion(oposicionData)
          
          // 4. Configurar menú personalizado
          const menuConfig = OPOSICION_MENUS[oposicionId] || DEFAULT_MENU
          setOposicionMenu(menuConfig)
          
          console.log('📱 Menú configurado:', menuConfig.name)
        }

      } catch (error) {
        console.error('❌ Error general cargando oposición de usuario:', error)
        setUserOposicion(null)
        setOposicionMenu(DEFAULT_MENU)
      } finally {
        setLoading(false)
      }
    }

    loadUserOposicion()

    // Escuchar asignación de nueva oposición
    const handleOposicionAssigned = (event) => {
      console.log('🎯 Nueva oposición asignada, recargando...')
      loadUserOposicion()
    }

    window.addEventListener('oposicionAssigned', handleOposicionAssigned)

    return () => {
      window.removeEventListener('oposicionAssigned', handleOposicionAssigned)
    }
  }, [user, userProfile, authLoading, supabase])

  // Función para cambiar oposición manualmente
  const changeOposicion = async (newOposicionId) => {
    if (!user) return false

    try {
      // Preparar datos básicos de la oposición
      const oposicionData = {
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

      return true
    } catch (error) {
      console.error('❌ Error cambiando oposición:', error)
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

// Helper para detectar si necesita mostrar notificación de bienvenida
export function useNewOposicionNotification() {
  const [showNotification, setShowNotification] = useState(false)
  const [notificationData, setNotificationData] = useState(null)

  useEffect(() => {
    // Verificar si hay una nueva asignación reciente
    const newAssignment = localStorage.getItem('newOposicionAssigned')
    
    if (newAssignment) {
      const data = JSON.parse(newAssignment)
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