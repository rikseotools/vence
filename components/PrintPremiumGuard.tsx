'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Anti-fuga premium del temario (impresión).
 *
 * El botón "Imprimir PDF" y el endpoint `/api/temario/.../pdf` ya son Premium,
 * pero un usuario NO premium podía extraer el temario con la IMPRESIÓN DEL
 * NAVEGADOR (Ctrl+P / menú Imprimir → "Guardar como PDF"): los TopicContentView
 * renderizan todo el contenido en el DOM y las leyes plegadas usan
 * `hidden print:block`, así que al imprimir aparecía el tema completo.
 *
 * Este guardia lo cierra desde UN SOLO SITIO (montado una vez en el layout raíz,
 * dentro de AuthProvider): pone `data-print-locked` en <html> cuando el usuario
 * no es premium y está en una página de temario. La regla `@media print` de
 * globals.css oculta el contenido (`.article-content`, clase exclusiva del
 * temario) y muestra el aviso. **Solo afecta a la impresión — la pantalla queda
 * intacta** (el free sigue leyendo el temario en la web). Premium imprime normal.
 *
 * Robusto/escalable: cubre cualquier oposición actual o futura sin tocar los
 * ~112 TopicContentView duplicados.
 */
export default function PrintPremiumGuard() {
  const { isPremium } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    // Solo las páginas de CONTENIDO del temario ('/<oposicion>/temario/<slug>')
    // contienen `.article-content`; el índice ('/<oposicion>/temario') no.
    const onTemarioContent = !!pathname && pathname.includes('/temario/')
    const shouldLock = onTemarioContent && !isPremium
    const html = document.documentElement
    if (shouldLock) html.setAttribute('data-print-locked', '')
    else html.removeAttribute('data-print-locked')
    return () => html.removeAttribute('data-print-locked')
  }, [isPremium, pathname])

  // Aviso oculto en pantalla; solo se muestra en la impresión cuando hay lock
  // (regla en globals.css). aria-hidden: es puramente para el papel.
  return (
    <div className="print-premium-notice" aria-hidden="true">
      <strong>Este temario es Premium</strong>
      <span>
        La descarga e impresión del temario está disponible con Premium en vence.es.
      </span>
    </div>
  )
}
