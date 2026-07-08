'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import {
  emitClientEvent,
  flushClientObservability,
} from '@/lib/observability/client'

/**
 * Route-level error boundary (Next.js App Router).
 *
 * Bloque 4 — captura errores que no son fatales para toda la app pero sí
 * para esta ruta (renders que tiran tras hydration, server components
 * que fallan, etc.). Reporta a Sentry con tags + `digest` (Next.js
 * genera digest único por error para correlación con server logs).
 *
 * Diferencia con `app/global-error.tsx`:
 *   - error.tsx: maneja errores DENTRO del root layout. Usa el layout
 *     completo, banner de cookies, header, etc. Mejor UX.
 *   - global-error.tsx: maneja errores que rompen el root layout mismo
 *     (raro pero posible). Re-renderiza html+body. Fallback de último
 *     recurso.
 *
 * Ambos cazan diferentes capas. Hay que tener LOS DOS.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Reportar a observabilidad in-house. El digest de Next.js correlaciona
    // client con server logs (el mismo digest aparece en los logs del runtime).
    emitClientEvent({
      severity: 'error',
      eventType: 'react_error_boundary',
      errorMessage: error.message,
      metadata: {
        boundary: 'app_error_tsx',
        digest: error.digest ?? null,
        stack: error.stack,
      },
    })
    // El boundary suele acompañar a un crash → enviar ya (beacon), no esperar al flush.
    flushClientObservability(true)
  }, [error])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ fontSize: '20px', marginBottom: '12px', color: '#333' }}>
        Algo no ha ido bien
      </h2>
      <p
        style={{
          color: '#666',
          marginBottom: '20px',
          textAlign: 'center',
          maxWidth: '420px',
        }}
      >
        Hemos registrado el problema y lo estamos investigando. Puedes
        intentarlo de nuevo o volver a la página de inicio.
      </p>
      {error.digest && (
        <p
          style={{
            color: '#999',
            fontSize: '12px',
            marginBottom: '20px',
            fontFamily: 'monospace',
          }}
        >
          Ref: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          style={{
            padding: '10px 20px',
            backgroundColor: '#e5e7eb',
            color: '#374151',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
