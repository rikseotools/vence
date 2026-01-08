'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const [shouldLoad, setShouldLoad] = useState(false)
  
  // ⚡ Cargar GA solo después de interacción del usuario o 3 segundos
  useEffect(() => {
    // 🚫 NO cargar Google Analytics en rutas de administración
    if (pathname?.startsWith('/admin')) {
      return
    }

    const handleInteraction = () => setShouldLoad(true)
    const timer = setTimeout(() => setShouldLoad(true), 3000)
    
    // Escuchar primera interacción
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll']
    events.forEach(event => 
      document.addEventListener(event, handleInteraction, { once: true, passive: true })
    )
    
    return () => {
      clearTimeout(timer)
      events.forEach(event => 
        document.removeEventListener(event, handleInteraction)
      )
    }
  }, [pathname])

  // 🚫 NO renderizar Google Analytics en rutas de administración
  if (pathname?.startsWith('/admin') || !shouldLoad) {
    return null
  }

  return (
    <>
      {/* Google Analytics - Nueva cuenta limpia para evitar mezcla con otros dominios */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-WXQ069CRY9"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-WXQ069CRY9');
          
          // Google Ads configuration (Nueva cuenta Enero 2026)
          gtag('config', 'AW-16813286691');
        `}
      </Script>
    </>
  )
}