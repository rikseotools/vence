// hooks/useOposicionPaths.ts
// Hook centralizado para obtener URLs dinámicas de la oposición del usuario.
// Evita hardcodear rutas como '/auxiliar-administrativo-estado/test'.
'use client'

import { useOposicion } from '@/contexts/OposicionContext'
import { useAuth } from '@/contexts/AuthContext'
import { getTestsLink, getTemarioLink, getHomeLink, ID_TO_SLUG, ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'

const DEFAULT_SLUG = 'auxiliar-administrativo-estado'

export function useOposicionPaths() {
  const { oposicionId } = useOposicion()
  const { userProfile } = useAuth()

  // 🛟 Fallback robusto (fix bug flor 12/07/2026): `OposicionContext.oposicionId`
  // es null durante la ventana de carga del perfil (fetch en background 6.8s+) o si
  // no hay caché local. En esa ventana, TODO consumidor caía a DEFAULT_SLUG (Estado)
  // → un usuario de OTRA oposición (p.ej. Valencia) que pulsaba "volver a mi oposición"
  // desde una ruta global (/test/articulo, /test/rapido…) aterrizaba en Estado.
  // Fix: si el contexto aún no resolvió, usar el `target_oposicion` del perfil de
  // AuthContext (que tiene su propia caché) ANTES de caer al flagship. Solo se cae a
  // Estado si el usuario GENUINAMENTE no tiene oposición (target null). No usa el
  // pathname a propósito: este hook es la oposición DEL USUARIO (Header "Mi Oposición"),
  // no la de la página que mira.
  const rawId = oposicionId ?? userProfile?.target_oposicion ?? null
  const effectiveId = rawId && ALL_OPOSICION_IDS.includes(rawId) ? rawId : null

  const slug = effectiveId ? (ID_TO_SLUG[effectiveId] ?? DEFAULT_SLUG) : DEFAULT_SLUG

  return {
    testUrl: effectiveId ? getTestsLink(effectiveId) : `/${DEFAULT_SLUG}/test`,
    temarioUrl: effectiveId ? getTemarioLink(effectiveId) : `/${DEFAULT_SLUG}/temario`,
    homeUrl: effectiveId ? getHomeLink(effectiveId) : '/',
    slug,
    oposicionId: effectiveId,
  }
}
