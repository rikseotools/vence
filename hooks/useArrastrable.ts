'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clampPosAbsoluta, esArrastre, parsearPosAbsoluta } from '@/lib/ui/arrastrable'
import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'

/**
 * Hace arrastrable un elemento, con la posición recordada en ESTE dispositivo.
 *
 * Mismo comportamiento que la píldora de la meta diaria (umbral de 6 px para no romper el
 * clic, clampeo al viewport, re-clampeo al rotar/redimensionar), pero reutilizable: cada
 * control del examen lo usa por separado, que es lo que pidió Manuel — poder mover el reloj
 * a un sitio y los botones a otro, no un bloque único.
 *
 * La posición se guarda ABSOLUTA (coordenadas de viewport). Guardarla como desplazamiento
 * respecto a la posición natural no vale aquí: la natural cuelga de la cabecera, que cambia
 * de alto, y al recargar el control aparecía en otro sitio del que se dejó.
 *
 * @param clave sufijo de la clave de localStorage (`arrastrable:<clave>`).
 */
export function useArrastrable(clave: string) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const seMovioRef = useRef(false)
  const claveLS = `arrastrable:${clave}`

  // Posición guardada (per-dispositivo: depende del tamaño de pantalla).
  useEffect(() => {
    setPos(parsearPosAbsoluta(safeGet(claveLS)))
  }, [claveLS])

  // Re-clampeo al redimensionar/rotar: una posición guardada en horizontal puede quedar
  // fuera de pantalla en vertical. Idempotente — si ya cabe, no re-renderiza.
  useEffect(() => {
    if (!pos) return
    const reclamp = () => setPos(prev => {
      const el = ref.current
      if (!prev || !el) return prev
      const rect = el.getBoundingClientRect()
      const next = clampPosAbsoluta({
        left: prev.left, top: prev.top,
        width: rect.width, height: rect.height,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      })
      if (next.left === prev.left && next.top === prev.top) return prev
      safeSet(claveLS, JSON.stringify(next))
      return next
    })
    reclamp()
    window.addEventListener('resize', reclamp)
    window.addEventListener('orientationchange', reclamp)
    return () => {
      window.removeEventListener('resize', reclamp)
      window.removeEventListener('orientationchange', reclamp)
    }
  }, [pos, claveLS])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button && e.button !== 0) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const baseLeft = rect.left
    const baseTop = rect.top
    const { width, height } = rect
    let ultima = { left: baseLeft, top: baseTop }
    seMovioRef.current = false

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!seMovioRef.current && !esArrastre(dx, dy)) return
      seMovioRef.current = true
      ultima = clampPosAbsoluta({
        left: baseLeft + dx, top: baseTop + dy,
        width, height,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      })
      setPos(ultima)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (seMovioRef.current) safeSet(claveLS, JSON.stringify(ultima))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [claveLS])

  /** Envolver los `onClick` con esto: tras arrastrar NO debe dispararse la acción. */
  const siNoArrastro = useCallback(<A extends unknown[]>(fn: (...args: A) => void) => {
    return (...args: A) => {
      if (seMovioRef.current) {
        seMovioRef.current = false
        return
      }
      fn(...args)
    }
  }, [])

  return {
    ref,
    onPointerDown,
    siNoArrastro,
    /** `fixed` solo cuando el usuario lo ha movido; si no, se queda donde lo pone el layout. */
    estilo: (pos
      ? { position: 'fixed' as const, left: pos.left, top: pos.top, margin: 0, touchAction: 'none' as const }
      : { touchAction: 'none' as const }),
    movido: !!pos,
    /** Devolver el control a su sitio de fábrica. */
    reiniciar: useCallback(() => {
      safeSet(claveLS, '')
      setPos(null)
    }, [claveLS]),
  }
}
