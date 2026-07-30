'use client'

// Aviso de que la misma oposición tiene OTRA convocatoria viva con temario distinto.
//
// POR QUÉ EXISTE (30/07/2026, caso Ana Isabel): Auxiliar Administrativo de la Comunidad de
// Madrid tiene dos convocatorias abiertas con programas distintos (examen octubre 2026 con
// Windows 10, junio 2027 con Windows 11). En el selector de oposición se distinguen bien,
// pero una vez dentro NADA lo decía: una usuaria estuvo estudiando el temario que no le
// tocaba y se enteró de casualidad, escribiendo a soporte por otra cosa. Teníamos el dato y
// no se lo dijimos.
//
// Es informativo, no alarmista: no dice que esté haciendo algo mal (a lo mejor está en la
// correcta), dice que compruebe. Y se puede cerrar, porque a quien ya lo ha comprobado no
// hay que repetírselo en cada visita.
import { useEffect, useState } from 'react'
import {
  decidirAvisoHermanas,
  textoAvisoHermanas,
  etiquetaExamen,
  type OposicionHermana,
} from '@/lib/convocatoria/convocatoriasHermanas'
import { emitClientEvent } from '@/lib/observability/client'
// `localStorage` desnudo lanza con la cuota llena o en Safari privado y se lleva la interfaz
// entera; el helper devuelve null/false y además lo reporta. Lo exige el lint.
import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'

const CLAVE = 'vence_aviso_convocatorias_ocultas'

export default function AvisoConvocatoriasHermanas({
  hermanas,
  onCambiar,
}: {
  hermanas: OposicionHermana[]
  /** Abre el selector de oposición ya existente (no duplicamos ese flujo aquí). */
  onCambiar?: () => void
}) {
  const aviso = decidirAvisoHermanas(hermanas)
  const actual = hermanas.find((h) => h.actual)
  const [oculto, setOculto] = useState(true) // arranca oculto: evita el parpadeo antes de leer la preferencia

  useEffect(() => {
    if (!aviso.mostrar || !actual) return
    let cerrado = false
    try {
      cerrado = (JSON.parse(safeGet(CLAVE) || '[]') as string[]).includes(actual.slug)
    } catch {
      // localStorage puede no estar disponible (Safari privado, cuota). Enseñar el aviso es
      // el estado seguro: se prefiere repetirlo a ocultarlo por un fallo de almacenamiento.
      cerrado = false
    }
    setOculto(cerrado)
    if (!cerrado) {
      emitClientEvent({
        severity: 'info',
        eventType: 'custom',
        metadata: { evento: 'aviso_convocatorias_hermanas', accion: 'mostrado', slug: actual.slug, otras: aviso.otras.length },
      })
    }
  }, [aviso.mostrar, aviso.otras.length, actual])

  if (!aviso.mostrar || oculto || !actual) return null

  const cerrar = () => {
    setOculto(true)
    try {
      const previos = JSON.parse(safeGet(CLAVE) || '[]') as string[]
      safeSet(CLAVE, JSON.stringify([...new Set([...previos, actual.slug])]))
    } catch { /* sin memoria: volverá a salir, que es el lado seguro */ }
    emitClientEvent({
      severity: 'info',
      eventType: 'custom',
      metadata: { evento: 'aviso_convocatorias_hermanas', accion: 'cerrado', slug: actual.slug },
    })
  }

  const suExamen = etiquetaExamen(actual.examDate)

  return (
    <div className="mb-6 mx-auto max-w-2xl rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-left">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden>⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {textoAvisoHermanas(aviso)}
          </p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Estás en <strong>{actual.nombre}</strong>
            {suExamen ? ` (examen en ${suExamen})` : ''}.
          </p>
          <ul className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            {aviso.otras.map((o) => {
              const e = etiquetaExamen(o.examDate)
              return (
                <li key={o.slug}>
                  La otra es <strong>{o.nombre}</strong>{e ? ` (examen en ${e})` : ''}.
                </li>
              )
            })}
          </ul>
          {onCambiar && (
            <button
              onClick={onCambiar}
              className="mt-3 text-sm font-semibold text-amber-900 dark:text-amber-100 underline underline-offset-2 hover:no-underline"
            >
              Cambiar de convocatoria
            </button>
          )}
        </div>
        <button
          onClick={cerrar}
          aria-label="Ocultar aviso"
          className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 text-lg leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
