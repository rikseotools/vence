// hooks/useNewMedalsBadge.ts
// Hook para detectar medallas nuevas y mostrar badge en el icono del header
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../lib/api/authHeaders'

export function useNewMedalsBadge() {
  const { user } = useAuth() as any
  const [hasNewMedals, setHasNewMedals] = useState(false)
  const [newMedalsCount, setNewMedalsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const MEDALS_BADGE_COOLDOWN_HOURS = 24
  const MEDALS_BADGE_COOLDOWN_KEY = 'medals_badge_last_viewed'

  const isInCooldown = () => {
    if (!user?.id) return false
    try {
      const lastViewedKey = `${MEDALS_BADGE_COOLDOWN_KEY}_${user.id}`
      const lastViewed = localStorage.getItem(lastViewedKey)
      if (!lastViewed) return false
      const lastViewedTime = new Date(lastViewed)
      const hoursSinceLastViewed = (Date.now() - lastViewedTime.getTime()) / (1000 * 60 * 60)
      return hoursSinceLastViewed < MEDALS_BADGE_COOLDOWN_HOURS
    } catch {
      return false
    }
  }

  const checkNewMedals = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    if (isInCooldown()) {
      setHasNewMedals(false)
      setNewMedalsCount(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Obtener medallas actuales via API
      const res = await fetch(`/api/medals?userId=${user.id}`)
      const data = await res.json()
      const currentMedals = data.success ? (data.medals || []) : []

      // Obtener medallas almacenadas/vistas (Fase C1: endpoint Drizzle, user del token)
      const headers = await getAuthHeaders()
      const badgeRes = await fetch('/api/v2/medals/badge', { headers })

      if (!badgeRes.ok) {
        console.warn('Error loading stored medals for badge:', badgeRes.status)
        setHasNewMedals(false)
        setNewMedalsCount(0)
        return
      }

      const storedMedals = ((await badgeRes.json()).medals || []) as any[]

      const storedMedalIds = new Set(storedMedals?.map((m: any) => m.medal_id) || [])

      const newMedals = currentMedals.filter((medal: any) =>
        !storedMedalIds.has(medal.id)
      )

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

  const markMedalsAsViewed = async () => {
    if (!user) return

    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v2/medals/badge', { method: 'POST', headers })

      if (!res.ok) {
        console.warn('Error marking medals as viewed:', res.status)
      } else {
        const lastViewedKey = `${MEDALS_BADGE_COOLDOWN_KEY}_${user.id}`
        localStorage.setItem(lastViewedKey, new Date().toISOString())

        setHasNewMedals(false)
        setNewMedalsCount(0)
      }
    } catch (error) {
      console.error('Error in markMedalsAsViewed:', error)
    }
  }

  useEffect(() => {
    checkNewMedals()
  }, [user?.id])

  return {
    hasNewMedals,
    newMedalsCount,
    loading,
    checkNewMedals,
    markMedalsAsViewed
  }
}