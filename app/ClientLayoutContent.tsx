// app/ClientLayoutContent.tsx - COMPONENTE CLIENTE SEPARADO
'use client'
import { ReactNode, useEffect } from 'react'
import HeaderES from './Header'
import FooterES from './Footer'
import Breadcrumbs from '../components/Breadcrumbs'
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
      {/* Breadcrumbs solo para usuarios no logueados Y solo en páginas que no tengan breadcrumbs específicos */}
      {!user && !loading &&
       !pathname.startsWith('/leyes') &&
       !pathname.startsWith('/teoria') &&
       !pathname.startsWith('/auxiliar-administrativo-estado/test') &&
       !pathname.startsWith('/auxiliar-administrativo-estado/temario') &&
       !pathname.startsWith('/administrativo-estado/test') &&
       !pathname.startsWith('/administrativo-estado/temario') &&
       !pathname.includes('/constitucion-titulos') &&
       !pathname.includes('/test-de-la-constitucion-espanola-de-1978') && (
        <Breadcrumbs />
      )}
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