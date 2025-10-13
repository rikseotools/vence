'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckIcon } from '@heroicons/react/24/outline'

export default function PsicotecnicosClient({ psychometricTopics }) {
  const [selectedTopics, setSelectedTopics] = useState(psychometricTopics.map(topic => topic.id))

  const toggleTopic = (topicId) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) 
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    )
  }

  const selectAll = () => {
    setSelectedTopics(psychometricTopics.map(topic => topic.id))
  }

  const deselectAll = () => {
    setSelectedTopics([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Exámenes psicotécnicos
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Realiza tests psicotécnicos (letras, cálculo, matemáticas, figuras...) y comprueba por ti mismo las aptitudes que tienes para resolver este tipo de pruebas.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left Column - Information */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Test Categories */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Test disponibles
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {[
                  'Constitución Española', 'Legislación', 'Administrativo', 'Estado',
                  'Com. Autónomas', 'Sanidad', 'Agentes Hacienda', 'Auxiliar Administrativo',
                  'Universidad', 'Auxiliar Biblioteca', 'Auxiliar Enfermería', 'Auxilio Judicial',
                  'Ayudantes Bibliotecas', 'Ayud. Inst. Penitenciarias', 'Celadores', 'Enfermería',
                  'Formación Sanitaria Esp.', 'EIR', 'FIR', 'MIR', 'PIR',
                  'Gestión Procesal y Adm.', 'Gestión Sist. Informática', 'Matronas',
                  'Superior Informática', 'Tec. Aux. Informática', 'Tram. Procesal y Adm.'
                ].map((category, index) => (
                  <span key={index} className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-center">
                    {category}
                  </span>
                ))}
              </div>
            </div>

            {/* Psychometric Categories */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Pruebas psicotécnicas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Psicotécnicos', 'Coeficiente Intelectual', 'Personalidad', 'Trivial', 'Inglés', 'Educativos', 'Conocimientos'].map((test, index) => (
                  <div key={index} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-lg text-center font-medium">
                    {test}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Description */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Examen psicotécnico
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                  La mejor forma de aumentar las capacidades personales y habilidades consiste en la realización de test psicotécnicos de diferentes materias. En esta sección podrás realizar este test psicotécnico Omnibus formado por:
                </p>
                
                <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    <span><strong>Cálculo numérico</strong> (agilidad numérica, cálculo, serie de números, matemáticas).</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    <span><strong>Razonamiento abstracto</strong> (serie de figuras, figuras no relacionadas, analogías).</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    <span><strong>Aptitudes Administrativas</strong> (detección de errores, matrices de figuras).</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    <span><strong>Razonamiento numérico</strong> (series de números, sucesiones).</span>
                  </li>
                  <li className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    <span><strong>Capacidades verbales</strong> (sinónimos, antónimos, ortografía, letras).</span>
                  </li>
                </ul>

                <p className="text-gray-700 dark:text-gray-300 mt-6 leading-relaxed">
                  Para realizar estos test sólo tienes que seleccionar aquellos temas de los que quieras que te salgan preguntas, de aquellos que no quieras hacer simplemente deselecciónalo. De este modo cada vez que hagas un test, el sistema se encargará de mostrarte 50 preguntas de entre los temas que has elegido, siendo diferentes cada vez que hagas uno.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Test Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sticky top-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Selecciona los temas
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                En total hay disponibles <strong>1720 preguntas</strong>.
              </p>

              {/* Select/Deselect All */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={selectAll}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Seleccionar todo
                </button>
                <button
                  onClick={deselectAll}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Deseleccionar
                </button>
              </div>

              {/* Topic Selection */}
              <div className="space-y-3 mb-8">
                {psychometricTopics.map((topic) => (
                  <label key={topic.id} className="flex items-start space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTopics.includes(topic.id)}
                      onChange={() => toggleTopic(topic.id)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {topic.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {topic.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Start Test Button */}
              <Link 
                href="/psicotecnicos/test"
                className="block w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-center py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                🧩 Hacer Test Psicotécnico
              </Link>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                {selectedTopics.length} tema{selectedTopics.length !== 1 ? 's' : ''} seleccionado{selectedTopics.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">¿Por qué realizar tests psicotécnicos?</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🧠</span>
                </div>
                <h3 className="font-semibold mb-2">Mejora tus aptitudes</h3>
                <p className="text-sm opacity-90">Desarrolla habilidades de razonamiento, cálculo y lógica</p>
              </div>
              <div className="text-center">
                <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-semibold mb-2">Conoce tu nivel</h3>
                <p className="text-sm opacity-90">Evalúa tus capacidades en diferentes áreas</p>
              </div>
              <div className="text-center">
                <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="font-semibold mb-2">Prepárate mejor</h3>
                <p className="text-sm opacity-90">Practica para oposiciones y procesos selectivos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}