// components/QuestionEvolution.tsx
//
// Tarjeta "Tu evolución en esta pregunta" que muestra el historial de
// intentos del usuario sobre una pregunta concreta: timeline visual,
// estadísticas, tendencias, recomendaciones.
//
// Migrado de .js a .tsx el 15/4/2026 a la vez que se añadió soporte para
// respuestas "en blanco" (was_blank=true). Los 3 estados visuales ahora son:
//   ✓ verde = correct (is_correct=true)
//   ✗ rojo  = incorrect (is_correct=false, was_blank=false)
//   ⚪ gris  = blank (was_blank=true)
//
// Reglas de negocio acordadas:
//   - Blanco NO rompe racha correcta (no cuenta ni como corte ni como acierto)
//   - Blanco cuenta en total intentos y en % aciertos como "no acertada"
//   - Transiciones especiales en la evolución: blanco↔correcto se mencionan
//     aparte del simple correct/incorrect.

'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

// ============================================================
// TYPES
// ============================================================

export interface QuestionEvolutionProps {
  userId: string
  questionId: string
  currentResult?: CurrentResult | null
}

export interface CurrentResult {
  is_correct?: boolean
  was_blank?: boolean
  time_spent_seconds?: number
  confidence_level?: ConfidenceLevel | null
}

type ConfidenceLevel = 'very_sure' | 'sure' | 'unsure' | 'guessing'

interface HistoryEntry {
  id: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  was_blank: boolean
  confidence_level: ConfidenceLevel | null
  time_spent_seconds: number
  created_at: string
  test_id: string
  question_order: number
  tests?: {
    id: string
    title: string | null
    completed_at: string | null
    created_at: string
    tema_number: number | null
    user_id: string
    total_questions: number | null
    score: string | null
  } | null
  // Añadido por el frontend para distinguir el intento "actual" del test en curso
  current?: boolean
}

interface QuestionStats {
  first_attempt_at: string
  last_attempt_at: string
  total_attempts: number
}

type EvolutionType =
  | 'primera_vez'
  | 'mejora'           // fallo → acierto
  | 'mejora_desde_blanco' // blanco → acierto (mejora grande)
  | 'retroceso'        // acierto → fallo
  | 'retroceso_a_blanco' // acierto → blanco (peor)
  | 'consistente_correcto'
  | 'consistente_incorrecto'
  | 'consistente_blanco'  // sigues sin saberla
  | 'blanco_reciente'     // último fue blanco (no pudo contestarla)

type EvolutionColor = 'blue' | 'green' | 'orange' | 'red' | 'gray'

interface MejoraTiempo {
  mejoro: boolean
  segundos: number
  porcentaje: number
  promedioAnterior: number
  tiempoActual: number
}

interface MejoraConfianza {
  mejoro: boolean
  anterior: ConfidenceLevel
  actual: ConfidenceLevel
  cambio: number
}

interface AnalisisTemporal {
  primerIntento: Date
  ultimoIntento: Date
  diasEstudiando: number
  sesionesUnicas: number
  promedioIntervalo: number
  frecuenciaEstudio: string
  intervalos: number[]
  consistencia: 'muy consistente' | 'consistente' | 'irregular' | 'insuficiente' | null
}

interface PatronesRendimiento {
  rendimientoPorIntento: Array<{
    intento: number
    correcto: boolean
    enBlanco: boolean
    tiempo: number
    confianza: ConfidenceLevel | null
  }>
  tendencia: 'mejorando' | 'empeorando' | 'estable'
  tiempoPromedio: number
  velocidadActual: 'rápida' | 'lenta'
  mejorTiempo: number
  peorTiempo: number
}

interface EstadisticasAvanzadas {
  distribicionConfianza: Record<ConfidenceLevel, number>
  efectividadPorConfianza: Partial<Record<ConfidenceLevel, number>>
  testsUnicos: number
  rachaMaximaCorrecta: number
  rachaMaximaIncorrecta: number
}

interface EvolutionData {
  tipoEvolucion: EvolutionType
  mensaje: string
  icono: string
  color: EvolutionColor
  totalIntentos: number
  aciertosAbsolutos: number
  fallosAbsolutos: number
  blancosAbsolutos: number
  tasaAciertos: number
  mejorasTiempo: MejoraTiempo | null
  mejorasConfianza: MejoraConfianza | null
  analisisTemporal: AnalisisTemporal | null
  patronesRendimiento: PatronesRendimiento | null
  estadisticasAvanzadas: EstadisticasAvanzadas | null
  historialCompleto: HistoryEntry[]
}

// ============================================================
// HELPERS (fuera del componente para testabilidad)
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function clasificarIntento(h: { is_correct: boolean; was_blank?: boolean | null }): 'correct' | 'incorrect' | 'blank' {
  if (h.was_blank === true) return 'blank'
  return h.is_correct ? 'correct' : 'incorrect'
}

/**
 * Racha máxima de aciertos consecutivos.
 *
 * IMPORTANTE: las blancas NO rompen la racha correcta (regla de negocio,
 * sugerencia Tinokero 15/4/2026). Una blanca se "salta" en el cálculo: no
 * cuenta ni como acierto ni como corte.
 *
 * Ejemplo: ✓ ⚪ ✓ ✓ ✗ ✓ ✓  → racha máxima = 3 (ignoras el ⚪ del medio,
 * la racha es ✓✓✓ hasta que llega el ✗).
 */
export function calcularRachaMaximaCorrecta(history: HistoryEntry[]): number {
  let rachaMaxima = 0
  let rachaActual = 0
  for (const h of history) {
    const tipo = clasificarIntento(h)
    if (tipo === 'correct') {
      rachaActual++
      rachaMaxima = Math.max(rachaMaxima, rachaActual)
    } else if (tipo === 'incorrect') {
      rachaActual = 0
    }
    // blank: ignorar (no corta, no suma)
  }
  return rachaMaxima
}

/**
 * Racha máxima de FALLOS REALES consecutivos (excluye blancas).
 * Blanco no cuenta aquí — respondió mal es distinto de no responder.
 */
export function calcularRachaMaximaIncorrecta(history: HistoryEntry[]): number {
  let rachaMaxima = 0
  let rachaActual = 0
  for (const h of history) {
    const tipo = clasificarIntento(h)
    if (tipo === 'incorrect') {
      rachaActual++
      rachaMaxima = Math.max(rachaMaxima, rachaActual)
    } else if (tipo === 'correct') {
      rachaActual = 0
    }
    // blank: ignorar
  }
  return rachaMaxima
}

/**
 * Determina el tipo de evolución comparando los últimos dos intentos.
 * Cubre las 9 transiciones posibles (3 estados x 3): correct/incorrect/blank.
 */
export function determinarTipoEvolucion(
  history: HistoryEntry[]
): { tipo: EvolutionType; mensaje: string; icono: string; color: EvolutionColor } {
  const total = history.length
  if (total === 0) {
    return { tipo: 'primera_vez', mensaje: 'Primera vez que ves esta pregunta', icono: '🆕', color: 'blue' }
  }
  if (total === 1) {
    const unico = history[0]
    const t = clasificarIntento(unico)
    if (t === 'blank') {
      return { tipo: 'blanco_reciente', mensaje: 'La dejaste en blanco la primera vez', icono: '⚪', color: 'gray' }
    }
    return { tipo: 'primera_vez', mensaje: 'Primera vez que ves esta pregunta', icono: '🆕', color: 'blue' }
  }

  const penultimo = clasificarIntento(history[history.length - 2])
  const ultimo = clasificarIntento(history[history.length - 1])

  const aciertos = history.filter(h => clasificarIntento(h) === 'correct').length

  // Transiciones (penultimo → ultimo)
  if (penultimo === 'blank' && ultimo === 'correct') {
    return { tipo: 'mejora_desde_blanco', mensaje: 'Antes no la sabías, ahora la has acertado. ¡Bien!', icono: '🎉', color: 'green' }
  }
  if (penultimo === 'incorrect' && ultimo === 'correct') {
    return { tipo: 'mejora', mensaje: '¡Progreso! Antes fallaste, ahora acertaste', icono: '🎉', color: 'green' }
  }
  if (penultimo === 'correct' && ultimo === 'blank') {
    return { tipo: 'retroceso_a_blanco', mensaje: 'Antes la sabías, ahora la dejaste en blanco. Repásala', icono: '⚠️', color: 'orange' }
  }
  if (penultimo === 'correct' && ultimo === 'incorrect') {
    return { tipo: 'retroceso', mensaje: 'Antes acertaste, ahora fallaste', icono: '⚠️', color: 'orange' }
  }
  if (ultimo === 'correct') {
    return { tipo: 'consistente_correcto', mensaje: `Siempre aciertas esta pregunta (${aciertos}/${total})`, icono: '✅', color: 'green' }
  }
  if (ultimo === 'blank') {
    return { tipo: 'consistente_blanco', mensaje: `Sigues sin saberla (${aciertos}/${total} aciertos)`, icono: '⚪', color: 'gray' }
  }
  // ultimo === 'incorrect'
  return { tipo: 'consistente_incorrecto', mensaje: `Sigues fallando esta pregunta (${aciertos}/${total})`, icono: '❌', color: 'red' }
}

function calcularConsistenciaEstudio(intervalos: number[]): AnalisisTemporal['consistencia'] {
  if (intervalos.length < 2) return 'insuficiente'
  const promedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length
  const varianza = intervalos.reduce((acc, val) => acc + Math.pow(val - promedio, 2), 0) / intervalos.length
  const desviacion = Math.sqrt(varianza)
  if (desviacion <= promedio * 0.3) return 'muy consistente'
  if (desviacion <= promedio * 0.6) return 'consistente'
  return 'irregular'
}

function traducirConfianza(nivel: string | null | undefined): string {
  const traducciones: Record<string, string> = {
    very_sure: 'muy seguro',
    sure: 'seguro',
    unsure: 'inseguro',
    guessing: 'adivinando',
  }
  return (nivel && traducciones[nivel]) || nivel || 'N/A'
}

function formatearFechaRelativa(fecha: Date): string {
  const ahora = new Date()
  const diff = ahora.getTime() - fecha.getTime()
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (dias === 0) return `Hoy a las ${hora}`
  if (dias === 1) return `Ayer a las ${hora}`
  if (dias < 7) return `Hace ${dias} días a las ${hora}`
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} semanas`
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`
  return `Hace ${Math.floor(dias / 365)} años`
}

// ============================================================
// Cálculos auxiliares por subseccion
// ============================================================

function calcularAnalisisTemporal(history: HistoryEntry[], questionStats: QuestionStats | null): AnalisisTemporal | null {
  if (history.length === 0) return null
  const primerIntento = questionStats?.first_attempt_at
    ? new Date(questionStats.first_attempt_at)
    : new Date(history[0].created_at)
  const ultimoIntento = questionStats?.last_attempt_at
    ? new Date(questionStats.last_attempt_at)
    : new Date(history[history.length - 1].created_at)

  const diasUnicos = [...new Set(history.map(h => h.created_at.split('T')[0]))]
  const fechas = history.map(h => new Date(h.created_at))
  const intervalos: number[] = []
  for (let i = 1; i < fechas.length; i++) {
    const dias = Math.ceil((fechas[i].getTime() - fechas[i - 1].getTime()) / (1000 * 60 * 60 * 24))
    intervalos.push(dias)
  }
  const promedioIntervalo = intervalos.length > 0
    ? Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length)
    : 0
  const diasEstudiando = Math.ceil((ultimoIntento.getTime() - primerIntento.getTime()) / (1000 * 60 * 60 * 24))

  let frecuenciaEstudio: string
  if (history.length === 1) frecuenciaEstudio = 'Primera vez'
  else if (history.length === 2) frecuenciaEstudio = `2 intentos en ${diasUnicos.length} días`
  else frecuenciaEstudio = `${history.length} intentos en ${diasUnicos.length} días`

  return {
    primerIntento,
    ultimoIntento,
    diasEstudiando: Math.max(diasEstudiando, 0),
    sesionesUnicas: diasUnicos.length,
    promedioIntervalo,
    frecuenciaEstudio,
    intervalos,
    consistencia: intervalos.length > 0 ? calcularConsistenciaEstudio(intervalos) : null,
  }
}

function calcularMejoraTiempo(history: HistoryEntry[]): MejoraTiempo | null {
  if (history.length < 2) return null
  const ultimo = history[history.length - 1]
  const previos = history.slice(0, -1)
  const tiemposPrevios = previos.map(h => h.time_spent_seconds).filter(t => t > 0)
  if (tiemposPrevios.length === 0) return null
  const promedio = tiemposPrevios.reduce((a, b) => a + b, 0) / tiemposPrevios.length
  const actual = ultimo.time_spent_seconds || 0
  const diferencia = promedio - actual
  if (Math.abs(diferencia) < 3) return null
  return {
    mejoro: diferencia > 0,
    segundos: Math.abs(Math.round(diferencia)),
    porcentaje: Math.round((diferencia / promedio) * 100),
    promedioAnterior: Math.round(promedio),
    tiempoActual: actual,
  }
}

function calcularMejoraConfianza(history: HistoryEntry[]): MejoraConfianza | null {
  if (history.length < 2) return null
  const ultimo = history[history.length - 1]
  const penultimo = history[history.length - 2]
  const confAnterior = penultimo?.confidence_level
  const confActual = ultimo?.confidence_level
  if (!confAnterior || !confActual) return null
  const niveles: Record<ConfidenceLevel, number> = { guessing: 1, unsure: 2, sure: 3, very_sure: 4 }
  const nivelA = niveles[confAnterior] || 0
  const nivelB = niveles[confActual] || 0
  if (nivelA === nivelB) return null
  return { mejoro: nivelB > nivelA, anterior: confAnterior, actual: confActual, cambio: nivelB - nivelA }
}

function calcularPatronesRendimiento(history: HistoryEntry[]): PatronesRendimiento | null {
  if (history.length === 0) return null
  const rendimientoPorIntento = history.map((h, index) => ({
    intento: index + 1,
    correcto: h.is_correct,
    enBlanco: h.was_blank === true,
    tiempo: h.time_spent_seconds,
    confianza: h.confidence_level,
  }))

  let tendencia: PatronesRendimiento['tendencia'] = 'estable'
  if (history.length >= 3) {
    const recientes = history.slice(-3).filter(h => h.is_correct).length
    const tempranos = history.slice(0, 3).filter(h => h.is_correct).length
    if (recientes > tempranos) tendencia = 'mejorando'
    if (recientes < tempranos) tendencia = 'empeorando'
  }

  const tiempos = history.map(h => h.time_spent_seconds).filter(t => t > 0)
  const tiempoPromedio = tiempos.length > 0 ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0
  const ultimoTiempo = history[history.length - 1]?.time_spent_seconds || 0
  const velocidadActual: 'rápida' | 'lenta' = ultimoTiempo < tiempoPromedio ? 'rápida' : 'lenta'

  return {
    rendimientoPorIntento,
    tendencia,
    tiempoPromedio: Math.round(tiempoPromedio),
    velocidadActual,
    mejorTiempo: tiempos.length > 0 ? Math.min(...tiempos) : ultimoTiempo,
    peorTiempo: tiempos.length > 0 ? Math.max(...tiempos) : ultimoTiempo,
  }
}

function calcularEstadisticasAvanzadas(history: HistoryEntry[]): EstadisticasAvanzadas {
  const distribicionConfianza: Record<ConfidenceLevel, number> = {
    very_sure: 0, sure: 0, unsure: 0, guessing: 0,
  }
  for (const h of history) {
    if (h.confidence_level && h.confidence_level in distribicionConfianza) {
      distribicionConfianza[h.confidence_level]++
    }
  }
  const efectividadPorConfianza: Partial<Record<ConfidenceLevel, number>> = {}
  for (const nivel of Object.keys(distribicionConfianza) as ConfidenceLevel[]) {
    const respuestasNivel = history.filter(h => h.confidence_level === nivel)
    if (respuestasNivel.length > 0) {
      const correctas = respuestasNivel.filter(h => h.is_correct).length
      efectividadPorConfianza[nivel] = Math.round((correctas / respuestasNivel.length) * 100)
    }
  }
  const testsUnicos = new Set(history.map(h => h.test_id)).size
  return {
    distribicionConfianza,
    efectividadPorConfianza,
    testsUnicos,
    rachaMaximaCorrecta: calcularRachaMaximaCorrecta(history),
    rachaMaximaIncorrecta: calcularRachaMaximaIncorrecta(history),
  }
}

export function calcularEvolucionCompleta(history: HistoryEntry[], questionStats: QuestionStats | null = null): EvolutionData {
  const total = history.length
  const aciertos = history.filter(h => clasificarIntento(h) === 'correct').length
  const blancos = history.filter(h => clasificarIntento(h) === 'blank').length
  const fallos = total - aciertos - blancos
  const tasaAciertos = total > 0 ? Math.round((aciertos / total) * 100) : 0

  const evo = determinarTipoEvolucion(history)

  return {
    tipoEvolucion: evo.tipo,
    mensaje: evo.mensaje,
    icono: evo.icono,
    color: evo.color,
    totalIntentos: total,
    aciertosAbsolutos: aciertos,
    fallosAbsolutos: fallos,
    blancosAbsolutos: blancos,
    tasaAciertos,
    mejorasTiempo: calcularMejoraTiempo(history),
    mejorasConfianza: calcularMejoraConfianza(history),
    analisisTemporal: calcularAnalisisTemporal(history, questionStats),
    patronesRendimiento: calcularPatronesRendimiento(history),
    estadisticasAvanzadas: calcularEstadisticasAvanzadas(history),
    historialCompleto: history,
  }
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function QuestionEvolution({ userId, questionId, currentResult }: QuestionEvolutionProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evolutionData, setEvolutionData] = useState<EvolutionData | null>(null)
  const [showDateHistory, setShowDateHistory] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  useEffect(() => {
    if (!userId || !questionId) {
      setLoading(false)
      return
    }

    const fetchQuestionHistory = async () => {
      try {
        setLoading(true)
        if (!UUID_REGEX.test(questionId)) {
          console.warn('⚠️ QuestionEvolution: questionId no es UUID válido:', questionId)
          setHistory([])
          setEvolutionData(calcularEvolucionCompleta([]))
          setLoading(false)
          return
        }

        const { data: previousHistory, error: histError } = await supabase
          .from('test_questions')
          .select(`
            id,
            user_answer,
            correct_answer,
            is_correct,
            was_blank,
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
          .eq('tests.user_id', userId)
          .order('created_at', { ascending: true })

        const { data: questionStats } = await supabase
          .from('user_question_history')
          .select('first_attempt_at, last_attempt_at, total_attempts')
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .single()

        if (histError) {
          console.error('Error fetching question history:', histError)
          setHistory([])
          setEvolutionData(calcularEvolucionCompleta([]))
          setError(histError.message)
          setLoading(false)
          return
        }

        const historialCompleto = (previousHistory ?? []) as unknown as HistoryEntry[]
        setHistory(historialCompleto)

        const evo = calcularEvolucionCompleta(
          historialCompleto,
          (questionStats ?? null) as QuestionStats | null
        )
        setEvolutionData(evo)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        console.error('Error en fetchQuestionHistory:', err)
        setHistory([])
        setEvolutionData(calcularEvolucionCompleta([]))
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchQuestionHistory()
  }, [userId, questionId, currentResult])

  if (loading && !evolutionData) return null
  if (error && !evolutionData) return null
  if (!evolutionData) return null

  const colorClasses: Record<EvolutionColor, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
    green: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
    orange: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
    red: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
    gray: 'bg-gray-50 border-gray-300 text-gray-800 dark:bg-gray-800/50 dark:border-gray-600 dark:text-gray-200',
  }

  // Helper para pintar círculo por intento (3 estados)
  const renderCircle = (intento: HistoryEntry, index: number, size: 'sm' | 'md' = 'md') => {
    const tipo = clasificarIntento(intento)
    const dim = size === 'sm' ? 'w-4 h-4 text-xs' : 'w-6 h-6 text-xs'
    const ring = intento.current ? 'ring-2 ring-offset-1' : ''
    const colorMap = {
      correct: `bg-green-500 text-white ${intento.current ? 'ring-green-300 dark:ring-green-600' : ''}`,
      incorrect: `bg-red-500 text-white ${intento.current ? 'ring-red-300 dark:ring-red-600' : ''}`,
      blank: `bg-gray-400 text-white ${intento.current ? 'ring-gray-300 dark:ring-gray-500' : ''}`,
    }[tipo]
    const iconMap = { correct: '✓', incorrect: '✗', blank: '⚪' }
    const labelMap = { correct: 'Correcto', incorrect: 'Incorrecto', blank: 'En blanco' }
    const fecha = new Date(intento.created_at).toLocaleDateString('es-ES')
    return (
      <div
        key={index}
        className={`rounded-full flex items-center justify-center font-bold ${dim} ${colorMap} ${ring}`}
        title={`Intento ${index + 1}: ${labelMap[tipo]} — ${fecha}`}
      >
        {iconMap[tipo]}
      </div>
    )
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

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-4">
        <div className="flex items-center space-x-1">
          <span>📊</span>
          <div>
            <div className="font-semibold">Aciertos: {evolutionData.tasaAciertos}%</div>
            <div className="opacity-75">
              ({evolutionData.totalIntentos} {evolutionData.totalIntentos === 1 ? 'intento' : 'intentos'})
            </div>
            {/* Desglose correctas/falladas/en blanco — solo si hay blancas */}
            {evolutionData.blancosAbsolutos > 0 && (
              <div className="opacity-75 text-xs mt-0.5">
                {evolutionData.aciertosAbsolutos} ✓ / {evolutionData.fallosAbsolutos} ✗ / {evolutionData.blancosAbsolutos} ⚪
              </div>
            )}
          </div>
        </div>

        {evolutionData.mejorasTiempo && (
          <div className="flex items-center space-x-1">
            <span>{evolutionData.mejorasTiempo.mejoro ? '⚡' : '🐌'}</span>
            <div>
              <div className="font-semibold">{evolutionData.mejorasTiempo.mejoro ? 'Más rápido' : 'Más lento'}</div>
              <div className="opacity-75">
                {evolutionData.mejorasTiempo.segundos}s {evolutionData.mejorasTiempo.mejoro ? 'menos' : 'más'}
              </div>
            </div>
          </div>
        )}

        {evolutionData.mejorasConfianza && (
          <div className="flex items-center space-x-1">
            <span>{evolutionData.mejorasConfianza.mejoro ? '🎯' : '🤔'}</span>
            <div>
              <div className="font-semibold">{evolutionData.mejorasConfianza.mejoro ? 'Más seguro' : 'Menos seguro'}</div>
              <div className="opacity-75">
                {traducirConfianza(evolutionData.mejorasConfianza.anterior)} → {traducirConfianza(evolutionData.mejorasConfianza.actual)}
              </div>
            </div>
          </div>
        )}

        {evolutionData.estadisticasAvanzadas && (
          <div className="flex items-center space-x-1">
            <span>🔥</span>
            <div>
              <div className="font-semibold">Racha máxima: {evolutionData.estadisticasAvanzadas.rachaMaximaCorrecta}</div>
              <div className="opacity-75">aciertos seguidos</div>
            </div>
          </div>
        )}
      </div>

      {/* Análisis temporal */}
      {evolutionData.analisisTemporal && (
        <div className="mb-4 p-3 bg-black/5 dark:bg-black/20 rounded text-xs">
          <div className="font-semibold mb-2">📅 Historial de estudio:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {evolutionData.totalIntentos === 1 ? (
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

          {/* Línea de tiempo visual (3 estados) */}
          <div className="flex items-center space-x-1 mb-3 flex-wrap">
            {evolutionData.historialCompleto.map((intento, index) => renderCircle(intento, index, 'md'))}
          </div>

          {/* Estadísticas avanzadas */}
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
                  <span className="opacity-75">Racha fallos:</span>
                  <div className="font-medium text-red-600">{evolutionData.estadisticasAvanzadas.rachaMaximaIncorrecta}</div>
                </div>
                <div>
                  <span className="opacity-75">Nivel confianza:</span>
                  <div className="font-medium">
                    {(() => {
                      const entries = Object.entries(evolutionData.estadisticasAvanzadas.distribicionConfianza) as Array<[ConfidenceLevel, number]>
                      const sorted = entries.sort((a, b) => b[1] - a[1])
                      return sorted[0] && sorted[0][1] > 0 ? traducirConfianza(sorted[0][0]) : 'N/A'
                    })()}
                  </div>
                </div>
              </div>
              {Object.keys(evolutionData.estadisticasAvanzadas.efectividadPorConfianza).length > 0 && (
                <div className="mt-3 pt-2 border-t border-current border-opacity-20">
                  <div className="font-semibold mb-1">🎯 Efectividad por nivel de confianza:</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(evolutionData.estadisticasAvanzadas.efectividadPorConfianza).map(([nivel, ef]) => (
                      <div key={nivel} className="text-center">
                        <div className="opacity-75 text-xs">{traducirConfianza(nivel)}</div>
                        <div className={`font-bold ${
                          (ef ?? 0) >= 80 ? 'text-green-600' :
                          (ef ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {ef ?? 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fechas detalladas */}
          {showDateHistory && evolutionData.historialCompleto.length > 1 && (
            <div className="mt-3 space-y-1 text-xs bg-black/10 dark:bg-black/30 rounded p-3 max-h-40 overflow-y-auto">
              <div className="font-semibold mb-2 sticky top-0 bg-inherit">📅 Cronología detallada:</div>
              {evolutionData.historialCompleto.map((intento, index) => {
                const tipo = clasificarIntento(intento)
                const label = tipo === 'correct' ? 'Correcto' : tipo === 'blank' ? 'En blanco' : 'Incorrecto'
                return (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-current border-opacity-10 last:border-b-0">
                    <div className="flex items-center space-x-3">
                      {renderCircle(intento, index, 'sm')}
                      <div>
                        <div className="font-medium">
                          {intento.current ? 'Ahora' : `Intento ${index + 1}`} — {label}
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
                              day: '2-digit', month: '2-digit', year: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                            })}
                      </div>
                      {intento.tests?.title && !intento.current && (
                        <div className="opacity-50 text-xs truncate max-w-24">{intento.tests.title}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Debug info */}
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
                      <div><strong>Tests únicos:</strong> {new Set(history.map(h => h.test_id)).size}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-current border-opacity-20">
                    <div className="font-semibold mb-1">Raw Data:</div>
                    <div className="bg-black/20 p-2 rounded font-mono text-xs max-h-32 overflow-auto">
                      {JSON.stringify({
                        totalIntentos: evolutionData.totalIntentos,
                        aciertos: evolutionData.aciertosAbsolutos,
                        fallos: evolutionData.fallosAbsolutos,
                        blancos: evolutionData.blancosAbsolutos,
                        tasaAciertos: evolutionData.tasaAciertos,
                        tipoEvolucion: evolutionData.tipoEvolucion,
                      }, null, 2)}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Recomendaciones */}
      {evolutionData.totalIntentos > 2 && (
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className="text-xs">
            <div className="font-semibold mb-2">💡 Recomendaciones personalizadas:</div>
            <div className="space-y-1">
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
              {evolutionData.blancosAbsolutos >= 2 && (
                <div className="flex items-start space-x-2">
                  <span>⚪</span>
                  <span>La has dejado en blanco {evolutionData.blancosAbsolutos} veces. Si dudas, intenta razonarla — un fallo te enseña más que una blanca.</span>
                </div>
              )}
              {evolutionData.mejorasTiempo?.mejoro && (
                <div className="flex items-start space-x-2">
                  <span>⚡</span>
                  <span>Has mejorado tu velocidad. Mantén este ritmo para ser más eficiente.</span>
                </div>
              )}
              {(evolutionData.estadisticasAvanzadas?.efectividadPorConfianza?.guessing ?? 0) > 60 && (
                <div className="flex items-start space-x-2">
                  <span>🤔</span>
                  <span>Curiosamente, aciertas bien &quot;adivinando&quot;. Confía más en tu intuición.</span>
                </div>
              )}
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
