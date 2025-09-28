// components/Logo.js - CON LOGO REAL DE ILOVETEST
import Image from 'next/image'
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
      {/* Logo Image */}
      <div className="relative flex-shrink-0">
        <Image
          src="/ilovetest-logo.png"
          alt="iLoveTest - Plataforma de Tests de Oposiciones"
          width={currentSize.width}
          height={currentSize.height}
          className="object-contain"
          priority
        />
      </div>
      
      {/* Texto opcional del logo */}
      {showText && (
        <div className={`font-bold ${currentSize.textSize} text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}>
          <span className="text-yellow-500">i</span>
          <span className="text-gray-800 dark:text-gray-100">Love</span>
          <span className="text-red-500">Test</span>
          <span className="text-gray-600 text-xs">®</span>
        </div>
      )}
    </div>
  )

  return (
    <Link href="/es" className="hover:opacity-80 transition-opacity" onClick={onClick}>
      {logoContent}
    </Link>
  )
}

// Variante solo icono (para espacios reducidos)
export function LogoIcon({ size = 32, className = '' }) {
  return (
    <Link href="/es" className={`hover:opacity-80 transition-opacity ${className}`}>
      <div className="relative">
        <Image
          src="/ilovetest-logo.png"
          alt="iLoveTest"
          width={size}
          height={size}
          className="object-contain"
        />
      </div>
    </Link>
  )
}

// Variante para footer
export function LogoFooter({ className = '' }) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Image
        src="/ilovetest-logo.png"
        alt="iLoveTest Logo"
        width={80}
        height={80}
        className="object-contain"
      />
      <h3 className="text-2xl font-bold">
        <span className="text-yellow-500">i</span>
        <span className="text-gray-100">Love</span>
        <span className="text-red-500">Test</span>
        <span className="text-gray-300 text-sm ml-1">®</span>
      </h3>
    </div>
  )
}

// Variante horizontal para header principal
export function LogoHorizontal({ className = '' }) {
  return (
    <Link href="/es" className={`flex items-center space-x-3 hover:opacity-80 transition-opacity ${className}`}>
      <Image
        src="/ilovetest-logo.png"
        alt="iLoveTest Logo"
        width={104}
        height={104}
        className="object-contain"
      />
      <div className="font-bold text-xl">
        <span className="text-yellow-500">i</span>
        <span className="text-gray-800 dark:text-gray-100">Love</span>
        <span className="text-red-500">Test</span>
        <span className="text-gray-600 dark:text-gray-400 text-sm ml-1">®</span>
      </div>
    </Link>
  )
}

// Versión grande para páginas principales
export function LogoHero({ className = '' }) {
  return (
    <Link href="/es" className={`flex flex-col items-center space-y-4 hover:opacity-80 transition-opacity ${className}`}>
      <Image
        src="/ilovetest-logo.png"
        alt="iLoveTest - Tests de Oposiciones"
        width={80}
        height={80}
        className="object-contain"
      />
      <div className="font-bold text-3xl text-center">
        <span className="text-yellow-500">i</span>
        <span className="text-gray-800 dark:text-gray-100">Love</span>
        <span className="text-red-500">Test</span>
        <span className="text-gray-600 dark:text-gray-400 text-lg ml-1">®</span>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-sm text-center max-w-md">
        La plataforma líder para preparar oposiciones con tests interactivos
      </p>
    </Link>
  )
}