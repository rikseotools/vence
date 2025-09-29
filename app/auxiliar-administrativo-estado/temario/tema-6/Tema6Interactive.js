'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/AuthContext'
import { useTopicUnlock } from '../../../../../hooks/useTopicUnlock'

export default function Tema6Interactive() {
  const { user } = useAuth()
  const { isTopicUnlocked, getTopicProgress, markTopicAsStudied } = useTopicUnlock()
  const [expandedSection, setExpandedSection] = useState(null)
  const [studyTime, setStudyTime] = useState(0)
  const [isStudying, setIsStudying] = useState(false)

  const temaNumero = 6
  const isUnlocked = user ? isTopicUnlocked(temaNumero) : true
  const progress = user ? getTopicProgress(temaNumero) : { accuracy: 0, questionsAnswered: 0 }

  // Cronómetro de estudio
  useEffect(() => {
    let interval
    if (isStudying) {
      interval = setInterval(() => {
        setStudyTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isStudying])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartStudy = () => {
    setIsStudying(true)
  }

  const handleFinishStudy = async () => {
    setIsStudying(false)
    if (user && studyTime >= 300) { // 5 minutos mínimo
      await markTopicAsStudied(temaNumero, studyTime)
    }
  }

  if (!isUnlocked && user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Tema 6 Bloqueado</h1>
          <p className="text-gray-600 mb-6">
            Debes completar los temas anteriores con al menos 70% de precisión para desbloquear este tema.
          </p>
          <Link 
            href="/auxiliar-administrativo-estado/temario"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver al Temario
          </Link>
        </div>
      </div>
    )
  }

  const secciones = [
    {
      id: 'introduccion',
      titulo: '🌍 Introducción al Tema',
      contenido: `
        <div class="prose max-w-none">
          <p class="text-lg text-gray-700 mb-4">
            El <strong>Tema 6</strong> aborda dos conceptos fundamentales de la gestión pública moderna: 
            el <strong>Gobierno Abierto</strong> y la <strong>Agenda 2030</strong>.
          </p>
          
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h4 class="font-bold text-blue-900 mb-2">🎯 Objetivos del tema:</h4>
            <ul class="text-blue-800 space-y-1">
              <li>• Comprender los 4 principios del Gobierno Abierto</li>
              <li>• Conocer la estructura de la Agenda 2030</li>
              <li>• Dominar los 17 ODS y su relación con GA</li>
              <li>• Memorizar fechas y cifras clave</li>
            </ul>
          </div>

          <div class="bg-red-50 border-l-4 border-red-500 p-4">
            <h4 class="font-bold text-red-900 mb-2">🚨 MUY IMPORTANTE para el examen:</h4>
            <p class="text-red-800">
              <strong>Memoriza perfectamente:</strong><br>
              • 4 principios del Gobierno Abierto<br>
              • Estructura: <strong>17 objetivos + 169 metas + 231 indicadores</strong><br>
              • Fecha: <strong>25 septiembre 2015</strong><br>
              • ODS 16: Instituciones sólidas
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'gobierno-abierto-concepto',
      titulo: '🏛️ Concepto de Gobierno Abierto',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Definición según la OCDE</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <p class="font-mono text-sm">
              "El Gobierno Abierto es una <strong>cultura de gobernanza</strong> que promueve los principios de 
              <strong>transparencia, integridad, rendición de cuentas y participación</strong> de las partes interesadas 
              en apoyo de la democracia y el crecimiento inclusivo."
            </p>
            <div class="text-xs text-gray-600 mt-2">
              Recomendación del Consejo de la OCDE - <strong>14 de diciembre de 2017</strong>
            </div>
          </div>

          <div class="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-blue-900 mb-2">🔹 Características principales</h4>
            <ul class="text-blue-800 space-y-2 text-sm">
              <li>• Es un <strong>modelo de gobernanza</strong> moderno</li>
              <li>• Se apoya en <strong>nuevas tecnologías</strong> e innovación</li>
              <li>• Fortalece la <strong>democracia</strong> y la gestión pública</li>
              <li>• Aumenta la <strong>confianza</strong> en las instituciones</li>
              <li>• Mejora la <strong>prestación de servicios</strong> públicos</li>
            </ul>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">💡 CONCEPTO CLAVE</h4>
            <p class="text-yellow-800 text-sm">
              Gobierno Abierto ≠ Administración Electrónica<br>
              <strong>GA:</strong> Cultura de transparencia y participación<br>
              <strong>AE:</strong> Herramientas digitales para la gestión
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'principios-gobierno-abierto',
      titulo: '⚖️ Los 4 Principios del Gobierno Abierto',
      contenido: `
        <div class="prose max-w-none">
          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h4 class="font-bold text-red-900 mb-2">🚨 ULTRA IMPORTANTE</h4>
            <p class="text-red-800 text-sm">
              Los 4 principios son la pregunta <strong>MÁS FRECUENTE</strong> del tema. 
              No confundir con otros conceptos.
            </p>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">1️⃣ TRANSPARENCIA</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• Proporciona <strong>información y datos</strong></li>
                <li>• Facilita el <strong>acceso</strong> a información pública</li>
                <li>• Promueve la <strong>publicidad activa</strong></li>
                <li>• Presupuestos y desempeño visibles</li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">2️⃣ PARTICIPACIÓN</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• <strong>Ciudadanía activa</strong> en políticas públicas</li>
                <li>• Inclusivo y participativo</li>
                <li>• Participación en <strong>toma de decisiones</strong></li>
                <li>• <strong>Co-creación</strong> de soluciones</li>
              </ul>
            </div>
            
            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-3">3️⃣ COLABORACIÓN</h4>
              <ul class="text-purple-800 space-y-2 text-sm">
                <li>• Trabajo <strong>colaborativo</strong> administraciones-ciudadanos</li>
                <li>• Alianzas <strong>público-privadas</strong></li>
                <li>• Fomenta la <strong>innovación abierta</strong></li>
                <li>• Cooperación entre <strong>múltiples actores</strong></li>
              </ul>
            </div>
            
            <div class="bg-orange-50 p-4 rounded-lg">
              <h4 class="font-bold text-orange-900 mb-3">4️⃣ RENDICIÓN DE CUENTAS</h4>
              <ul class="text-orange-800 space-y-2 text-sm">
                <li>• <strong>Rinde cuentas</strong> ante la sociedad</li>
                <li>• Responde a las <strong>necesidades ciudadanas</strong></li>
                <li>• <strong>Trazabilidad</strong> de decisiones públicas</li>
                <li>• <strong>Control social</strong> continuo</li>
              </ul>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h4 class="font-bold text-yellow-900 mb-2">🎯 PREGUNTA TIPO EXAMEN</h4>
            <p class="text-yellow-800 text-sm mb-2">
              "¿Cuál NO es un principio del Gobierno Abierto?"<br>
              a) Transparencia<br>
              b) Rendición de cuentas<br>
              c) <strong>Integridad</strong> ← TRAMPA FRECUENTE<br>
              d) Participación
            </p>
            <p class="text-yellow-800 text-xs">
              <strong>Respuesta:</strong> c) Integridad (aparece en la definición OCDE pero NO es uno de los 4 principios)
            </p>
          </div>

          <div class="bg-gray-100 p-4 rounded-lg">
            <h4 class="font-bold text-gray-900 mb-2">📋 Truco para memorizar:</h4>
            <div class="text-sm text-gray-800 font-mono">
              T-P-C-R: <strong>T</strong>ransparencia, <strong>P</strong>articipación, <strong>C</strong>olaboración, <strong>R</strong>endición
            </div>
          </div>
        </div>
      `
    },
    {
      id: 'organizacion-espana',
      titulo: '🇪🇸 Organización en España',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Órganos de Coordinación</h3>
          
          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">🏢 Comisión Sectorial de Gobierno Abierto</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• <strong>Solo Administraciones públicas</strong></li>
                <li>• Estatal + Autonómicas + Locales</li>
                <li>• Coordinación, colaboración y debate</li>
                <li>• Intercambio de experiencias</li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🤝 Foro de Gobierno Abierto</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• <strong>Participación paritaria</strong></li>
                <li>• Administraciones + Sociedad civil</li>
                <li>• Diálogo y debate</li>
                <li>• Igual número de representantes</li>
              </ul>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h4 class="font-bold text-yellow-900 mb-2">🔍 DIFERENCIA CLAVE</h4>
            <div class="text-yellow-800 text-sm">
              <p><strong>Comisión Sectorial:</strong> Solo administraciones públicas</p>
              <p><strong>Foro de GA:</strong> Administraciones + Sociedad civil (paritario)</p>
            </div>
          </div>

          <div class="bg-purple-50 p-4 rounded-lg">
            <h4 class="font-bold text-purple-900 mb-3">📋 Normativa organizativa</h4>
            <ul class="text-purple-800 space-y-1 text-sm">
              <li>• <strong>Real Decreto 1671/2009:</strong> Crea Comisión Interministerial GA</li>
              <li>• <strong>Orden PCI/2910/2010:</strong> Desarrolla funcionamiento</li>
              <li>• <strong>Ley 19/2013:</strong> Transparencia y acceso información</li>
            </ul>
          </div>
        </div>
      `
    },
    {
      id: 'agenda-2030-concepto',
      titulo: '🌍 ¿Qué es la Agenda 2030?',
      contenido: `
        <div class="prose max-w-none">
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold mb-2">Definición oficial</h4>
            <p class="text-sm">
              La Agenda 2030 para el Desarrollo Sostenible es un <strong>plan de acción</strong> 
              aprobado por la Asamblea General de las Naciones Unidas el <strong>25 de septiembre de 2015</strong>.
            </p>
          </div>

          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h4 class="font-bold text-red-900 mb-2">📅 FECHA CLAVE - MUY PREGUNTADA</h4>
            <p class="text-red-800 font-bold text-lg">25 de septiembre de 2015</p>
            <p class="text-red-800 text-sm">Esta fecha aparece constantemente en exámenes</p>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">🎯 Características</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• <strong>Compromiso universal</strong> (todos los Estados ONU)</li>
                <li>• Plan para <strong>15 años</strong> (2015-2030)</li>
                <li>• Objetivo: <strong>transformar el mundo</strong></li>
                <li>• Desarrollo sostenible integral</li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🌟 Principios</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• <strong>Universales</strong> (todos los países)</li>
                <li>• <strong>Transformadores</strong> (cambio paradigma)</li>
                <li>• <strong>Civilizatorios</strong> (derechos humanos)</li>
                <li>• <strong>Integrales</strong> (interconectados)</li>
              </ul>
            </div>
          </div>

          <div class="bg-purple-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-purple-900 mb-2">🎨 Plan de acción en favor de:</h4>
            <div class="grid grid-cols-5 gap-2 text-center text-sm">
              <div class="text-purple-800">👥<br>PERSONAS</div>
              <div class="text-purple-800">🌍<br>PLANETA</div>
              <div class="text-purple-800">💰<br>PROSPERIDAD</div>
              <div class="text-purple-800">🕊️<br>PAZ</div>
              <div class="text-purple-800">🤝<br>ALIANZAS</div>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">✨ Principio central</h4>
            <p class="text-yellow-800 text-lg font-bold">"Que nadie quede rezagado"</p>
            <p class="text-yellow-800 text-sm">(No dejar a nadie atrás - Leave no one behind)</p>
          </div>
        </div>
      `
    },
    {
      id: 'estructura-ods',
      titulo: '📊 Estructura: 17 ODS + 169 Metas + 231 Indicadores',
      contenido: `
        <div class="prose max-w-none">
          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h4 class="font-bold text-red-900 mb-2">🚨 CIFRAS MÁS PREGUNTADAS DEL TEMA</h4>
            <div class="text-red-800 text-center">
              <p class="text-2xl font-bold mb-2">17 - 169 - 231</p>
              <p class="text-sm">17 Objetivos + 169 Metas + 231 Indicadores</p>
              <p class="text-xs mt-2">Esta estructura aparece en TODOS los exámenes</p>
            </div>
          </div>

          <h3 class="text-xl font-bold mb-4">Los 17 Objetivos de Desarrollo Sostenible</h3>
          
          <div class="grid md:grid-cols-3 gap-3 mb-6 text-sm">
            <div class="bg-red-50 p-2 rounded">
              <strong>ODS 1:</strong> Fin de la pobreza
            </div>
            <div class="bg-orange-50 p-2 rounded">
              <strong>ODS 2:</strong> Hambre cero
            </div>
            <div class="bg-green-50 p-2 rounded">
              <strong>ODS 3:</strong> Salud y bienestar
            </div>
            <div class="bg-red-50 p-2 rounded">
              <strong>ODS 4:</strong> Educación de calidad
            </div>
            <div class="bg-orange-50 p-2 rounded">
              <strong>ODS 5:</strong> Igualdad de género
            </div>
            <div class="bg-blue-50 p-2 rounded">
              <strong>ODS 6:</strong> Agua limpia y saneamiento
            </div>
            <div class="bg-yellow-50 p-2 rounded">
              <strong>ODS 7:</strong> Energía asequible y no contaminante
            </div>
            <div class="bg-purple-50 p-2 rounded">
              <strong>ODS 8:</strong> Trabajo decente y crecimiento económico
            </div>
            <div class="bg-orange-50 p-2 rounded">
              <strong>ODS 9:</strong> Industria, innovación e infraestructura
            </div>
            <div class="bg-pink-50 p-2 rounded">
              <strong>ODS 10:</strong> Reducción de las desigualdades
            </div>
            <div class="bg-yellow-50 p-2 rounded">
              <strong>ODS 11:</strong> Ciudades y comunidades sostenibles
            </div>
            <div class="bg-green-50 p-2 rounded">
              <strong>ODS 12:</strong> Producción y consumo responsables
            </div>
            <div class="bg-blue-50 p-2 rounded">
              <strong>ODS 13:</strong> Acción por el clima
            </div>
            <div class="bg-blue-50 p-2 rounded">
              <strong>ODS 14:</strong> Vida submarina
            </div>
            <div class="bg-green-50 p-2 rounded">
              <strong>ODS 15:</strong> Vida de ecosistemas terrestres
            </div>
            <div class="bg-indigo-50 p-2 rounded">
              <strong>ODS 16:</strong> Paz, justicia e instituciones sólidas
            </div>
            <div class="bg-purple-50 p-2 rounded">
              <strong>ODS 17:</strong> Alianzas para lograr los objetivos
            </div>
          </div>

          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h4 class="font-bold text-blue-900 mb-2">⭐ ODS MÁS PREGUNTADOS EN EXÁMENES</h4>
            <div class="text-blue-800 text-sm space-y-2">
              <p><strong>ODS 8:</strong> Trabajo decente y crecimiento económico (preguntado en 2021)</p>
              <p><strong>ODS 16:</strong> Paz, justicia e instituciones sólidas (relacionado con GA)</p>
              <p><strong>ODS 17:</strong> Alianzas para lograr objetivos (cooperación internacional)</p>
            </div>
          </div>

          <div class="bg-gray-100 p-4 rounded-lg">
            <h4 class="font-bold text-gray-900 mb-2">📋 Características de los ODS:</h4>
            <ul class="text-gray-800 space-y-1 text-sm">
              <li>• <strong>No son jurídicamente obligatorios</strong> (pero compromiso político)</li>
              <li>• <strong>Requieren alianzas</strong> multiactor</li>
              <li>• <strong>Son medibles</strong> (sistema de seguimiento)</li>
              <li>• <strong>Responsabilidades comunes</strong> pero diferenciadas</li>
            </ul>
          </div>
        </div>
      `
    },
    {
      id: 'implementacion-espana',
      titulo: '🇪🇸 Implementación en España',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Marco Organizativo</h3>
          
          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">🏢 Órganos de Alto Nivel</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• <strong>Ministerio de Derechos Sociales y Agenda 2030</strong></li>
                <li>• Secretaría de Estado para la Agenda 2030</li>
                <li>• Comisión Delegada del Gobierno</li>
                <li>• Alto Comisionado para la Agenda 2030</li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🤝 Órganos de Coordinación</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• <strong>Conferencia Sectorial</strong> (Estado-CCAA)</li>
                <li>• Consejo de Desarrollo Sostenible</li>
                <li>• Grupo de Alto Nivel</li>
                <li>• Participación sociedad civil</li>
              </ul>
            </div>
          </div>

          <div class="bg-purple-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-purple-900 mb-3">📋 Marco Normativo Nacional</h4>
            <ul class="text-purple-800 space-y-2 text-sm">
              <li>• <strong>RD 419/2018:</strong> Crea Oficina Alto Comisionado</li>
              <li>• <strong>RD 2/2020:</strong> Crea Ministerio Derechos Sociales y Agenda 2030</li>
              <li>• <strong>RD 1/2021:</strong> Secretaría de Estado Agenda 2030</li>
              <li>• <strong>Plan de Acción:</strong> Aprobado Consejo Ministros 2018</li>
            </ul>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">📊 Seguimiento y Evaluación</h4>
            <div class="text-yellow-800 text-sm space-y-2">
              <p><strong>Informes anuales:</strong> Progreso desde 2019</p>
              <p><strong>Examen Nacional Voluntario:</strong> Presentado en ONU (último 2021)</p>
              <p><strong>Etiquetado ODS:</strong> En Presupuestos Generales desde 2018</p>
            </div>
          </div>
        </div>
      `
    },
    {
      id: 'relacion-ga-agenda',
      titulo: '🔗 Relación Gobierno Abierto - Agenda 2030',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">GA como Política Palanca para los ODS</h3>
          
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h4 class="font-bold text-blue-900 mb-2">🎯 Contribución especial al ODS 16</h4>
            <p class="text-blue-800 text-sm mb-2">
              <strong>ODS 16:</strong> Paz, justicia e instituciones sólidas
            </p>
            <div class="text-blue-800 text-sm space-y-1">
              <p>• <strong>Meta 16.6:</strong> Instituciones eficaces y transparentes</p>
              <p>• <strong>Meta 16.7:</strong> Decisiones inclusivas y participativas</p>
              <p>• <strong>Meta 16.10:</strong> Acceso público a la información</p>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">✨ GA como Acelerador</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• <strong>Transparencia</strong> en gestión recursos</li>
                <li>• <strong>Participación</strong> en diseño políticas</li>
                <li>• <strong>Rendición cuentas</strong> en seguimiento</li>
                <li>• <strong>Colaboración</strong> multiactor</li>
              </ul>
            </div>
            
            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-3">🔧 Instrumentos Comunes</h4>
              <ul class="text-purple-800 space-y-2 text-sm">
                <li>• Planes de Gobierno Abierto</li>
                <li>• Portales de transparencia</li>
                <li>• Plataformas participación</li>
                <li>• Datos abiertos (Open Data)</li>
              </ul>
            </div>
          </div>

          <div class="bg-orange-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-orange-900 mb-3">📋 En la Estrategia Nacional</h4>
            <div class="text-orange-800 text-sm">
              <p class="mb-2"><strong>Política Palanca 8:</strong> "Democracia digital, gobierno abierto y gobernanza global"</p>
              <p class="text-xs">Los Planes de GA son considerados política palanca para alcanzar los ODS</p>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">🎯 PREGUNTA TIPO EXAMEN</h4>
            <p class="text-yellow-800 text-sm">
              "Los Planes de Gobierno Abierto contribuyen especialmente al cumplimiento del:"<br>
              <strong>Respuesta:</strong> ODS 16 (Paz, justicia e instituciones sólidas)
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'normativa-transparencia',
      titulo: '📋 Ley 19/2013 de Transparencia',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Ley 19/2013, de 9 de diciembre</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold mb-2">Artículo 1 - Objeto</h4>
            <p class="text-sm">
              "Ampliar y reforzar la <strong>transparencia</strong> de la actividad pública, 
              regular el <strong>derecho de acceso</strong> a la información y establecer las 
              <strong>obligaciones de buen gobierno</strong>."
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-50 p-3 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-2 text-sm">📊 TÍTULO I</h4>
              <p class="text-blue-800 text-xs">Transparencia de la actividad pública</p>
            </div>
            
            <div class="bg-green-50 p-3 rounded-lg">
              <h4 class="font-bold text-green-900 mb-2 text-sm">📋 TÍTULO II</h4>
              <p class="text-green-800 text-xs">Derecho de acceso a la información</p>
            </div>
            
            <div class="bg-purple-50 p-3 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-2 text-sm">⚖️ TÍTULO III</h4>
              <p class="text-purple-800 text-xs">Buen gobierno</p>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h4 class="font-bold text-yellow-900 mb-2">📅 Información sujeta a transparencia (Art. 5)</h4>
            <ul class="text-yellow-800 text-sm space-y-1">
              <li>• <strong>Institucional:</strong> Funciones, normativa, estructura</li>
              <li>• <strong>Jurídica:</strong> Directrices, proyectos normativos</li>
              <li>• <strong>Económica:</strong> Contratos, presupuestos, retribuciones</li>
            </ul>
          </div>

          <div class="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-blue-900 mb-3">📋 Derecho de Acceso (Art. 12-13)</h4>
            <div class="text-blue-800 text-sm">
              <p class="mb-2"><strong>Art. 12:</strong> "Todas las personas tienen derecho a acceder a la información pública"</p>
              <p><strong>Art. 13:</strong> Información pública = contenidos/documentos en poder de sujetos obligados</p>
            </div>
          </div>

          <div class="bg-red-50 border-l-4 border-red-500 p-4">
            <h4 class="font-bold text-red-900 mb-2">⏰ PLAZOS (Preguntado en exámenes)</h4>
            <p class="text-red-800 text-sm">
              <strong>Resolución solicitudes acceso:</strong> Un mes desde recepción<br>
              <strong>Silencio administrativo:</strong> Negativo (si no responden = denegado)
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'preguntas-examenes',
      titulo: '📝 Análisis de Preguntas de Exámenes',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Preguntas Reales de Exámenes (2019-2023)</h3>
          
          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h4 class="font-bold text-red-900 mb-2">📊 Frecuencia del Tema</h4>
            <div class="text-red-800 text-sm">
              <p><strong>Examen 2023:</strong> 1 pregunta (junto al Tema 4, los que menos)</p>
              <p><strong>Tendencia:</strong> 1-2 preguntas por examen</p>
              <p><strong>Peso:</strong> 3-6% del Bloque I</p>
            </div>
          </div>

          <div class="space-y-4 mb-6">
            <div class="bg-yellow-50 p-4 rounded-lg">
              <h4 class="font-bold text-yellow-900 mb-2">🎯 PREGUNTA REAL 2022 - Principios GA</h4>
              <p class="text-yellow-800 text-sm mb-2">"¿Cuál NO es un principio del Gobierno Abierto?"</p>
              <div class="text-xs text-yellow-800">
                <p>a) Transparencia</p>
                <p>b) Rendición de cuentas</p>
                <p>c) <strong>Integridad</strong> ← RESPUESTA CORRECTA</p>
                <p>d) Participación</p>
              </div>
            </div>

            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-2">🎯 PREGUNTA REAL 2019 - Estructura Agenda</h4>
              <p class="text-blue-800 text-sm mb-2">"La Agenda 2030 para el Desarrollo Sostenible plantea:"</p>
              <div class="text-xs text-blue-800">
                <p>a) 15 objetivos con 160 metas</p>
                <p>b) 21 objetivos con 184 metas</p>
                <p>c) 18 objetivos con 173 metas</p>
                <p>d) <strong>17 objetivos con 169 metas</strong> ← RESPUESTA CORRECTA</p>
              </div>
            </div>

            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-2">🎯 PREGUNTA REAL 2021 - ODS Específico</h4>
              <p class="text-green-800 text-sm mb-2">"El ODS 8 de la Agenda 2030 se refiere a:"</p>
              <div class="text-xs text-green-800">
                <p>a) <strong>Trabajo decente y crecimiento económico</strong> ← RESPUESTA CORRECTA</p>
                <p>b) Desnuclearización industrial</p>
                <p>c) Racionalización de usos industriales</p>
                <p>d) Impulso extracción combustibles fósiles</p>
              </div>
            </div>
          </div>

          <div class="bg-orange-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-orange-900 mb-2">⚠️ ERRORES MÁS FRECUENTES</h4>
            <ul class="text-orange-800 text-sm space-y-1">
              <li>• Confundir "integridad" como 5º principio del GA</li>
              <li>• Mezclar cifras: 15-160, 21-184 vs 17-169-231</li>
              <li>• Confundir fechas: Sept. 2015 vs Dic. 2017</li>
              <li>• Confundir ODS específicos</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded-lg">
            <h4 class="font-bold text-purple-900 mb-2">✅ ESTRATEGIA PARA EL EXAMEN</h4>
            <div class="text-purple-800 text-sm space-y-2">
              <p><strong>Prioridad MÁXIMA:</strong></p>
              <p>• 4 principios GA: T-P-C-R</p>
              <p>• Estructura: 17-169-231</p>
              <p>• Fecha: 25 septiembre 2015</p>
              <p><strong>Prioridad ALTA:</strong></p>
              <p>• ODS 8 y ODS 16</p>
              <p>• Ley 19/2013</p>
              <p>• Relación GA-Agenda 2030</p>
            </div>
          </div>
        </div>
      `
    },
    {
      id: 'esquema-resumen',
      titulo: '📋 Esquema Resumen para Memorizar',
      contenido: `
        <div class="prose max-w-none">
          <div class="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg mb-6">
            <h3 class="text-xl font-bold text-center mb-4">🎯 ESQUEMA MASTER TEMA 6</h3>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">🏛️ GOBIERNO ABIERTO</h4>
              <div class="text-blue-800 text-sm space-y-2">
                <p><strong>Definición:</strong> Cultura de gobernanza (OCDE 14/dic/2017)</p>
                <p><strong>4 Principios:</strong> T-P-C-R</p>
                <p>• <strong>T</strong>ransparencia</p>
                <p>• <strong>P</strong>articipación</p>
                <p>• <strong>C</strong>olaboración</p>
                <p>• <strong>R</strong>endición cuentas</p>
              </div>
            </div>

            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🌍 AGENDA 2030</h4>
              <div class="text-green-800 text-sm space-y-2">
                <p><strong>Aprobada:</strong> 25 septiembre 2015 (ONU)</p>
                <p><strong>Duración:</strong> 2015-2030 (15 años)</p>
                <p><strong>Estructura:</strong> 17-169-231</p>
                <p><strong>Principio:</strong> "Nadie quede rezagado"</p>
                <p><strong>Plan:</strong> Personas, Planeta, Prosperidad, Paz, Alianzas</p>
              </div>
            </div>
          </div>

          <div class="bg-purple-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-purple-900 mb-3">🔗 RELACIÓN GA - AGENDA 2030</h4>
            <ul class="text-purple-800 text-sm space-y-1">
              <li>• GA = política <strong>palanca</strong> para ODS</li>
              <li>• Contribuye especialmente al <strong>ODS 16</strong></li>
              <li>• Es <strong>acelerador</strong> para otros ODS</li>
              <li>• Meta 16.6: Instituciones transparentes</li>
              <li>• Meta 16.7: Decisiones participativas</li>
              <li>• Meta 16.10: Acceso información</li>
            </ul>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-orange-50 p-4 rounded-lg">
              <h4 class="font-bold text-orange-900 mb-3">📋 NORMATIVA CLAVE</h4>
              <ul class="text-orange-800 text-sm space-y-1">
                <li>• <strong>Ley 19/2013:</strong> Transparencia</li>
                <li>• <strong>RD 419/2018:</strong> Alto Comisionado</li>
                <li>• <strong>RD 2/2020:</strong> Ministerio DsyA2030</li>
                <li>• <strong>Plan Acción:</strong> Consejo Ministros 2018</li>
              </ul>
            </div>

            <div class="bg-red-50 p-4 rounded-lg">
              <h4 class="font-bold text-red-900 mb-3">⚡ DATOS CLAVE EXAMEN</h4>
              <ul class="text-red-800 text-sm space-y-1">
                <li>• <strong>17</strong> objetivos + <strong>169</strong> metas + <strong>231</strong> indicadores</li>
                <li>• <strong>25 septiembre 2015</strong> (aprobación)</li>
                <li>• <strong>4 principios GA</strong> (no 5)</li>
                <li>• <strong>ODS 8:</strong> Trabajo decente</li>
                <li>• <strong>ODS 16:</strong> Instituciones sólidas</li>
              </ul>
            </div>
          </div>

          <div class="mt-6 bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">📚 TRUCOS MEMORIZACIÓN</h4>
            <div class="text-yellow-800 text-sm space-y-1">
              <p><strong>Principios GA:</strong> "Te Puedes Colgar Rápido" (T-P-C-R)</p>
              <p><strong>Agenda 2030:</strong> "17 Reinas en 169 Castillos con 231 Torres"</p>
              <p><strong>Fecha:</strong> "25 de SEPTiembre = SEP-25-tiembre"</p>
              <p><strong>ODS 16:</strong> "16 años = edad de instituciones sólidas"</p>
            </div>
          </div>
        </div>
      `
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fijo */}
      <div className="sticky top-0 bg-white shadow-md z-10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/auxiliar-administrativo-estado/temario"
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Volver al Temario
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Tema 6: El Gobierno Abierto y la Agenda 2030</h1>
              <p className="text-sm text-gray-600">Conceptos, principios y estructura</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Cronómetro de estudio */}
            <div className="text-right">
              <div className="text-sm text-gray-600">Tiempo de estudio</div>
              <div className="font-mono text-lg font-bold text-blue-600">
                {formatTime(studyTime)}
              </div>
            </div>

            {/* Botón de estudio */}
            {!isStudying ? (
              <button 
                onClick={handleStartStudy}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                ▶️ Iniciar Estudio
              </button>
            ) : (
              <button 
                onClick={handleFinishStudy}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                ⏹️ Finalizar Estudio
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Información del tema */}
        <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-xl mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">🌍</span>
                <span className="text-sm bg-white/20 px-2 py-1 rounded-full">Governance</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">El Gobierno Abierto y la Agenda 2030</h2>
              <p className="text-green-100">
                4 Principios GA + 17 ODS + 169 Metas + 231 Indicadores
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-200">Tu progreso</div>
              <div className="text-lg font-bold">{progress.accuracy}% precisión</div>
              <div className="text-sm text-green-200">{progress.questionsAnswered} preguntas</div>
            </div>
          </div>
        </div>

        {/* Alertas importantes */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <h3 className="font-bold text-red-900 mb-2">🚨 MUY PREGUNTADO</h3>
            <p className="text-red-800 text-sm">17-169-231 y los 4 principios del GA aparecen en TODOS los exámenes</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <h3 className="font-bold text-yellow-900 mb-2">⚠️ TRAMPA FRECUENTE</h3>
            <p className="text-yellow-800 text-sm">Integridad NO es uno de los 4 principios del Gobierno Abierto</p>
          </div>
        </div>

        {/* Navegación de secciones */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <h3 className="font-bold text-gray-800 mb-3">📚 Secciones del Tema</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {secciones.map((seccion) => (
              <button
                key={seccion.id}
                onClick={() => setExpandedSection(expandedSection === seccion.id ? null : seccion.id)}
                className={`p-2 text-left text-sm rounded transition-colors ${
                  expandedSection === seccion.id 
                    ? 'bg-green-100 text-green-800 font-medium' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {seccion.titulo}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido de las secciones */}
        <div className="space-y-6">
          {secciones.map((seccion) => (
            <div 
              key={seccion.id}
              className={`bg-white rounded-lg shadow-md transition-all duration-300 ${
                expandedSection === seccion.id ? 'ring-2 ring-green-500' : ''
              }`}
            >
              <button
                onClick={() => setExpandedSection(expandedSection === seccion.id ? null : seccion.id)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-lg font-bold text-gray-800">{seccion.titulo}</h3>
                <span className={`transform transition-transform ${
                  expandedSection === seccion.id ? 'rotate-180' : ''
                }`}>
                  ⌄
                </span>
              </button>
              
              {expandedSection === seccion.id && (
                <div className="p-6 border-t border-gray-200">
                  <div dangerouslySetInnerHTML={{ __html: seccion.contenido }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botón para ir a tests */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-8 rounded-xl">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              ¿Listo para poner a prueba tus conocimientos?
            </h3>
            <p className="text-gray-600 mb-6">
              Practica con preguntas reales de exámenes oficiales sobre este tema.
            </p>
            <Link
              href="/auxiliar-administrativo-estado/test/tema/6"
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-green-700 hover:to-blue-700 transition-all inline-block"
            >
              🎯 Hacer Test del Tema 6
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}