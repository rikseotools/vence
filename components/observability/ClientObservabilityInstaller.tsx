'use client'

import { useEffect } from 'react'
import {
  installClientObservability,
  setObservabilityUserId,
} from '@/lib/observability/client'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Componente client-side que instala los hooks de observability una
 * sola vez al montar, y mantiene el userId actualizado tras login/logout.
 *
 * Inyectado en app/layout.tsx después del AuthProvider.
 *
 * `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` viene de Vercel build time —
 * permite correlacionar errores client-side con el deploy concreto.
 *
 * Bloque 4 Gap 1 del manual de observabilidad.
 */
export function ClientObservabilityInstaller() {
  const { user } = useAuth()

  useEffect(() => {
    // Instalar una vez. `installed` flag interno previene re-init.
    installClientObservability({
      userId: user?.id ?? null,
      deployVersion:
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null,
    })
  }, [user?.id])

  // Actualizar userId tras login/logout (sin reinstalar)
  useEffect(() => {
    setObservabilityUserId(user?.id ?? null)
  }, [user?.id])

  return null
}
