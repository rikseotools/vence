'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * ¿El elemento observado ha dejado de verse?
 *
 * Sirve para que un control flotante aparezca SOLO cuando hace falta. En el examen, la
 * cabecera ya enseña el tiempo y las respondidas: si los controles flotantes salieran también
 * ahí, taparían el título sin aportar nada. Aparecen cuando esa cabecera se va de pantalla —
 * que es justo el momento del que se quejaba Manolo ("una vez que pasas de la primera pregunta
 * dejas de ver el reloj").
 *
 * El `ref` es una FUNCIÓN, no un `useRef`: el componente que lo usa tiene returns tempranos
 * (cargando, error), así que el nodo no existe en el primer render. Con un ref normal el
 * observador se montaba sobre `null` y no volvía a intentarlo — los controles no aparecían
 * nunca. Así se engancha en cuanto el nodo entra en el DOM, tarde lo que tarde.
 *
 * Devuelve `false` mientras no se sabe (SSR o sin `IntersectionObserver`): en el peor caso los
 * controles tardan un instante en aparecer, nunca tapan de más.
 */
export function useFueraDePantalla<T extends HTMLElement>(minimoVisiblePx = 60) {
  const [fuera, setFuera] = useState(false)
  const observadorRef = useRef<IntersectionObserver | null>(null)

  const ref = useCallback((nodo: T | null) => {
    observadorRef.current?.disconnect()
    observadorRef.current = null
    if (!nodo || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      // "Fuera" = queda MENOS de `minimoVisiblePx` a la vista, no "ni un píxel". Con el
      // criterio estricto, saltar a una pregunta de arriba volvía a asomar la cabecera y los
      // controles se escondían en mitad del salto: no se podían encadenar dos saltos seguidos.
      // Se mide en píxeles y no en porcentaje para que dé igual lo que crezca la tarjeta.
      (entradas) => {
        const e = entradas[entradas.length - 1]
        setFuera(e.intersectionRect.height < minimoVisiblePx)
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )
    obs.observe(nodo)
    observadorRef.current = obs
  }, [minimoVisiblePx])

  useEffect(() => () => observadorRef.current?.disconnect(), [])

  return { ref, fuera }
}
