// app/es/Footer.js - FOOTER CON LOGO INTEGRADO
'use client'
import Link from 'next/link'
import { LogoFooter } from '../../components/Logo'
import { useAuth } from '../../contexts/AuthContext'

export default function FooterES() {
  const { user, loading } = useAuth()
  const currentYear = new Date().getFullYear()

  const enlaces = {
    leyes: [
      { nombre: 'Constitución Española', href: '/es/leyes/constitucion-espanola', disponible: true },
      { nombre: 'Ley 39/2015', href: '/es/leyes/ley-39-2015', disponible: false },
      { nombre: 'Ley 40/2015', href: '/es/leyes/ley-40-2015', disponible: false },
      { nombre: 'Código Civil', href: '/es/leyes/codigo-civil', disponible: false },
      { nombre: 'Código Penal', href: '/es/leyes/codigo-penal', disponible: false }
    ],
    oposiciones: [
      { nombre: 'Auxiliar Administrativo Estado', href: '/es/auxiliar-administrativo-estado', disponible: true },
      { nombre: 'Test de Leyes', href: '/es/leyes', disponible: true },
      { nombre: 'Guardia Civil', href: '/es/guardia-civil', disponible: false },
      { nombre: 'Policía Nacional', href: '/es/policia-nacional', disponible: false },
      { nombre: 'Auxilio Judicial', href: '/es/auxilio-judicial', disponible: false }
    ],
    recursos: [
      { nombre: 'Temarios Gratis', href: '/es/auxiliar-administrativo-estado/temario', disponible: true },
      { nombre: 'Tests Online', href: '/es/auxiliar-administrativo-estado/test', disponible: true },
      { nombre: 'Simulacros de Examen', href: '/es/simulacros', disponible: false },
      { nombre: 'Guías de Estudio', href: '/es/guias', disponible: false },
      { nombre: 'Blog Jurídico', href: '/es/blog', disponible: false }
    ],
    ayuda: [
      { nombre: 'Contacto', href: '/es/contacto', disponible: false },
      { nombre: 'Preguntas Frecuentes', href: '/es/faq', disponible: false },
      { nombre: 'Cómo Estudiar', href: '/es/como-estudiar', disponible: false },
      { nombre: 'Política de Privacidad', href: '/es/privacidad', disponible: false },
      { nombre: 'Términos de Uso', href: '/es/terminos', disponible: false }
    ]
  }

  // Si el usuario está logueado, mostrar solo las dos secciones inferiores
  if (user) {
    return (
      <footer className="bg-gray-900 text-white">
        {/* Sección inferior con copyright y enlaces */}
        <div className="border-t border-gray-800">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 mb-4 md:mb-0">
                <p className="text-gray-400 text-sm">
                  © {currentYear} iLoveTest. Todos los derechos reservados.
                </p>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-500 cursor-not-allowed">Privacidad</span>
                  <span className="text-gray-500 cursor-not-allowed">Términos</span>
                  <span className="text-gray-500 cursor-not-allowed">Cookies</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Información legal pequeña */}
        <div className="bg-gray-950 py-3">
          <div className="container mx-auto px-4">
            <p className="text-xs text-gray-500 text-center">
              iLoveTest España es una plataforma educativa independiente. Todos los contenidos son de carácter informativo y educativo.
            </p>
          </div>
        </div>
      </footer>
    )
  }

  // Footer completo para usuarios no logueados
  return (
    <footer className="bg-gray-900 text-white">
      {/* Sección principal del footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Información de la empresa */}
          <div className="lg:col-span-2">
            {/* Logo integrado */}
            <div className="mb-4">
              <LogoFooter />
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed">
              La plataforma para preparar oposiciones y estudiar legislación española. 
              Más de 5.000 preguntas gratuitas, temarios actualizados y simulacros de examen.
            </p>
          </div>

          {/* Tests por Leyes */}
          <div>
            <h4 className="text-lg font-bold mb-4 text-yellow-400">📚 Tests por Leyes</h4>
            <ul className="space-y-2">
              {enlaces.leyes.map((enlace, index) => (
                <li key={index}>
                  {enlace.disponible ? (
                    <Link 
                      href={enlace.href}
                      className="text-gray-300 hover:text-white transition-colors text-sm"
                    >
                      {enlace.nombre}
                    </Link>
                  ) : (
                    <span className="text-gray-500 text-sm cursor-not-allowed">
                      {enlace.nombre} <span className="text-xs">(Pronto)</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Oposiciones */}
          <div>
            <h4 className="text-lg font-bold mb-4 text-blue-400">🎯 Oposiciones</h4>
            <ul className="space-y-2">
              {enlaces.oposiciones.map((enlace, index) => (
                <li key={index}>
                  {enlace.disponible ? (
                    <Link 
                      href={enlace.href}
                      className="text-gray-300 hover:text-white transition-colors text-sm"
                    >
                      {enlace.nombre}
                    </Link>
                  ) : (
                    <span className="text-gray-500 text-sm cursor-not-allowed">
                      {enlace.nombre} <span className="text-xs">(Pronto)</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h4 className="text-lg font-bold mb-4 text-green-400">📖 Recursos</h4>
            <ul className="space-y-2">
              {enlaces.recursos.map((enlace, index) => (
                <li key={index}>
                  {enlace.disponible ? (
                    <Link 
                      href={enlace.href}
                      className="text-gray-300 hover:text-white transition-colors text-sm"
                    >
                      {enlace.nombre}
                    </Link>
                  ) : (
                    <span className="text-gray-500 text-sm cursor-not-allowed">
                      {enlace.nombre} <span className="text-xs">(Pronto)</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Sección inferior */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 mb-4 md:mb-0">
              <p className="text-gray-400 text-sm">
                © {currentYear} iLoveTest España. Todos los derechos reservados.
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-gray-500 cursor-not-allowed">Privacidad</span>
                <span className="text-gray-500 cursor-not-allowed">Términos</span>
                <span className="text-gray-500 cursor-not-allowed">Cookies</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Información legal pequeña */}
      <div className="bg-gray-950 py-3">
        <div className="container mx-auto px-4">
          <p className="text-xs text-gray-500 text-center">
            iLoveTest España es una plataforma educativa independiente. Todos los contenidos son de carácter informativo y educativo.
          </p>
        </div>
      </div>
    </footer>
  )
}