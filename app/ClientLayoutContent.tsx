// app/ClientLayoutContent.tsx - COMPONENTE CLIENTE SEPARADO
'use client'
import { ReactNode, useEffect } from 'react'
import HeaderES from './Header'
import FooterES from './Footer'
// Breadcrumbs.js eliminado — InteractiveBreadcrumbs cubre todas las rutas
import OnboardingModal from '../components/OnboardingModal'
import OpenInscriptionBanner from '../components/OpenInscriptionBanner'
import { useAuth } from '../contexts/AuthContext'
import { useOposicion } from '../contexts/OposicionContext'
import { usePathname } from 'next/navigation'
import { useOnboarding } from '../hooks/useOnboarding'
import { captureMetaParams } from '../lib/metaPixelCapture'

// Rutas donde NO mostramos el banner global de inscripción abierta:
//   - tests activos (/test/, /[opo]/test/, /psicotecnicos/test/, etc.)
//   - admin panel, auth flows, debug pages
// Los configuradores tipo /test-oposiciones (con guion) SÍ ven banner.
function shouldHideInscriptionBanner(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/auth')) return true
  if (pathname.startsWith('/debug')) return true
  if (pathname.startsWith('/test/')) return true
  if (pathname === '/test') return true
  if (pathname === '/test-recuperado' || pathname.startsWith('/test-recuperado/')) return true
  if (pathname.includes('/test/')) return true // /[opo]/test/...
  return false
}

// Componente interno que usa el contexto de Auth
export default function ClientLayoutContent({ children }: { children: ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const { needsOposicionFix } = useOposicion()
  const pathname = usePathname()
  const { showModal, handleComplete, handleSkip, forceShow } = useOnboarding()
  const hideInscriptionBanner = shouldHideInscriptionBanner(pathname)

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
      {/* Banner "Inscripción abierta" — ángulo boca-oreja (familiares/amigos).
          Oculto en tests activos y admin/auth/debug para no interrumpir. */}
      {!hideInscriptionBanner && <OpenInscriptionBanner />}
      {/* Breadcrumbs eliminados del layout global — cada página usa InteractiveBreadcrumbs */}
      {children}
      <FooterES />

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