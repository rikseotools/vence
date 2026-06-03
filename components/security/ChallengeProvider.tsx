'use client'

// components/security/ChallengeProvider.tsx
//
// Monta el modal de verificación humana y registra el solver en el bridge,
// para que `fetchWithChallenge` pueda pedir un token desde cualquier sitio.
//
// Colócalo UNA vez cerca de la raíz del árbol cliente (p.ej. en el layout
// dentro de los providers). Es invisible hasta que algo pide un reto.

import { useCallback, useEffect, useRef, useState } from 'react'
import { registerChallengeSolver } from '@/lib/api/challengeBridge'
import HumanChallenge from './HumanChallenge'

type Pending = {
  action?: string
  resolve: (token: string) => void
  reject: (err: Error) => void
}

export default function ChallengeProvider({
  children,
}: {
  children?: React.ReactNode
}) {
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || ''
  const [open, setOpen] = useState(false)
  const pendingRef = useRef<Pending | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    pendingRef.current = null
  }, [])

  useEffect(() => {
    const unregister = registerChallengeSolver(
      (action?: string) =>
        new Promise<string>((resolve, reject) => {
          // Sin site key configurada no podemos retar → rechazar (fail-open
          // lo decide el servidor; aquí solo no bloqueamos la UI).
          if (!siteKey) {
            reject(new Error('Turnstile site key no configurada'))
            return
          }
          pendingRef.current = { action, resolve, reject }
          setOpen(true)
        }),
    )
    return unregister
  }, [siteKey])

  const handleVerify = useCallback(
    (token: string) => {
      pendingRef.current?.resolve(token)
      close()
    },
    [close],
  )

  const handleCancel = useCallback(() => {
    pendingRef.current?.reject(new Error('challenge_cancelled'))
    close()
  }, [close])

  return (
    <>
      {children}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verificación de seguridad"
          style={overlayStyle}
          onClick={handleCancel}
        >
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={titleStyle}>Un momento…</h2>
            <p style={textStyle}>
              Por seguridad necesitamos confirmar que eres una persona. Marca la
              casilla para continuar.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
              <HumanChallenge
                siteKey={siteKey}
                action={pendingRef.current?.action}
                onVerify={handleVerify}
                onError={handleCancel}
                onExpire={handleCancel}
              />
            </div>
            <button type="button" onClick={handleCancel} style={cancelBtnStyle}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 16,
}
const cardStyle: React.CSSProperties = {
  background: 'var(--card-bg, #fff)',
  color: 'var(--card-fg, #111)',
  borderRadius: 12,
  padding: 24,
  maxWidth: 380,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  textAlign: 'center',
}
const titleStyle: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, fontWeight: 700 }
const textStyle: React.CSSProperties = { margin: 0, fontSize: 14, opacity: 0.8 }
const cancelBtnStyle: React.CSSProperties = {
  marginTop: 8,
  background: 'transparent',
  border: 'none',
  color: '#6b7280',
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'underline',
}
