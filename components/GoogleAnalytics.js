'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const [shouldLoad, setShouldLoad] = useState(false)
  
  // 🚫 NO cargar Google Analytics en rutas de administración
  if (pathname?.startsWith('/admin')) {
    return null
  }

  // ⚡ Cargar GA solo después de interacción del usuario o 3 segundos
  useEffect(() => {
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
  }, [])

  if (!shouldLoad) {
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
          
          // Google Ads configuration
          gtag('config', 'AW-10842123204');
        `}
      </Script>
    </>
  )
}