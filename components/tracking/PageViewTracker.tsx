// components/tracking/PageViewTracker.tsx
// Trackea automáticamente cada cambio de página
'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { InteractionTracker } from '@/hooks/useInteractionTracker'
import { useAuth } from '@/contexts/AuthContext'

// Determinar categoría de la página
function getPageCategory(pathname: string): string {
  if (pathname.includes('/test')) return 'test'
  if (pathname.includes('/psicotecnicos')) return 'psychometric'
  if (pathname.includes('/temario')) return 'navigation'
  if (pathname.includes('/login') || pathname.includes('/registro')) return 'auth'
  if (pathname.includes('/premium') || pathname.includes('/pricing')) return 'conversion'
  if (pathname.includes('/admin')) return 'ui'
  if (pathname.includes('/leyes')) return 'navigation'
  if (pathname === '/') return 'navigation'
  return 'navigation'
}

// Extraer información útil del pathname
function getPageInfo(pathname: string): {
  section: string
  subsection: string | null
  params: Record<string, string>
} {
  const parts = pathname.split('/').filter(Boolean)

  return {
    section: parts[0] || 'home',
    subsection: parts[1] || null,
    params: parts.reduce((acc, part, index) => {
      if (index > 1) acc[`param${index - 1}`] = part
      return acc
    }, {} as Record<string, string>)
  }
}

export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth() as { user: { id: string } | null }
  const previousPathRef = useRef<string | null>(null)
  const pageStartTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!pathname) return

    const currentPath = pathname
    const previousPath = previousPathRef.current

    // Calcular tiempo en página anterior
    const timeOnPreviousPage = previousPath ? Date.now() - pageStartTimeRef.current : 0

    // Trackear salida de página anterior (si existe)
    if (previousPath && previousPath !== currentPath) {
      InteractionTracker.track({
        eventType: 'page_exit',
        eventCategory: getPageCategory(previousPath) as any,
        component: 'PageViewTracker',
        action: 'exit',
        label: previousPath,
        value: {
          page: previousPath,
          timeOnPageMs: timeOnPreviousPage,
          timeOnPageSec: Math.round(timeOnPreviousPage / 1000),
          exitTo: currentPath
        },
        pageUrl: previousPath,
        responseTimeMs: timeOnPreviousPage,
        userId: user?.id
      })
    }

    // Trackear entrada a nueva página
    const pageInfo = getPageInfo(currentPath)
    const queryParams = Object.fromEntries(searchParams?.entries() || [])

    InteractionTracker.track({
      eventType: 'page_view',
      eventCategory: getPageCategory(currentPath) as any,
      component: 'PageViewTracker',
      action: 'view',
      label: currentPath,
      value: {
        page: currentPath,
        section: pageInfo.section,
        subsection: pageInfo.subsection,
        params: pageInfo.params,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        referrer: previousPath || document.referrer || undefined,
        isFirstPage: !previousPath
      },
      pageUrl: currentPath,
      userId: user?.id
    })

    // Actualizar refs
    previousPathRef.current = currentPath
    pageStartTimeRef.current = Date.now()

  }, [pathname, searchParams, user?.id])

  // Trackear salida al cerrar/navegar fuera
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (previousPathRef.current) {
        const timeOnPage = Date.now() - pageStartTimeRef.current

        // Usar sendBeacon para garantizar el envío
        const event = {
          events: [{
            eventType: 'page_exit',
            eventCategory: getPageCategory(previousPathRef.current),
            component: 'PageViewTracker',
            action: 'unload',
            label: previousPathRef.current,
            value: {
              page: previousPathRef.current,
              timeOnPageMs: timeOnPage,
              timeOnPageSec: Math.round(timeOnPage / 1000),
              exitType: 'unload'
            },
            pageUrl: previousPathRef.current,
            responseTimeMs: timeOnPage,
            userId: user?.id,
            timestamp: Date.now()
          }]
        }

        navigator.sendBeacon('/api/interactions', JSON.stringify(event))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [user?.id])

  return null // Este componente no renderiza nada
}
