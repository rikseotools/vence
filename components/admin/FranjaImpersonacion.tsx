'use client'

// Franja fija de «estás viendo la cuenta de otra persona» (T-289).
//
// No es decoración: el incidente clásico de la suplantación es el admin que se olvida de
// dónde está. El candado de solo lectura impide el daño, y esta franja impide la confusión
// —por ejemplo, leer un dato de otra cuenta creyendo que es la propia y responderle a un
// usuario con la información equivocada—.
//
// Se pinta en el layout raíz para TODAS las páginas, porque la suplantación afecta a toda la
// app, no a una pantalla. Cuando no hay suplantación no renderiza nada ni hace peticiones
// extra: se apoya en la sesión que el AuthContext ya tiene.

import { useEffect, useState } from 'react'
import { CAPAS } from '@/lib/ui/capas'

export default function FranjaImpersonacion() {
  const [datos, setDatos] = useState<{ email: string | null; admin: string } | null>(null)
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    let vivo = true
    // Sin la cookie-marca no hay suplantación posible → ni una petición. Este componente vive
    // en el layout raíz, así que preguntar siempre al servidor costaría un fetch por carga de
    // página a todos los usuarios, por una función que usa el administrador.
    //
    // T-335 — esto es correcto SOLO porque la marca ya no tiene reloj propio. Hasta el
    // 30/07/2026 caducaba a los 30 minutos mientras la sesión suplantada se renovaba sola en
    // cada carga: la franja desaparecía y la suplantación seguía, o sea invisible. Hoy la
    // marca la re-emite `/api/auth/token` con el restante REAL (`impExp`), así que marca y
    // sesión mueren a la vez, y si el navegador pierde la marca el siguiente tick de sesión
    // la repone. Si algún día se le vuelve a dar vida propia, este `return` vuelve a mentir.
    if (!document.cookie.split('; ').some((c) => c.startsWith('vence_imp='))) return
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!vivo || !s?.impersonadoPor) return
        setDatos({ email: s?.user?.email ?? null, admin: String(s.impersonadoPor) })
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  if (!datos) return null

  const salir = async () => {
    setSaliendo(true)
    // Ruta FUERA de /api/admin/*: durante la suplantación el token es el del usuario, así
    // que el guard de admin rechazaba la salida y dejaba atrapado dentro de su cuenta.
    await fetch('/api/impersonacion/salir', { method: 'POST' }).catch(() => {})
    window.location.href = '/admin'
  }

  return (
    // z-index por CAPAS.sistema (T-608): con z-[9999] empataba con el banner de cookies y
    // quedaba POR DEBAJO de CAPAS.modal (10000) — un modal abierto durante una suplantación
    // tapaba el aviso de "estás viendo la cuenta de otra persona", justo lo que este aviso
    // existe para impedir.
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-sm font-semibold shadow-lg" style={{ zIndex: CAPAS.sistema }}>
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <span className="truncate">
          👁️ Estás viendo la cuenta de <strong>{datos.email ?? 'este usuario'}</strong> — solo lectura
        </span>
        <button
          onClick={salir}
          disabled={saliendo}
          className="shrink-0 bg-white/20 hover:bg-white/30 disabled:opacity-60 rounded-lg px-3 py-1 transition-colors"
        >
          {saliendo ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </div>
  )
}
