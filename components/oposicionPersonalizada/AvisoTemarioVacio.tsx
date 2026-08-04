// components/oposicionPersonalizada/AvisoTemarioVacio.tsx — «esta oposición aún no tiene temas». [T-508]
//
// ── POR QUÉ ES UN COMPONENTE Y NO DOS PÁRRAFOS COPIADOS ─────────────────────────────────────
//
// Porque el mismo estado —una personalizada que existe pero está vacía— lo pintan DOS rutas
// (`/oposicion-personalizada/[id]/test` y `…/temario`) y hasta hoy solo una de ellas lo
// explicaba: la de tests decía qué pasaba y la de temario soltaba un **404 pelado**. Una
// usuaria premium se encontró ese 404 al pulsar el icono 📚 del Header y escribió creyendo que
// la plataforma estaba rota.
//
// Dos textos separados vuelven a divergir en cuanto alguien toque uno. Con uno solo, la próxima
// ruta que necesite decir esto lo dice igual.
//
// NO es lo mismo que un 404: el 404 sigue siendo la respuesta correcta para un id inventado o
// para una oposición que no existe. Aquí la oposición existe y es tuya — lo que falta es
// contenido, y eso tiene arreglo desde el editor.

import Link from 'next/link'
import { enlaceEditor } from '@/lib/oposicionPersonalizada/enlaceEditor'

export default function AvisoTemarioVacio({
  ctaEditor = true,
  personalizadaId = null,
}: {
  ctaEditor?: boolean
  /** [T-523] Con él, el editor abre ESTA oposición en vez de la lista. Sin él, la lista. */
  personalizadaId?: string | null
}) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-900 dark:text-amber-100">
      <p>
        Este temario aún no tiene temas con contenido. Vuelve al editor y añade leyes y artículos
        a algún tema.
      </p>
      {ctaEditor && (
        <Link
          href={enlaceEditor(personalizadaId)}
          className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Ir al editor del temario
        </Link>
      )}
    </div>
  )
}
