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

import { useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'
import BotonVerComoUsuario from '@/components/admin/BotonVerComoUsuario'

interface Usuario {
  id: string
  email: string
  nombre: string | null
  plan: string | null
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

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (q.trim().length < 2) {
      setError('Escribe al menos 2 letras')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/usuarios/buscar?q=${encodeURIComponent(q.trim())}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `Error ${res.status}`)
      setUsuarios(body.usuarios || [])
      setTruncado(!!body.truncado)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCargando(false)
    }
  }

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
          placeholder="Buscar por nombre o correo…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={cargando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

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
                      {u.plan === 'premium' && (
                        <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-full font-medium">
                          premium
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
                      {u.oposicion || 'sin oposición elegida'} · alta {fecha(u.alta)} · visto{' '}
                      {fecha(u.ultimaActividad)}
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
