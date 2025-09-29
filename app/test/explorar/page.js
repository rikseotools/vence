// app/test/explorar/page.js
'use client'
import { Suspense } from 'react'
import TestPageWrapper from '@/components/TestPageWrapper'

function ExplorarContent() {
  return (
    <TestPageWrapper
      tema={null}
      testType="explorar"
      customTitle="Explorar Contenido"
      customDescription="Nuevo contenido añadido recientemente"
      customIcon="🔍"
      customColor="from-blue-500 to-cyan-600"
      customSubtitle="Descubre las últimas preguntas"
      loadingMessage="🔍 Cargando contenido nuevo..."
    />
  )
}

export default function ExplorarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🔍 Cargando contenido nuevo...
          </h2>
        </div>
      </div>
    }>
      <ExplorarContent />
    </Suspense>
  )
}
