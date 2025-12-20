// app/test/mantener-racha/page.js
'use client'
import { Suspense } from 'react'
import TestPageWrapper from '@/components/TestPageWrapper'

function MantenerRachaContent() {
  return (
    <TestPageWrapper
      tema={null}
      testType="mantener-racha"
      customTitle="Mantener Racha"
      customDescription="Test para continuar tu racha de estudio"
      customIcon="🔥"
      customColor="from-yellow-500 to-orange-600"
      customSubtitle="Mantén tu motivación activa"
      loadingMessage="🔥 Preparando test para mantener racha..."
    />
  )
}

export default function MantenerRachaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🔥 Preparando test para mantener racha...
          </h2>
        </div>
      </div>
    }>
      <MantenerRachaContent />
    </Suspense>
  )
}
