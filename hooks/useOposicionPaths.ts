// hooks/useOposicionPaths.ts
// Hook centralizado para obtener URLs dinámicas de la oposición del usuario.
// Evita hardcodear rutas como '/auxiliar-administrativo-estado/test'.
'use client'

import { useOposicion } from '@/contexts/OposicionContext'
import { getTestsLink, getTemarioLink, getHomeLink, ID_TO_SLUG } from '@/lib/config/oposiciones'

const DEFAULT_SLUG = 'auxiliar-administrativo-estado'

export function useOposicionPaths() {
  const { oposicionId } = useOposicion()
  const slug = oposicionId ? (ID_TO_SLUG[oposicionId] ?? DEFAULT_SLUG) : DEFAULT_SLUG

  return {
    testUrl: oposicionId ? getTestsLink(oposicionId) : `/${DEFAULT_SLUG}/test`,
    temarioUrl: oposicionId ? getTemarioLink(oposicionId) : `/${DEFAULT_SLUG}/temario`,
    homeUrl: oposicionId ? getHomeLink(oposicionId) : '/',
    slug,
    oposicionId,
  }
}
