'use client'
import { useEffect } from 'react'
import Script from 'next/script'

export default function GoogleAnalytics() {
  useEffect(() => {
    // Configurar Google Analytics cuando se monta el componente
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || []
      function gtag() {
        window.dataLayer.push(arguments)
      }
      window.gtag = gtag
      gtag('js', new Date())
      gtag('config', 'G-MCKS9RWYNL')
    }
  }, [])

  return (
    <>
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-MCKS9RWYNL"
      />
    </>
  )
}