// hooks/useVersionCheck.ts — Detecta versión vieja y fuerza recarga
// Consulta /api/version al volver de background. Si cambió, recarga.
'use client'
import { useEffect, useRef } from 'react'

// Versión del cliente se fija al cargar el módulo
let clientVersion: string | null = null

export function useVersionCheck() {
  const checkingRef = useRef(false)

  useEffect(() => {
    async function checkVersion() {
      if (checkingRef.current) return
      checkingRef.current = true

      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return

        const { version } = await res.json()
        if (!version || version === 'dev') return

        if (!clientVersion) {
          // Primera carga — guardar versión
          clientVersion = version
          return
        }

        if (version !== clientVersion) {
          console.log(`🔄 Nueva versión detectada: ${clientVersion} → ${version}. Recargando...`)
          window.location.reload()
        }
      } catch {
        // Red caída o error — ignorar silenciosamente
      } finally {
        checkingRef.current = false
      }
    }

    // Check al montar
    checkVersion()

    // Check al volver de background
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}

/**
 * Devuelve la versión del cliente para tracking/debugging.
 * Null si aún no se ha cargado.
 */
export function getClientVersion(): string | null {
  return clientVersion
}
