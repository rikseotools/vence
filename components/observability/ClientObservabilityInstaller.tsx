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
 * `NEXT_PUBLIC_GIT_COMMIT_SHA` se inyecta en build time (build-arg del
 * workflow frontend-deploy.yml) — permite correlacionar errores client-side
 * con el deploy concreto.
 *
 * Bloque 4 Gap 1 del manual de observabilidad.
 */
export function ClientObservabilityInstaller() {
  const { user } = useAuth()

  useEffect(() => {
    // Instalar una vez. `installed` flag interno previene re-init.
    // deployVersion: NEXT_PUBLIC_GIT_COMMIT_SHA viene del build-arg pasado por
    // frontend-deploy.yml (github.sha) en el build Docker para ECS Fargate.
    installClientObservability({
      userId: user?.id ?? null,
      deployVersion:
        process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.slice(0, 8)
        ?? null,
    })
  }, [user?.id])

  // Actualizar userId tras login/logout (sin reinstalar)
  useEffect(() => {
    setObservabilityUserId(user?.id ?? null)
  }, [user?.id])

  return null
}
