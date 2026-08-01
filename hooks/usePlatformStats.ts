'use client'
// hooks/usePlatformStats.ts — cifras de volumen para componentes de cliente [T-460].
//
// Devuelve SIEMPRE algo presentable: arranca con los mínimos garantizados y los sustituye cuando
// llega la respuesta. Así ninguna pantalla parpadea con un cero ni se queda sin texto si la red
// falla — que es justo lo que llevaba a clavar los números a mano.
import { useEffect, useState } from 'react'
import { MINIMOS_GARANTIZADOS, formatVolumen, type PlatformStats } from '@/lib/api/platform-stats/shared'

let cacheEnMemoria: PlatformStats | null = null

export function usePlatformStats(): PlatformStats & { fmt: (n: number) => string } {
  const [stats, setStats] = useState<PlatformStats>(cacheEnMemoria ?? MINIMOS_GARANTIZADOS)

  useEffect(() => {
    if (cacheEnMemoria) return
    let vivo = true
    fetch('/api/platform-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PlatformStats | null) => {
        if (!d || !vivo || !d.preguntas) return
        cacheEnMemoria = d
        setStats(d)
      })
      .catch(() => { /* nos quedamos con los mínimos: son ciertos */ })
    return () => { vivo = false }
  }, [])

  return { ...stats, fmt: formatVolumen }
}
