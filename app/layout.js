import './globals.css'
import ClientLayoutContent from './ClientLayoutContent'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider } from '../contexts/AuthContext'
import { QuestionProvider } from '../contexts/QuestionContext'
import AIChatWidget from '../components/AIChatWidget'
import GoogleOneTapWrapper from '../components/GoogleOneTapWrapper'

export default function SpanishLayout({ children }) {
  return (
    <html lang="es">
      <head />
      <body className="min-h-screen">
        <AuthProvider initialUser={null}>
          <QuestionProvider>
            <div className="flex flex-col min-h-screen">
              <ClientLayoutContent>
                <main className="flex-1 min-h-0">
                  {children}
                </main>
              </ClientLayoutContent>
            </div>
            <AIChatWidget />
            <GoogleOneTapWrapper />
          </QuestionProvider>
        </AuthProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}