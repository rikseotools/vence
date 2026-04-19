'use client'
// components/AutoAssignOposicion.tsx
// Client component montado en las landings de oposición (template dinámico
// app/[oposicion]/page.tsx). Una vez la sesión del usuario esté lista, llama
// al endpoint /api/v2/auto-assign-target con el slug actual. El endpoint
// es idempotente: solo asigna si target_oposicion está NULL. Si ya está
// asignado, no hace nada.
//
// No renderiza nada visible. Solo efecto lateral.

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'

export default function AutoAssignOposicion({ slug }: { slug: string }) {
  const { user, supabase, userProfile } = useAuth()
  const calledRef = useRef(false)

  useEffect(() => {
    if (!user || calledRef.current) return
    // Si ya tiene target, no hace falta llamar (guard adicional cliente
    // para ahorrar un fetch; el endpoint también es idempotente).
    if (userProfile?.target_oposicion) return
    calledRef.current = true

    ;(async () => {
      try {
        const authHeaders = await getAuthHeaders()
        if (!authHeaders['Authorization']) return

        await fetch('/api/v2/auto-assign-target', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({ slug }),
        })
      } catch (err) {
        // Silencioso; no afecta UX si falla
        console.warn('[auto-assign-target] fetch falló:', err)
      }
    })()
  }, [user, userProfile, supabase, slug])

  return null
}
