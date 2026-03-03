// hooks/useMedalChecker.ts
// Hook para verificar y otorgar medallas automáticamente

import { useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { checkAndNotifyNewMedals } from '../lib/services/rankingMedals'

export function useMedalChecker() {
  const { user, supabase } = useAuth() as any

  // Función para verificar medallas después de completar un test
  const checkMedalsAfterTest = useCallback(async () => {
    if (!user || !supabase) return

    try {
      const newMedals = await checkAndNotifyNewMedals(supabase, user.id)
      
      if (newMedals.length > 0) {
        console.log(`🏆 ¡${newMedals.length} nueva(s) medalla(s) conseguida(s)!`, newMedals)
        
        // Mostrar notificación toast opcional (implementar según tu sistema de notificaciones)
        newMedals.forEach(medal => {
          console.log(`🎉 Nueva medalla: ${medal.title}`)
        })
        
        return newMedals
      }
    } catch (error) {
      console.error('Error checking medals after test:', error)
    }
    
    return []
  }, [user, supabase])

  // Función para verificar medallas manualmente
  const checkMedalsNow = useCallback(async () => {
    return await checkMedalsAfterTest()
  }, [checkMedalsAfterTest])

  return {
    checkMedalsAfterTest,
    checkMedalsNow
  }
}

// Hook específico para integrar con el sistema de tests
export function useTestMedalIntegration() {
  const { checkMedalsAfterTest } = useMedalChecker()

  // Función que debe llamarse después de completar un test
  const onTestCompleted = useCallback(async (testData: any) => {
    // Pequeño delay para asegurar que los datos del test se han guardado
    setTimeout(async () => {
      try {
        const newMedals = await checkMedalsAfterTest()
        
        // Opcional: Mostrar modal de celebración si hay medallas nuevas
        if (newMedals && newMedals.length > 0) {
          // Implementar modal de celebración aquí si lo deseas
          console.log('🎊 ¡Deberías mostrar una celebración por las nuevas medallas!')
        }
      } catch (error) {
        console.error('Error in medal integration:', error)
      }
    }, 2000) // 2 segundos de delay
  }, [checkMedalsAfterTest])

  return {
    onTestCompleted
  }
}