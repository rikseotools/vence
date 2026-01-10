// hooks/useDeviceTracking.js
// Sistema de tracking de device_id para detectar fraude multi-cuenta
// Solo se activa para usuarios en la lista de vigilancia (fraud_watch_list)

'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const DEVICE_ID_KEY = 'vence_device_id'

/**
 * Hook para gestionar el device_id de tracking
 *
 * Flujo:
 * 1. Verificar si el usuario está en fraud_watch_list
 * 2. Si está vigilado, generar/recuperar device_id de localStorage
 * 3. Devolver device_id para enviarlo con las sesiones
 *
 * El device_id es un UUID único por navegador/dispositivo.
 * Si 2+ usuarios comparten el mismo device_id = fraude confirmado.
 */
export function useDeviceTracking() {
  const { user, supabase } = useAuth()
  const [deviceId, setDeviceId] = useState(null)
  const [isWatched, setIsWatched] = useState(false)
  const [loading, setLoading] = useState(true)

  // Generar o recuperar device_id de localStorage
  const getOrCreateDeviceId = useCallback(() => {
    if (typeof window === 'undefined') return null

    let storedDeviceId = localStorage.getItem(DEVICE_ID_KEY)

    if (!storedDeviceId) {
      // Generar nuevo UUID
      storedDeviceId = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, storedDeviceId)
      console.log('🔒 Nuevo device_id generado:', storedDeviceId.substring(0, 8) + '...')
    }

    return storedDeviceId
  }, [])

  // Verificar si el usuario está en la lista de vigilancia
  const checkWatchStatus = useCallback(async () => {
    if (!user?.id || !supabase) {
      setLoading(false)
      return
    }

    try {
      // Verificar si está en fraud_watch_list
      const { data, error } = await supabase
        .from('fraud_watch_list')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        // La tabla puede no existir aún
        if (error.code !== '42P01') {
          console.error('Error verificando watch status:', error)
        }
        setIsWatched(false)
        setLoading(false)
        return
      }

      const watched = !!data
      setIsWatched(watched)

      if (watched) {
        // Usuario vigilado - activar tracking
        const id = getOrCreateDeviceId()
        setDeviceId(id)
        console.log('👁️ Usuario bajo vigilancia - tracking activo')
      }

    } catch (err) {
      console.error('Error en checkWatchStatus:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, supabase, getOrCreateDeviceId])

  useEffect(() => {
    checkWatchStatus()
  }, [checkWatchStatus])

  // Función para obtener device_id (solo si está vigilado)
  const getDeviceId = useCallback(() => {
    if (!isWatched) return null
    return deviceId || getOrCreateDeviceId()
  }, [isWatched, deviceId, getOrCreateDeviceId])

  return {
    deviceId: isWatched ? deviceId : null,
    isWatched,
    loading,
    getDeviceId
  }
}

/**
 * Función independiente para obtener device_id sin hook
 * Útil para el SessionTracker que puede no tener acceso al contexto
 */
export async function getDeviceIdForUser(supabase, userId) {
  if (!userId || !supabase) return null

  try {
    // Verificar si está en la lista de vigilancia
    const { data, error } = await supabase
      .from('fraud_watch_list')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      return null // No está vigilado
    }

    // Está vigilado - obtener o crear device_id
    if (typeof window === 'undefined') return null

    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }

    return deviceId

  } catch (err) {
    console.error('Error en getDeviceIdForUser:', err)
    return null
  }
}

/**
 * Función para forzar la generación de device_id
 * Útil cuando se añade un usuario a la watchlist mientras está conectado
 */
export function forceGenerateDeviceId() {
  if (typeof window === 'undefined') return null

  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}
