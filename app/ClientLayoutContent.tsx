// app/ClientLayoutContent.tsx - COMPONENTE CLIENTE SEPARADO
'use client'
import { ReactNode, useEffect } from 'react'
import HeaderES from './Header'
import FooterES from './Footer'
// Breadcrumbs.js eliminado — InteractiveBreadcrumbs cubre todas las rutas
import PushNotificationManager from '../components/PushNotificationManager'
import OnboardingModal from '../components/OnboardingModal'
import { useAuth } from '../contexts/AuthContext'
import { useOposicion } from '../contexts/OposicionContext'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '../hooks/useOnboarding'
import { captureMetaParams } from '../lib/metaPixelCapture'

// Componente interno que usa el contexto de Auth
export default function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const { needsOposicionFix } = useOposicion()
  const pathname = usePathname()
  const { showModal, handleComplete, handleSkip, forceShow } = useOnboarding()

  // Capturar parámetros de Meta Ads (fbclid, utm_source, etc.) al cargar
  useEffect(() => {
    captureMetaParams()
  }, [])

  return (
    <>
      <HeaderES />
      {/* Banner para usuarios sin oposición seleccionada */}
      {user && userProfile && !userProfile.target_oposicion && !loading && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-center text-sm">
          <span className="text-amber-800 dark:text-amber-200">
            Selecciona tu oposición para que tus estadísticas y temario sean precisos
          </span>
          <button
            onClick={forceShow}
            className="ml-3 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-md transition-colors"
          >
            Seleccionar
          </button>
        </div>
      )}
      {/* Banner para usuarios con oposición no disponible (custom) */}
      {user && needsOposicionFix && !loading && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2.5 text-center text-sm">
          <span className="text-blue-800 dark:text-blue-200">
            Tu oposición no tiene temario específico, pero puedes practicar con leyes comunes a todas las oposiciones
          </span>
          <a
            href="/leyes"
            className="ml-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors inline-block"
          >
            Ver leyes
          </a>
        </div>
      )}
      {/* Breadcrumbs eliminados del layout global — cada página usa InteractiveBreadcrumbs */}
      {children}
      <FooterES />

      {/* PushNotificationManager desactivado — no usamos PWA/push actualmente */}

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