// hooks/useNewMedalsBadge.ts
// Hook para detectar medallas nuevas y mostrar badge en el icono del header
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUserRankingMedals } from '../lib/services/rankingMedals'

export function useNewMedalsBadge() {
  const { user, supabase } = useAuth() as any
  const [hasNewMedals, setHasNewMedals] = useState(false)
  const [newMedalsCount, setNewMedalsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // 🆕 COOLDOWN DE 1 DÍA PARA BADGE DE MEDALLAS
  const MEDALS_BADGE_COOLDOWN_HOURS = 24
  const MEDALS_BADGE_COOLDOWN_KEY = 'medals_badge_last_viewed'

  // Función para verificar si está en cooldown
  const isInCooldown = () => {
    if (!user?.id) return false
    
    try {
      const lastViewedKey = `${MEDALS_BADGE_COOLDOWN_KEY}_${user.id}`
      const lastViewed = localStorage.getItem(lastViewedKey)
      
      if (!lastViewed) return false // Primera vez, no está en cooldown
      
      const lastViewedTime = new Date(lastViewed)
      const now = new Date()
      const hoursSinceLastViewed = (now.getTime() - lastViewedTime.getTime()) / (1000 * 60 * 60)
      
      const inCooldown = hoursSinceLastViewed < MEDALS_BADGE_COOLDOWN_HOURS
      
      // Cooldown activo - no mostrar badge
      // if (inCooldown) console.log(`🕒 Badge medallas cooldown: ${Math.ceil(MEDALS_BADGE_COOLDOWN_HOURS - hoursSinceLastViewed)}h`)
      
      return inCooldown
    } catch (error) {
      console.error('Error verificando cooldown de medallas:', error)
      return false
    }
  }

  // Función para verificar medallas nuevas
  const checkNewMedals = async () => {
    
    if (!user || !supabase) {
      setLoading(false)
      return
    }

    // 🆕 VERIFICAR COOLDOWN ANTES DE MOSTRAR BADGE
    if (isInCooldown()) {
      setHasNewMedals(false)
      setNewMedalsCount(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // 🏆 CALCULAR MEDALLAS BASADAS EN POSICIÓN ACTUAL EN RANKINGS
      // El trofeo debe parpadear si el usuario está en el top de algún período
      const currentMedals = await getUserRankingMedals(supabase, user.id)
      
      // Obtener medallas que ya están almacenadas/vistas
      const { data: storedMedals, error: storedError } = await supabase
        .from('user_medals')
        .select('medal_id, unlocked_at, viewed')
        .eq('user_id', user.id)

      if (storedError) {
        console.warn('Error loading stored medals for badge:', storedError)
        setHasNewMedals(false)
        setNewMedalsCount(0)
        return
      }

      const storedMedalIds = new Set(storedMedals?.map((m: any) => m.medal_id) || [])
      
      // Medallas que existen pero no están almacenadas = nuevas
      const newMedals = currentMedals.filter(medal => 
        !storedMedalIds.has(medal.id)
      )

      // También verificar medallas almacenadas pero no vistas
      const unviewedStoredMedals = storedMedals?.filter((stored: any) =>
        stored.viewed === false || stored.viewed === null
      ) || []

      const totalNewMedals = newMedals.length + unviewedStoredMedals.length

      setNewMedalsCount(totalNewMedals)
      setHasNewMedals(totalNewMedals > 0)


    } catch (error) {
      console.error('Error checking new medals for badge:', error)
      setHasNewMedals(false)
      setNewMedalsCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Función para marcar medallas como vistas (llamar cuando se abre el modal)
  const markMedalsAsViewed = async () => {
    if (!user || !supabase) return

    try {
      // Marcar todas las medallas del usuario como vistas
      const { error } = await supabase
        .from('user_medals')
        .update({ viewed: true })
        .eq('user_id', user.id)
        .eq('viewed', false)

      if (error) {
        console.warn('Error marking medals as viewed:', error)
      } else {
        console.log('✅ Medallas marcadas como vistas')
        
        // 🆕 INICIAR COOLDOWN DE 1 DÍA
        const lastViewedKey = `${MEDALS_BADGE_COOLDOWN_KEY}_${user.id}`
        const now = new Date().toISOString()
        localStorage.setItem(lastViewedKey, now)
        console.log(`🕒 Cooldown de medallas iniciado: 24h desde ${now}`)
        
        setHasNewMedals(false)
        setNewMedalsCount(0)
      }
    } catch (error) {
      console.error('Error in markMedalsAsViewed:', error)
    }
  }

  // Verificar medallas al montar y cuando cambie el usuario
  useEffect(() => {
    checkNewMedals()
    
    // DEBUG DESHABILITADO - ya no calcular ranking en tiempo real
    // El trofeo solo debe parpadear por medallas ya otorgadas en la BD
  }, [user?.id, supabase])

  // Función de debug temporal
  const debugUserMedals = async (supabase: any, userId: string) => {
    console.log('🔍 === DEBUG AUTOMÁTICO DE MEDALLAS ===')
    console.log('🔍 Usuario:', userId)
    
    try {
      const now = new Date()
      const today = {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      }

      console.log('🔍 Período HOY:', today.start.toISOString(), 'hasta', today.end.toISOString())

      // Obtener respuestas de hoy
      const { data: responses, error } = await supabase
        .from('test_questions')
        .select(`
          tests!inner(user_id),
          is_correct,
          created_at
        `)
        .eq('tests.is_completed', true)
        .gte('created_at', today.start.toISOString())
        .lte('created_at', today.end.toISOString())

      if (error) {
        console.log('❌ Error obteniendo responses:', error)
        return
      }

      console.log(`🔍 Total respuestas HOY:`, responses?.length || 0)

      // Procesar por usuario
      const userStats: Record<string, any> = {}
      responses?.forEach((response: any) => {
        const responseUserId = response.tests.user_id
        if (!userStats[responseUserId]) {
          userStats[responseUserId] = {
            userId: responseUserId,
            totalQuestions: 0,
            correctAnswers: 0
          }
        }

        userStats[responseUserId].totalQuestions++
        if (response.is_correct) {
          userStats[responseUserId].correctAnswers++
        }
      })

      // Calcular ranking
      const ranking = Object.values(userStats)
        .filter((u: any) => u.totalQuestions >= 5)
        .map((u: any) => ({
          ...u,
          accuracy: Math.round((u.correctAnswers / u.totalQuestions) * 100)
        }))
        .sort((a: any, b: any) => {
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
          return b.totalQuestions - a.totalQuestions
        })

      console.log(`🔍 Ranking HOY completo:`, ranking)
      console.log(`🔍 Total usuarios en ranking:`, ranking.length)

      const userRank = ranking.findIndex((u: any) => u.userId === userId) + 1
      console.log(`🔍 TU POSICIÓN: ${userRank} (${userRank === 0 ? 'No estás en el ranking' : '#' + userRank})`)

      if (userRank > 0) {
        const userStats = ranking[userRank - 1]
        console.log(`🔍 TUS STATS: ${userStats.accuracy}% - ${userStats.totalQuestions} preguntas - ${userStats.correctAnswers} correctas`)
      }

      // Verificar requisitos
      if (userRank === 1) {
        if (ranking.length >= 1) {
          console.log(`✅ DEBERÍAS TENER MEDALLA DE CAMPEÓN DEL DÍA!`)
        } else {
          console.log(`❌ No estás en el ranking`)
        }
      }

      // Verificar medallas almacenadas
      const { data: storedMedals } = await supabase
        .from('user_medals')
        .select('*')
        .eq('user_id', userId)

      console.log('🔍 Medallas almacenadas:', storedMedals?.length || 0)
      storedMedals?.forEach((medal: any) => {
        console.log(`🏆 ${medal.medal_id} - Visto: ${medal.viewed}`)
      })

      // DEBUG: Verificar nombres en diferentes tablas
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('nickname')
        .eq('id', userId)
        .single()

      const { data: publicProfile } = await supabase
        .from('public_user_profiles')
        .select('display_name')
        .eq('id', userId)
        .single()

      console.log('🔍 Nickname en user_profiles:', userProfile?.nickname)
      console.log('🔍 Display name en public_user_profiles:', publicProfile?.display_name)
      
      if (userProfile?.nickname !== publicProfile?.display_name) {
        console.log('❌ ¡Los nombres NO están sincronizados!')
      } else {
        console.log('✅ Los nombres están sincronizados correctamente')
      }

    } catch (error) {
      console.log('❌ Error en debug:', error)
    }
    
    console.log('🔍 === FIN DEBUG AUTOMÁTICO ===')
  }

  // Polling eliminado: las medallas se calculan sobre períodos cerrados (ayer,
  // semana pasada, mes pasado) que no cambian. El check en mount (useEffect
  // anterior) es suficiente. El RankingModal tiene su propio fetch independiente
  // con RPC optimizado (get_ranking_for_period) que siempre muestra datos frescos.

  return {
    hasNewMedals,
    newMedalsCount,
    loading,
    checkNewMedals,
    markMedalsAsViewed
  }
}