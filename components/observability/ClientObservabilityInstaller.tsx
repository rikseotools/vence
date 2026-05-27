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
    // deployVersion: NEXT_PUBLIC_GIT_COMMIT_SHA viene del build-arg pasado por
    // frontend-deploy.yml (github.sha). Legacy NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    // sólo existía en Vercel — tras cutover a ECS (2026-05-26) quedó undefined
    // → deployVersion=null en TODOS los eventos client. Bug detectado 2026-05-27.
    installClientObservability({
      userId: user?.id ?? null,
      deployVersion:
        process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.slice(0, 8)
        ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
        ?? null,
    })
  }, [user?.id])

  // Actualizar userId tras login/logout (sin reinstalar)
  useEffect(() => {
    setObservabilityUserId(user?.id ?? null)
  }, [user?.id])

  return null
}
