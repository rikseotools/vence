// app/ClientLayoutContent.js - COMPONENTE CLIENTE SEPARADO
'use client'
import HeaderES from './Header'
import FooterES from './Footer'
import Breadcrumbs from '../components/Breadcrumbs'
import PushNotificationManager from '../components/PushNotificationManager'
import { useAuth } from '../contexts/AuthContext'
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
export default function ClientLayoutContent({ children }) {
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
      'tema': (temaNumber) => {
        const tema = TEMAS_CONFIG[temaNumber]
        return tema ? `${tema.icon} ${tema.titulo}` : `📖 Tema ${temaNumber}`
      }
    }
  }

  return (
    <>
      <HeaderES />
      <main>
        {/* Breadcrumbs solo para usuarios no logueados */}
        {!user && !loading && (
          <Breadcrumbs 
            pathname={pathname}
            getBreadcrumbLabels={getBreadcrumbLabels}
          />
        )}
        {children}
      </main>
      <FooterES />
      
      {/* Manager de notificaciones solo para usuarios logueados */}
      {user && <PushNotificationManager />}
    </>
  )
}