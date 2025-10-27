// components/QuestionEvolution.js - COMPONENTE UNIFICADO CON TODA LA INFORMACIÓN - CORREGIDO
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

export default function QuestionEvolution({ 
  userId, 
  questionId, 
  currentResult 
}) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [evolutionData, setEvolutionData] = useState(null)
  const [showDateHistory, setShowDateHistory] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  // Obtener historial completo de la pregunta
  useEffect(() => {
    if (!userId || !questionId) {
      setLoading(false)
      return
    }

    const fetchQuestionHistory = async () => {
      try {
        setLoading(true)
        
        // Validar que questionId es un UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(questionId)) {
          console.warn('⚠️ QuestionEvolution: questionId no es un UUID válido:', questionId)
          setHistory([])
          setEvolutionData(calculateCompleteEvolution([], currentResult))
          setLoading(false)
          return
        }

        // Solo log una vez por questionId
        if (!window.questionEvolutionCache) window.questionEvolutionCache = new Set()
        if (!window.questionEvolutionCache.has(questionId)) {
          console.log('🔍 QuestionEvolution: Buscando historial para:', { questionId, userId })
          window.questionEvolutionCache.add(questionId)
        }
        
        // Consulta completa: Obtener toda la información disponible
        const { data: previousHistory, error } = await supabase
          .from('test_questions')
          .select(`
            id,
            user_answer,
            correct_answer,
            is_correct,
            confidence_level,
            time_spent_seconds,
            created_at,
            test_id,
            question_order,
            tests!inner(
              id,
              title,
              completed_at,
              created_at,
              tema_number,
              user_id,
              total_questions,
              score
            )
          `)
          .eq('question_id', questionId)
          .in('test_id', await getUserTestIds(userId))
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error fetching question history:', error)
          setHistory([])
          setEvolutionData(calculateCompleteEvolution([], currentResult))
          setLoading(false)
          return
        }

        const historialCompleto = previousHistory || []
        
        // Debug detallado: Mostrar todas las fechas de estudio
        // Historial encontrado: {historialCompleto.length} respuestas previas
        
        setHistory(historialCompleto)
        
        // Calcular datos de evolución completos
        const evolucionCalculada = calculateCompleteEvolution(historialCompleto, currentResult)
        setEvolutionData(evolucionCalculada)
        
      } catch (err) {
        console.error('Error en fetchQuestionHistory:', err)
        setHistory([])
        setEvolutionData(calculateCompleteEvolution([], currentResult))
      } finally {
        setLoading(false)
      }
    }

    fetchQuestionHistory()
  }, [userId, questionId, currentResult])

  // Función auxiliar: Obtener IDs de tests del usuario
  const getUserTestIds = async (userId) => {
    try {
      const { data: userTests, error } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', userId)

      if (error) {
        console.warn('Error obteniendo tests del usuario:', error)
        return []
      }

      return userTests.map(test => test.id)
    } catch (err) {
      console.warn('Error en getUserTestIds:', err)
      return []
    }
  }

  // ✅ FUNCIÓN CORREGIDA: Calcular evolución con TODA la información
  const calculateCompleteEvolution = (previousHistory, current) => {
    // Fix: previousHistory YA incluye la respuesta actual de la BD
    // No necesitamos sumar +1 ni agregar current porque ya está incluido
    
    // Debug throttled para evitar spam
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      console.log('🔍 [DEBUG] Calculando evolución:', {
        previousHistoryLength: previousHistory.length,
        shouldNotAddCurrent: true
      })
    }
    
    // Corrección: usar solo previousHistory que ya incluye todo
    const totalIntentos = previousHistory.length
    const intentosCorrectos = previousHistory.filter(h => h.is_correct).length
    const tasaAciertos = totalIntentos > 0 ? Math.round((intentosCorrectos / totalIntentos) * 100) : 0

    // Determinar tipo de evolución
    let tipoEvolucion = 'primera_vez'
    let mensaje = ''
    let icono = '🆕'
    let color = 'blue'

    if (totalIntentos === 0) {
      // No debería pasar
      tipoEvolucion = 'primera_vez'
      mensaje = 'Primera vez que ves esta pregunta'
      icono = '🆕'
      color = 'blue'
    } else if (totalIntentos === 1) {
      // Realmente es la primera vez
      tipoEvolucion = 'primera_vez'
      mensaje = 'Primera vez que ves esta pregunta'
      icono = '🆕'
      color = 'blue'
    } else {
      // Múltiples intentos - comparar últimos dos
      const penultimoIntento = previousHistory[previousHistory.length - 2]
      const ultimoIntento = previousHistory[previousHistory.length - 1]
      
      if (!penultimoIntento.is_correct && ultimoIntento.is_correct) {
        tipoEvolucion = 'mejora'
        mensaje = `¡Progreso! Antes fallaste, ahora acertaste`
        icono = '🎉'
        color = 'green'
      } else if (penultimoIntento.is_correct && !ultimoIntento.is_correct) {
        tipoEvolucion = 'retroceso'
        mensaje = 'Antes acertaste, ahora fallaste'
        icono = '⚠️'
        color = 'orange'
      } else if (ultimoIntento.is_correct) {
        tipoEvolucion = 'consistente_correcto'
        mensaje = `Siempre aciertas esta pregunta (${intentosCorrectos}/${totalIntentos})`
        icono = '✅'
        color = 'green'
      } else {
        tipoEvolucion = 'consistente_incorrecto'
        mensaje = `Sigues fallando esta pregunta (${intentosCorrectos}/${totalIntentos})`
        icono = '❌'
        color = 'red'
      }
    }

    // Usar solo previousHistory para todas las métricas
    const mejorasTiempo = calcularMejoraTiempoSolo(previousHistory)
    const mejorasConfianza = calcularMejoraConfianzaSolo(previousHistory)
    const analisisTemporal = calcularAnalisisTemporal(previousHistory)
    const patronesRendimiento = calcularPatronesRendimientoSolo(previousHistory)
    const estadisticasAvanzadas = calcularEstadisticasAvanzadasSolo(previousHistory)

    return {
      tipoEvolucion,
      mensaje,
      icono,
      color,
      totalIntentos,
      tasaAciertos,
      mejorasTiempo,
      mejorasConfianza,
      analisisTemporal,
      patronesRendimiento,
      estadisticasAvanzadas,
      // Usar solo previousHistory - no duplicar
      historialCompleto: previousHistory
    }
  }

  // Función: Calcular análisis temporal completo
  const calcularAnalisisTemporal = (history) => {
    if (history.length === 0) return null

    const fechas = history.map(h => new Date(h.created_at))
    const primerIntento = fechas[0]
    const ultimoIntento = fechas[fechas.length - 1]
    
    // Días únicos de estudio
    const diasUnicos = [...new Set(history.map(h => h.created_at.split('T')[0]))]
    
    // Calcular intervalos entre intentos
    const intervalos = []
    for (let i = 1; i < fechas.length; i++) {
      const dias = Math.ceil((fechas[i] - fechas[i-1]) / (1000 * 60 * 60 * 24))
      intervalos.push(dias)
    }
    
    const promedioIntervalo = intervalos.length > 0 
      ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length)
      : 0

    // Mejorar análisis de frecuencia
    const diasEstudiando = Math.ceil((ultimoIntento - primerIntento) / (1000 * 60 * 60 * 24))
    
    let frecuenciaEstudio
    if (history.length === 1) {
      frecuenciaEstudio = 'Primera vez'
    } else if (history.length === 2) {
      frecuenciaEstudio = `2 intentos en ${diasUnicos.length} días`
    } else {
      frecuenciaEstudio = `${history.length} intentos en ${diasUnicos.length} días`
    }
    
    return {
      primerIntento,
      ultimoIntento,
      diasEstudiando: Math.max(diasEstudiando, 0),
      sesionesUnicas: diasUnicos.length,
      promedioIntervalo,
      frecuenciaEstudio,
      intervalos,
      consistencia: intervalos.length > 0 ? calcularConsistenciaEstudio(intervalos) : null
    }
  }

  // ✅ NUEVAS FUNCIONES auxiliares que NO usan 'current'

  const calcularMejoraTiempoSolo = (history) => {
    if (history.length < 2) return null
    
    const ultimoIntento = history[history.length - 1]
    const intentosAnteriores = history.slice(0, -1)
    const tiemposAnteriores = intentosAnteriores.map(h => h.time_spent_seconds).filter(t => t > 0)
    
    if (tiemposAnteriores.length === 0) return null
    
    const promedioAnterior = tiemposAnteriores.reduce((a, b) => a + b, 0) / tiemposAnteriores.length
    const tiempoActual = ultimoIntento.time_spent_seconds || 0
    const diferencia = promedioAnterior - tiempoActual
    
    if (Math.abs(diferencia) < 3) return null
    
    return {
      mejoro: diferencia > 0,
      segundos: Math.abs(Math.round(diferencia)),
      porcentaje: Math.round((diferencia / promedioAnterior) * 100),
      promedioAnterior: Math.round(promedioAnterior),
      tiempoActual: tiempoActual
    }
  }

  const calcularMejoraConfianzaSolo = (history) => {
    if (history.length < 2) return null
    
    const ultimoIntento = history[history.length - 1]
    const penultimoIntento = history[history.length - 2]
    
    const confianzaAnterior = penultimoIntento?.confidence_level
    const confianzaActual = ultimoIntento?.confidence_level
    
    if (!confianzaAnterior || !confianzaActual) return null
    
    const nivelesConfianza = {
      'guessing': 1,
      'unsure': 2,
      'sure': 3,
      'very_sure': 4
    }
    
    const nivelAnterior = nivelesConfianza[confianzaAnterior] || 0
    const nivelActual = nivelesConfianza[confianzaActual] || 0
    
    if (nivelAnterior === nivelActual) return null
    
    return {
      mejoro: nivelActual > nivelAnterior,
      anterior: confianzaAnterior,
      actual: confianzaActual,
      cambio: nivelActual - nivelAnterior
    }
  }

  const calcularPatronesRendimientoSolo = (history) => {
    if (history.length === 0) return null

    // Rendimiento por intento
    const rendimientoPorIntento = history.map((h, index) => ({
      intento: index + 1,
      correcto: h.is_correct,
      tiempo: h.time_spent_seconds,
      confianza: h.confidence_level
    }))

    // Calcular tendencia solo si hay múltiples intentos
    let tendencia = 'estable'
    if (history.length >= 3) {
      const aciertosRecientes = history.slice(-3).filter(h => h.is_correct).length
      const aciertosTempranos = history.slice(0, 3).filter(h => h.is_correct).length
      
      if (aciertosRecientes > aciertosTempranos) tendencia = 'mejorando'
      if (aciertosRecientes < aciertosTempranos) tendencia = 'empeorando'
    }

    // Análisis de velocidad
    const tiempos = history.map(h => h.time_spent_seconds).filter(t => t > 0)
    const tiempoPromedio = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b) / tiempos.length : 0
    const ultimoTiempo = history[history.length - 1]?.time_spent_seconds || 0
    const velocidadActual = ultimoTiempo < tiempoPromedio ? 'rápida' : 'lenta'

    return {
      rendimientoPorIntento,
      tendencia,
      tiempoPromedio: Math.round(tiempoPromedio),
      velocidadActual,
      mejorTiempo: tiempos.length > 0 ? Math.min(...tiempos) : ultimoTiempo,
      peorTiempo: tiempos.length > 0 ? Math.max(...tiempos) : ultimoTiempo
    }
  }

  const calcularEstadisticasAvanzadasSolo = (history) => {
    // Distribución de confianza
    const distribicionConfianza = {
      'very_sure': 0,
      'sure': 0,
      'unsure': 0,
      'guessing': 0
    }

    history.forEach(h => {
      if (h.confidence_level && distribicionConfianza.hasOwnProperty(h.confidence_level)) {
        distribicionConfianza[h.confidence_level]++
      }
    })

    // Efectividad por nivel de confianza
    const efectividadPorConfianza = {}
    Object.keys(distribicionConfianza).forEach(nivel => {
      const respuestasNivel = history.filter(h => h.confidence_level === nivel)
      
      if (respuestasNivel.length > 0) {
        const correctas = respuestasNivel.filter(h => h.is_correct).length
        efectividadPorConfianza[nivel] = Math.round((correctas / respuestasNivel.length) * 100)
      }
    })

    // Tests únicos
    const testsUnicos = [...new Set(history.map(h => h.test_id))].length

    return {
      distribicionConfianza,
      efectividadPorConfianza,
      testsUnicos,
      rachaMaximaCorrecta: calcularRachaMaximaSolo(history, true),
      rachaMaximaIncorrecta: calcularRachaMaximaSolo(history, false)
    }
  }

  const calcularRachaMaximaSolo = (history, buscarCorrectas) => {
    let rachaMaxima = 0
    let rachaActual = 0
    
    history.forEach(intento => {
      if (intento.is_correct === buscarCorrectas) {
        rachaActual++
        rachaMaxima = Math.max(rachaMaxima, rachaActual)
      } else {
        rachaActual = 0
      }
    })
    
    return rachaMaxima
  }

  // Funciones auxiliares existentes mejoradas
  const calcularConsistenciaEstudio = (intervalos) => {
    if (intervalos.length < 2) return 'insuficiente'
    
    const promedio = intervalos.reduce((a, b) => a + b) / intervalos.length
    const varianza = intervalos.reduce((acc, val) => acc + Math.pow(val - promedio, 2), 0) / intervalos.length
    const desviacion = Math.sqrt(varianza)
    
    if (desviacion <= promedio * 0.3) return 'muy consistente'
    if (desviacion <= promedio * 0.6) return 'consistente'
    return 'irregular'
  }

  // Función para traducir confianza
  const traducirConfianza = (nivel) => {
    const traducciones = {
      'very_sure': 'muy seguro',
      'sure': 'seguro',
      'unsure': 'inseguro',
      'guessing': 'adivinando'
    }
    return traducciones[nivel] || nivel
  }

  // Función para formatear fecha relativa
  const formatearFechaRelativa = (fecha) => {
  const ahora = new Date()
  const diff = ahora - fecha
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  // Formatear hora en 24h
  const hora = fecha.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
  
  if (dias === 0) return `Hoy a las ${hora}`
  if (dias === 1) return `Ayer a las ${hora}`
  if (dias < 7) return `Hace ${dias} días a las ${hora}`
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} semanas`
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`
  return `Hace ${Math.floor(dias / 365)} años`
}

  // Loading y error silenciosos
  if (loading) return null
  if (error) return null
  if (!evolutionData) return null

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
    green: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
    orange: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
    red: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
  }

  return (
    <div className={`border rounded-lg p-4 mt-4 ${colorClasses[evolutionData.color]}`}>
      {/* Mensaje principal de evolución */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-2xl">{evolutionData.icono}</span>
        <div>
          <div className="font-bold text-sm">Tu Evolución en esta pregunta:</div>
          <div className="text-sm">{evolutionData.mensaje}</div>
        </div>
      </div>

      {/* Métricas principales expandidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-4">
        {/* Estadística general */}
        <div className="flex items-center space-x-1">
          <span>📊</span>
          <div>
            <div className="font-semibold">
              Aciertos: {evolutionData.tasaAciertos}%
            </div>
            <div className="opacity-75">
              ({evolutionData.totalIntentos} {evolutionData.totalIntentos === 1 ? 'intento' : 'intentos'})
            </div>
          </div>
        </div>

        {/* Mejora de tiempo */}
        {evolutionData.mejorasTiempo && (
          <div className="flex items-center space-x-1">
            <span>{evolutionData.mejorasTiempo.mejoro ? '⚡' : '🐌'}</span>
            <div>
              <div className="font-semibold">
                {evolutionData.mejorasTiempo.mejoro ? 'Más rápido' : 'Más lento'}
              </div>
              <div className="opacity-75">
                {evolutionData.mejorasTiempo.segundos}s {evolutionData.mejorasTiempo.mejoro ? 'menos' : 'más'}
              </div>
            </div>
          </div>
        )}

        {/* Mejora de confianza */}
        {evolutionData.mejorasConfianza && (
          <div className="flex items-center space-x-1">
            <span>{evolutionData.mejorasConfianza.mejoro ? '🎯' : '🤔'}</span>
            <div>
              <div className="font-semibold">
                {evolutionData.mejorasConfianza.mejoro ? 'Más seguro' : 'Menos seguro'}
              </div>
              <div className="opacity-75">
                {traducirConfianza(evolutionData.mejorasConfianza.anterior)} → {traducirConfianza(evolutionData.mejorasConfianza.actual)}
              </div>
            </div>
          </div>
        )}

        {/* Racha actual */}
        {evolutionData.estadisticasAvanzadas && (
          <div className="flex items-center space-x-1">
            <span>🔥</span>
            <div>
              <div className="font-semibold">
                Racha máxima: {evolutionData.estadisticasAvanzadas.rachaMaximaCorrecta}
              </div>
              <div className="opacity-75">
                aciertos seguidos
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Análisis temporal mejorado */}
      {evolutionData.analisisTemporal && (
        <div className="mb-4 p-3 bg-black/5 dark:bg-black/20 rounded text-xs">
          <div className="font-semibold mb-2">📅 Historial de estudio:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Lógica mejorada para 1 vs múltiples intentos */}
            {evolutionData.totalIntentos === 1 ? (
              // Solo 1 intento - mostrar "Primer y único intento"
              <>
                <div className="md:col-span-2">
                  <span className="opacity-75">Primer y único intento:</span>
                  <div className="font-medium">{formatearFechaRelativa(evolutionData.analisisTemporal.primerIntento)}</div>
                </div>
                <div>
                  <span className="opacity-75">Sesiones:</span>
                  <div className="font-medium">1 día</div>
                </div>
                <div>
                  <span className="opacity-75">Frecuencia:</span>
                  <div className="font-medium">Primera vez</div>
                </div>
              </>
            ) : (
              // Múltiples intentos - mostrar formato normal
              <>
                <div>
                  <span className="opacity-75">Primer intento:</span>
                  <div className="font-medium">{formatearFechaRelativa(evolutionData.analisisTemporal.primerIntento)}</div>
                </div>
                <div>
                  <span className="opacity-75">Último intento:</span>
                  <div className="font-medium">{formatearFechaRelativa(evolutionData.analisisTemporal.ultimoIntento)}</div>
                </div>
                <div>
                  <span className="opacity-75">Sesiones:</span>
                  <div className="font-medium">{evolutionData.analisisTemporal.sesionesUnicas} días diferentes</div>
                </div>
                <div>
                  <span className="opacity-75">Frecuencia:</span>
                  <div className="font-medium">{evolutionData.analisisTemporal.frecuenciaEstudio}</div>
                </div>
              </>
            )}
          </div>
          
          {/* Consistencia de estudio - solo mostrar si hay múltiples intentos */}
          {evolutionData.analisisTemporal.consistencia && evolutionData.totalIntentos > 1 && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
              <span className="opacity-75">Consistencia:</span>
              <span className={`ml-1 font-medium ${
                evolutionData.analisisTemporal.consistencia === 'muy consistente' ? 'text-green-600' :
                evolutionData.analisisTemporal.consistencia === 'consistente' ? 'text-blue-600' : 'text-orange-600'
              }`}>
                {evolutionData.analisisTemporal.consistencia}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Patrones de rendimiento */}
      {evolutionData.patronesRendimiento && (
        <div className="mb-4 p-3 bg-black/5 dark:bg-black/20 rounded text-xs">
          <div className="font-semibold mb-2">🎯 Análisis de rendimiento:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <span className="opacity-75">Tendencia:</span>
              <div className={`font-medium ${
                evolutionData.patronesRendimiento.tendencia === 'mejorando' ? 'text-green-600' :
                evolutionData.patronesRendimiento.tendencia === 'empeorando' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {evolutionData.patronesRendimiento.tendencia === 'mejorando' ? '📈 Mejorando' :
                 evolutionData.patronesRendimiento.tendencia === 'empeorando' ? '📉 Empeorando' : '📊 Estable'}
              </div>
            </div>
            <div>
              <span className="opacity-75">Velocidad actual:</span>
              <div className={`font-medium ${
                evolutionData.patronesRendimiento.velocidadActual === 'rápida' ? 'text-green-600' : 'text-orange-600'
              }`}>
                {evolutionData.patronesRendimiento.velocidadActual === 'rápida' ? '⚡ Rápida' : '🐌 Lenta'}
              </div>
            </div>
            <div>
              <span className="opacity-75">Tiempo promedio:</span>
              <div className="font-medium">{evolutionData.patronesRendimiento.tiempoPromedio}s</div>
            </div>
          </div>
        </div>
      )}

      {/* Historial visual completo */}
      {evolutionData.totalIntentos > 1 && (
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold">Historial de respuestas:</div>
            <div className="flex space-x-2">
              {evolutionData.totalIntentos > 3 && (
                <button
                  onClick={() => setShowDateHistory(!showDateHistory)}
                  className="text-xs underline opacity-75 hover:opacity-100 transition-opacity"
                >
                  {showDateHistory ? '🔼 Ocultar fechas' : '🔽 Ver fechas'}
                </button>
              )}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  className="text-xs underline opacity-75 hover:opacity-100 transition-opacity"
                >
                  {showDebugInfo ? '🔼 Debug' : '🔽 Debug'}
                </button>
              )}
            </div>
          </div>
          
          {/* Línea de tiempo visual */}
          <div className="flex items-center space-x-1 mb-3">
            {evolutionData.historialCompleto.map((intento, index) => (
              <div
                key={index}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  intento.current
                    ? intento.is_correct 
                      ? 'bg-green-500 text-white ring-2 ring-green-300 ring-offset-1 dark:ring-green-600'
                      : 'bg-red-500 text-white ring-2 ring-red-300 ring-offset-1 dark:ring-red-600'
                    : intento.is_correct
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
                title={`Intento ${index + 1}: ${intento.is_correct ? 'Correcto' : 'Incorrecto'} - ${new Date(intento.created_at).toLocaleDateString('es-ES')}`}
              >
                {intento.is_correct ? '✓' : '✗'}
              </div>
            ))}
          </div>

          {/* Estadísticas avanzadas expandibles */}
          {evolutionData.estadisticasAvanzadas && (
            <div className="mb-3 p-2 bg-black/10 dark:bg-black/30 rounded text-xs">
              <div className="font-semibold mb-2">📊 Estadísticas detalladas:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="opacity-75">Tests únicos:</span>
                  <div className="font-medium">{evolutionData.estadisticasAvanzadas.testsUnicos}</div>
                </div>
                <div>
                  <span className="opacity-75">Racha correcta:</span>
                  <div className="font-medium text-green-600">{evolutionData.estadisticasAvanzadas.rachaMaximaCorrecta}</div>
                </div>
                <div>
                  <span className="opacity-75">Racha incorrecta:</span>
                  <div className="font-medium text-red-600">{evolutionData.estadisticasAvanzadas.rachaMaximaIncorrecta}</div>
                </div>
                <div>
                  <span className="opacity-75">Nivel confianza:</span>
                  <div className="font-medium">
                    {Object.entries(evolutionData.estadisticasAvanzadas.distribicionConfianza)
                      .sort(([,a], [,b]) => b - a)[0]?.[0] ? 
                      traducirConfianza(Object.entries(evolutionData.estadisticasAvanzadas.distribicionConfianza)
                        .sort(([,a], [,b]) => b - a)[0][0]) : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Efectividad por confianza */}
              {Object.keys(evolutionData.estadisticasAvanzadas.efectividadPorConfianza).length > 0 && (
                <div className="mt-3 pt-2 border-t border-current border-opacity-20">
                  <div className="font-semibold mb-1">🎯 Efectividad por nivel de confianza:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(evolutionData.estadisticasAvanzadas.efectividadPorConfianza).map(([nivel, efectividad]) => (
                      <div key={nivel} className="text-center">
                        <div className="opacity-75 text-xs">{traducirConfianza(nivel)}</div>
                        <div className={`font-bold ${
                          efectividad >= 80 ? 'text-green-600' :
                          efectividad >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {efectividad}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fechas detalladas expandibles */}
          {showDateHistory && evolutionData.historialCompleto.length > 1 && (
            <div className="mt-3 space-y-1 text-xs bg-black/10 dark:bg-black/30 rounded p-3 max-h-40 overflow-y-auto">
              <div className="font-semibold mb-2 sticky top-0 bg-inherit">📅 Cronología detallada:</div>
              {evolutionData.historialCompleto.map((intento, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-current border-opacity-10 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                      intento.current
                        ? intento.is_correct ? 'bg-green-500 text-white ring-1 ring-green-300' : 'bg-red-500 text-white ring-1 ring-red-300'
                        : intento.is_correct ? 'bg-green-400 text-white' : 'bg-red-400 text-white'
                    }`}>
                      {intento.is_correct ? '✓' : '✗'}
                    </span>
                    <div>
                      <div className="font-medium">
                        {intento.current ? 'Ahora' : `Intento ${index + 1}`}
                      </div>
                      <div className="opacity-75 text-xs">
                        {intento.time_spent_seconds ? `${intento.time_spent_seconds}s` : ''} 
                        {intento.confidence_level ? ` • ${traducirConfianza(intento.confidence_level)}` : ''}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="opacity-75">
                      {intento.current 
                        ? 'Justo ahora'
                        : new Date(intento.created_at).toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                      }
                    </div>
                    {intento.tests?.title && !intento.current && (
                      <div className="opacity-50 text-xs truncate max-w-24">
                        {intento.tests.title}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Debug info expandible en desarrollo */}
          {process.env.NODE_ENV === 'development' && showDebugInfo && evolutionData.analisisTemporal && (
            <div className="mt-3 pt-2 border-t border-current border-opacity-20">
              <details className="text-xs">
                <summary className="cursor-pointer hover:opacity-100 opacity-75 font-semibold mb-2">
                  🔍 Debug Evolution (Desarrollo)
                </summary>
                <div className="mt-2 p-3 bg-black/10 dark:bg-black/30 rounded space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-semibold mb-1">Identificadores:</div>
                      <div><strong>Question ID:</strong> <span className="font-mono text-xs">{questionId}</span></div>
                      <div><strong>User ID:</strong> <span className="font-mono text-xs">{userId}</span></div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Estadísticas BD:</div>
                      <div><strong>Respuestas en BD:</strong> {history.length}</div>
                      <div><strong>Tests únicos:</strong> {[...new Set(history.map(h => h.test_id))].length}</div>
                    </div>
                  </div>
                  
                  {evolutionData.analisisTemporal && (
                    <div>
                      <div className="font-semibold mb-1">Análisis temporal:</div>
                      <div><strong>Días estudiando:</strong> {evolutionData.analisisTemporal.diasEstudiando}</div>
                      <div><strong>Intervalo promedio:</strong> {evolutionData.analisisTemporal.promedioIntervalo} días</div>
                      <div><strong>Consistencia:</strong> {evolutionData.analisisTemporal.consistencia || 'N/A'}</div>
                    </div>
                  )}
                  
                  {evolutionData.patronesRendimiento && (
                    <div>
                      <div className="font-semibold mb-1">Rendimiento:</div>
                      <div><strong>Mejor tiempo:</strong> {evolutionData.patronesRendimiento.mejorTiempo}s</div>
                      <div><strong>Peor tiempo:</strong> {evolutionData.patronesRendimiento.peorTiempo}s</div>
                      <div><strong>Tendencia:</strong> {evolutionData.patronesRendimiento.tendencia}</div>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-current border-opacity-20">
                    <div className="font-semibold mb-1">Raw Data:</div>
                    <div className="bg-black/20 p-2 rounded font-mono text-xs max-h-32 overflow-auto">
                      {JSON.stringify({
                        totalIntentos: evolutionData.totalIntentos,
                        tasaAciertos: evolutionData.tasaAciertos,
                        tipoEvolucion: evolutionData.tipoEvolucion
                      }, null, 2)}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Consejos y recomendaciones dinámicas */}
      {evolutionData.totalIntentos > 2 && (
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className="text-xs">
            <div className="font-semibold mb-2">💡 Recomendaciones personalizadas:</div>
            <div className="space-y-1">
              {/* Consejo basado en tendencia */}
              {evolutionData.patronesRendimiento?.tendencia === 'mejorando' && (
                <div className="flex items-start space-x-2">
                  <span>🎯</span>
                  <span>¡Excelente progreso! Sigues mejorando en esta pregunta.</span>
                </div>
              )}
              {evolutionData.patronesRendimiento?.tendencia === 'empeorando' && (
                <div className="flex items-start space-x-2">
                  <span>📚</span>
                  <span>Repasa este tema. Tu rendimiento ha disminuido en los últimos intentos.</span>
                </div>
              )}
              
              {/* Consejo basado en tiempo */}
              {evolutionData.mejorasTiempo?.mejoro && (
                <div className="flex items-start space-x-2">
                  <span>⚡</span>
                  <span>Has mejorado tu velocidad. Mantén este ritmo para ser más eficiente.</span>
                </div>
              )}
              
              {/* Consejo basado en confianza */}
              {evolutionData.estadisticasAvanzadas?.efectividadPorConfianza?.guessing > 60 && (
                <div className="flex items-start space-x-2">
                  <span>🤔</span>
                  <span>Curiosamente, aciertas bien "adivinando". Confía más en tu intuición.</span>
                </div>
              )}
              
              {/* Consejo basado en consistencia */}
              {evolutionData.analisisTemporal?.consistencia === 'irregular' && (
                <div className="flex items-start space-x-2">
                  <span>📅</span>
                  <span>Estudia este tema con más regularidad para mejor retención.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
