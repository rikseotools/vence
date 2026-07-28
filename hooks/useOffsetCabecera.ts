'use client'

import { useEffect, useState } from 'react'
import { offsetBajoCabecera } from '@/lib/ui/stickyOffset'

/**
 * Píxeles que ocupa la cabecera pegajosa del sitio, para que un `sticky` propio se coloque
 * DEBAJO y no detrás (ver `lib/ui/stickyOffset.ts` para el porqué).
 *
 * Se mide en vivo porque la cabecera cambia de alto: móvil vs escritorio, con o sin sesión
 * (segunda fila de racha/leyes), y con el aviso de convocatoria. Cualquier constante escrita
 * a mano se queda mal en cuanto cambie una de las tres.
 *
 * Devuelve 0 en el servidor y en el primer render (SSR-safe): el peor caso mientras mide es
 * el comportamiento de antes, no un salto de maquetación.
 */
export function useOffsetCabecera(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const medir = () => {
      const cabecera = document.querySelector('header')
      if (!cabecera) {
        setOffset(0)
        return
      }
      const rect = cabecera.getBoundingClientRect()

      // Filas que asoman por debajo de la caja de la cabecera (la segunda fila móvil es
      // `absolute top-full`: no cuenta en el alto pero tapa igual). Se cuentan SOLO las
      // marcadas con `data-cabecera-fila`, no todo lo posicionado: escanear posicionados se
      // tragaba el menú desplegable (457 px, oculto con opacity/visibility) y hundía la barra
      // media pantalla.
      const sobresalientes: DOMRect[] = []
      for (const nodo of Array.from(cabecera.querySelectorAll('[data-cabecera-fila]'))) {
        const cs = getComputedStyle(nodo)
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
        const r = nodo.getBoundingClientRect()
        if (r.height > 0 && r.bottom > rect.bottom) sobresalientes.push(r)
      }

      setOffset(offsetBajoCabecera(rect, sobresalientes, { altoViewport: window.innerHeight }))
    }

    medir()
    // Segunda medición en el frame siguiente: al montar, fuentes e iconos aún pueden crecer.
    const raf = requestAnimationFrame(medir)

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    const cabecera = document.querySelector('header')
    if (ro && cabecera) ro.observe(cabecera)

    window.addEventListener('resize', medir)
    window.addEventListener('orientationchange', medir)

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', medir)
      window.removeEventListener('orientationchange', medir)
    }
  }, [])

  return offset
}
