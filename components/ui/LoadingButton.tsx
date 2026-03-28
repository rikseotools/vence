// components/ui/LoadingButton.tsx
// Botón reutilizable con feedback visual automático para acciones async.
// Muestra spinner y se deshabilita mientras ejecuta el onClick.
'use client'

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface LoadingButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick: () => Promise<void> | void
  children: ReactNode
  loadingText?: string
}

export default function LoadingButton({
  onClick,
  children,
  loadingText,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading || disabled) return
    setLoading(true)
    try {
      await onClick()
    } catch (error) {
      console.error('LoadingButton error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      className={`${className} ${loading ? 'opacity-70 cursor-wait' : ''}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          {loadingText || children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
