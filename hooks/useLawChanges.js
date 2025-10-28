// hooks/useLawChanges.js
'use client'

import { useState, useEffect } from 'react'

export function useLawChanges() {
  const [hasUnreviewedChanges, setHasUnreviewedChanges] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkForChanges = async () => {
    try {
      const response = await fetch('/api/law-changes')
      const data = await response.json()
      
      if (data.success) {
        setHasUnreviewedChanges(data.summary.hasUnreviewedChanges)
      }
    } catch (error) {
      console.error('Error checking law changes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkForChanges()
    
    // Verificar cada 5 minutos
    const interval = setInterval(checkForChanges, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    hasUnreviewedChanges,
    loading,
    refreshChanges: checkForChanges
  }
}