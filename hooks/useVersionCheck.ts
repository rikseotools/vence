// hooks/useVersionCheck.ts — Detecta versión vieja y fuerza recarga
//
// Consulta /api/version al montar y al volver de background. Si el servidor
// sirve una versión distinta a la que el cliente tiene cargada, fuerza
// window.location.reload() para que el usuario reciba el código nuevo.
//
// GUARD DE RUTAS CRÍTICAS: si el usuario está en medio de un test / examen
// / psicotécnico, el reload se difiere — se marca la versión nueva como
// pendiente y se aplica automáticamente cuando el usuario navega fuera de
// la ruta crítica. Esto evita pérdidas de progreso percibidas por el usuario
// (ver bug francofila 2026-04-09: 3 deploys en 12 min durante un test →
// UI reseteada a "1/26" tras cada reload).
//
// GUARD DE RÁFAGA (T-168, caso real 26/07): un `window.location.reload()` mata
// TODO el estado JS del módulo — `clientVersion`/`pendingVersion` vuelven a null
// en la página nueva. Si el servidor sigue sirviendo versiones distintas entre
// una petición y la siguiente (deploy rodante de Fargate: tareas viejas y nuevas
// conviviendo tras el ALB, cada fetch a /api/version puede tocar una u otra), la
// página recién recargada detecta OTRA "versión nueva" y se recarga otra vez —
// sin nada que recuerde que ACABA de recargar. Medido en el incidente real: 4
// recargas en 11 s (12:09:51, 12:10:00, 12:10:01, 12:10:02), la primera cortó un
// test en la pregunta 2. `sessionStorage` (sobrevive al reload, a diferencia de
// una variable de módulo) guarda cuándo fue el último reload; si el siguiente
// intento cae dentro del cooldown, se SUPRIME — se acepta la versión sin recargar
// y se reintentará en el próximo montaje/vuelta de background, que ya no debería
// pillar el deploy a medias.
'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useInteractionTracker } from '@/hooks/useInteractionTracker'

// Versión del cliente se fija al cargar el módulo (primer checkVersion)
let clientVersion: string | null = null

// Versión nueva detectada pero pendiente de aplicar (usuario en ruta crítica)
let pendingVersion: string | null = null

// ── Guard de ráfaga ──────────────────────────────────────────────────────
const RELOAD_MARK_KEY = 'vence_version_check_last_reload'
const RELOAD_COOLDOWN_MS = 20_000

interface ReloadMark {
  at: number
  toVersion: string
}

function readReloadMark(): ReloadMark | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_MARK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.at !== 'number' || typeof parsed?.toVersion !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function writeReloadMark(toVersion: string, nowMs: number): void {
  try {
    sessionStorage.setItem(RELOAD_MARK_KEY, JSON.stringify({ at: nowMs, toVersion }))
  } catch {
    // sessionStorage puede fallar (modo privado, cuota) — no bloquear el flujo por esto.
  }
}

/**
 * ¿Hay que SUPRIMIR este reload porque acabamos de recargar hace muy poco?
 * Pura y exportada para poder testearla sin mockear sessionStorage/Date.
 */
export function shouldSuppressReload(
  mark: ReloadMark | null,
  nowMs: number,
  cooldownMs: number = RELOAD_COOLDOWN_MS
): boolean {
  if (!mark) return false
  return nowMs - mark.at < cooldownMs
}

// Rutas donde NO queremos recargar automáticamente. Perder estado aquí
// resulta en pérdida de progreso visible para el usuario (tests en curso,
// exámenes, formularios multi-step).
const CRITICAL_ROUTE_PATTERNS: RegExp[] = [
  // Tests por ley (/leyes/[slug]/avanzado, /rapido, /personalizado, /aleatorio, /repaso-fallos)
  /\/leyes\/[^/]+\/(avanzado|rapido|personalizado|aleatorio|repaso-fallos)/,
  // Tests por oposición: personalizado, aleatorio-examen, examen-oficial, etc.
  // Bug 30/04/2026: /administrativo-estado/test/test-personalizado NO estaba cubierto
  // → version_check_reload_immediate interrumpía tests activos (caso Maria del Carmen)
  /\/[^/]+\/test\/test-/,
  // Tests por oposición/tema (/[oposicion]/test/tema/N)
  /\/[^/]+\/test\/tema\/\d+/,
  // Exámenes oficiales
  /\/examen-oficial/,
  /\/aleatorio-examen/,
  // Tests psicotécnicos activos (configuración, selección de series, y ejecución)
  /\/psicotecnicos\/test/,
  // Test multi-ley
  /\/test\/multi-ley/,
  // Tests desde chat / artículo / por-leyes / rapido / repaso
  /\/test\/(desde-chat|articulo|por-leyes|rapido|repaso-fallos|repaso-fallos-v2|mantener-racha|explorar)/,
  // Test aleatorio-examen (ruta raíz)
  /\/test\/aleatorio-examen/,
  // Test recuperado (usuario volviendo a test interrumpido)
  /\/test-recuperado/,
]

/**
 * Devuelve true si el pathname coincide con una ruta donde forzar un reload
 * causaría pérdida de estado percibida por el usuario.
 *
 * Exportado para poder testearlo de forma aislada.
 */
export function isInCriticalRoute(pathname: string): boolean {
  if (!pathname) return false
  return CRITICAL_ROUTE_PATTERNS.some(p => p.test(pathname))
}

export function useVersionCheck() {
  const checkingRef = useRef(false)
  const pathname = usePathname()
  const { track } = useInteractionTracker()

  useEffect(() => {
    async function checkVersion() {
      if (checkingRef.current) return
      checkingRef.current = true

      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return

        const { version } = await res.json()
        if (!version || version === 'dev') return

        if (!clientVersion) {
          // Primera carga — guardar versión y salir
          clientVersion = version
          return
        }

        if (version === clientVersion) {
          // Servidor sigue en la misma versión. Limpiar cualquier pendiente stale.
          pendingVersion = null
          return
        }

        // Versión nueva detectada
        pendingVersion = version

        const currentPath = window.location.pathname
        if (isInCriticalRoute(currentPath)) {
          console.log(
            `🔄 Nueva versión detectada (${clientVersion} → ${version}) — ` +
            `diferida, usuario en ruta crítica: ${currentPath}`
          )
          track({
            eventType: 'version_check_deferred',
            eventCategory: 'navigation',
            component: 'useVersionCheck',
            action: 'defer',
            value: {
              clientVersion,
              newVersion: version,
              pathname: currentPath,
            },
          })
          return
        }

        if (shouldSuppressReload(readReloadMark(), Date.now())) {
          console.log(
            `🔄 Nueva versión detectada (${clientVersion} → ${version}) — ` +
            `SUPRIMIDA, reload reciente (ráfaga): ${currentPath}`
          )
          track({
            eventType: 'version_check_reload_suppressed',
            eventCategory: 'navigation',
            component: 'useVersionCheck',
            action: 'reload_suppressed',
            value: {
              clientVersion,
              newVersion: version,
              pathname: currentPath,
            },
          })
          clientVersion = version
          pendingVersion = null
          return
        }

        console.log(`🔄 Nueva versión detectada: ${clientVersion} → ${version}. Recargando...`)
        track({
          eventType: 'version_check_reload_immediate',
          eventCategory: 'navigation',
          component: 'useVersionCheck',
          action: 'reload_immediate',
          value: {
            clientVersion,
            newVersion: version,
            pathname: currentPath,
          },
        })
        writeReloadMark(version, Date.now())
        window.location.reload()
      } catch {
        // Red caída o error — ignorar silenciosamente
      } finally {
        checkingRef.current = false
      }
    }

    // Check al montar
    checkVersion()

    // Check al volver de background
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [track])

  // Al cambiar de ruta: si había una versión pendiente y ya no estamos en
  // ruta crítica, aplicar el reload diferido ahora.
  useEffect(() => {
    if (!pendingVersion) return
    if (isInCriticalRoute(pathname)) return

    const versionToApply = pendingVersion

    if (shouldSuppressReload(readReloadMark(), Date.now())) {
      console.log(
        `🔄 Saliendo de ruta crítica con versión pendiente ` +
        `(${clientVersion} → ${versionToApply}) — SUPRIMIDA, reload reciente (ráfaga)`
      )
      track({
        eventType: 'version_check_reload_suppressed',
        eventCategory: 'navigation',
        component: 'useVersionCheck',
        action: 'reload_suppressed',
        value: {
          clientVersion,
          newVersion: versionToApply,
          pathname,
        },
      })
      clientVersion = versionToApply
      pendingVersion = null
      return
    }

    console.log(
      `🔄 Saliendo de ruta crítica con versión pendiente ` +
      `(${clientVersion} → ${versionToApply}). Recargando...`
    )
    track({
      eventType: 'version_check_reload_deferred',
      eventCategory: 'navigation',
      component: 'useVersionCheck',
      action: 'reload_deferred',
      value: {
        clientVersion,
        newVersion: versionToApply,
        pathname,
      },
    })
    writeReloadMark(versionToApply, Date.now())
    window.location.reload()
  }, [pathname, track])
}

/**
 * Devuelve la versión del cliente para tracking/debugging.
 * Null si aún no se ha cargado.
 */
export function getClientVersion(): string | null {
  return clientVersion
}

/**
 * Helper para tests: resetear el estado module-level entre casos.
 * NO usar en código de producción.
 */
export function __resetVersionCheckState(): void {
  clientVersion = null
  pendingVersion = null
  try {
    sessionStorage.removeItem(RELOAD_MARK_KEY)
  } catch {
    // no-op en entornos sin sessionStorage
  }
}
