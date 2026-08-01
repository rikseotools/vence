import './globals.css'
import { Suspense } from 'react'
import ClientLayoutContent from './ClientLayoutContent'
import FranjaImpersonacion from '@/components/admin/FranjaImpersonacion'
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
import AvisoMultiCuentaModal from '@/components/AvisoMultiCuentaModal'
import ChallengeProvider from '../components/security/ChallengeProvider'
import { GlobalClickTracker, PageViewTracker, AttributionCapture, DeviceIdentity } from '../components/tracking'
import CookieBanner, { CookieConsentProvider } from '../components/CookieConsent'
import ConsentModeDefault from '../components/ConsentModeDefault'
import { TTSChainProvider } from '../components/tts/TTSChainContext'
import { ClientObservabilityInstaller } from '../components/observability/ClientObservabilityInstaller'
import PwaInstallBanner from '../components/PwaInstallBanner'
import ReferralAttributionOnLogin from '../components/ReferralAttributionOnLogin'
import PrintPremiumGuard from '../components/PrintPremiumGuard'
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
            {/* Invitación a instalar la PWA. Solo móvil y solo a quien no la tiene; la
                decisión vive en lib/pwa/installBanner.ts. Vuelve a existir porque el banner
                anterior desapareció con la retirada del push (03/05) y desde entonces nadie
                invita a instalarla: solo el 2% la tiene, y quien la tiene usa la plataforma
                4,4× más. */}
            <PwaInstallBanner />
            {/* Anti-fuga premium: bloquea la impresión del temario (Ctrl+P / botón)
                para usuarios no premium. Fuente única, ver components/PrintPremiumGuard. */}
            <PrintPremiumGuard />
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
                    {/* T-371 — el identificador de dispositivo nace AQUÍ, al arrancar la app.
                        Antes solo lo creaba el beacon de atribución (y detrás de dos `return`) o
                        el chat de IA, así que 4 de cada 10 usuarios no tenían ninguno y eran
                        invisibles para el antifraude. Va antes que AttributionCapture porque el
                        ancla debe existir antes de que nadie la lea. */}
                    <DeviceIdentity />
                    <Suspense fallback={null}>
                      <AttributionCapture />
                    </Suspense>
                    {/* T-289 — franja de suplantación. En el layout raíz porque «ver la
                        cuenta de otra persona» afecta a TODA la app, no a una pantalla.
                        Sin suplantación no pinta nada. */}
                    <FranjaImpersonacion />
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
                    {/* Aviso de «una cuenta por persona y dispositivo» ([T-418]). Global e
                        invisible salvo que el servidor vea 2+ cuentas FREE en este equipo;
                        nunca se le enseña a un premium. */}
                    <AvisoMultiCuentaModal />
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