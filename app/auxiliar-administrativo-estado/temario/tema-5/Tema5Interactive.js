'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/AuthContext'
import { useTopicUnlock } from '../../../../../hooks/useTopicUnlock'

export default function Tema5Interactive() {
  const { user } = useAuth()
  const { isTopicUnlocked, getTopicProgress, markTopicAsStudied } = useTopicUnlock()
  const [expandedSection, setExpandedSection] = useState(null)
  const [studyTime, setStudyTime] = useState(0)
  const [isStudying, setIsStudying] = useState(false)

  const temaNumero = 5
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
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Tema 5 Bloqueado</h1>
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
      titulo: '🏛️ Introducción al Tema',
      contenido: `
        <div class="prose max-w-none">
          <p class="text-lg text-gray-700 mb-4">
            El <strong>Título IV de la Constitución Española</strong> regula el Gobierno y la Administración, estableciendo las bases del poder ejecutivo en España.
          </p>
          
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h4 class="font-bold text-blue-900 mb-2">🎯 Objetivos del tema:</h4>
            <ul class="text-blue-800 space-y-1">
              <li>• Conocer la composición y funciones del Gobierno</li>
              <li>• Comprender el proceso de investidura</li>
              <li>• Entender los principios de la Administración Pública</li>
              <li>• Dominar la estructura ministerial</li>
            </ul>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">⚠️ ULTRA IMPORTANTE para el examen:</h4>
            <p class="text-yellow-800">
              Los <strong>artículos 97, 98, 99 y 103</strong> de la Constitución son los más preguntados en los exámenes oficiales. 
              Memoriza especialmente el procedimiento de investidura del artículo 99.
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'composicion-gobierno',
      titulo: '👥 Composición del Gobierno (Art. 98 CE)',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Artículo 98 - Composición</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <p class="font-mono text-sm">
              "El Gobierno se compone del <strong>Presidente, de los Vicepresidentes, en su caso, de los Ministros y de los demás miembros</strong> que establezca la ley."
            </p>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">🔹 El Presidente del Gobierno</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• <strong>Dirige</strong> la acción del Gobierno</li>
                <li>• <strong>Coordina</strong> las funciones de los demás miembros</li>
                <li>• Representa al Gobierno</li>
                <li>• Responsable de la política de defensa</li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🔹 Los Ministros</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• Dirigen sectores específicos de actividad</li>
                <li>• Refrendan actos del Rey en sus materias</li>
                <li>• Proponen Secretarios de Estado</li>
                <li>• Responsabilidad directa en su gestión</li>
              </ul>
            </div>
          </div>

          <div class="bg-red-50 border-l-4 border-red-500 p-4">
            <h4 class="font-bold text-red-900 mb-2">❌ Incompatibilidades (Art. 98.3)</h4>
            <p class="text-red-800 text-sm">
              Los miembros del Gobierno <strong>NO PUEDEN</strong>:
            </p>
            <ul class="text-red-800 text-sm mt-2 space-y-1">
              <li>• Ejercer otras funciones representativas (salvo mandato parlamentario)</li>
              <li>• Ejercer otra función pública que no derive de su cargo</li>
              <li>• Realizar actividad profesional o mercantil alguna</li>
            </ul>
          </div>

          <div class="mt-6 p-4 bg-purple-50 rounded-lg">
            <h4 class="font-bold text-purple-900 mb-2">📊 Estructura Ministerial (Ley 50/1997)</h4>
            <div class="text-sm text-purple-800">
              <p><strong>Ministro</strong> → <strong>Secretarios de Estado</strong> → <strong>Subsecretario</strong></p>
              <p class="mt-2">El Subsecretario es el órgano superior después del Ministro y Secretarios de Estado.</p>
            </div>
          </div>
        </div>
      `
    },
    {
      id: 'funciones-gobierno',
      titulo: '⚖️ Funciones del Gobierno (Art. 97 CE)',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Artículo 97 - Funciones</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <p class="font-mono text-sm">
              "El Gobierno <strong>dirige la política interior y exterior, la Administración civil y militar y la defensa del Estado</strong>. 
              Ejerce la <strong>función ejecutiva y la potestad reglamentaria</strong> de acuerdo con la Constitución y las leyes."
            </p>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">🔹 Función Directiva</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• <strong>Política interior</strong> y exterior</li>
                <li>• <strong>Administración civil</strong> y militar</li>
                <li>• <strong>Defensa del Estado</strong></li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🔹 Potestad Normativa</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• <strong>Función ejecutiva</strong></li>
                <li>• <strong>Potestad reglamentaria</strong></li>
                <li>• Sometimiento a Constitución y leyes</li>
              </ul>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">⚡ PREGUNTA FRECUENTE</h4>
            <p class="text-yellow-800 text-sm">
              <strong>Diferencia función ejecutiva vs legislativa:</strong><br>
              • <strong>Ejecutiva:</strong> Ejecutar y hacer cumplir las leyes<br>
              • <strong>Legislativa:</strong> Crear las leyes (corresponde a las Cortes)
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'investidura',
      titulo: '🗳️ Investidura del Presidente (Art. 99 CE)',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Artículo 99 - Proceso de Investidura</h3>
          
          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h4 class="font-bold text-red-900 mb-2">🚨 ULTRA IMPORTANTE</h4>
            <p class="text-red-800 text-sm">
              El artículo 99 es el <strong>MÁS PREGUNTADO</strong> en exámenes oficiales. 
              Memoriza el procedimiento paso a paso.
            </p>
          </div>

          <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-2">1️⃣ PROPUESTA</h4>
              <p class="text-blue-800 text-sm">
                El <strong>Rey</strong>, previa consulta con representantes de grupos parlamentarios, 
                propone un candidato a través del <strong>Presidente del Congreso</strong>.
              </p>
            </div>

            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-2">2️⃣ PRIMERA VOTACIÓN</h4>
              <p class="text-green-800 text-sm">
                El candidato expone su programa y solicita confianza.<br>
                <strong>Mayoría absoluta</strong> = Más de la mitad de los diputados (176 de 350)
              </p>
            </div>

            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-2">3️⃣ SEGUNDA VOTACIÓN</h4>
              <p class="text-purple-800 text-sm">
                Si no obtiene mayoría absoluta, <strong>48 horas después</strong>.<br>
                <strong>Mayoría simple</strong> = Más votos a favor que en contra
              </p>
            </div>

            <div class="bg-orange-50 p-4 rounded-lg">
              <h4 class="font-bold text-orange-900 mb-2">4️⃣ PLAZO LÍMITE</h4>
              <p class="text-orange-800 text-sm">
                <strong>Dos meses</strong> desde la primera votación de investidura.<br>
                Si nadie obtiene confianza → <strong>Disolución automática</strong> y nuevas elecciones.
              </p>
            </div>
          </div>

          <div class="mt-6 bg-gray-100 p-4 rounded-lg">
            <h4 class="font-bold text-gray-900 mb-2">📋 Esquema para memorizar:</h4>
            <div class="text-sm text-gray-800 font-mono">
              Rey consulta → Propuesta → 1ª votación (mayoría absoluta) → 
              48h → 2ª votación (mayoría simple) → 2 meses máximo → Disolución
            </div>
          </div>
        </div>
      `
    },
    {
      id: 'consejo-ministros',
      titulo: '🏛️ Consejo de Ministros (Ley 50/1997)',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">El Consejo de Ministros</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold mb-2">Artículo 5 - Concepto</h4>
            <p class="font-mono text-sm">
              "El Consejo de Ministros es el <strong>órgano colegiado del Gobierno</strong>, 
              integrado por el Presidente, los Vicepresidentes, en su caso, y los Ministros."
            </p>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">📅 Régimen de Sesiones (Art. 6)</h4>
              <ul class="text-blue-800 space-y-2 text-sm">
                <li>• <strong>Ordinarias:</strong> Todos los viernes</li>
                <li>• <strong>Extraordinarias:</strong> Cuando convoque el Presidente</li>
                <li>• Presididas por el Presidente del Gobierno</li>
                <li>• En su ausencia: Vicepresidente por orden</li>
              </ul>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">⚖️ Competencias (Art. 7)</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• Aprobar <strong>proyectos de ley</strong></li>
                <li>• Aprobar <strong>Presupuestos Generales</strong></li>
                <li>• Aprobar <strong>reglamentos</strong></li>
                <li>• Acordar tratados internacionales</li>
                <li>• Declarar estados de alarma y excepción</li>
              </ul>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">⚡ PREGUNTA FRECUENTE</h4>
            <p class="text-yellow-800 text-sm">
              <strong>"¿Cuándo se reúne el Consejo de Ministros?"</strong><br>
              Respuesta: <strong>"Todos los viernes"</strong> (sesión ordinaria)
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'comisiones-delegadas',
      titulo: '🤝 Comisiones Delegadas del Gobierno',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Comisiones Delegadas (Arts. 8-9 Ley 50/1997)</h3>
          
          <div class="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold text-blue-900 mb-2">🎯 Finalidad</h4>
            <p class="text-blue-800 text-sm">
              Coordinación de la política del Gobierno en materias que 
              <strong>afecten a varios Departamentos ministeriales</strong>.
            </p>
          </div>

          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">🔹 Creación</h4>
              <ul class="text-green-800 space-y-2 text-sm">
                <li>• Por el <strong>Presidente del Gobierno</strong></li>
                <li>• A propuesta propia o de otros miembros</li>
                <li>• Para materias interdepartamentales</li>
              </ul>
            </div>
            
            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-3">🔹 Presidencia</h4>
              <ul class="text-purple-800 space-y-2 text-sm">
                <li>• <strong>Presidente del Gobierno</strong></li>
                <li>• O el <strong>Vicepresidente/Ministro</strong> en quien delegue</li>
              </ul>
            </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg">
            <h4 class="font-bold text-gray-900 mb-2">⚖️ Competencias</h4>
            <ul class="text-gray-800 space-y-1 text-sm">
              <li>• Preparar decisiones del Consejo de Ministros</li>
              <li>• Adoptar decisiones delegadas por el Consejo o el Presidente</li>
            </ul>
          </div>
        </div>
      `
    },
    {
      id: 'principios-administracion',
      titulo: '🏢 Principios de la Administración (Art. 103 CE)',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Artículo 103 - Administración Pública</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <p class="font-mono text-sm">
              "La Administración Pública <strong>sirve con objetividad los intereses generales</strong> y actúa de acuerdo con los principios de 
              <strong>eficacia, jerarquía, descentralización, desconcentración y coordinación</strong>, 
              con <strong>sometimiento pleno a la ley y al Derecho</strong>."
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-50 p-3 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-2 text-sm">🎯 OBJETIVIDAD</h4>
              <p class="text-blue-800 text-xs">Servir intereses generales, no particulares</p>
            </div>
            
            <div class="bg-green-50 p-3 rounded-lg">
              <h4 class="font-bold text-green-900 mb-2 text-sm">⚡ EFICACIA</h4>
              <p class="text-green-800 text-xs">Cumplimiento efectivo de objetivos</p>
            </div>
            
            <div class="bg-purple-50 p-3 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-2 text-sm">📊 JERARQUÍA</h4>
              <p class="text-purple-800 text-xs">Estructura organizativa vertical</p>
            </div>
            
            <div class="bg-orange-50 p-3 rounded-lg">
              <h4 class="font-bold text-orange-900 mb-2 text-sm">🌐 DESCENTRALIZACIÓN</h4>
              <p class="text-orange-800 text-xs">Distribución competencial territorial</p>
            </div>
            
            <div class="bg-red-50 p-3 rounded-lg">
              <h4 class="font-bold text-red-900 mb-2 text-sm">📋 DESCONCENTRACIÓN</h4>
              <p class="text-red-800 text-xs">Delegación interna de competencias</p>
            </div>
            
            <div class="bg-indigo-50 p-3 rounded-lg">
              <h4 class="font-bold text-indigo-900 mb-2 text-sm">🤝 COORDINACIÓN</h4>
              <p class="text-indigo-800 text-xs">Actuación conjunta y coherente</p>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h4 class="font-bold text-yellow-900 mb-2">📝 LEY 40/2015 - Principios adicionales</h4>
            <div class="text-yellow-800 text-sm">
              <p><strong>Art. 3:</strong> Buena fe y confianza legítima</p>
              <p><strong>Art. 4:</strong> Transparencia, accesibilidad, racionalización, participación</p>
              <p><strong>Art. 5:</strong> Cooperación y lealtad institucional</p>
            </div>
          </div>

          <div class="bg-red-50 border-l-4 border-red-500 p-4">
            <h4 class="font-bold text-red-900 mb-2">🚨 MEMORIZAR</h4>
            <p class="text-red-800 text-sm">
              Los 6 principios del Art. 103: <strong>O-E-J-D-D-C</strong><br>
              (Objetividad, Eficacia, Jerarquía, Descentralización, Desconcentración, Coordinación)
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'delegacion-avocacion',
      titulo: '🔄 Delegación y Avocación',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Delegación y Avocación (Arts. 12-13 Ley 50/1997)</h3>
          
          <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">⬇️ DELEGACIÓN (Art. 12)</h4>
              <div class="text-blue-800 text-sm">
                <p class="mb-2"><strong>Concepto:</strong> Transferir competencias a otros órganos</p>
                <p class="mb-2"><strong>Sentido:</strong> De superior a inferior (hacia abajo)</p>
                <p><strong>Requisito:</strong> Circunstancias técnicas, económicas, sociales, jurídicas o territoriales</p>
              </div>
            </div>
            
            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">⬆️ AVOCACIÓN (Art. 13)</h4>
              <div class="text-green-800 text-sm">
                <p class="mb-2"><strong>Concepto:</strong> Asumir competencias de órganos dependientes</p>
                <p class="mb-2"><strong>Sentido:</strong> De inferior a superior (hacia arriba)</p>
                <p><strong>Requisito:</strong> Mismas circunstancias que la delegación</p>
              </div>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h4 class="font-bold text-yellow-900 mb-2">💡 TRUCO para recordar</h4>
            <p class="text-yellow-800 text-sm">
              <strong>DELEGAR:</strong> "DEjar que LO haga otro" (dar competencia)<br>
              <strong>AVOCAR:</strong> "Atraer VOz y voto" (quitar competencia)
            </p>
          </div>

          <div class="bg-gray-100 p-4 rounded-lg">
            <h4 class="font-bold text-gray-900 mb-2">🔍 Diferencias clave:</h4>
            <table class="text-sm text-gray-800 w-full">
              <tr>
                <td class="font-bold p-2 border-r">DELEGACIÓN</td>
                <td class="font-bold p-2">AVOCACIÓN</td>
              </tr>
              <tr>
                <td class="p-2 border-r">Superior → Inferior</td>
                <td class="p-2">Superior ← Inferior</td>
              </tr>
              <tr>
                <td class="p-2 border-r">Dar competencias</td>
                <td class="p-2">Recuperar competencias</td>
              </tr>
              <tr>
                <td class="p-2 border-r">Descarga de trabajo</td>
                <td class="p-2">Control directo</td>
              </tr>
            </table>
          </div>
        </div>
      `
    },
    {
      id: 'cese-responsabilidades',
      titulo: '🚪 Cese y Responsabilidades',
      contenido: `
        <div class="prose max-w-none">
          <h3 class="text-xl font-bold mb-4">Cese de los Miembros del Gobierno</h3>
          
          <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 class="font-bold mb-2">Artículo 15 Ley 50/1997 - Causas de cese</h4>
          </div>

          <div class="grid md:grid-cols-2 gap-4 mb-6">
            <div class="bg-red-50 p-3 rounded-lg">
              <h4 class="font-bold text-red-900 mb-2 text-sm">1️⃣ DIMISIÓN</h4>
              <p class="text-red-800 text-xs">Aceptada por el Presidente del Gobierno</p>
            </div>
            
            <div class="bg-orange-50 p-3 rounded-lg">
              <h4 class="font-bold text-orange-900 mb-2 text-sm">2️⃣ SEPARACIÓN</h4>
              <p class="text-orange-800 text-xs">Acordada por el Presidente del Gobierno</p>
            </div>
            
            <div class="bg-purple-50 p-3 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-2 text-sm">3️⃣ PÉRDIDA CONFIANZA</h4>
              <p class="text-purple-800 text-xs">Confianza parlamentaria</p>
            </div>
            
            <div class="bg-blue-50 p-3 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-2 text-sm">4️⃣ DISOLUCIÓN</h4>
              <p class="text-blue-800 text-xs">Del Gobierno completo</p>
            </div>
            
            <div class="bg-green-50 p-3 rounded-lg">
              <h4 class="font-bold text-green-900 mb-2 text-sm">5️⃣ FALLECIMIENTO</h4>
              <p class="text-green-800 text-xs">O incapacidad</p>
            </div>
          </div>

          <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h4 class="font-bold text-yellow-900 mb-2">📋 Artículo 101 CE - Cese del Gobierno</h4>
            <div class="text-yellow-800 text-sm">
              <p>El Gobierno cesa por:</p>
              <ul class="mt-2 space-y-1">
                <li>• Elecciones generales</li>
                <li>• Pérdida de confianza parlamentaria</li>
                <li>• Dimisión o fallecimiento del Presidente</li>
              </ul>
              <p class="mt-2"><strong>Gobierno cesante:</strong> Continúa en funciones hasta nuevo Gobierno</p>
            </div>
          </div>

          <div class="bg-red-50 border-l-4 border-red-500 p-4">
            <h4 class="font-bold text-red-900 mb-2">⚖️ Responsabilidad Criminal (Art. 102)</h4>
            <p class="text-red-800 text-sm">
              Presidente y miembros del Gobierno: <strong>Sala de lo Penal del Tribunal Supremo</strong><br>
              Por traición o delitos contra seguridad del Estado: necesaria iniciativa de 1/4 del Congreso + mayoría absoluta
            </p>
          </div>
        </div>
      `
    },
    {
      id: 'esquema-resumen',
      titulo: '📋 Esquema Resumen para Memorizar',
      contenido: `
        <div class="prose max-w-none">
          <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6">
            <h3 class="text-xl font-bold text-center mb-4">🎯 ESQUEMA MASTER</h3>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-blue-50 p-4 rounded-lg">
              <h4 class="font-bold text-blue-900 mb-3">👥 COMPOSICIÓN (Art. 98)</h4>
              <ul class="text-blue-800 text-sm space-y-1">
                <li>• <strong>Presidente:</strong> Dirige y coordina</li>
                <li>• <strong>Vicepresidentes:</strong> Opcionales</li>
                <li>• <strong>Ministros:</strong> Dirigen departamentos</li>
                <li>• <strong>Demás miembros:</strong> Sec. Estado, Subsec.</li>
              </ul>
            </div>

            <div class="bg-green-50 p-4 rounded-lg">
              <h4 class="font-bold text-green-900 mb-3">⚖️ FUNCIONES (Art. 97)</h4>
              <ul class="text-green-800 text-sm space-y-1">
                <li>• Política interior y exterior</li>
                <li>• Administración civil y militar</li>
                <li>• Defensa del Estado</li>
                <li>• Función ejecutiva y reglamentaria</li>
              </ul>
            </div>

            <div class="bg-purple-50 p-4 rounded-lg">
              <h4 class="font-bold text-purple-900 mb-3">🗳️ INVESTIDURA (Art. 99)</h4>
              <ul class="text-purple-800 text-sm space-y-1">
                <li>• 1ª votación: <strong>Mayoría absoluta</strong></li>
                <li>• 2ª votación: <strong>48h después, mayoría simple</strong></li>
                <li>• Plazo límite: <strong>2 meses</strong></li>
                <li>• Sin investidura: <strong>Disolución</strong></li>
              </ul>
            </div>

            <div class="bg-orange-50 p-4 rounded-lg">
              <h4 class="font-bold text-orange-900 mb-3">🏛️ CONSEJO MINISTROS</h4>
              <ul class="text-orange-800 text-sm space-y-1">
                <li>• Sesiones: <strong>Todos los viernes</strong></li>
                <li>• Aprobar proyectos de ley</li>
                <li>• Aprobar presupuestos</li>
                <li>• Estados de alarma/excepción</li>
              </ul>
            </div>

            <div class="bg-red-50 p-4 rounded-lg">
              <h4 class="font-bold text-red-900 mb-3">🏢 PRINCIPIOS ADMIN. (103)</h4>
              <div class="text-red-800 text-sm">
                <p class="font-mono">O-E-J-D-D-C</p>
                <p>Objetividad, Eficacia, Jerarquía,</p>
                <p>Descentralización, Desconcentración, Coordinación</p>
              </div>
            </div>

            <div class="bg-indigo-50 p-4 rounded-lg">
              <h4 class="font-bold text-indigo-900 mb-3">🔄 DELEGACIÓN/AVOCACIÓN</h4>
              <ul class="text-indigo-800 text-sm space-y-1">
                <li>• <strong>Delegar:</strong> Superior → Inferior</li>
                <li>• <strong>Avocar:</strong> Superior ← Inferior</li>
                <li>• Requisito: Circunstancias técnicas, etc.</li>
              </ul>
            </div>
          </div>

          <div class="mt-6 bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h4 class="font-bold text-yellow-900 mb-2">🚨 ARTÍCULOS ULTRA IMPORTANTES</h4>
            <div class="text-yellow-800 text-sm">
              <p><strong>Art. 97:</strong> Funciones del Gobierno (función ejecutiva y reglamentaria)</p>
              <p><strong>Art. 98:</strong> Composición e incompatibilidades</p>
              <p><strong>Art. 99:</strong> Investidura (mayorías, plazos, disolución)</p>
              <p><strong>Art. 103:</strong> Principios Administración (O-E-J-D-D-C)</p>
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
              <h1 className="text-lg font-bold text-gray-800">Tema 5: El Gobierno y la Administración</h1>
              <p className="text-sm text-gray-600">Constitución Española - Título IV</p>
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
        <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-6 rounded-xl mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">⚖️</span>
                <span className="text-sm bg-white/20 px-2 py-1 rounded-full">Constitucional</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">El Gobierno y la Administración</h2>
              <p className="text-purple-100">
                Arts. 97-106 CE + Ley 50/1997 del Gobierno + Ley 40/2015 RJSP
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-purple-200">Tu progreso</div>
              <div className="text-lg font-bold">{progress.accuracy}% precisión</div>
              <div className="text-sm text-purple-200">{progress.questionsAnswered} preguntas</div>
            </div>
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
                    ? 'bg-blue-100 text-blue-800 font-medium' 
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
                expandedSection === seccion.id ? 'ring-2 ring-blue-500' : ''
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
              href="/auxiliar-administrativo-estado/test/tema/5"
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-green-700 hover:to-blue-700 transition-all inline-block"
            >
              🎯 Hacer Test del Tema 5
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}