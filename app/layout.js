import './globals.css'
import ClientLayoutContent from './ClientLayoutContent'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider } from '../contexts/AuthContext'

export default function SpanishLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <AuthProvider initialUser={null}>
          <div className="flex flex-col min-h-screen">
            <ClientLayoutContent>
              <main className="flex-1">
                {children}
              </main>
            </ClientLayoutContent>
          </div>
        </AuthProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}