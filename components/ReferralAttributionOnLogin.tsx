'use client'
// components/ReferralAttributionOnLogin.tsx
// Disparador GLOBAL de atribución de referido: al autenticarse en CUALQUIER página, reclama la
// cookie `vence_ref` (puesta por /r/[code]). Antes solo se disparaba en /embajadores, y un referido
// que pagaba sin volver a esa página perdía la atribución (→ ni cupón ni calificación). Este componente
// (montado en el layout, no renderiza nada) lo cubre en todo el sitio. Idempotente + no-op sin cookie.

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'

export default function ReferralAttributionOnLogin() {
  const { user, loading } = useAuth()
  const claimedFor = useRef<string | null>(null)

  useEffect(() => {
    if (loading || !user) return
    if (claimedFor.current === user.id) return // una vez por usuario/sesión
    claimedFor.current = user.id
    getAuthHeaders()
      .then((headers) => fetch('/api/referrals/attribute', { method: 'POST', headers }))
      .catch(() => { /* silencioso: la atribución nunca rompe la navegación */ })
  }, [loading, user])

  return null
}
