'use client'

// components/AvisoMultiCuentaModal.tsx
//
// Aviso de «una cuenta por persona y dispositivo» ([T-418], 01/08/2026).
//
// ── PARA QUÉ SIRVE, QUE NO ES OBVIO ─────────────────────────────────────────
// El cupo diario del plan gratuito se cuenta también por DISPOSITIVO: todas las cuentas free
// del mismo equipo suman. Quien entra con una segunda cuenta se encuentra el cupo ya gastado
// (si en la otra hizo 15, le quedan 10) y hasta ahora eso pasaba SIN EXPLICACIÓN — la interfaz
// le dejaba contestar y el servidor tiraba cada respuesta con un 403 mudo. Medido en 14 días:
// 27 usuarios, 1.471 respuestas perdidas.
//
// Este aviso existe para que, cuando luego le salga el muro de Premium haciendo un test, **ya
// sepa por qué**. El muro es el de siempre, el mismo que ve cualquier free que agota su cupo:
// aquí no se le castiga aparte, solo se le informa.
//
// ── LO QUE NO HACE, A PROPÓSITO ─────────────────────────────────────────────
// · NO dice cuántas cuentas hemos visto ni cómo las relacionamos (sería el manual de evasión).
// · NO habla de fraude ni de trampas: la regla se cita y punto.
// · NO se le enseña a un PREMIUM. Mucha gente que paga tiene además una cuenta gratuita, y a un
//   premium no se le limita nada, así que avisarle sería molestar a un cliente sin motivo. El
//   filtro está en dos sitios (el endpoint solo cuenta cuentas free, y `debeMostrarAviso`
//   descarta premium).
// · NO se repite en cada carga: una vez al día mientras la situación siga (decisión de Manuel).

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDailyQuestionLimit } from '../hooks/useDailyQuestionLimit'
import { claveAceptacion, debeMostrarAviso, diaLocal } from '../lib/multicuenta/aviso'
import { emitClientEvent } from '@/lib/observability/client'

export default function AvisoMultiCuentaModal() {
  const { user } = useAuth() as any
  const { multiCuentaDispositivo, isPremiumUser, loading } = useDailyQuestionLimit()
  const [visible, setVisible] = useState(false)
  const [clave, setClave] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const userId = user?.id ?? null
    if (!userId) return

    const k = claveAceptacion(userId, diaLocal(new Date()))
    let yaAceptadoHoy = false
    try {
      yaAceptadoHoy = window.localStorage.getItem(k) === '1'
    } catch {
      // Navegador con almacenamiento bloqueado: se prefiere NO enseñarlo a enseñarlo en bucle.
      yaAceptadoHoy = true
    }

    setClave(k)
    const mostrar = debeMostrarAviso({
      multiCuenta: multiCuentaDispositivo,
      esPremium: isPremiumUser,
      userId,
      yaAceptadoHoy,
      cargando: loading,
    })
    setVisible(mostrar)

    // Este aviso solo dejaba rastro en `localStorage`, o sea en el navegador de quien lo ve.
    // Consecuencia práctica (04/08/2026): al ir a verificar [T-418] en producción, el punto
    // «¿le sale el modal y deja de salirle tras Aceptar?» resultó **imposible de comprobar** —
    // no hay dato que mirar. Una pantalla que decide algo y no deja huella no se puede verificar
    // ni medir: no sabemos a cuánta gente le sale, ni si alguien lo acepta.
    // `info` a propósito: no es una avería, es un embudo (visto → aceptado).
    if (mostrar) {
      emitClientEvent({
        severity: 'info',
        eventType: 'multicuenta_aviso',
        metadata: { accion: 'visto' },
      })
    }
  }, [user?.id, multiCuentaDispositivo, isPremiumUser, loading])

  if (!visible) return null

  const aceptar = () => {
    let guardado = true
    try {
      if (clave) window.localStorage.setItem(clave, '1')
    } catch {
      // Si no se puede guardar, al menos no se queda atascado en pantalla.
      guardado = false
    }
    // `guardado:false` es justo el caso que hace que el aviso REAPAREZCA en la siguiente carga
    // (navegador con almacenamiento bloqueado). Sin este dato, eso se vive como «me sale todo el
    // rato» y no habría forma de distinguirlo de un fallo de la condición.
    emitClientEvent({
      severity: 'info',
      eventType: 'multicuenta_aviso',
      metadata: { accion: 'aceptado', guardado },
    })
    setVisible(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-multicuenta-titulo"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2
          id="aviso-multicuenta-titulo"
          className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3"
        >
          Una cuenta por persona y dispositivo
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          Hemos detectado que en este dispositivo se está usando más de una cuenta. Nuestros
          términos de uso permiten <strong>una cuenta por persona y por dispositivo</strong>.
        </p>
        <p className="text-gray-600 dark:text-gray-300 mb-5">
          El límite diario de preguntas del plan gratuito se cuenta por dispositivo, así que las
          preguntas que ya se hayan hecho hoy aquí descuentan del total. Con Premium no hay
          límite diario.
        </p>
        <button
          onClick={aceptar}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
