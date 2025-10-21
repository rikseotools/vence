// app/layout.js - SIN BREADCRUMBS PARA USUARIOS LOGUEADOS
'use client'
import './globals.css'
import HeaderES from './Header'
import FooterES from './Footer'
import Breadcrumbs from '../components/Breadcrumbs'
import PushNotificationManager from '../components/PushNotificationManager'
import GoogleAnalytics from '../components/GoogleAnalytics'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { usePathname } from 'next/navigation'

// Configuración de temas para breadcrumbs dinámicos
const TEMAS_CONFIG = {
  '1': {
    titulo: 'La Constitución Española de 1978',
    color: 'from-red-500 to-orange-500',
    icon: '📜'
  },
  '4': {
    titulo: 'El Poder Judicial',
    color: 'from-blue-600 to-indigo-600',
    icon: '⚖️'
  },
  '11': {
    titulo: 'Ley 39/2015 Procedimiento Administrativo',
    color: 'from-green-600 to-teal-600',
    icon: '📋'
  },
  '16': {
    titulo: 'Personal al servicio de las AAPP',
    color: 'from-purple-600 to-pink-600',
    icon: '👥'
  },
}

// Componente interno que usa el contexto de Auth
function LayoutContent({ children }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  
  
  // Función para generar labels dinámicos de breadcrumbs
  const getBreadcrumbLabels = () => {
    return {
      '': '🏠 Inicio',
      'auxiliar-administrativo-estado': '👨‍💼 Auxiliar Administrativo Estado',
      'test': '🎯 Tests',
      'temario': '📚 Temarios',
      'leyes': '📚 Leyes',
      // Temas dinámicos
      'tema-1': `${TEMAS_CONFIG['1']?.icon} Tema 1: ${TEMAS_CONFIG['1']?.titulo}`,
      'tema-4': `${TEMAS_CONFIG['4']?.icon} Tema 4: ${TEMAS_CONFIG['4']?.titulo}`,
      'tema-11': `${TEMAS_CONFIG['11']?.icon} Tema 11: ${TEMAS_CONFIG['11']?.titulo}`,
      'tema-16': `${TEMAS_CONFIG['16']?.icon} Tema 16: ${TEMAS_CONFIG['16']?.titulo}`,
      // Tests dinámicos
      'test-1': '📝 Test 1',
      'test-2': '📝 Test 2',
      'test-3': '📝 Test 3',
      'test-4': '📝 Test 4',
      'test-5': '📝 Test 5',
    }
  }

  // Determinar si mostrar breadcrumbs
  const shouldShowBreadcrumbs = () => {
    // Si está cargando, NO mostrar breadcrumbs
    if (loading) return false
    
    // NUNCA mostrar breadcrumbs - Las migas interactivas se encargan de todo
    return false
  }

  return (
    <>
      <HeaderES />
      {shouldShowBreadcrumbs() && (
        <Breadcrumbs customLabels={getBreadcrumbLabels()} />
      )}
      <main className="min-h-screen">
        {/* Mostrar gestor de notificaciones push */}
        <PushNotificationManager />
        
        {children}
      </main>
      <FooterES />
    </>
  )
}

export default function SpanishLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider initialUser={null}>
          <LayoutContent>
            {children}
          </LayoutContent>
        </AuthProvider>
        {/* Google Analytics al final para no bloquear render */}
        <GoogleAnalytics />
      </body>
    </html>
  )
}