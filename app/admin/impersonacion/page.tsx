'use client'
// app/admin/impersonacion/page.tsx — «Ver la app como la ve un usuario» (T-289).
//
// Puerta única: se busca a la persona por NOMBRE o CORREO y se entra en su sesión, en solo
// lectura y durante 30 minutos. Es una pestaña propia y no un botón escondido en otra
// pantalla porque el caso de uso llega desde cualquier sitio —un feedback, una impugnación,
// una llamada— y siempre empieza igual: «esta persona dice que ve X».
//
// Lo que se ve NO es una imitación de su pantalla: es su sesión real, así que la app entera
// (páginas, APIs, caché por usuario, badges) responde como le responde a ella. Una pantalla
// de admin que imita a la del usuario diverge con el tiempo y acaba mintiendo.

import { useState, useEffect, useRef } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import BotonVerComoUsuario from '@/components/admin/BotonVerComoUsuario'

interface Usuario {
  id: string
  email: string
  nombre: string | null
  plan: string | null
  ciudad: string | null
  oposicion: string | null
  alta: string | null
  ultimaActividad: string | null
  esAdmin: boolean
}

export default function ImpersonacionPage() {
  const [q, setQ] = useState('')
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncado, setTruncado] = useState(false)
  // Nº de la última búsqueda lanzada. Sirve para descartar respuestas que llegan tarde: al
  // teclear se disparan varias, y sin esto una respuesta lenta de «fl» puede pisar a la de
  // «flor» y dejar en pantalla resultados que no corresponden a lo escrito.
  const ultima = useRef(0)
  const aborto = useRef<AbortController | null>(null)

  const buscar = async (e?: React.FormEvent, texto?: string) => {
    e?.preventDefault()
    const termino = (texto ?? q).trim()
    if (termino.length < 2) {
      setError(termino.length === 0 ? null : 'Escribe al menos 2 letras')
      setUsuarios(null)
      return
    }
    // Cancela la petición anterior: escribir rápido no debe dejar una cola de consultas
    // corriendo contra la base por cada tecla.
    aborto.current?.abort()
    const ctrl = new AbortController()
    aborto.current = ctrl
    const turno = ++ultima.current
    setCargando(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/usuarios/buscar?q=${encodeURIComponent(termino)}`, {
        signal: ctrl.signal,
      })
      if (turno !== ultima.current) return // llegó tarde: ya hay una búsqueda más nueva
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Un 401/403 aquí casi siempre es la sesión, no la búsqueda: decirlo con esas
        // palabras ahorra el rato de mirar una pantalla en blanco sin saber qué pasa.
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            'Tu sesión de administrador no es válida (o ha caducado). Cierra sesión y vuelve a entrar.',
          )
        }
        throw new Error(body?.error || `La búsqueda falló (error ${res.status})`)
      }
      setUsuarios(body.usuarios || [])
      setTruncado(!!body.truncado)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return // cancelada por otra más nueva
      if (turno !== ultima.current) return
      // Nunca dejar la pantalla muda: sin mensaje, un fallo parece «no hace nada».
      setError((err as Error).message || 'No se pudo completar la búsqueda')
      setUsuarios(null)
    } finally {
      if (turno === ultima.current) setCargando(false)
    }
  }

  // Búsqueda en vivo: filtra según se escribe, con un respiro de 250 ms para no lanzar una
  // consulta por tecla. La consulta tarda 60-100 ms sobre 11.601 usuarios, así que el
  // resultado aparece prácticamente al terminar de teclear.
  useEffect(() => {
    const t = setTimeout(() => { void buscar(undefined, q) }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString('es-ES') : '—')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        👁️ Ver la app como un usuario
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Para entender lo que alguien nos cuenta hay que ver <strong>su</strong> pantalla: su plan, su
        oposición, sus límites, su temario. Aquí entras en su sesión real.
      </p>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-6 text-sm text-amber-900 dark:text-amber-200">
        <strong>Solo lectura.</strong> Con esa sesión no se puede escribir nada: ni responder tests,
        ni gastar su cupo, ni enviar mensajes, ni tocar su plan. Caduca sola a los 30 minutos, verás
        una franja roja mientras dure, y queda registrado quién entró, en qué cuenta y para qué.
      </div>

      <form onSubmit={buscar} className="flex gap-2 mb-6">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe un nombre o un correo…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {/* El formulario se queda por el Enter y por accesibilidad, pero ya no hace falta
            pulsarlo: la lista se filtra sola al escribir. */}
        <button
          type="submit"
          disabled={cargando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {usuarios && usuarios.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nadie coincide con «{q}». Prueba con parte del correo o del nombre.
        </p>
      )}

      {usuarios && usuarios.length > 0 && (
        <>
          {truncado && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Se muestran los 25 primeros: afina la búsqueda si no está quien buscas.
            </p>
          )}
          <ul className="space-y-3">
            {usuarios.map((u) => (
              <li
                key={u.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {u.nombre || '(sin nombre)'}
                      {/* El plan se pinta SIEMPRE, también cuando es free. Antes solo salía
                          la etiqueta de premium, así que «free» había que deducirlo de que no
                          hubiera nada — y la ausencia de una etiqueta no se distingue de un
                          dato que no cargó. Es lo primero que se mira para entender un
                          reporte: los límites diarios y medio producto dependen de eso. */}
                      {u.plan === 'premium' ? (
                        <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-full font-medium">
                          premium
                        </span>
                      ) : (
                        <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                          free
                        </span>
                      )}
                      {u.esAdmin && (
                        <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                          admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 truncate">{u.email}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {/* La ciudad va delante de la oposición porque es lo que desempata
                          entre homónimos: buscar «maria luisa» devuelve cinco personas y el
                          correo no siempre dice quién es. */}
                      📍 {u.ciudad || 'sin ciudad'} · {u.oposicion || 'sin oposición elegida'} · alta{' '}
                      {fecha(u.alta)} · visto {fecha(u.ultimaActividad)}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {u.esAdmin ? (
                      // El servidor lo rechaza igualmente; no ofrecer el botón evita el clic
                      // inútil y explica el porqué.
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[16rem]">
                        No se puede entrar en la cuenta de otro administrador.
                      </p>
                    ) : (
                      <BotonVerComoUsuario userId={u.id} nombre={u.nombre || u.email} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
