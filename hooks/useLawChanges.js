// hooks/useLawChanges.js
'use client'

import { useState, useEffect } from 'react'

export function useLawChanges() {
  const [hasUnreviewedChanges, setHasUnreviewedChanges] = useState(false)
  const [hasOutdatedLaws, setHasOutdatedLaws] = useState(false)
  const [hasDiscrepancies, setHasDiscrepancies] = useState(false)
  const [loading, setLoading] = useState(true)

  // Verificación rápida: solo consulta BD (no scrapea BOE)
  const checkForChanges = async () => {
    try {
      // Solo consultar estado guardado en BD (muy rápido)
      const response = await fetch('/api/law-changes?readonly=true')
      const data = await response.json()

      if (data.success) {
        setHasUnreviewedChanges(data.summary?.hasUnreviewedChanges || false)
      }
    } catch (error) {
      console.error('Error checking law changes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Verificación de discrepancias BOE vs BD (instantánea, solo lee de BD)
  const checkDiscrepancies = async () => {
    try {
      const response = await fetch('/api/verify-articles/stats-by-law')
      const data = await response.json()

      if (data.success) {
        setHasDiscrepancies(data.hasDiscrepancies || false)
      }
    } catch (error) {
      console.error('Error checking discrepancies:', error)
    }
  }

  // Verificación de fechas BOE (ligera, solo extrae fechas)
  const checkBOEDates = async () => {
    try {
      const response = await fetch('/api/law-changes/quick-check')
      const data = await response.json()

      if (data.success) {
        setHasOutdatedLaws(data.hasOutdatedLaws || false)
      }
    } catch (error) {
      console.error('Error checking BOE dates:', error)
    }
  }

  useEffect(() => {
    // Verificación inicial de BD (instantánea)
    checkForChanges()

    // Verificación inicial de discrepancias (instantánea)
    checkDiscrepancies()

    // Verificación inicial de fechas BOE (ligera)
    checkBOEDates()

    // Verificar BD cada 5 minutos
    const interval = setInterval(checkForChanges, 5 * 60 * 1000)

    // Verificar discrepancias cada 5 minutos
    const discrepanciesInterval = setInterval(checkDiscrepancies, 5 * 60 * 1000)

    // Verificar fechas BOE cada 30 minutos
    const boeInterval = setInterval(checkBOEDates, 30 * 60 * 1000)

    return () => {
      clearInterval(interval)
      clearInterval(discrepanciesInterval)
      clearInterval(boeInterval)
    }
  }, [])

  return {
    hasUnreviewedChanges: hasUnreviewedChanges || hasOutdatedLaws || hasDiscrepancies,
    hasOutdatedLaws,
    hasDiscrepancies,
    loading,
    refreshChanges: checkForChanges,
    refreshDiscrepancies: checkDiscrepancies,
    refreshBOE: checkBOEDates
  }
}