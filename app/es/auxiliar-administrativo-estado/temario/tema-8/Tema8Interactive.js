'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../../../contexts/AuthContext'

export default function Tema8Interactive() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('introduccion')
  const [studyTime, setStudyTime] = useState(0)
  const [isStudying, setIsStudying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let interval = null
    if (isStudying) {
      interval = setInterval(() => {
        setStudyTime(studyTime + 1)
      }, 1000)
    } else if (!isStudying && studyTime !== 0) {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isStudying, studyTime])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const calculateProgress = () => {
    const sections = ['introduccion', 'principios', 'centrales', 'superiores', 'territoriales', 'otros', 'exterior', 'examenes']
    return Math.round(((sections.indexOf(activeSection) + 1) / sections.length) * 100)
  }

  useEffect(() => {
    setProgress(calculateProgress())
  }, [activeSection])

  const toggleStudy = () => {
    setIsStudying(!isStudying)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header fijo */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/es/auxiliar-administrativo-estado/temario" className="text-blue-600 hover:text-blue-700">
                <span className="text-xl">←</span>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Tema 8: La Administración General del Estado</h1>
                <p className="text-sm text-gray-600">Organización y estructura administrativa</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                ⏱️ {formatTime(studyTime)}
              </div>
              <button
                onClick={toggleStudy}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  isStudying 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isStudying ? '⏸️ Pausar' : '▶️ Estudiar'}
              </button>
            </div>
          </div>
          
          {/* Barra de progreso */}
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{progress}% completado</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 flex gap-8">
        {/* Navegación lateral */}
        <div className="w-64 bg-white rounded-xl shadow-sm p-4 h-fit sticky top-24">
          <nav className="space-y-2">
            {[
              { id: 'introduccion', label: '1. Introducción', icon: '📋' },
              { id: 'principios', label: '2. Principios de organización', icon: '⚖️' },
              { id: 'centrales', label: '3. Órganos centrales', icon: '🏢' },
              { id: 'superiores', label: '4. Órganos superiores y directivos', icon: '👑' },
              { id: 'territoriales', label: '5. Órganos territoriales', icon: '🗺️' },
              { id: 'otros', label: '6. Otros órganos', icon: '🔧' },
              { id: 'exterior', label: '7. Administración exterior', icon: '🌍' },
              { id: 'examenes', label: '📝 Enfoque exámenes', icon: '🎯' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === item.id
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden">
          
          {/* Sección 1: Introducción */}
          {activeSection === 'introduccion' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">📋</span>
                <h2 className="text-2xl font-bold text-gray-800">Introducción</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-3">¿Qué es la AGE?</h3>
                  <p className="text-blue-800">
                    La <strong>Administración General del Estado</strong> constituye la organización administrativa 
                    del poder ejecutivo estatal, configurándose como el conjunto de órganos y entes que, bajo 
                    la dirección del Gobierno, desarrollan las competencias administrativas del Estado.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-xl">📖</span>
                      Marco normativo principal
                    </h4>
                    <ul className="text-gray-700 space-y-2">
                      <li><strong>Ley 40/2015</strong> de Régimen Jurídico del Sector Público</li>
                      <li><strong>Título I:</strong> Organización y funcionamiento de la AGE</li>
                      <li><strong>Arts. 54-80:</strong> Estructura y competencias</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      Objetivos fundamentales
                    </h4>
                    <ul className="text-gray-700 space-y-2">
                      <li>• Ejecutar las políticas del Gobierno</li>
                      <li>• Desarrollar competencias administrativas estatales</li>
                      <li>• Garantizar unidad de acción estatal</li>
                      <li>• Coordinar administraciones territoriales</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h4 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    Concepto clave para exámenes
                  </h4>
                  <p className="text-yellow-800">
                    La AGE es la <strong>organización administrativa del poder ejecutivo estatal</strong> que actúa 
                    <strong> bajo la dirección del Gobierno</strong> para desarrollar las competencias administrativas 
                    del Estado. No confundir con otras administraciones públicas (autonómicas, locales).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sección 2: Principios de organización */}
          {activeSection === 'principios' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">⚖️</span>
                <h2 className="text-2xl font-bold text-gray-800">Principios de Organización y Funcionamiento</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-red-900 mb-3">🔴 Artículo 54 LRJSP - IMPRESCINDIBLE</h3>
                  <p className="text-red-800 font-medium">
                    Los <strong>6 principios rectores</strong> de la AGE son pregunta frecuente en exámenes oficiales.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h4 className="font-bold text-blue-900 mb-4">Principios básicos (Art. 54.1)</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        <span className="font-medium">Eficacia</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                        <span className="font-medium">Jerarquía</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                        <span className="font-medium">Descentralización funcional</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                        <span className="font-medium">Desconcentración funcional y territorial</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                        <span className="font-medium">Coordinación</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">6</span>
                        <span className="font-medium">Sometimiento pleno a la Ley</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-4">Estructura general (Art. 55)</h4>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-green-800">División funcional</h5>
                        <p className="text-green-700 text-sm">En Departamentos ministeriales</p>
                      </div>
                      <div>
                        <h5 className="font-semibold text-green-800">Gestión territorial integrada</h5>
                        <p className="text-green-700 text-sm">En Delegaciones del Gobierno en CCAA</p>
                      </div>
                      <div>
                        <h5 className="font-semibold text-green-800">Tres organizaciones:</h5>
                        <ul className="text-green-700 text-sm mt-1 space-y-1">
                          <li>• Central (Ministerios)</li>
                          <li>• Territorial (Delegaciones)</li>
                          <li>• Exterior (Embajadas)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <h4 className="font-bold text-orange-900 mb-3">❗ Competencias residuales (Art. 54.2)</h4>
                  <p className="text-orange-800">
                    Las competencias en materia de <strong>organización administrativa, régimen de personal, 
                    procedimientos e inspección de servicios</strong> no atribuidas específicamente a ningún otro 
                    órgano corresponderán al <strong>Ministerio de Hacienda y Administraciones Públicas</strong>.
                  </p>
                </div>

                <div className="mt-8 bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    Preguntas típicas de examen
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Los principios de organización de la AGE son: eficacia, jerarquía, descentralización..."</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 54.1 LRJSP</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Las competencias no atribuidas corresponden al Ministerio de Hacienda"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 54.2 LRJSP</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección 3: Órganos centrales */}
          {activeSection === 'centrales' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🏢</span>
                <h2 className="text-2xl font-bold text-gray-800">Órganos Centrales</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-3">Los Ministerios (Art. 57-58 LRJSP)</h3>
                  <p className="text-blue-800">
                    La AGE se organiza en <strong>Presidencia del Gobierno</strong> y en <strong>Ministerios</strong>, 
                    comprendiendo cada uno de ellos uno o varios sectores funcionalmente homogéneos de actividad administrativa.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white border-2 border-gray-200 p-6 rounded-lg">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      Creación de Ministerios
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-semibold text-gray-700">¿Quién los crea?</h5>
                        <p className="text-gray-600 text-sm">Real Decreto del <strong>Presidente del Gobierno</strong></p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-semibold text-gray-700">¿Qué determina?</h5>
                        <ul className="text-gray-600 text-sm">
                          <li>• Número de Ministerios</li>
                          <li>• Denominación</li>
                          <li>• Ámbito de competencia</li>
                          <li>• Secretarías de Estado</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-gray-200 p-6 rounded-lg">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-xl">🏗️</span>
                      Organización interna (Art. 58)
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Secretarías de Estado</span>
                        <span className="text-sm text-gray-500">Opcional</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Secretarías Generales</span>
                        <span className="text-sm text-gray-500">Opcional</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Subsecretaría</span>
                        <span className="text-sm text-green-600 font-medium">Obligatoria</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Secretaría General Técnica</span>
                        <span className="text-sm text-green-600 font-medium">Obligatoria</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Direcciones Generales</span>
                        <span className="text-sm text-gray-500">Según necesidad</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Subdirecciones Generales</span>
                        <span className="text-sm text-gray-500">Dentro de DG</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    Unidades administrativas (Art. 56)
                  </h4>
                  <p className="text-yellow-800">
                    Son los <strong>elementos organizativos básicos</strong> de las estructuras orgánicas. 
                    Comprenden puestos de trabajo vinculados <strong>funcionalmente</strong> por razón de sus 
                    cometidos y <strong>orgánicamente</strong> por una jefatura común.
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    Preguntas frecuentes
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Los Ministerios se crean por Real Decreto del Presidente del Gobierno"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 57.2 LRJSP</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Todo Ministerio contará con Subsecretaría y Secretaría General Técnica"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 58.2 LRJSP</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-red-500">
                      <p className="font-medium text-gray-800">"Todo Ministerio debe tener Secretarías de Estado"</p>
                      <p className="text-sm text-red-600">❌ FALSO - Son opcionales (Art. 58.1)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección 4: Órganos superiores y directivos */}
          {activeSection === 'superiores' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">👑</span>
                <h2 className="text-2xl font-bold text-gray-800">Órganos Superiores y Directivos</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-red-900 mb-3">🔴 Clasificación IMPRESCINDIBLE (Art. 55.3)</h3>
                  <p className="text-red-800 font-medium">
                    La distinción entre órganos superiores y directivos es pregunta MUY frecuente en exámenes.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg">
                    <h4 className="font-bold text-blue-900 mb-4 text-center">🎖️ ÓRGANOS SUPERIORES</h4>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                        <div className="font-semibold text-blue-800">1. Los Ministros</div>
                        <div className="text-sm text-blue-600">Jefes superiores del Departamento</div>
                      </div>
                      <div className="bg-white p-3 rounded border-l-4 border-blue-500">
                        <div className="font-semibold text-blue-800">2. Los Secretarios de Estado</div>
                        <div className="text-sm text-blue-600">Responsables de sectores específicos</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-4 text-center">🎯 ÓRGANOS DIRECTIVOS</h4>
                    <div className="space-y-2">
                      <div className="bg-white p-2 rounded border-l-4 border-green-500">
                        <div className="font-medium text-green-800 text-sm">1. Subsecretarios y Secretarios generales</div>
                      </div>
                      <div className="bg-white p-2 rounded border-l-4 border-green-500">
                        <div className="font-medium text-green-800 text-sm">2. Secretarios generales técnicos</div>
                      </div>
                      <div className="bg-white p-2 rounded border-l-4 border-green-500">
                        <div className="font-medium text-green-800 text-sm">3. Directores generales</div>
                      </div>
                      <div className="bg-white p-2 rounded border-l-4 border-green-500">
                        <div className="font-medium text-green-800 text-sm">4. Subdirectores generales</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
                  <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    Condición de alto cargo (Art. 55.6) - PREGUNTA FRECUENTE
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-semibold text-green-800 mb-2">✅ SÍ tienen condición de alto cargo:</h5>
                      <ul className="text-green-700 space-y-1 text-sm">
                        <li>• Ministros</li>
                        <li>• Secretarios de Estado</li>
                        <li>• Subsecretarios</li>
                        <li>• Secretarios generales</li>
                        <li>• Secretarios generales técnicos</li>
                        <li>• Directores generales</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-red-800 mb-2">❌ NO tienen condición de alto cargo:</h5>
                      <ul className="text-red-700 space-y-1 text-sm">
                        <li>• <strong>Subdirectores generales</strong></li>
                        <li>• Asimilados</li>
                      </ul>
                      <div className="mt-3 p-2 bg-red-100 rounded">
                        <p className="text-xs text-red-800">
                          <strong>Referencia:</strong> Ley 3/2015 reguladora del ejercicio del alto cargo
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Ministros */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-xl">👨‍💼</span>
                      Los Ministros (Art. 61) - IMPRESCINDIBLE
                    </h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-2">Posición jerárquica:</h5>
                        <p className="text-gray-600 text-sm">
                          Jefes superiores del Departamento y superiores jerárquicos directos de 
                          <strong> Secretarios de Estado</strong> y <strong>Subsecretarios</strong>
                        </p>
                      </div>
                      <div>
                        <h5 className="font-semibold text-gray-700 mb-2">Competencias principales:</h5>
                        <ul className="text-gray-600 text-sm space-y-1">
                          <li>• Ejercer potestad reglamentaria</li>
                          <li>• Fijar objetivos y aprobar planes</li>
                          <li>• Proponer organización interna</li>
                          <li>• Administrar créditos presupuestarios</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Secretarios de Estado */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-xl">🎖️</span>
                      Los Secretarios de Estado (Art. 62)
                    </h4>
                    <p className="text-gray-600 mb-3">
                      Directamente responsables de la <strong>ejecución de la acción del Gobierno</strong> 
                      en un sector de actividad específica.
                    </p>
                    <div className="bg-gray-50 p-4 rounded">
                      <h5 className="font-semibold text-gray-700 mb-2">Competencias clave:</h5>
                      <ul className="text-gray-600 text-sm space-y-1">
                        <li>• Ejercer competencias sobre sector asignado</li>
                        <li>• Dirigir y coordinar órganos dependientes</li>
                        <li>• Nombrar Subdirectores Generales</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    Preguntas típicas de examen
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border-l-4 border-red-500">
                      <p className="font-medium text-gray-800">"Los Subdirectores Generales tienen condición de alto cargo"</p>
                      <p className="text-sm text-red-600">❌ FALSO - Art. 55.6 LRJSP (Excepción expresa)</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Los Ministros son superiores jerárquicos directos de Secretarios de Estado"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 61 LRJSP</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección 5: Órganos territoriales */}
          {activeSection === 'territoriales' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🗺️</span>
                <h2 className="text-2xl font-bold text-gray-800">Órganos Territoriales</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-red-900 mb-3">🔴 Delegados del Gobierno (Art. 72-73) - IMPRESCINDIBLE</h3>
                  <p className="text-red-800 font-medium">
                    Las competencias de los Delegados del Gobierno son pregunta MUY frecuente. 
                    Memorizar las 5 grandes áreas del Art. 73.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg">
                    <h4 className="font-bold text-blue-900 mb-4 text-center">🎖️ DELEGADOS DEL GOBIERNO</h4>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-blue-800">Representación</h5>
                        <p className="text-sm text-blue-600">Representan al <strong>Gobierno de la Nación</strong> en la CCAA</p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-blue-800">Dirección</h5>
                        <p className="text-sm text-blue-600">Dirigen y supervisan la AGE en la CCAA</p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-blue-800">Rango</h5>
                        <p className="text-sm text-blue-600">Rango de <strong>Subsecretario</strong> (Art. 55.4)</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-4 text-center">🏛️ SUBDELEGADOS DEL GOBIERNO</h4>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-green-800">Ubicación</h5>
                        <p className="text-sm text-green-600">En cada provincia de CCAA <strong>pluriprovinciales</strong></p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-green-800">Dependencia</h5>
                        <p className="text-sm text-green-600">Bajo <strong>inmediata dependencia</strong> del Delegado</p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-green-800">Nombramiento</h5>
                        <p className="text-sm text-green-600">Nombrados por el <strong>Delegado</strong> del Gobierno</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                  <h4 className="font-bold text-yellow-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    Las 5 competencias de los Delegados (Art. 73) - MEMORIZAR
                  </h4>
                  <div className="grid md:grid-cols-1 gap-4">
                    <div className="space-y-3">
                      <div className="bg-white p-4 rounded border-l-4 border-yellow-500">
                        <h5 className="font-bold text-yellow-800">1. Dirección y coordinación de la AGE</h5>
                        <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                          <li>• Impulsar, coordinar y supervisar actividad</li>
                          <li>• Nombrar Subdelegados del Gobierno</li>
                          <li>• Informar propuestas de nombramiento</li>
                        </ul>
                      </div>
                      <div className="bg-white p-4 rounded border-l-4 border-yellow-500">
                        <h5 className="font-bold text-yellow-800">2. Información de la acción del Gobierno</h5>
                        <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                          <li>• Coordinar información sobre programas</li>
                          <li>• Promover colaboración con otras AAPP</li>
                          <li>• Elevar informe anual al Gobierno</li>
                        </ul>
                      </div>
                      <div className="bg-white p-4 rounded border-l-4 border-yellow-500">
                        <h5 className="font-bold text-yellow-800">3. Coordinación con otras Administraciones</h5>
                        <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                          <li>• Comunicar con Gobierno CCAA</li>
                          <li>• Mantener relaciones coordinación</li>
                          <li>• Participar en Comisiones mixtas</li>
                        </ul>
                      </div>
                      <div className="bg-white p-4 rounded border-l-4 border-yellow-500">
                        <h5 className="font-bold text-yellow-800">4. Control de legalidad</h5>
                        <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                          <li>• Resolver recursos administrativos</li>
                          <li>• Velar por cumplimiento competencias Estado</li>
                        </ul>
                      </div>
                      <div className="bg-white p-4 rounded border-l-4 border-yellow-500">
                        <h5 className="font-bold text-yellow-800">5. Políticas públicas</h5>
                        <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                          <li>• Formular propuestas sobre objetivos</li>
                          <li>• Proponer medidas anti-duplicidad</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">🏝️</span>
                    Directores Insulares (Art. 70)
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-2">Nombramiento:</h5>
                      <ul className="text-gray-600 text-sm space-y-1">
                        <li>• Por el <strong>Delegado del Gobierno</strong></li>
                        <li>• Procedimiento libre designación</li>
                        <li>• Funcionarios Subgrupo <strong>A1</strong></li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-2">Competencias:</h5>
                      <p className="text-gray-600 text-sm">
                        Ejercen en su ámbito territorial las <strong>competencias atribuidas 
                        a los Subdelegados</strong> del Gobierno en provincias
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h4 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    Preguntas frecuentes
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Los Delegados del Gobierno tienen rango de Subsecretario"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 55.4 LRJSP</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Los Subdelegados son nombrados por el Delegado del Gobierno"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 73.a.2 LRJSP</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-red-500">
                      <p className="font-medium text-gray-800">"Existe Subdelegado en todas las provincias de España"</p>
                      <p className="text-sm text-red-600">❌ FALSO - Solo en CCAA pluriprovinciales</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección 6: Otros órganos */}
          {activeSection === 'otros' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🔧</span>
                <h2 className="text-2xl font-bold text-gray-800">Otros Órganos Administrativos</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg">
                    <h4 className="font-bold text-blue-900 mb-4">🛠️ Servicios comunes (Art. 68)</h4>
                    <p className="text-blue-800 text-sm mb-4">
                      Corresponde el <strong>asesoramiento, apoyo técnico y gestión directa</strong> 
                      en las funciones de servicios comunes.
                    </p>
                    <div className="space-y-2">
                      <div className="bg-white p-2 rounded text-sm">
                        <span className="font-medium">• Planificación y presupuestación</span>
                      </div>
                      <div className="bg-white p-2 rounded text-sm">
                        <span className="font-medium">• Cooperación internacional</span>
                      </div>
                      <div className="bg-white p-2 rounded text-sm">
                        <span className="font-medium">• Organización y RRHH</span>
                      </div>
                      <div className="bg-white p-2 rounded text-sm">
                        <span className="font-medium">• Sistemas información</span>
                      </div>
                      <div className="bg-white p-2 rounded text-sm">
                        <span className="font-medium">• Producción normativa</span>
                      </div>
                      <div className="bg-white p-2 rounded text-sm">
                        <span className="font-medium">• Asistencia jurídica</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-4">⚖️ Creación de órganos (Art. 59)</h4>
                    <div className="space-y-4">
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-green-800 text-sm">Real Decreto Consejo Ministros</h5>
                        <ul className="text-green-700 text-xs mt-1 space-y-1">
                          <li>• Subsecretarías</li>
                          <li>• Secretarías Generales</li>
                          <li>• Secretarías Generales Técnicas</li>
                          <li>• Direcciones Generales</li>
                          <li>• Subdirecciones Generales</li>
                        </ul>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-green-800 text-sm">Orden Ministerial</h5>
                        <p className="text-green-700 text-xs mt-1">
                          Órganos de nivel <strong>inferior a Subdirección General</strong>
                          <br />
                          <span className="text-xs">(previa autorización Mº Hacienda)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">🏛️</span>
                    Servicios territoriales (Art. 71)
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded border-l-4 border-green-500">
                      <h5 className="font-bold text-green-800 mb-2">✅ Servicios integrados</h5>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• Se incorporan estructural y funcionalmente</li>
                        <li>• Bajo dirección del Delegado</li>
                        <li>• Incluyen: Fomento, Industria, Agricultura, Sanidad...</li>
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded border-l-4 border-orange-500">
                      <h5 className="font-bold text-orange-800 mb-2">🔄 Servicios no integrados</h5>
                      <ul className="text-orange-700 text-sm space-y-1">
                        <li>• Mantienen dependencia orgánica de Ministerios</li>
                        <li>• Delegado ejerce coordinación e información</li>
                        <li>• No integración estructural</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">🏴</span>
                    Ceuta y Melilla
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-2">Estructura común:</h5>
                      <ul className="text-gray-600 text-sm space-y-1">
                        <li>• Secretaría General</li>
                        <li>• Gabinete del Delegado</li>
                        <li>• Área funcional de Fomento</li>
                        <li>• Área funcional de Sanidad</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-2">Melilla adicional:</h5>
                      <p className="text-gray-600 text-sm">
                        • Área funcional de <strong>Agricultura y Pesca</strong>
                      </p>
                      <h5 className="font-semibold text-gray-700 mb-2 mt-3">Ambas tienen:</h5>
                      <p className="text-gray-600 text-sm">
                        • Comisión de asistencia (igual que CCAA)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección 7: Administración exterior */}
          {activeSection === 'exterior' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🌍</span>
                <h2 className="text-2xl font-bold text-gray-800">Administración del Estado en el Exterior</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-3">Marco normativo</h3>
                  <p className="text-blue-800">
                    El Servicio Exterior del Estado se rige por la <strong>Ley 2/2014, de 25 de marzo, 
                    de la Acción y del Servicio Exterior del Estado</strong> y, supletoriamente, por la Ley 40/2015.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-yellow-50 border-2 border-yellow-200 p-6 rounded-lg">
                    <h4 className="font-bold text-yellow-900 mb-4">👑 El Rey y la función internacional</h4>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-yellow-800">Representación</h5>
                        <p className="text-sm text-yellow-700">
                          Asume la <strong>más alta representación</strong> de España 
                          en sus relaciones internacionales
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-yellow-800">Tratados</h5>
                        <p className="text-sm text-yellow-700">
                          Manifiesta el <strong>consentimiento del Estado</strong> 
                          para obligarse internacionalmente
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded">
                        <h5 className="font-semibold text-yellow-800">Credenciales</h5>
                        <p className="text-sm text-yellow-700">
                          Acredita Jefes de Misiones y recibe credenciales extranjeras
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-4">🏛️ Servicio Exterior del Estado</h4>
                    <div className="bg-white p-4 rounded mb-4">
                      <h5 className="font-semibold text-green-800 mb-2">Definición (Art. 1.2.c)</h5>
                      <p className="text-sm text-green-700">
                        Los <strong>órganos, unidades administrativas y medios</strong> que, 
                        bajo dirección del Gobierno, ejecutan y desarrollan la 
                        <strong> Política Exterior y Acción Exterior</strong>
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded">
                      <h5 className="font-semibold text-green-800 mb-2">Funciones (Art. 41)</h5>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Aportar elementos de análisis</li>
                        <li>• Coordinar Acción Exterior</li>
                        <li>• Promover intereses de España</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">🌐</span>
                    Órganos del Servicio Exterior
                  </h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded">
                        <h5 className="font-bold text-blue-800 mb-2">🏛️ Misiones Diplomáticas Permanentes</h5>
                        <ul className="text-blue-700 text-sm space-y-1">
                          <li>• Representan a España ante Estados</li>
                          <li>• Pueden ser de acreditación múltiple</li>
                          <li>• Jefatura: Embajador Extraordinario</li>
                        </ul>
                      </div>
                      <div className="bg-green-50 p-4 rounded">
                        <h5 className="font-bold text-green-800 mb-2">🌍 Representaciones Permanentes</h5>
                        <ul className="text-green-700 text-sm space-y-1">
                          <li>• Ante UE u Organizaciones Internacionales</li>
                          <li>• Pueden ser de Observación</li>
                          <li>• Jefatura: Embajador Representante</li>
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-orange-50 p-4 rounded">
                        <h5 className="font-bold text-orange-800 mb-2">⏰ Misiones Diplomáticas Especiales</h5>
                        <ul className="text-orange-700 text-sm space-y-1">
                          <li>• Representación temporal</li>
                          <li>• Para cometido concreto</li>
                          <li>• Carácter especial</li>
                        </ul>
                      </div>
                      <div className="bg-purple-50 p-4 rounded">
                        <h5 className="font-bold text-purple-800 mb-2">🏢 Oficinas Consulares</h5>
                        <ul className="text-purple-700 text-sm space-y-1">
                          <li>• Ejercicio funciones consulares</li>
                          <li>• Asistencia a españoles</li>
                          <li>• De carrera o honorarias</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">👨‍💼</span>
                    Jefaturas y rangos
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded border-l-4 border-blue-500">
                      <h5 className="font-semibold text-blue-800 mb-2">Embajadores</h5>
                      <ul className="text-blue-700 text-sm space-y-1">
                        <li>• <strong>Máxima autoridad</strong> ante Estado receptor</li>
                        <li>• Acreditados por el <strong>Rey</strong> con cartas credenciales</li>
                        <li>• Condición de <strong>órgano directivo</strong> (Art. 55.5)</li>
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded border-l-4 border-green-500">
                      <h5 className="font-semibold text-green-800 mb-2">Encargados de Negocios</h5>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• Pueden ejercer jefatura de Misión</li>
                        <li>• Acreditados con <strong>cartas de gabinete</strong></li>
                        <li>• Firmadas por <strong>Ministro AAEE</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h4 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    Preguntas frecuentes
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"El Rey acredita a los Jefes de Misión Diplomática"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 44 Ley 2/2014</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <p className="font-medium text-gray-800">"Los Embajadores son órganos directivos de la AGE"</p>
                      <p className="text-sm text-green-600">✅ VERDADERO - Art. 55.5 LRJSP</p>
                    </div>
                    <div className="bg-white p-3 rounded border-l-4 border-red-500">
                      <p className="font-medium text-gray-800">"El Servicio Exterior se rige íntegramente por la Ley 40/2015"</p>
                      <p className="text-sm text-red-600">❌ FALSO - Se rige por Ley 2/2014 y supletoriamente 40/2015</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección 8: Enfoque exámenes */}
          {activeSection === 'examenes' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🎯</span>
                <h2 className="text-2xl font-bold text-gray-800">Enfoque Exámenes Oficiales</h2>
              </div>
              
              <div className="prose max-w-none">
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 p-6 rounded-lg mb-8">
                  <h3 className="text-xl font-bold text-red-900 mb-4">🔴 ARTÍCULOS IMPRESCINDIBLES</h3>
                  <p className="text-red-800 mb-4">
                    Estos artículos aparecen con <strong>mucha frecuencia</strong> en exámenes oficiales. 
                    Son de memorización obligatoria.
                  </p>
                  
                  <div className="grid md:grid-cols-1 gap-4">
                    <div className="bg-white p-5 rounded-lg border border-red-200">
                      <h4 className="font-bold text-red-900 mb-3">📋 Artículo 55 LRJSP - Estructura de la AGE</h4>
                      <div className="space-y-2">
                        <div className="bg-red-50 p-3 rounded">
                          <strong className="text-red-800">¿Qué se pregunta más?</strong>
                          <ul className="text-red-700 text-sm mt-1 space-y-1">
                            <li>• Clasificación entre órganos superiores y directivos</li>
                            <li>• <strong>Condición de alto cargo</strong> (apartado 6): quién la tiene y quién NO</li>
                            <li>• Organización territorial vs central</li>
                            <li>• Rangos administrativos</li>
                          </ul>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <strong className="text-gray-800">Preguntas típicas:</strong>
                          <div className="mt-2 space-y-2">
                            <div className="text-sm">❌ "Los Subdirectores Generales tienen condición de alto cargo" (FALSO - art. 55.6)</div>
                            <div className="text-sm">✅ "La AGE se organiza según principios de división funcional en..." (art. 55.1)</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-lg border border-red-200">
                      <h4 className="font-bold text-red-900 mb-3">👨‍💼 Artículo 61 LRJSP - Los Ministros</h4>
                      <div className="space-y-2">
                        <div className="bg-red-50 p-3 rounded">
                          <strong className="text-red-800">¿Qué se pregunta más?</strong>
                          <ul className="text-red-700 text-sm mt-1 space-y-1">
                            <li>• Competencias específicas de los Ministros</li>
                            <li>• Relación jerárquica con otros órganos</li>
                            <li>• Administración de créditos presupuestarios</li>
                          </ul>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <strong className="text-gray-800">Preguntas típicas:</strong>
                          <div className="mt-2 space-y-2">
                            <div className="text-sm">✅ "Son competencias de los Ministros: fijar objetivos, aprobar planes..." (VERDADERO)</div>
                            <div className="text-sm">✅ "Los Ministros son superiores jerárquicos directos de..." (Secretarios de Estado y Subsecretarios)</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-lg border border-red-200">
                      <h4 className="font-bold text-red-900 mb-3">🗺️ Artículo 72-73 LRJSP - Los Delegados del Gobierno</h4>
                      <div className="space-y-2">
                        <div className="bg-red-50 p-3 rounded">
                          <strong className="text-red-800">¿Qué se pregunta más?</strong>
                          <ul className="text-red-700 text-sm mt-1 space-y-1">
                            <li>• Representación del Gobierno en CCAA</li>
                            <li>• <strong>Las 5 grandes áreas competenciales</strong> del art. 73</li>
                            <li>• Dependencia jerárquica</li>
                          </ul>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <strong className="text-gray-800">Preguntas típicas:</strong>
                          <div className="mt-2 space-y-2">
                            <div className="text-sm">✅ "Los Delegados del Gobierno tienen rango de..." (Subsecretario - art. 55.4)</div>
                            <div className="text-sm">✅ "Competencias: dirección y coordinación, información, colaboración..." (art. 73)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 p-6 rounded-lg mb-8">
                  <h3 className="text-xl font-bold text-yellow-900 mb-4">🟡 MUY IMPORTANTES</h3>
                  <p className="text-yellow-800 mb-4">Aparecen <strong>frecuentemente</strong> en exámenes</p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded border border-yellow-200">
                      <h4 className="font-bold text-yellow-900 mb-2">⚖️ Artículo 54 LRJSP - Principios</h4>
                      <ul className="text-yellow-800 text-sm space-y-1">
                        <li>• Los 6 principios rectores de la AGE</li>
                        <li>• Competencias residuales del Ministerio de Hacienda</li>
                      </ul>
                      <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                        <strong>Típicas:</strong> "Principios: eficacia, jerarquía, descentralización..." (art. 54.1)
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded border border-yellow-200">
                      <h4 className="font-bold text-yellow-900 mb-2">🏢 Artículo 57 LRJSP - Ministerios</h4>
                      <ul className="text-yellow-800 text-sm space-y-1">
                        <li>• Organización por sectores homogéneos</li>
                        <li>• Procedimiento de creación (RD Presidente)</li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded border border-yellow-200">
                      <h4 className="font-bold text-yellow-900 mb-2">🎖️ Artículo 62 LRJSP - Secretarios Estado</h4>
                      <ul className="text-yellow-800 text-sm space-y-1">
                        <li>• Responsabilidad directa de ejecución</li>
                        <li>• Competencias sobre sectores específicos</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-500 p-6 rounded-lg mb-8">
                  <h3 className="text-xl font-bold text-green-900 mb-4">🟢 IMPORTANTES</h3>
                  <p className="text-green-800 mb-4">Aparecen <strong>ocasionalmente</strong></p>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded border border-green-200">
                      <h4 className="font-bold text-green-900 mb-2">⚖️ Art. 59 - Creación órganos</h4>
                      <ul className="text-green-800 text-sm space-y-1">
                        <li>• RD Consejo Ministros vs Orden Ministerial</li>
                        <li>• Niveles organizativos</li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded border border-green-200">
                      <h4 className="font-bold text-green-900 mb-2">🏛️ Art. 74-75 - Subdelegados</h4>
                      <ul className="text-green-800 text-sm space-y-1">
                        <li>• Dependencia del Delegado</li>
                        <li>• Competencias a nivel provincial</li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded border border-green-200">
                      <h4 className="font-bold text-green-900 mb-2">🌍 Art. 80 + Ley 2/2014</h4>
                      <ul className="text-green-800 text-sm space-y-1">
                        <li>• Remisión a la Ley 2/2014</li>
                        <li>• Funciones del Rey internacionales</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 text-white p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-2xl">💡</span>
                    Estrategia de estudio para exámenes
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold mb-3 text-yellow-300">🎯 Prioridad MÁXIMA:</h4>
                      <ul className="space-y-2 text-sm">
                        <li>✅ <strong>Art. 55:</strong> Memorizar estructura, clasificación órganos y condición alto cargo</li>
                        <li>✅ <strong>Art. 61:</strong> Competencias de Ministros y relaciones jerárquicas</li>
                        <li>✅ <strong>Art. 72-73:</strong> Las 5 competencias de Delegados del Gobierno</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold mb-3 text-blue-300">📚 Técnicas de memorización:</h4>
                      <ul className="space-y-2 text-sm">
                        <li>🔤 <strong>Principios Art. 54:</strong> "EJDDCS" (Eficacia, Jerarquía, Descentralización...)</li>
                        <li>🔢 <strong>5 competencias Delegados:</strong> DIR-INF-COOR-CON-POL</li>
                        <li>⚠️ <strong>Excepción alto cargo:</strong> Solo Subdirectores NO lo tienen</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer con navegación */}
      <div className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/es/auxiliar-administrativo-estado/temario"
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                ← Volver al Temario
              </Link>
              <Link 
                href="/es/auxiliar-administrativo-estado/test/tema/8"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                🎯 Hacer Test Tema 8
              </Link>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">
                ⏱️ Tiempo de estudio: <span className="font-medium">{formatTime(studyTime)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Progreso: {progress}% • {activeSection === 'examenes' ? 'Sección final' : 'Continúa estudiando'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}