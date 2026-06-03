'use client'

// components/security/HumanChallenge.tsx
//
// Widget reutilizable de verificación humana (Cloudflare Turnstile).
// Carga el script de CF una sola vez (singleton) y renderiza el reto.
// Agnóstico de uso: lo monta el ChallengeProvider en un modal, pero puede
// usarse inline en cualquier formulario (registro, soporte, etc.).

import { useEffect, useRef } from 'react'

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// ── Tipos mínimos del global window.turnstile ──
interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  action?: string
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'flexible' | 'compact'
}
interface TurnstileApi {
  render: (el: HTMLElement, opts: TurnstileRenderOptions) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let _scriptPromise: Promise<void> | null = null
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (_scriptPromise) return _scriptPromise
  _scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile"]`,
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile script error')))
      if (window.turnstile) resolve()
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile script error'))
    document.head.appendChild(s)
  })
  return _scriptPromise
}

export interface HumanChallengeProps {
  siteKey: string
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  action?: string
  theme?: 'light' | 'dark' | 'auto'
  className?: string
}

export default function HumanChallenge({
  siteKey,
  onVerify,
  onError,
  onExpire,
  action,
  theme = 'auto',
  className,
}: HumanChallengeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  // Mantener callbacks frescos sin re-renderizar el widget.
  const cbRef = useRef({ onVerify, onError, onExpire })
  cbRef.current = { onVerify, onError, onExpire }

  useEffect(() => {
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          callback: (token: string) => cbRef.current.onVerify(token),
          'error-callback': () => cbRef.current.onError?.(),
          'expired-callback': () => cbRef.current.onExpire?.(),
        })
      })
      .catch(() => cbRef.current.onError?.())

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* idempotente */
        }
      }
    }
    // siteKey/action/theme estables durante la vida del reto.
  }, [siteKey, action, theme])

  return <div ref={containerRef} className={className} />
}
