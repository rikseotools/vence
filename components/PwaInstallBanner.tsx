'use client'

/**
 * Banner «instala la app» — invitación a instalar la PWA. Solo móvil, solo a quien no la tiene.
 *
 * ## Por qué vuelve a existir
 *
 * La PWA funciona y quien la instala usa la plataforma **4,4× más** (1.909 interacciones por
 * usuario en 30 días frente a 431) y es premium en un 28% frente al 5%. Pero solo la tiene el
 * **2%** de los usuarios activos, y no es casualidad: **nadie invita a instalarla** desde que el
 * banner desapareció con la retirada del sistema de push (03/05/2026), porque vivía dentro de
 * `PushNotificationManager`.
 *
 * ## Cómo está montado
 *
 * - **La decisión vive fuera**, en `lib/pwa/installBanner.ts` (puro, sin DOM). Aquí solo se
 *   recogen las señales del navegador y se pinta. Así las reglas se prueban enteras sin montar
 *   un navegador, que es donde de verdad se cometen los errores.
 * - **La medición usa la observabilidad que ya hay** (`emitClientEvent`, tipo
 *   `pwa_install_banner`). No se resucita `pwa_events`/`pwaTracker`: esas tablas las escribía
 *   supabase-js, llevan congeladas desde el 21/05 y no las lee nadie.
 * - **La adopción NO se mide aquí.** «Quién la usa y cuánto» ya viaja en
 *   `user_interactions.device_info.isStandalone` desde siempre. Aquí solo se mide el EMBUDO del
 *   banner (visto → aceptado → instalado / descartado).
 * - **El descarte se persiste** con `safeLocalStorage`, que ya trata el caso de Safari privado
 *   y cuota llena (y lo reporta como `storage_unavailable`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { emitClientEvent } from '@/lib/observability/client'
import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'
import {
  CLAVE_SILENCIO,
  decidirBanner,
  esMovil,
  leerSilencio,
  silenciarHasta,
  type MotivoBanner,
} from '@/lib/pwa/installBanner'

/** Lo que Chrome entrega en `beforeinstallprompt`. No está en los tipos del DOM. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Cuánto se espera a que Chrome dispare `beforeinstallprompt` antes de dar por hecho que no
 * va a llegar. No condiciona lo que ve el usuario (si llega más tarde, el banner sale igual):
 * solo evita contar como "sin prompt" a quien sí lo tuvo.
 */
const MARGEN_PROMPT_MS = 10_000

/**
 * Acciones que son un FALLO de verdad y no un paso del embudo. Van con severidad `error`
 * porque el panel de salud (`/admin/salud-sistema`) cuenta `severity IN ('error','critical')`:
 * emitirlas como `info` —como estaban al principio— las dejaba registradas pero **invisibles**,
 * y si la instalación se rompiera para los usuarios no se enteraría nadie. Es justo el fallo
 * que el manual de observabilidad nombra: *"si un usuario nos reporta un bug que la
 * observabilidad podía haber capturado, hemos fallado"*.
 */
const ACCIONES_DE_FALLO = new Set(['error_prompt', 'prompt_perdido'])

function emitir(accion: string, extra?: Record<string, unknown>) {
  emitClientEvent({
    severity: ACCIONES_DE_FALLO.has(accion) ? 'error' : 'info',
    eventType: 'pwa_install_banner',
    // `accion` va DESPUÉS del spread a propósito: así ningún extra puede pisarla. Es la clave
    // por la que se agrupa todo el embudo; que un `metadata` la sobrescriba sin avisar
    // convierte la métrica en otra cosa sin que nadie lo note.
    metadata: { ...extra, accion },
  })
}

export default function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const promptRef = useRef<EventoInstalacion | null>(null)
  // Dos guardas SEPARADAS, y esto tiene historia: al principio era una sola, y el resultado
  // fue que al montar (cuando Chrome aún no ha disparado `beforeinstallprompt`) se emitía
  // `no_mostrado` y quedaba bloqueada, así que el `mostrado` posterior NUNCA se emitía. El
  // embudo habría salido con el numerador a cero en producción. Lo cazó el test de
  // integración antes de desplegarlo.
  const medidoMostrado = useRef(false)
  const medidoNoMostrado = useRef(false)
  const temporizadorSinPrompt = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const yaInstalada =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    const movil = esMovil(window.navigator.userAgent)
    const silenciadoHasta = leerSilencio(safeGet(CLAVE_SILENCIO))

    // Se evalúa DOS veces: ahora (para descartar de inmediato los casos que no dependen del
    // navegador) y otra vez cuando llega `beforeinstallprompt`. Chrome lo dispara cuando le
    // parece, a veces segundos después de cargar, así que decidir solo al montar dejaría el
    // banner sin salir nunca.
    const evaluar = (promptDisponible: boolean) => {
      const { mostrar, motivo } = decidirBanner({
        yaInstalada,
        esMovil: movil,
        promptDisponible,
        silenciadoHasta,
        ahora: Date.now(),
      })
      if (mostrar) {
        setVisible(true)
        if (temporizadorSinPrompt.current) clearTimeout(temporizadorSinPrompt.current)
        if (!medidoMostrado.current) {
          medidoMostrado.current = true
          emitir('mostrado')
        }
        return
      }

      // El "no mostrado" se mide igual, y CON su motivo: si mañana el banner no aparece, la
      // diferencia entre "nadie cumple los criterios" y "el navegador no lo ofrece" es justo
      // lo que hace falta para saber si hay avería o no la hay.
      //
      // Pero `sin_prompt` NO es un veredicto al montar: Chrome dispara
      // `beforeinstallprompt` cuando le parece, a veces segundos después. Emitirlo de
      // inmediato marcaría como "sin prompt" a gente a la que sí se le acabó enseñando. Se
      // espera, y solo si pasado ese margen sigue sin llegar, se registra.
      if (motivo === 'sin_prompt') {
        if (!temporizadorSinPrompt.current) {
          temporizadorSinPrompt.current = setTimeout(() => {
            if (!medidoMostrado.current && !medidoNoMostrado.current) {
              medidoNoMostrado.current = true
              emitir('no_mostrado', { motivo: 'sin_prompt' satisfies MotivoBanner })
            }
          }, MARGEN_PROMPT_MS)
        }
        return
      }

      if (!medidoNoMostrado.current) {
        medidoNoMostrado.current = true
        emitir('no_mostrado', { motivo: motivo satisfies MotivoBanner })
      }
    }

    evaluar(false)

    const onPrompt = (e: Event) => {
      // Sin `preventDefault` Chrome enseña SU propio aviso y el nuestro sobra.
      e.preventDefault()
      promptRef.current = e as EventoInstalacion
      evaluar(true)
    }
    const onInstalada = () => {
      setVisible(false)
      emitir('instalado')
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalada)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalada)
      if (temporizadorSinPrompt.current) clearTimeout(temporizadorSinPrompt.current)
    }
  }, [])

  const instalar = useCallback(async () => {
    const p = promptRef.current
    if (!p) {
      // El usuario pulsa «Instalar» y NO PASA NADA. Es el fallo más grave de los dos, porque
      // desde fuera es indistinguible de que la app esté rota, y antes salía por un `return`
      // mudo. Chrome invalida el prompt guardado en algunos casos (cambio de pestaña, otra
      // instalación en curso), así que puede ocurrir sin que nadie haya tocado el código.
      emitir('prompt_perdido')
      setVisible(false)
      return
    }
    emitir('aceptado')
    setVisible(false)
    try {
      await p.prompt()
      const { outcome } = await p.userChoice
      // `accepted` aquí NO es una instalación consumada — eso lo confirma `appinstalled`.
      // Se miden los dos porque la diferencia entre ambos es la gente que se arrepiente en el
      // diálogo del sistema, y esa fuga no se ve de ninguna otra forma.
      emitir('eleccion_sistema', { outcome })
    } catch (err) {
      emitir('error_prompt', { error: (err as Error)?.message?.slice(0, 120) })
    } finally {
      promptRef.current = null
    }
  }, [])

  const descartar = useCallback((gesto: 'cerrar' | 'ahora_no') => {
    setVisible(false)
    safeSet(CLAVE_SILENCIO, String(silenciarHasta(gesto, Date.now())))
    // `gesto` y NO `accion`: el extra se esparce sobre el objeto del evento, así que llamarlo
    // `accion` PISABA el nombre de la acción y el evento salía como 'cerrar' en vez de
    // 'descartado'. Lo cazó el test antes de que llegara a producción, donde habría partido
    // el embudo en dos categorías fantasma.
    emitir('descartado', { gesto })
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar la aplicación de Vence"
      className="fixed bottom-0 inset-x-0 z-50 p-3 sm:hidden"
    >
      <div className="mx-auto max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 p-4">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-xl flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">Instala Vence en tu móvil</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              Entra directo desde el icono, a pantalla completa.
            </p>
          </div>
          <button
            onClick={() => descartar('cerrar')}
            aria-label="Cerrar"
            className="flex-shrink-0 -mt-1 -mr-1 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={instalar}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold min-h-[44px]"
          >
            Instalar
          </button>
          <button
            onClick={() => descartar('ahora_no')}
            className="px-4 py-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium min-h-[44px]"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
