// components/ui/NavigationButton.tsx
// Botón reutilizable para navegación con feedback visual.
// Muestra spinner al hacer clic mientras la página carga.
'use client'

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface NavigationButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  href: string
  children: ReactNode
  loadingText?: string
  replace?: boolean
}

export default function NavigationButton({
  href,
  children,
  loadingText,
  disabled,
  className = '',
  replace = false,
  ...props
}: NavigationButtonProps) {
  const [navigating, setNavigating] = useState(false)
  const router = useRouter()

  const handleClick = () => {
    if (navigating || disabled) return
    setNavigating(true)
    if (replace) {
      router.replace(href)
    } else {
      router.push(href)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={navigating || disabled}
      className={`${className} ${navigating ? 'opacity-70 cursor-wait' : ''}`}
      {...props}
    >
      {navigating ? (
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
