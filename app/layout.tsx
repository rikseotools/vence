import './globals.css'
import { Suspense } from 'react'
import ClientLayoutContent from './ClientLayoutContent'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider } from '../contexts/AuthContext'
import { QuestionProvider } from '../contexts/QuestionContext'
import { AIChatProvider } from '../contexts/AIChatContext'
import { OposicionProvider } from '../contexts/OposicionContext'
import { LawSlugProvider } from '../contexts/LawSlugContext'
import { getSlugMappingForApi } from '@/lib/api/laws'
import AIChatWidget from '../components/AIChatWidget'
import GoogleOneTapWrapper from '../components/GoogleOneTapWrapper'
import FraudTracker from '../components/FraudTracker'
import ChallengeProvider from '../components/security/ChallengeProvider'
import { GlobalClickTracker, PageViewTracker, AttributionCapture } from '../components/tracking'
import CookieBanner, { CookieConsentProvider } from '../components/CookieConsent'
import ConsentModeDefault from '../components/ConsentModeDefault'
import { TTSChainProvider } from '../components/tts/TTSChainContext'
import { ClientObservabilityInstaller } from '../components/observability/ClientObservabilityInstaller'
import ReferralAttributionOnLogin from '../components/ReferralAttributionOnLogin'
import { EarlyErrorsBridge } from '../components/observability/EarlyErrorsBridge'

export default async function SpanishLayout({ children }: { children: React.ReactNode }) {
  // Precargar mapping slug↔shortName para client components (cacheado en memoria 1h)
  let lawMappings: Awaited<ReturnType<typeof getSlugMappingForApi>> = []
  try {
    lawMappings = await getSlugMappingForApi()
  } catch (error) {
    console.warn('⚠️ [Layout] No se pudo cargar mapping de leyes:', error)
  }

  return (
    <html lang="es">
      <head>
        {/* Google Consent Mode v2 — estado por defecto (denied). DEBE ir antes
            que cualquier etiqueta de Google. beforeInteractive lo garantiza. */}
        <ConsentModeDefault />
        {/* Captura errores ANTES de hydration. Debe ir lo más arriba posible
            en <head> para pillar errores de otros scripts inline (GTM,
            polyfills, ...). Los procesa el SDK in-house al hidratar. */}
        <EarlyErrorsBridge />
      </head>
      <body className="min-h-screen">
        <CookieConsentProvider>
          <AuthProvider initialUser={null}>
            {/* Instala los hooks de observabilidad in-house (única captura de
                errores de cliente tras retirar Sentry): window.onerror,
                unhandledrejection, console, wrapper de fetch, pre-hydration,
                intent tracking. Ver lib/observability/client.ts. */}
            <ClientObservabilityInstaller />
            <ReferralAttributionOnLogin />
            <OposicionProvider>
              <LawSlugProvider initialMappings={lawMappings}>
              <QuestionProvider>
                <AIChatProvider>
                  <TTSChainProvider>
                  <GlobalClickTracker>
                    <Suspense fallback={null}>
                      <PageViewTracker />
                    </Suspense>
                    {/* F0 trackeo-conversiones-ventas — captura global de click-IDs
                        (gclid/gbraid/wbraid/fbclid/ttclid/msclkid) + UTM en cualquier
                        página, no solo /landing/*. */}
                    <Suspense fallback={null}>
                      <AttributionCapture />
                    </Suspense>
                    <div className="flex flex-col min-h-screen">
                      <ClientLayoutContent>
                        <main className="flex-1 min-h-0">
                          {children}
                        </main>
                      </ClientLayoutContent>
                    </div>
                    <AIChatWidget />
                    <GoogleOneTapWrapper />
                    <FraudTracker />
                    {/* Modal de verificación humana (anti-scraping). Invisible
                        hasta que un endpoint protegido pide resolver un reto. */}
                    <ChallengeProvider />
                  </GlobalClickTracker>
                  </TTSChainProvider>
                </AIChatProvider>
              </QuestionProvider>
              </LawSlugProvider>
            </OposicionProvider>
          </AuthProvider>
          <CookieBanner />
        </CookieConsentProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}