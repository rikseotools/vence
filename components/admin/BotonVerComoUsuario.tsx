'use client'

// Botón «Ver la app como este usuario» (T-289).
//
// Un componente y no código suelto en una página porque el caso de uso aparece en varios
// sitios: la ficha del embajador, un feedback que no se entiende sin ver su pantalla, una
// impugnación sobre algo que solo le pasa a esa persona. Todos deberían abrir la MISMA
// puerta, con la misma auditoría.
//
// Pide un motivo por escrito. No es burocracia: es lo que hace que el registro de auditoría
// sirva para algo dentro de tres meses, y obliga a pensar dos segundos antes de entrar en la
// cuenta de alguien.

import { useState } from 'react'
import { adminFetch } from '@/lib/api/adminFetch'

export default function BotonVerComoUsuario({
  userId,
  nombre,
}: {
  userId: string
  nombre?: string | null
}) {
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entrar = async () => {
    const motivo = window.prompt(
      `Vas a ver la app como ${nombre || 'este usuario'}, en SOLO LECTURA y durante 30 minutos.\n\n¿Para qué? (queda registrado)`,
      '',
    )
    if (motivo === null) return // canceló
    setAbriendo(true)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/impersonar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, motivo }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `Error ${res.status}`)
      // La cookie ya viene puesta en la respuesta: basta con navegar.
      window.location.href = body?.ir || '/perfil'
    } catch (e) {
      setError((e as Error).message)
      setAbriendo(false)
    }
  }

  return (
    <div>
      <button
        onClick={entrar}
        disabled={abriendo}
        className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        👁️ {abriendo ? 'Entrando…' : 'Ver la app como este usuario'}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Solo lectura · caduca en 30 min · queda registrado
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}
