'use client'

// El desglose de la cartera del embajador: qué aportación concreta generó cada euro.
//
// Vive en un componente propio porque lo pintan DOS sitios y tienen que enseñar exactamente
// lo mismo: `/recompensas` (lo que ve la persona) y `/admin/referidos/<userId>` (donde
// miramos «lo que ellos ven» antes de escribirles). Si fueran dos copias, una envejecería y
// estaríamos respondiendo sobre una pantalla que ya no existe — que es justo el fallo que
// acabamos de cometer indicándole a un usuario un rótulo de otra pantalla.
//
// `soloLectura` apaga los enlaces a Soporte: desde el panel de admin abrirían la ficha CON
// NUESTRA sesión, no con la suya, y lo que se quiere ahí es ver su pantalla, no navegar.

import { useState } from 'react'
import Link from 'next/link'
import { ETIQUETA_FUENTE, etiquetaEstado, type BreakdownRow } from '@/lib/referrals/breakdown'

export default function DesgloseCartera({
  filas,
  soloLectura = false,
  abiertoPorDefecto = false,
}: {
  filas: BreakdownRow[]
  soloLectura?: boolean
  abiertoPorDefecto?: boolean
}) {
  const [verDetalle, setVerDetalle] = useState(abiertoPorDefecto)
  const [filaAbierta, setFilaAbierta] = useState<number | null>(null)

  if (!filas || filas.length === 0) return null

  return (
    <div className="mt-5">
      <button
        onClick={() => setVerDetalle((v) => !v)}
        className="text-sm font-semibold text-blue-700 dark:text-blue-300 underline underline-offset-2 hover:no-underline"
      >
        {verDetalle ? 'Ocultar el detalle' : '¿De dónde sale cada euro?'}
      </button>
      {verDetalle && (
        <ul className="mt-3 space-y-2">
          {filas.map((b, i) => {
            const est = etiquetaEstado(b.status)
            const abierta = filaAbierta === i
            // Cada aportación se puede seguir hasta su origen: la pregunta se despliega aquí
            // mismo (reconocerla es lo que se pedía) y la ficha completa —explicación,
            // artículo, resolución— o el hilo del aviso se abren en Soporte, que ya tiene
            // esas vistas hechas.
            const enlace = b.disputeId
              ? `/soporte?tab=impugnaciones&dispute_id=${b.disputeId}`
              : b.conversationId
                ? `/soporte?conversation_id=${b.conversationId}`
                : null
            return (
              <li key={i} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {ETIQUETA_FUENTE[b.kind as keyof typeof ETIQUETA_FUENTE] ?? b.kind}
                      {' · '}
                      {new Date(b.date).toLocaleDateString('es-ES')}
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-100 mt-0.5 break-words">
                      {b.asunto}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {b.pregunta && (
                        <button
                          onClick={() => setFilaAbierta(abierta ? null : i)}
                          className="text-xs font-semibold text-blue-700 dark:text-blue-300 underline underline-offset-2 hover:no-underline"
                        >
                          {abierta ? 'Ocultar la pregunta' : 'Ver la pregunta'}
                        </button>
                      )}
                      {enlace && !soloLectura && (
                        <Link
                          href={enlace}
                          className="text-xs font-semibold text-blue-700 dark:text-blue-300 underline underline-offset-2 hover:no-underline"
                        >
                          {b.disputeId ? 'Ver la ficha completa' : 'Ver la conversación'}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${est.cuenta ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                      {b.amount} €
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{est.texto}</div>
                  </div>
                </div>
                {abierta && b.pregunta && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-800 dark:text-gray-100 mb-2">{b.pregunta.texto}</p>
                    <ul className="space-y-1">
                      {b.pregunta.opciones.map((o, k) => (
                        <li
                          key={k}
                          className={`text-sm px-3 py-1.5 rounded-lg ${
                            b.pregunta!.correcta === k
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-medium'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {String.fromCharCode(65 + k)}) {o}
                          {b.pregunta!.correcta === k && ' ✓'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
