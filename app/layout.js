import './globals.css'
import ClientLayoutContent from './ClientLayoutContent'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider } from '../contexts/AuthContext'

export default function SpanishLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider initialUser={null}>
          <ClientLayoutContent>
            {children}
          </ClientLayoutContent>
        </AuthProvider>
        <GoogleAnalytics />
      </body>
    </html>
  )
}