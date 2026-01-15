import './globals.css'
import { Suspense } from 'react'
import ClientLayoutContent from './ClientLayoutContent'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider } from '../contexts/AuthContext'
import { QuestionProvider } from '../contexts/QuestionContext'
import { OposicionProvider } from '../contexts/OposicionContext'
import AIChatWidget from '../components/AIChatWidget'
import GoogleOneTapWrapper from '../components/GoogleOneTapWrapper'
import SentryInit from '../components/SentryInit'
import FraudTracker from '../components/FraudTracker'
import { GlobalClickTracker, PageViewTracker } from '../components/tracking'

export default function SpanishLayout({ children }) {
  return (
    <html lang="es">
      <head />
      <body className="min-h-screen">
        <SentryInit />
        <AuthProvider initialUser={null}>
          <OposicionProvider>
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
          </OposicionProvider>
        </AuthProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}