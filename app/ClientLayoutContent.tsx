// app/ClientLayoutContent.tsx - COMPONENTE CLIENTE SEPARADO
'use client'
import { ReactNode, useEffect } from 'react'
import HeaderES from './Header'
import FooterES from './Footer'
// Breadcrumbs.js eliminado — InteractiveBreadcrumbs cubre todas las rutas
import PushNotificationManager from '../components/PushNotificationManager'
import OnboardingModal from '../components/OnboardingModal'
import { useAuth } from '../contexts/AuthContext'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '../hooks/useOnboarding'
import { captureMetaParams } from '../lib/metaPixelCapture'

// Componente interno que usa el contexto de Auth
export default function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const { showModal, handleComplete, handleSkip } = useOnboarding()

  // Capturar parámetros de Meta Ads (fbclid, utm_source, etc.) al cargar
  useEffect(() => {
    captureMetaParams()
  }, [])

  return (
    <>
      <HeaderES />
      {/* Breadcrumbs eliminados del layout global — cada página usa InteractiveBreadcrumbs */}
      {children}
      <FooterES />

      {/* Manager de notificaciones solo para usuarios logueados */}
      {user && <PushNotificationManager />}

      {/* Modal de Onboarding solo para usuarios logueados */}
      {user && (
        <OnboardingModal
          isOpen={showModal}
          onComplete={handleComplete}
          onSkip={handleSkip}
          user={user}
        />
      )}
    </>
  )
}