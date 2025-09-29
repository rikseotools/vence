// components/Logo.js - LOGO DE VENCE
import Link from 'next/link'

export default function Logo({ size = 'medium', showText = true, className = '', onClick }) {
  const sizes = {
    small: { width: 32, height: 32, textSize: 'text-sm' },
    medium: { width: 40, height: 40, textSize: 'text-lg' },
    large: { width: 48, height: 48, textSize: 'text-xl' },
    xl: { width: 56, height: 56, textSize: 'text-2xl' }
  }

  const currentSize = sizes[size] || sizes.medium

  const logoContent = (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Logo Icon combinado - V arriba, ENCE abajo */}
      <div className="relative flex-shrink-0">
        <div className={`bg-gradient-to-r from-blue-800 to-blue-950 text-white font-bold rounded-lg flex flex-col items-center justify-center shadow-md`}
             style={{
               width: currentSize.width,
               height: currentSize.height,
               padding: '2px'
             }}>
          {/* V grande arriba */}
          <div style={{
            fontSize: `${Math.floor(currentSize.width * 0.32)}px`,
            lineHeight: '0.8',
            fontWeight: '900'
          }}>
            V
          </div>
          {/* VENCE pequeño abajo */}
          <div style={{
            fontSize: `${Math.floor(currentSize.width * 0.11)}px`,
            lineHeight: '0.8',
            fontWeight: '900',
            letterSpacing: '0.3px',
            marginTop: '6px',
            color: '#f9fafb',
            WebkitTextStroke: '0.5px #111827',
            textStroke: '0.5px #111827',
            textShadow: `
              0 0 0 1px #6b7280,
              0 0 0 2px #374151,
              1px 1px 2px rgba(0,0,0,0.4)
            `
          }}>
            VENCE
          </div>
        </div>
      </div>
      
      {/* Texto opcional del logo completo */}
      {showText && (
        <div className={`font-bold ${currentSize.textSize} text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-gray-100 transition-colors`}>
          <span className="tracking-wider" style={{
            color: '#f9fafb',
            WebkitTextStroke: '1px #111827',
            textStroke: '1px #111827',
            textShadow: `
              0 0 0 3px #6b7280,
              0 0 0 6px #374151,
              2px 2px 8px rgba(0,0,0,0.4)
            `,
            fontWeight: '900',
            letterSpacing: '0.1em'
          }}>VENCE</span>
        </div>
      )}
    </div>
  )

  return (
    <Link href="/" className="hover:opacity-80 transition-opacity" onClick={onClick}>
      {logoContent}
    </Link>
  )
}

// Variante solo icono (para espacios reducidos)
export function LogoIcon({ size = 32, className = '' }) {
  return (
    <Link href="/" className={`hover:opacity-80 transition-opacity ${className}`}>
      <div className="relative">
        <div className={`bg-gradient-to-r from-blue-800 to-blue-950 text-white font-bold rounded-lg flex flex-col items-center justify-center shadow-md`}
             style={{
               width: size,
               height: size,
               padding: '2px'
             }}>
          <div style={{
            fontSize: `${Math.floor(size * 0.28)}px`,
            lineHeight: '0.8',
            fontWeight: '900'
          }}>
            V
          </div>
          <div style={{
            fontSize: `${Math.floor(size * 0.20)}px`,
            lineHeight: '0.8',
            fontWeight: '900',
            letterSpacing: '0.1px',
            marginTop: '4px',
            color: '#ffffff'
          }}>
            VENCE
          </div>
        </div>
      </div>
    </Link>
  )
}

// Variante para footer
export function LogoFooter({ className = '' }) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold rounded-lg flex flex-col items-center justify-center shadow-md`}
           style={{
             width: 80,
             height: 80,
             padding: '4px'
           }}>
        <div style={{
          fontSize: '28px',
          lineHeight: '0.8',
          fontWeight: '900'
        }}>
          V
        </div>
        <div style={{
          fontSize: '10px',
          lineHeight: '0.8',
          fontWeight: '600',
          letterSpacing: '0.3px',
          marginTop: '3px'
        }}>
          VENCE
        </div>
      </div>
      <h3 className="text-2xl tracking-wider" style={{
        color: '#e5e7eb',
        WebkitTextStroke: '1px #374151',
        textStroke: '1px #374151',
        textShadow: `
          0 0 0 2px #9ca3af,
          0 0 0 4px #6b7280,
          2px 2px 6px rgba(0,0,0,0.4)
        `,
        fontWeight: '900',
        letterSpacing: '0.1em'
      }}>
        VENCE
      </h3>
    </div>
  )
}

// Variante horizontal para header principal
export function LogoHorizontal({ className = '' }) {
  return (
    <Link href="/" className={`flex items-center space-x-3 hover:opacity-80 transition-opacity ${className}`}>
      <div className={`bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold rounded-lg flex flex-col items-center justify-center shadow-md`}
           style={{
             width: 48,
             height: 48,
             padding: '2px'
           }}>
        <div style={{
          fontSize: '17px',
          lineHeight: '0.8',
          fontWeight: '900'
        }}>
          V
        </div>
        <div style={{
          fontSize: '6px',
          lineHeight: '0.8',
          fontWeight: '900',
          letterSpacing: '0.3px',
          marginTop: '3px',
          color: '#f9fafb',
          WebkitTextStroke: '0.3px #111827',
          textStroke: '0.3px #111827',
          textShadow: `
            0 0 0 0.5px #6b7280,
            0 0 0 1px #374151,
            0.5px 0.5px 1px rgba(0,0,0,0.4)
          `
        }}>
          VENCE
        </div>
      </div>
      <div className="text-xl tracking-wider" style={{
        color: '#f9fafb',
        WebkitTextStroke: '1px #111827',
        textStroke: '1px #111827',
        textShadow: `
          0 0 0 3px #6b7280,
          0 0 0 6px #374151,
          2px 2px 8px rgba(0,0,0,0.4)
        `,
        fontWeight: '900',
        letterSpacing: '0.1em'
      }}>
        VENCE
      </div>
    </Link>
  )
}

// Versión grande para páginas principales
export function LogoHero({ className = '' }) {
  return (
    <Link href="/" className={`flex flex-col items-center space-y-4 hover:opacity-80 transition-opacity ${className}`}>
      <div className={`bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold rounded-xl flex flex-col items-center justify-center shadow-lg`}
           style={{
             width: 80,
             height: 80,
             padding: '4px'
           }}>
        <div style={{
          fontSize: '28px',
          lineHeight: '0.8',
          fontWeight: '900'
        }}>
          V
        </div>
        <div style={{
          fontSize: '10px',
          lineHeight: '0.8',
          fontWeight: '600',
          letterSpacing: '0.3px',
          marginTop: '3px'
        }}>
          VENCE
        </div>
      </div>
      <div className="text-3xl text-center tracking-wider" style={{
        color: '#f9fafb',
        WebkitTextStroke: '1px #111827',
        textStroke: '1px #111827',
        textShadow: `
          0 0 0 3px #6b7280,
          0 0 0 6px #374151,
          3px 3px 10px rgba(0,0,0,0.5)
        `,
        fontWeight: '900',
        letterSpacing: '0.1em'
      }}>
        VENCE
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm text-center max-w-md">
        La plataforma líder para preparar oposiciones con tests interactivos
      </p>
    </Link>
  )
}