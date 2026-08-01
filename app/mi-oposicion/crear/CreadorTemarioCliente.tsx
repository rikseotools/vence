'use client'
// Puente entre la página (servidor) y el creador (cliente): aporta el nombre del autor, que es
// lo único que el creador necesita del contexto de sesión. (T-327)
//
// Va aparte para que `CreadorTemario` no dependa de `AuthContext`: así el componente que tiene
// toda la lógica se puede montar en una prueba o en una simulación sin levantar la sesión.

import { useAuth } from '@/contexts/AuthContext'
import CreadorTemario from '@/components/miOposicion/CreadorTemario'

export default function CreadorTemarioCliente() {
  const { user, loading } = useAuth() as {
    user?: { full_name?: string | null; email?: string | null } | null
    loading?: boolean
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-500">Cargando…</div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crea tu oposición</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Necesitas iniciar sesión para armar tu propio temario y poder guardarlo.
        </p>
        <a
          href="/login"
          className="inline-block mt-6 px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          Iniciar sesión
        </a>
      </div>
    )
  }

  // Solo el nombre; nunca el email. El nombre público lleva pila + iniciales (ver `temario.ts`).
  return <CreadorTemario autor={user.full_name ?? null} />
}
