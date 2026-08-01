// app/mi-oposicion/crear/page.tsx — crear tu propia oposición. (T-327)
//
// `noindex` a propósito: es una herramienta de usuario autenticado, no contenido de catálogo.
// Las oposiciones que se creen aquí SÍ serán públicas y elegibles por otros, pero eso es una
// página distinta — mezclar el creador con el catálogo es justo lo que ensucia el SEO.

import type { Metadata } from 'next'
import CreadorTemarioCliente from './CreadorTemarioCliente'

export const metadata: Metadata = {
  title: 'Crea tu oposición | Vence',
  description:
    'Arma tu propio temario eligiendo las leyes y los artículos que entran en cada tema.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <CreadorTemarioCliente />
    </main>
  )
}
