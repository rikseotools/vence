import './globals.css'
import { Suspense } from 'react'
import ClientLayoutContent from './ClientLayoutContent'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider } from '../contexts/AuthContext'
import { QuestionProvider } from '../contexts/QuestionContext'
import { OposicionProvider } from '../contexts/OposicionContext'
import { LawSlugProvider } from '../contexts/LawSlugContext'
import { getSlugMappingForApi } from '@/lib/api/laws'
import AIChatWidget from '../components/AIChatWidget'
import GoogleOneTapWrapper from '../components/GoogleOneTapWrapper'
import SentryInit from '../components/SentryInit'
import FraudTracker from '../components/FraudTracker'
import { GlobalClickTracker, PageViewTracker } from '../components/tracking'
import CookieBanner, { CookieConsentProvider } from '../components/CookieConsent'

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
      <head />
      <body className="min-h-screen">
        <SentryInit />
        <CookieConsentProvider>
          <AuthProvider initialUser={null}>
            <OposicionProvider>
              <LawSlugProvider initialMappings={lawMappings}>
              <QuestionProvider>
                <GlobalClickTracker>
                  <Suspense fallback={null}>
                    <PageViewTracker />
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
                </GlobalClickTracker>
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