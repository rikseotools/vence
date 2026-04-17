// hooks/useLawChanges.ts
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
    // Retrasar 12s — en dev, Turbopack compila rutas API secuencialmente
    // y las conexiones del navegador (max 6) se saturan si todo dispara a la vez.
    const initialDelay = setTimeout(() => {
      checkForChanges()
      checkDiscrepancies()
      // checkBOEDates() — desactivado del auto-check (tarda ~10s, scrapea BOE entero)
      // Se ejecuta solo manualmente desde /admin/monitoreo o via cron de GitHub Actions
    }, 12000)

    // Verificar BD cada 5 minutos
    const interval = setInterval(checkForChanges, 5 * 60 * 1000)

    // Verificar discrepancias cada 5 minutos
    const discrepanciesInterval = setInterval(checkDiscrepancies, 5 * 60 * 1000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(interval)
      clearInterval(discrepanciesInterval)
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