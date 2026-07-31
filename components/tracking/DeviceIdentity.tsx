'use client'

// components/tracking/DeviceIdentity.tsx
//
// Crea el identificador de dispositivo al ARRANCAR la app. Una línea, y es toda la pieza.
//
// ── POR QUÉ EXISTE ([T-371], 31/07/2026) ────────────────────────────────────────────────────
//
// Hasta hoy `vence_device_id` solo nacía en dos sitios, y ninguno tenía que ver con seguridad:
// el beacon de atribución de campañas (`AttributionCapture`) y el widget del chat de IA. En el
// primero, además, la creación quedaba DESPUÉS de dos `return` —uno de ellos para las sesiones
// que empiezan por navegación interna—, así que el ancla del antifraude era un efecto
// secundario de una pieza de marketing.
//
// Consecuencia medida el 31/07: el 38,7% de las altas recientes no tenía ni una fila en
// `user_devices`. 405 usuarios con actividad real y cero huella. Y el sesgo, lo peor: los
// premium cubiertos al 97% (usan mucho la app y acaban disparando alguno de los dos caminos)
// frente al 52% de las cuentas free fuera, que es justo donde vive el farmeo del límite
// gratuito y donde se abren cuentas de más.
//
// El flujo que sí importaba —responder preguntas— solo LEÍA el valor (`answerSaveQueue` hace
// `getItem`), nunca lo creaba. Quien no pasaba por marketing ni abría el chat era invisible
// para el sweep de multicuenta, para el límite de dispositivos y para la comprobación
// anti-autoreferido de los referidos.
//
// Montado en el layout, el identificador existe desde la primera carga de cualquier página. No
// pinta nada, no pide permisos y no hace red: solo asegura que el ancla EXISTE antes de que
// alguien la necesite.

import { useEffect } from 'react'
import { getOrCreateDeviceId } from '@/hooks/useDeviceTracking'

export default function DeviceIdentity() {
  useEffect(() => {
    try {
      getOrCreateDeviceId()
    } catch {
      // `localStorage` puede lanzar (modo privado de Safari, almacenamiento lleno, cookies
      // bloqueadas). Que falle la identificación NO puede romper la carga de la página: el
      // servidor ya trata la ausencia de ancla como «no identificado», que es el caso que
      // esta pieza reduce, no el que garantiza.
    }
  }, [])

  return null
}
