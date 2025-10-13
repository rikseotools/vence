'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

export default function PsychometricQuestionEvolution({ 
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

  // Obtener historial completo de la pregunta psicotécnica
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
          console.warn('⚠️ PsychometricQuestionEvolution: questionId no es un UUID válido:', questionId)
          setHistory([])
          setEvolutionData(calculateCompleteEvolution([], currentResult))
          setLoading(false)
          return
        }

        console.log('🔍 PsychometricQuestionEvolution: Buscando historial para:', {
          questionId,
          userId
        })
        
        // Consulta para preguntas psicotécnicas
        const { data: previousHistory, error } = await supabase
          .from('psychometric_test_answers')
          .select(`
            id,
            user_answer,
            is_correct,
            time_spent_seconds,
            created_at,
            test_session_id,
            question_order,
            psychometric_test_sessions!inner(
              id,
              session_type,
              total_questions
            )
          `)
          .eq('question_id', questionId)
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error fetching psychometric question history:', error)
          setHistory([])
          setEvolutionData(calculateCompleteEvolution([], currentResult))
          setLoading(false)
          return
        }

        const historialCompleto = previousHistory || []
        
        console.log(`🔍 Historial psicotécnico encontrado: ${historialCompleto.length} respuestas previas`)
        
        setHistory(historialCompleto)
        
        // Calcular datos de evolución completos
        const evolucionCalculada = calculateCompleteEvolution(historialCompleto, currentResult)
        setEvolutionData(evolucionCalculada)
        
      } catch (err) {
        console.error('Error en fetchQuestionHistory psicotécnico:', err)
        setHistory([])
        setEvolutionData(calculateCompleteEvolution([], currentResult))
      } finally {
        setLoading(false)
      }
    }

    fetchQuestionHistory()
  }, [userId, questionId, currentResult])

  // Calcular evolución completa para preguntas psicotécnicas
  const calculateCompleteEvolution = (previousHistory, current) => {
    console.log('🔍 [DEBUG] Calculando evolución psicotécnica:', {
      previousHistoryLength: previousHistory.length,
      currentResult: current
    })
    
    const totalIntentos = previousHistory.length
    const intentosCorrectos = previousHistory.filter(h => h.is_correct).length
    const tasaAciertos = totalIntentos > 0 ? Math.round((intentosCorrectos / totalIntentos) * 100) : 0

    // Determinar tipo de evolución
    let tipoEvolucion = 'primera_vez'
    let mensaje = ''
    let icono = '🆕'
    let color = 'blue'

    if (totalIntentos === 0) {
      tipoEvolucion = 'primera_vez'
      mensaje = 'Primera vez que ves esta pregunta psicotécnica'
      icono = '🆕'
      color = 'blue'
    } else if (totalIntentos === 1) {
      tipoEvolucion = 'primera_vez'
      mensaje = 'Primera vez que ves esta pregunta psicotécnica'
      icono = '🆕'
      color = 'blue'
    } else {
      // Múltiples intentos - comparar últimos dos
      const penultimoIntento = previousHistory[previousHistory.length - 2]
      const ultimoIntento = previousHistory[previousHistory.length - 1]
      
      if (!penultimoIntento.is_correct && ultimoIntento.is_correct) {
        tipoEvolucion = 'mejora'
        mensaje = `¡Progreso en psicotécnicos! Antes fallaste, ahora acertaste`
        icono = '🧠'
        color = 'green'
      } else if (penultimoIntento.is_correct && !ultimoIntento.is_correct) {
        tipoEvolucion = 'retroceso'
        mensaje = 'Antes acertaste esta pregunta psicotécnica, ahora fallaste'
        icono = '🤔'
        color = 'orange'
      } else if (ultimoIntento.is_correct) {
        tipoEvolucion = 'consistente_correcto'
        mensaje = `Dominas este tipo de pregunta psicotécnica (${intentosCorrectos}/${totalIntentos})`
        icono = '⭐'
        color = 'green'
      } else {
        tipoEvolucion = 'consistente_incorrecto'
        mensaje = `Esta pregunta psicotécnica te cuesta (${intentosCorrectos}/${totalIntentos})`
        icono = '📚'
        color = 'red'
      }
    }

    // Calcular métricas específicas de psicotécnicos
    const mejorasTiempo = calcularMejoraTiempo(previousHistory)
    const analisisInteraccion = calcularAnalisisInteraccion(previousHistory)
    const analisisTemporal = calcularAnalisisTemporal(previousHistory)
    const patronesRendimiento = calcularPatronesRendimiento(previousHistory)
    const estadisticasAvanzadas = calcularEstadisticasAvanzadas(previousHistory)

    return {
      tipoEvolucion,
      mensaje,
      icono,
      color,
      totalIntentos,
      tasaAciertos,
      mejorasTiempo,
      analisisInteraccion,
      analisisTemporal,
      patronesRendimiento,
      estadisticasAvanzadas,
      historialCompleto: previousHistory
    }
  }

  // Funciones específicas para análisis psicotécnico
  const calcularMejoraTiempo = (history) => {
    if (history.length < 2) return null
    
    const ultimoIntento = history[history.length - 1]
    const intentosAnteriores = history.slice(0, -1)
    const tiemposAnteriores = intentosAnteriores.map(h => h.time_spent_seconds).filter(t => t > 0)
    
    if (tiemposAnteriores.length === 0) return null
    
    const promedioAnterior = tiemposAnteriores.reduce((a, b) => a + b, 0) / tiemposAnteriores.length
    const tiempoActual = ultimoIntento.time_spent_seconds || 0
    const diferencia = promedioAnterior - tiempoActual
    
    if (Math.abs(diferencia) < 5) return null // Mayor tolerancia para psicotécnicos
    
    return {
      mejoro: diferencia > 0,
      segundos: Math.abs(Math.round(diferencia)),
      porcentaje: Math.round((diferencia / promedioAnterior) * 100),
      promedioAnterior: Math.round(promedioAnterior),
      tiempoActual: tiempoActual
    }
  }

  const calcularAnalisisInteraccion = (history) => {
    if (history.length === 0) return null

    // Analizar datos de interacción específicos de psicotécnicos
    const interacciones = history
      .map(h => h.interaction_data)
      .filter(data => data && typeof data === 'object')

    if (interacciones.length === 0) return null

    let totalClicksChart = 0
    let totalHoverTime = 0
    let metodosCalculo = {}
    let usedQuickButtons = 0

    interacciones.forEach(data => {
      if (data.clicks_on_chart) totalClicksChart += data.clicks_on_chart
      if (data.hover_time_seconds) totalHoverTime += data.hover_time_seconds
      if (data.calculation_method) {
        metodosCalculo[data.calculation_method] = (metodosCalculo[data.calculation_method] || 0) + 1
      }
      if (data.used_quick_buttons) usedQuickButtons++
    })

    return {
      clicksPromedioChart: Math.round(totalClicksChart / interacciones.length),
      tiempoHoverPromedio: Math.round(totalHoverTime / interacciones.length),
      metodoCalculoPreferido: Object.keys(metodosCalculo).reduce((a, b) => 
        metodosCalculo[a] > metodosCalculo[b] ? a : b, null),
      usoBotonesRapidos: Math.round((usedQuickButtons / interacciones.length) * 100)
    }
  }

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

    const diasEstudiando = Math.ceil((ultimoIntento - primerIntento) / (1000 * 60 * 60 * 24))
    
    let frecuenciaEstudio
    if (history.length === 1) {
      frecuenciaEstudio = 'Primera vez'
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
      intervalos
    }
  }

  const calcularPatronesRendimiento = (history) => {
    if (history.length === 0) return null

    // Rendimiento por intento
    const rendimientoPorIntento = history.map((h, index) => ({
      intento: index + 1,
      correcto: h.is_correct,
      tiempo: h.time_spent_seconds,
      sessionType: h.psychometric_test_sessions?.session_type
    }))

    // Calcular tendencia
    let tendencia = 'estable'
    if (history.length >= 3) {
      const aciertosRecientes = history.slice(-3).filter(h => h.is_correct).length
      const aciertosTempranos = history.slice(0, 3).filter(h => h.is_correct).length
      
      if (aciertosRecientes > aciertosTempranos) tendencia = 'mejorando'
      if (aciertosRecientes < aciertosTempranos) tendencia = 'empeorando'
    }

    // Análisis de velocidad específico para psicotécnicos
    const tiempos = history.map(h => h.time_spent_seconds).filter(t => t > 0)
    const tiempoPromedio = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b) / tiempos.length : 0
    const ultimoTiempo = history[history.length - 1]?.time_spent_seconds || 0
    
    // Para psicotécnicos, velocidad óptima es importante pero no debe ser demasiado rápida
    let velocidadActual = 'normal'
    if (ultimoTiempo < tiempoPromedio * 0.7) velocidadActual = 'muy_rapida'
    else if (ultimoTiempo < tiempoPromedio * 0.9) velocidadActual = 'rapida'
    else if (ultimoTiempo > tiempoPromedio * 1.3) velocidadActual = 'lenta'

    return {
      rendimientoPorIntento,
      tendencia,
      tiempoPromedio: Math.round(tiempoPromedio),
      velocidadActual,
      mejorTiempo: tiempos.length > 0 ? Math.min(...tiempos) : ultimoTiempo,
      peorTiempo: tiempos.length > 0 ? Math.max(...tiempos) : ultimoTiempo
    }
  }

  const calcularEstadisticasAvanzadas = (history) => {
    // Análisis por tipo de sesión
    const sesiones = {}
    history.forEach(h => {
      const sessionType = h.psychometric_test_sessions?.session_type || 'unknown'
      if (!sesiones[sessionType]) {
        sesiones[sessionType] = { total: 0, correctas: 0 }
      }
      sesiones[sessionType].total++
      if (h.is_correct) sesiones[sessionType].correctas++
    })

    // Efectividad por tipo de sesión
    const efectividadPorSesion = {}
    Object.keys(sesiones).forEach(tipo => {
      efectividadPorSesion[tipo] = Math.round((sesiones[tipo].correctas / sesiones[tipo].total) * 100)
    })

    // Sesiones únicas
    const sesionesUnicas = [...new Set(history.map(h => h.test_session_id))].length

    // Categorías trabajadas
    const categorias = [...new Set(history.map(h => 
      h.psychometric_test_sessions?.psychometric_categories?.category_key
    ).filter(Boolean))]

    return {
      efectividadPorSesion,
      sesionesUnicas,
      categoriasTrabajajas: categorias,
      rachaMaximaCorrecta: calcularRachaMaxima(history, true),
      rachaMaximaIncorrecta: calcularRachaMaxima(history, false)
    }
  }

  const calcularRachaMaxima = (history, buscarCorrectas) => {
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

  // Función para formatear fecha relativa
  const formatearFechaRelativa = (fecha) => {
    const ahora = new Date()
    const diff = ahora - fecha
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
    
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

  // Función para traducir tipos de sesión
  const traducirTipoSesion = (tipo) => {
    const traducciones = {
      'psychometric': 'Psicotécnico',
      'random': 'Aleatorio',
      'custom': 'Personalizado',
      'quick': 'Rápido'
    }
    return traducciones[tipo] || tipo
  }

  // Loading y error states
  if (loading) return null
  if (error) return null
  if (!evolutionData) return null

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    red: 'bg-red-50 border-red-200 text-red-800'
  }

  return (
    <div className={`border rounded-lg p-4 mt-4 ${colorClasses[evolutionData.color]}`}>
      {/* Mensaje principal de evolución */}
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-2xl">{evolutionData.icono}</span>
        <div>
          <div className="font-bold text-sm">Tu Evolución en esta pregunta psicotécnica:</div>
          <div className="text-sm">{evolutionData.mensaje}</div>
        </div>
      </div>

      {/* Métricas principales para psicotécnicos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-4">
        {/* Estadística general */}
        <div className="flex items-center space-x-1">
          <span>🧠</span>
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

        {/* Análisis de interacción */}
        {evolutionData.analisisInteraccion && (
          <div className="flex items-center space-x-1">
            <span>📊</span>
            <div>
              <div className="font-semibold">
                {evolutionData.analisisInteraccion.metodoCalculoPreferido === 'mental_math' ? 'Cálculo mental' : 'Usa gráfico'}
              </div>
              <div className="opacity-75">
                {evolutionData.analisisInteraccion.usoBotonesRapidos}% botones rápidos
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

      {/* Análisis temporal */}
      {evolutionData.analisisTemporal && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
          <div className="font-semibold mb-2">📅 Historial de estudio psicotécnico:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {evolutionData.totalIntentos === 1 ? (
              <>
                <div className="md:col-span-2">
                  <span className="opacity-75">Primer intento:</span>
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
        </div>
      )}

      {/* Patrones de rendimiento específicos de psicotécnicos */}
      {evolutionData.patronesRendimiento && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
          <div className="font-semibold mb-2">🎯 Análisis de rendimiento psicotécnico:</div>
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
              <span className="opacity-75">Velocidad:</span>
              <div className={`font-medium ${
                evolutionData.patronesRendimiento.velocidadActual === 'muy_rapida' ? 'text-orange-600' :
                evolutionData.patronesRendimiento.velocidadActual === 'rapida' ? 'text-green-600' :
                evolutionData.patronesRendimiento.velocidadActual === 'lenta' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {evolutionData.patronesRendimiento.velocidadActual === 'muy_rapida' ? '⚠️ Muy rápida' :
                 evolutionData.patronesRendimiento.velocidadActual === 'rapida' ? '⚡ Rápida' :
                 evolutionData.patronesRendimiento.velocidadActual === 'lenta' ? '🐌 Lenta' : '📊 Normal'}
              </div>
            </div>
            <div>
              <span className="opacity-75">Tiempo promedio:</span>
              <div className="font-medium">{evolutionData.patronesRendimiento.tiempoPromedio}s</div>
            </div>
          </div>
        </div>
      )}

      {/* Historial visual específico para psicotécnicos */}
      {evolutionData.totalIntentos > 1 && (
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold">Historial de respuestas psicotécnicas:</div>
            <div className="flex space-x-2">
              {evolutionData.totalIntentos > 3 && (
                <button
                  onClick={() => setShowDateHistory(!showDateHistory)}
                  className="text-xs underline opacity-75 hover:opacity-100 transition-opacity"
                >
                  {showDateHistory ? '🔼 Ocultar fechas' : '🔽 Ver fechas'}
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
                  intento.is_correct
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
                title={`Intento ${index + 1}: ${intento.is_correct ? 'Correcto' : 'Incorrecto'} - ${new Date(intento.created_at).toLocaleDateString('es-ES')}`}
              >
                {intento.is_correct ? '✓' : '✗'}
              </div>
            ))}
          </div>

          {/* Estadísticas avanzadas específicas de psicotécnicos */}
          {evolutionData.estadisticasAvanzadas && (
            <div className="mb-3 p-2 bg-gray-200 rounded text-xs">
              <div className="font-semibold mb-2">📊 Estadísticas psicotécnicas detalladas:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="opacity-75">Sesiones únicas:</span>
                  <div className="font-medium">{evolutionData.estadisticasAvanzadas.sesionesUnicas}</div>
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
                  <span className="opacity-75">Categorías:</span>
                  <div className="font-medium">{evolutionData.estadisticasAvanzadas.categoriasTrabajajas.length}</div>
                </div>
              </div>

              {/* Efectividad por tipo de sesión */}
              {Object.keys(evolutionData.estadisticasAvanzadas.efectividadPorSesion).length > 0 && (
                <div className="mt-3 pt-2 border-t border-current border-opacity-20">
                  <div className="font-semibold mb-1">🎯 Efectividad por tipo de sesión:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(evolutionData.estadisticasAvanzadas.efectividadPorSesion).map(([tipo, efectividad]) => (
                      <div key={tipo} className="text-center">
                        <div className="opacity-75 text-xs">{traducirTipoSesion(tipo)}</div>
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
            <div className="mt-3 space-y-1 text-xs bg-gray-200 rounded p-3 max-h-40 overflow-y-auto">
              <div className="font-semibold mb-2 sticky top-0 bg-inherit">📅 Cronología detallada:</div>
              {evolutionData.historialCompleto.map((intento, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-current border-opacity-10 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                      intento.is_correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {intento.is_correct ? '✓' : '✗'}
                    </span>
                    <div>
                      <div className="font-medium">Intento {index + 1}</div>
                      <div className="opacity-75 text-xs">
                        {intento.time_spent_seconds ? `${intento.time_spent_seconds}s` : ''} 
                        {intento.psychometric_test_sessions?.session_type ? 
                          ` • ${traducirTipoSesion(intento.psychometric_test_sessions.session_type)}` : ''}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="opacity-75">
                      {new Date(intento.created_at).toLocaleDateString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Consejos específicos para psicotécnicos */}
      {evolutionData.totalIntentos > 1 && (
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className="text-xs">
            <div className="font-semibold mb-2">💡 Recomendaciones para psicotécnicos:</div>
            <div className="space-y-1">
              {/* Consejo basado en velocidad */}
              {evolutionData.patronesRendimiento?.velocidadActual === 'muy_rapida' && (
                <div className="flex items-start space-x-2">
                  <span>⚠️</span>
                  <span>Vas muy rápido. En psicotécnicos es mejor ser preciso que veloz.</span>
                </div>
              )}
              {evolutionData.patronesRendimiento?.velocidadActual === 'lenta' && (
                <div className="flex items-start space-x-2">
                  <span>⏱️</span>
                  <span>Practica técnicas de cálculo mental para ser más eficiente.</span>
                </div>
              )}
              
              {/* Consejo basado en método de cálculo */}
              {evolutionData.analisisInteraccion?.metodoCalculoPreferido === 'mental_math' && (
                <div className="flex items-start space-x-2">
                  <span>🧠</span>
                  <span>Excelente uso del cálculo mental. Sigue practicando estas técnicas.</span>
                </div>
              )}
              
              {/* Consejo basado en uso de botones rápidos */}
              {evolutionData.analisisInteraccion?.usoBotonesRapidos > 80 && (
                <div className="flex items-start space-x-2">
                  <span>⚡</span>
                  <span>Dominas los botones rápidos. Esto te dará ventaja en el examen real.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}