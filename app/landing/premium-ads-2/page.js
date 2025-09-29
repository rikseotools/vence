// app/premium-ads-2/page.js - VERSIÓN HONESTA SIN EXAGERACIONES
'use client'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with useSearchParams
const PremiumAdsLanding = dynamic(() => import('./PremiumAdsLandingSSR'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-600 border-t-transparent mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          🔥 Cargando oferta especial...
        </h2>
      </div>
    </div>
  )
})

export default PremiumAdsLanding