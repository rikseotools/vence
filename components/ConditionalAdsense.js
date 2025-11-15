'use client'
import { usePathname } from 'next/navigation'

export default function ConditionalAdsense() {
  const pathname = usePathname()
  
  // No cargar AdSense en rutas de administración
  const isAdminRoute = pathname?.startsWith('/admin')
  
  if (isAdminRoute) {
    return null
  }
  
  return (
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5346427920432730"
      crossOrigin="anonymous"
    />
  )
}