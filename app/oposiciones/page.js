// app/oposiciones/page.js - MEJORADO con tarjetas clickeables
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useOposicion } from '../../../contexts/OposicionContext'

export default function OposicionesPage() {
  const { setOposicionActual, oposicionMenu, hasOposicion } = useOposicion()
  const [selectedOposicion, setSelectedOposicion] = useState(null)

  // Datos de oposiciones disponibles
  const oposiciones = [
    {
      id: 'auxiliar-administrativo-estado',
      name: 'Auxiliar Administrativo del Estado',
      shortName: 'Aux. Administrativo',
      badge: 'C2',
      icon: '👨‍💼',
      color: 'blue',
      description: 'Oposición para trabajar en la Administración General del Estado como Auxiliar Administrativo.',
      category: 'Administración General',
      level: 'Grupo C, Subgrupo C2',
      temarios: 16,
      tests: 320,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario completo actualizado',
        'Tests por temas',
        'Simulacros de examen',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'No estar inhabilitado para el ejercicio público'
      ],
      href: '/auxiliar-administrativo-estado'
    }
  ]

  // Detectar oposición actual al cargar
  useEffect(() => {
    if (hasOposicion && oposicionMenu) {
      setSelectedOposicion(oposiciones.find(op => op.id === 'auxiliar-administrativo-estado'))
    }
  }, [hasOposicion, oposicionMenu])

  const handleSelectOposicion = async (oposicion) => {
    setSelectedOposicion(oposicion)
    await setOposicionActual(oposicion.id)
  }

  // 🆕 Manejar click en tarjeta - ir directamente a la oposición
  const handleCardClick = (oposicion, event) => {
    // Evitar que se active si se hace click en enlaces/botones
    if (event.target.tagName === 'A' || event.target.tagName === 'BUTTON' || event.target.closest('a, button')) {
      return
    }
    
    // Ir directamente a la página principal de la oposición
    window.location.href = oposicion.href
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-6">
              <span className="inline-block text-6xl mb-4">🏛️</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Oposiciones Disponibles
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Elige tu oposición y comienza a prepararte con nuestro sistema de estudio personalizado
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📚</span>
                <span className="text-sm md:text-base">Temarios completos</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🎯</span>
                <span className="text-sm md:text-base">Tests ilimitados</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <span className="text-sm md:text-base">Seguimiento detallado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="container mx-auto px-4 py-12">
        
        {/* Oposición actual */}
        {hasOposicion && selectedOposicion && (
          <div className="mb-12">
            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6">
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl">{selectedOposicion.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-emerald-800">
                    🎯 Estudiando actualmente
                  </h2>
                  <p className="text-emerald-600">{selectedOposicion.name}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link 
                  href={`${selectedOposicion.href}/temario`}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  <span>📚</span>
                  <span>Ir al Temario</span>
                </Link>
                <Link 
                  href={`${selectedOposicion.href}/test`}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <span>🎯</span>
                  <span>Hacer Tests</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Instrucciones de uso */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Oposiciones Disponibles
          </h2>
          <p className="text-gray-600 mb-4 max-w-2xl mx-auto">
            Actualmente ofrecemos preparación para la siguiente oposición. 
            Próximamente añadiremos más opciones.
          </p>
          <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">
            <span>💡</span>
            <span>Haz clic en cualquier parte de la tarjeta para ir a la oposición</span>
          </div>
        </div>

        {/* Grid de Oposiciones */}
        <div className="grid gap-8 max-w-4xl mx-auto">
          {oposiciones.map((oposicion) => (
            <div 
              key={oposicion.id}
              onClick={(e) => handleCardClick(oposicion, e)}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border-2 cursor-pointer group border-gray-200 hover:border-blue-300 hover:shadow-blue-100"
            >
              {/* Header */}
              <div className={`bg-gradient-to-r ${
                oposicion.color === 'blue' ? 'from-blue-500 to-indigo-600' :
                oposicion.color === 'emerald' ? 'from-emerald-500 to-teal-600' :
                'from-purple-500 to-pink-600'
              } text-white p-6 relative overflow-hidden`}>
                
                {/* Efecto hover en header */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center space-x-4">
                    <span className="text-4xl transform group-hover:scale-110 transition-transform duration-300">
                      {oposicion.icon}
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">{oposicion.name}</h3>
                      <div className="flex items-center space-x-4 text-sm opacity-90">
                        <span className="bg-white/20 px-3 py-1 rounded-full">
                          {oposicion.badge}
                        </span>
                        <span>{oposicion.level}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Indicador de click */}
                  <div className="opacity-60 group-hover:opacity-100 text-white/80 text-sm font-medium transition-opacity">
                    Haz clic para explorar
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  {oposicion.description}
                </p>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <div className="text-2xl font-bold text-blue-600">{oposicion.temarios}</div>
                    <div className="text-sm text-blue-700">Temas</div>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <div className="text-2xl font-bold text-emerald-600">{oposicion.tests}+</div>
                    <div className="text-sm text-emerald-700">Tests</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                    <div className="text-lg font-bold text-purple-600">{oposicion.difficulty}</div>
                    <div className="text-sm text-purple-700">Dificultad</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                    <div className="text-lg font-bold text-orange-600">{oposicion.duration}</div>
                    <div className="text-sm text-orange-700">Duración</div>
                  </div>
                </div>

                {/* Características */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">✨</span>
                    Características incluidas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {oposicion.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2 text-gray-600">
                        <span className="text-emerald-500">✓</span>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Requisitos */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">📋</span>
                    Requisitos básicos
                  </h4>
                  <div className="space-y-2">
                    {oposicion.requirements.map((req, index) => (
                      <div key={index} className="flex items-start space-x-2 text-gray-600">
                        <span className="text-blue-500 mt-1">•</span>
                        <span className="text-sm">{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Acciones - SIMPLIFICADAS */}
                <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                  <Link 
                    href={`${oposicion.href}/temario`}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors group/btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="group-hover/btn:animate-bounce">📚</span>
                    <span>Ver Temario</span>
                  </Link>
                  <Link 
                    href={`${oposicion.href}/test`}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors group/btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="group-hover/btn:animate-pulse">🎯</span>
                    <span>Hacer Tests</span>
                  </Link>
                </div>

                {/* Indicador visual de que es clickeable */}
                <div className="text-center mt-4 opacity-60 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-gray-500">
                    Haz clic en cualquier parte para explorar esta oposición
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-8 max-w-2xl mx-auto">
            <span className="text-4xl mb-4 block">🚀</span>
            <h3 className="text-2xl font-bold text-purple-800 mb-4">
              ¡Próximamente más oposiciones!
            </h3>
            <p className="text-purple-600 mb-6">
              Estamos trabajando para añadir más oposiciones a nuestra plataforma. 
              Pronto tendrás acceso a Guardia Civil, Policía Nacional, Correos y muchas más.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-purple-500">
              <span>👮‍♂️ Guardia Civil</span>
              <span>🚔 Policía Nacional</span>
              <span>📮 Correos</span>
              <span>⚖️ Justicia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}