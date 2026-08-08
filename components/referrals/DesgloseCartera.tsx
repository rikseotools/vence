'use client'

// «De dónde vienen tus ingresos», con cada fuente desplegable.
//
// ## Por qué así (Manuel, 30/07/2026)
//
// La primera versión era una lista plana de todas las aportaciones bajo un enlace aparte
// («¿De dónde sale cada euro?»), duplicando el resumen por fuente que ya había justo encima.
// Dos sitios contando lo mismo, y para ver la conversación de un aviso te sacaba a otra
// pantalla: *«al pinchar en conversación se va a otra pantalla y es mucho lío»*.
//
// Ahora manda el resumen: cada fuente (Mejoras/bugs, Recomendaciones, Opiniones…) se abre y
// enseña **sus** aportaciones. La pregunta impugnada y la conversación del aviso se
// despliegan AQUÍ, sin salir de la página — que es donde la persona está mirando su saldo.
//
// La conversación NO se vuelca aquí dentro: se abre en pestaña nueva (ordenador) o en un
// modal (móvil), que es lo que pidió Manuel al ver el primer intento. El motivo de fondo lo
// dio la propia pantalla: al pintar los mensajes en crudo salía **la URL interna de S3** de
// una captura que la usuaria había adjuntado. Un hilo de soporte no es texto plano —lleva
// adjuntos, imágenes y formato—, y re-implementarlo en miniatura significa volver a
// equivocarse en cada detalle. Soporte ya sabe pintarlo: allí se va.
//
// Los mensajes del modal se piden solo al abrirlo.

import { useState } from 'react'
import { ETIQUETA_FUENTE, etiquetaEstado, type BreakdownRow } from '@/lib/referrals/breakdown'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { partirMensaje } from '@/lib/referrals/mensajeAdjuntos'
import { CAPAS } from '@/lib/ui/capas'

/** Qué `kind` del desglose alimenta cada fila del resumen por fuente. */
const KIND_POR_FUENTE: Record<string, BreakdownRow['kind'][]> = {
  bug: ['bug', 'impugnacion'],
  ugc: ['ugc'],
  referido: ['referral'],
  registro_activo: ['referral'],
}

/**
 * Forma REAL de `/api/soporte/messages` (ver `lib/api/soporte/schemas.ts`): camelCase y con
 * nulos permitidos. La primera versión leía `is_admin`/`created_at` y el resultado era que
 * la fecha salía «Invalid Date» y TODOS los mensajes se atribuían al usuario, incluidas
 * nuestras respuestas. Se vio en la captura de móvil.
 */
interface Mensaje {
  id: string
  message: string
  isAdmin: boolean | null
  createdAt: string | null
}

/**
 * Pinta el texto de un mensaje sin enseñar jamás una URL interna.
 *
 * El troceado vive en `lib/referrals/mensajeAdjuntos` y está probado aparte: la primera
 * versión tenía el regex aquí dentro con la bandera `g`, y reutilizarlo con `.test()` hacía
 * que una imagen se pintara y la siguiente saliera como URL (el `lastIndex` persiste entre
 * llamadas). Mismo criterio que la pantalla de Soporte.
 */
function CuerpoMensaje({ texto }: { texto: string }) {
  return (
    <>
      {partirMensaje(texto).map((parte, i) =>
        parte.tipo === 'imagen' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={parte.url}
            alt="Imagen adjunta"
            className="mt-1 rounded-md max-h-40 w-auto"
            loading="lazy"
            onError={(e) => {
              const el = e.target as HTMLImageElement
              el.replaceWith(
                Object.assign(document.createElement('span'), {
                  className: 'text-xs opacity-70',
                  textContent: '📎 imagen adjunta',
                }),
              )
            }}
          />
        ) : (
          <span key={i}>{parte.valor}</span>
        ),
      )}
    </>
  )
}

export default function DesgloseCartera({
  filas,
  fuente,
  soloLectura = false,
}: {
  filas: BreakdownRow[]
  /** `source` de la fila del resumen (bug, ugc, referido, registro_activo). */
  fuente: string
  soloLectura?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  /** Cuántas aportaciones se muestran. Crece de 3 en 3 con «mostrar más antiguas». */
  const [visibles, setVisibles] = useState(3)
  const [filaAbierta, setFilaAbierta] = useState<number | null>(null)
  /** Conversación abierta en modal (solo móvil). */
  const [modal, setModal] = useState<{ id: string; asunto: string } | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[] | 'cargando' | 'error'>('cargando')

  const kinds = KIND_POR_FUENTE[fuente] ?? []
  const propias = (filas || []).filter((f) => kinds.includes(f.kind))
  if (propias.length === 0) return null

  /** ¿Pantalla estrecha? En móvil abrir una pestaña nueva descoloca; mejor un modal. */
  const esMovil = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

  const verConversacion = async (id: string, asunto: string) => {
    const destino = `/soporte?conversation_id=${id}`
    if (!esMovil()) {
      // Ordenador: pestaña nueva. Soporte ya pinta el hilo entero (adjuntos, formato,
      // responder), y no se pierde de vista la cartera.
      window.open(destino, '_blank', 'noopener,noreferrer')
      return
    }
    setModal({ id, asunto })
    setMensajes('cargando')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/soporte/messages?conversationId=${id}`, { headers })
      const body = await res.json()
      if (!res.ok || !body?.success) throw new Error(body?.error || 'no se pudo cargar')
      setMensajes(body.messages || [])
    } catch {
      setMensajes('error')
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
      >
        {abierto ? '▾ Ocultar el detalle' : `▸ Ver las ${propias.length} aportaciones`}
      </button>

      {abierto && (
        <ul className="mt-2 space-y-2">
          {propias.slice(0, visibles).map((b, i) => {
            const est = etiquetaEstado(b.status, b.kind)
            const detalleAbierto = filaAbierta === i
            return (
              <li key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5">
                {/* En móvil apila; en pantalla ancha, importe a la derecha. */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {ETIQUETA_FUENTE[b.kind] ?? b.kind} · {new Date(b.date).toLocaleDateString('es-ES')}
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-100 mt-0.5 break-words">{b.asunto}</div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0 shrink-0">
                    <span className={`text-sm font-bold ${est.cuenta ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                      {b.amount} €
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{est.texto}</span>
                  </div>
                </div>

                {!soloLectura && (b.pregunta || b.conversationId) && (
                  <button
                    onClick={() => {
                      if (b.pregunta) return setFilaAbierta(detalleAbierto ? null : i)
                      if (b.conversationId) void verConversacion(b.conversationId, b.asunto)
                    }}
                    className="mt-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    {b.pregunta ? (detalleAbierto ? 'Ocultar la pregunta' : 'Ver la pregunta') : 'Ver la conversación ↗'}
                  </button>
                )}

                {detalleAbierto && b.pregunta && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-800 dark:text-gray-100 mb-2">{b.pregunta.texto}</p>
                    <ul className="space-y-1">
                      {b.pregunta.opciones.map((o, k) => (
                        <li
                          key={k}
                          className={`text-sm px-2.5 py-1.5 rounded-lg break-words ${
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
      {/* Con muchas aportaciones la página se volvía interminable: se enseñan las más
          recientes y el resto se pide. */}
      {abierto && propias.length > visibles && (
        <button
          onClick={() => setVisibles((v) => v + 3)}
          className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
        >
          Mostrar más antiguas ({propias.length - visibles})
        </button>
      )}

      {/* MODAL (solo móvil). En pantalla estrecha, abrir una pestaña nueva descoloca: se
          pierde el sitio en el que estabas. Aquí se lee el hilo y se cierra. Para responder
          está el enlace a Soporte, que es donde vive esa conversación de verdad. */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ zIndex: CAPAS.modal }}
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tu conversación</div>
                <div className="text-sm text-gray-800 dark:text-gray-100 truncate">{modal.asunto}</div>
              </div>
              <button
                onClick={() => setModal(null)}
                className="shrink-0 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3 space-y-2">
              {mensajes === 'cargando' && <p className="text-sm text-gray-500">Cargando…</p>}
              {mensajes === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400">No se pudo cargar la conversación.</p>
              )}
              {Array.isArray(mensajes) && mensajes.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin mensajes.</p>
              )}
              {Array.isArray(mensajes) &&
                mensajes.map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm rounded-lg px-3 py-2 break-words ${
                      m.isAdmin
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                        : 'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    <div className="text-[11px] font-semibold opacity-70 mb-0.5">
                      {m.isAdmin ? 'Vence' : 'Tú'}
                      {m.createdAt && !Number.isNaN(Date.parse(m.createdAt))
                        ? ` · ${new Date(m.createdAt).toLocaleDateString('es-ES')}`
                        : ''}
                    </div>
                    <CuerpoMensaje texto={m.message} />
                  </div>
                ))}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <a
                href={`/soporte?conversation_id=${modal.id}`}
                className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
              >
                Abrir en Soporte para responder →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
