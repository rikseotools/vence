// components/FraudTracker.js
// Componente invisible que activa el tracking de device_id para usuarios vigilados
// Se incluye en el layout principal para que se ejecute en cada página

'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const DEVICE_ID_KEY = 'vence_device_id'

export default function FraudTracker() {
  const { user, supabase } = useAuth()

  useEffect(() => {
    if (!user?.id || !supabase) return

    const checkAndActivateTracking = async () => {
      try {
        // Verificar si el usuario está en la lista de vigilancia
        const { data, error } = await supabase
          .from('fraud_watch_list')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          // La tabla puede no existir aún - silencioso
          if (error.code !== '42P01' && error.code !== 'PGRST116') {
            console.warn('FraudTracker: Error verificando watch status')
          }
          return
        }

        if (data) {
          // Usuario está vigilado - generar device_id si no existe
          let deviceId = localStorage.getItem(DEVICE_ID_KEY)

          if (!deviceId) {
            deviceId = crypto.randomUUID()
            localStorage.setItem(DEVICE_ID_KEY, deviceId)
            console.log('🔒 FraudTracker: device_id generado para usuario vigilado')
          }
        }

      } catch (err) {
        // Silencioso - no es crítico para la experiencia del usuario
      }
    }

    // Pequeño delay para no bloquear el render inicial
    const timeoutId = setTimeout(checkAndActivateTracking, 2000)

    return () => clearTimeout(timeoutId)
  }, [user?.id, supabase])

  // No renderiza nada
  return null
}
