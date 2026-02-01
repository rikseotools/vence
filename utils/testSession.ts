// utils/testSession.ts - Gestión de sesiones de test (TypeScript + Zod)
// ========================================
// Migrado de JS a TS para mayor robustez y type safety
// ========================================

import { z } from 'zod'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

// ============================================
// TIPOS E INTERFACES
// ============================================

/** Información del dispositivo del usuario */
export interface DeviceInfo {
  user_agent: string
  screen_resolution: string
  viewport_size: string
  device_model: 'mobile' | 'tablet' | 'desktop'
  browser_language: string
  timezone: string
  color_depth: number
  pixel_ratio: number
  connection_type: string
  platform: string
  online_status: boolean
}

/** Sesión de usuario (user_sessions table) */
export interface UserSession {
  id: string
  user_id: string
  session_start: string
  session_end: string | null
  user_agent: string
  screen_resolution: string
  viewport_size: string
  device_model: string
  browser_language: string
  timezone: string
  color_depth: number
  pixel_ratio: number
  connection_type: string
  entry_page: string
  referrer_url: string
  engagement_score: number
  interaction_rate: number
  content_consumption_rate: number
  bounce_indicator: boolean
  updated_at?: string
}

/** Sesión de test (tests table) */
export interface TestSession {
  id: string
  user_id: string
  title: string
  test_type: TestType
  test_url: string | null
  total_questions: number
  score: number
  tema_number: number
  test_number: number | null
  time_limit_minutes: number | null
  started_at: string
  completed_at: string | null
  is_completed: boolean
  questions_metadata: string
  user_session_data: string
  performance_metrics: string
  // Index signature para compatibilidad con código existente
  [key: string]: unknown
}

/** Tipos de test válidos */
export type TestType = 'practice' | 'exam'

/** Estructura de una pregunta (lo que espera createDetailedTestSession)
 * Soporta estructura plana (ExamLayout) y anidada (legacy)
 */
export interface QuestionInput {
  // Campo id puede estar en raíz
  id?: string
  // Campos de estructura plana (ExamLayout)
  question_text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  difficulty?: string
  // Campos adicionales comunes
  tema_number?: number
  primary_article_id?: string
  explanation?: string
  correct_option?: number
  articles?: unknown
  // Estructura anidada (legacy)
  metadata?: {
    id?: string
    difficulty?: string
  }
  article?: {
    id?: string
    number?: string
    law_short_name?: string
  }
}

/** Configuración del test */
export interface TestConfig {
  timeLimit?: number
  [key: string]: unknown
}

// ============================================
// SCHEMAS ZOD PARA VALIDACIÓN
// ============================================

const testTypeSchema = z.enum(['practice', 'exam'])

// Schema flexible para preguntas - acepta estructura plana (ExamLayout) o anidada (legacy)
const questionSchema = z.object({
  // Campo id puede estar en raíz o en metadata
  id: z.string().optional(),
  // Campos de estructura plana (ExamLayout)
  question_text: z.string().optional(),
  option_a: z.string().optional(),
  option_b: z.string().optional(),
  option_c: z.string().optional(),
  option_d: z.string().optional(),
  difficulty: z.string().optional(),
  // Estructura anidada (legacy)
  metadata: z.object({
    id: z.string().optional(),
    difficulty: z.string().optional(),
  }).optional(),
  article: z.object({
    id: z.string().optional(),
    number: z.string().optional(),
    law_short_name: z.string().optional(),
  }).optional(),
}).passthrough() // Permitir campos adicionales

const createTestSessionSchema = z.object({
  userId: z.string().uuid('userId debe ser un UUID válido'),
  tema: z.number().int('tema debe ser un entero').min(0, 'tema no puede ser negativo'),
  testNumber: z.union([z.number(), z.string()]).transform(val =>
    typeof val === 'string' ? parseInt(val, 10) || 1 : val
  ),
  questions: z.array(questionSchema).min(1, 'Debe haber al menos una pregunta'),
  config: z.object({
    timeLimit: z.number().optional(),
  }).passthrough().optional().default({}),
  startTime: z.number(),
  pageLoadTime: z.number(),
  userSession: z.any().optional().nullable(),
  testType: testTypeSchema.default('practice'),
})

export type CreateTestSessionParams = z.infer<typeof createTestSessionSchema>

// ============================================
// CACHE DE SESIONES (con límite para evitar memory leaks)
// ============================================

class LimitedSessionCache<T> {
  private cache: Map<string, T>
  private maxSize: number

  constructor(maxSize: number = 20) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  get(key: string): T | undefined {
    return this.cache.get(key)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

const sessionCache = new LimitedSessionCache<UserSession | TestSession>(20)

// ============================================
// FUNCIONES PÚBLICAS
// ============================================

/**
 * Detecta información del dispositivo del usuario
 * @returns DeviceInfo o objeto vacío si no hay window
 */
export function getDeviceInfo(): Partial<DeviceInfo> {
  if (typeof window === 'undefined') return {}

  const userAgent = navigator.userAgent
  const screen = window.screen
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string }
    mozConnection?: { effectiveType?: string }
    webkitConnection?: { effectiveType?: string }
  }).connection ||
  (navigator as Navigator & { mozConnection?: { effectiveType?: string } }).mozConnection ||
  (navigator as Navigator & { webkitConnection?: { effectiveType?: string } }).webkitConnection

  const deviceModel: DeviceInfo['device_model'] =
    /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' :
    /Tablet|iPad/.test(userAgent) ? 'tablet' : 'desktop'

  return {
    user_agent: userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    device_model: deviceModel,
    browser_language: 'es',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    color_depth: screen.colorDepth,
    pixel_ratio: window.devicePixelRatio,
    connection_type: connection?.effectiveType || 'unknown',
    platform: navigator.platform,
    online_status: navigator.onLine,
  }
}

/**
 * Obtiene o crea una sesión de usuario
 * @param userId - ID del usuario (UUID)
 * @returns UserSession o null si falla
 */
export async function getOrCreateUserSession(userId: string): Promise<UserSession | null> {
  try {
    console.log('🔍 Verificando sesión existente para usuario:', userId)

    if (!userId) {
      console.error('❌ userId es requerido')
      return null
    }

    // Verificar cache primero
    const cacheKey = `user_session_${userId}`
    const cached = sessionCache.get(cacheKey)
    if (cached && 'session_start' in cached) {
      console.log('✅ Usando sesión de cache:', cached.id)
      return cached as UserSession
    }

    // Buscar sesión activa en la base de datos (últimas 24 horas)
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)

    const { data: existingSessions, error: searchError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('session_start', yesterday.toISOString())
      .is('session_end', null)
      .order('session_start', { ascending: false })
      .limit(1)

    if (searchError) {
      console.error('❌ Error buscando sesiones:', searchError)
    }

    // Si existe sesión activa, actualizarla y usarla
    if (existingSessions && existingSessions.length > 0) {
      const existingSession = existingSessions[0] as UserSession
      console.log('✅ Reutilizando sesión existente:', existingSession.id)

      await supabase
        .from('user_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingSession.id)

      sessionCache.set(cacheKey, existingSession)
      return existingSession
    }

    // Crear nueva sesión
    console.log('🆕 Creando nueva sesión de usuario...')

    const deviceInfo = getDeviceInfo()
    const insertData = {
      user_id: userId,
      session_start: new Date().toISOString(),
      user_agent: deviceInfo.user_agent || 'unknown',
      screen_resolution: deviceInfo.screen_resolution || 'unknown',
      viewport_size: deviceInfo.viewport_size || 'unknown',
      device_model: deviceInfo.device_model || 'unknown',
      browser_language: deviceInfo.browser_language || 'es',
      timezone: deviceInfo.timezone || 'Europe/Madrid',
      color_depth: deviceInfo.color_depth || 24,
      pixel_ratio: deviceInfo.pixel_ratio || 1,
      connection_type: deviceInfo.connection_type || 'unknown',
      entry_page: typeof window !== 'undefined' ? window.location.href : 'unknown',
      referrer_url: typeof document !== 'undefined' ? document.referrer || 'direct' : 'direct',
      engagement_score: 0,
      interaction_rate: 0,
      content_consumption_rate: 0,
      bounce_indicator: false,
    }

    const { data, error } = await supabase
      .from('user_sessions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Error creando sesión:', error)
      return null
    }

    console.log('✅ Nueva sesión creada:', data.id)
    sessionCache.set(cacheKey, data as UserSession)
    return data as UserSession

  } catch (error) {
    console.error('❌ Error en getOrCreateUserSession:', error)
    return null
  }
}

/**
 * Crea una sesión de test detallada
 * @param params - Parámetros tipados y validados
 * @returns TestSession o null si falla
 */
export async function createDetailedTestSession(
  params: CreateTestSessionParams
): Promise<TestSession | null>

/**
 * @deprecated Usar la versión con objeto de parámetros
 * Mantiene compatibilidad con código existente
 */
export async function createDetailedTestSession(
  userId: string,
  tema: number | string,
  testNumber: number | string,
  questions: QuestionInput[],
  config?: TestConfig,
  startTime?: number,
  pageLoadTime?: number,
  userSession?: unknown,
  testType?: TestType
): Promise<TestSession | null>

// Implementación que soporta ambas firmas
export async function createDetailedTestSession(
  paramsOrUserId: CreateTestSessionParams | string,
  tema?: number | string,
  testNumber?: number | string,
  questions?: QuestionInput[],
  config?: TestConfig,
  startTime?: number,
  pageLoadTime?: number,
  _userSession?: unknown,
  testType: TestType = 'practice'
): Promise<TestSession | null> {
  try {
    // Normalizar parámetros (soportar ambas formas de llamada)
    let params: CreateTestSessionParams

    if (typeof paramsOrUserId === 'string' && paramsOrUserId) {
      // Llamada legacy con parámetros separados (userId es string válido)
      const parsedTema = typeof tema === 'string' ? parseInt(tema, 10) || 0 : (tema ?? 0)
      const parsedTestNumber = typeof testNumber === 'string' ? parseInt(testNumber, 10) || 1 : (testNumber ?? 1)
      // Type assertion necesaria porque QuestionInput no tiene index signature
      // pero el schema Zod usa .passthrough() para aceptar campos adicionales en runtime
      params = {
        userId: paramsOrUserId,
        tema: parsedTema,
        testNumber: parsedTestNumber,
        questions: (questions ?? []) as CreateTestSessionParams['questions'],
        config: config ?? {},
        startTime: startTime ?? Date.now(),
        pageLoadTime: pageLoadTime ?? Date.now(),
        testType: testType,
      }
    } else if (paramsOrUserId && typeof paramsOrUserId === 'object') {
      // Llamada nueva con objeto
      params = paramsOrUserId
    } else {
      // userId es null/undefined - retornar temprano
      console.error('❌ createDetailedTestSession: userId es requerido')
      return null
    }

    // Validar con Zod
    const validation = createTestSessionSchema.safeParse(params)
    if (!validation.success) {
      console.error('❌ Validación fallida:', validation.error.flatten())
      console.error('   Params recibidos:', JSON.stringify(params, null, 2).substring(0, 500))
      return null
    }

    const validatedParams = validation.data
    console.log(`🆕 Creando sesión de test (tipo: ${validatedParams.testType})...`)

    if (validatedParams.questions.length === 0) {
      console.error('❌ No se puede crear sesión: No hay preguntas disponibles')
      return null
    }

    const cacheKey = `test_session_${validatedParams.userId}_${validatedParams.tema}_${validatedParams.testNumber}_${validatedParams.testType}_${Date.now()}`

    // MODO EXAMEN: Siempre crear nuevo test (no reutilizar)
    if (validatedParams.testType === 'exam') {
      console.log('🆕 Modo examen detectado - creando test nuevo (no se reutiliza)')
    } else {
      // Solo para tests de práctica: verificar cache y tests activos
      const practiceCacheKey = `test_session_${validatedParams.userId}_${validatedParams.tema}_${validatedParams.testNumber}_${validatedParams.testType}`
      const cached = sessionCache.get(practiceCacheKey)
      if (cached && 'test_type' in cached) {
        console.log('✅ Reutilizando sesión de test de cache:', cached.id)
        return cached as TestSession
      }

      // Buscar test activo reciente (últimos 30 minutos)
      const thirtyMinutesAgo = new Date()
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)

      const { data: activeTests } = await supabase
        .from('tests')
        .select('*')
        .eq('user_id', validatedParams.userId)
        .eq('tema_number', validatedParams.tema)
        .eq('test_number', validatedParams.testNumber)
        .eq('test_type', validatedParams.testType)
        .eq('is_completed', false)
        .gte('started_at', thirtyMinutesAgo.toISOString())
        .order('started_at', { ascending: false })
        .limit(1)

      if (activeTests && activeTests.length > 0) {
        const activeTest = activeTests[0] as TestSession
        console.log('✅ Reutilizando test activo de práctica:', activeTest.id)
        sessionCache.set(practiceCacheKey, activeTest)
        return activeTest
      }
    }

    // Crear título seguro
    const safeTitle = `Test Tema ${validatedParams.tema} - ${validatedParams.testNumber}`.substring(0, 100)

    // Preparar metadata de preguntas (soporta estructura plana y anidada)
    const questionsMetadata = {
      question_ids: validatedParams.questions.map(q => q.id || q.metadata?.id || `temp_${Date.now()}_${Math.random()}`),
      article_ids: validatedParams.questions.map(q => q.article?.id || null),
      article_numbers: validatedParams.questions.map(q => q.article?.number || 'unknown'),
      difficulties: validatedParams.questions.map(q => q.difficulty || q.metadata?.difficulty || 'medium'),
      laws: validatedParams.questions.map(q => q.article?.law_short_name || 'unknown'),
      total_questions: validatedParams.questions.length,
      estimated_duration: validatedParams.questions.length * 60,
    }

    const insertData = {
      user_id: validatedParams.userId,
      title: safeTitle,
      test_type: validatedParams.testType,
      test_url: typeof window !== 'undefined' ? window.location.pathname : null,
      total_questions: validatedParams.questions.length,
      score: 0,
      tema_number: validatedParams.tema,
      test_number: validatedParams.testNumber,
      time_limit_minutes: validatedParams.config?.timeLimit || null,
      started_at: new Date().toISOString(),
      completed_at: null,
      is_completed: false,
      questions_metadata: JSON.stringify(questionsMetadata),
      user_session_data: JSON.stringify(getDeviceInfo()),
      performance_metrics: JSON.stringify({
        start_time: validatedParams.startTime,
        expected_duration_minutes: validatedParams.questions.length * 2,
        load_time: Date.now() - validatedParams.pageLoadTime,
      }),
    }

    console.log('📤 Intentando INSERT en tabla tests...')
    console.log('   Datos a insertar:', {
      user_id: insertData.user_id,
      title: insertData.title,
      test_type: insertData.test_type,
      total_questions: insertData.total_questions,
      tema_number: insertData.tema_number,
      test_number: insertData.test_number,
    })

    const { data, error } = await supabase
      .from('tests')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ ERROR CRÍTICO creando sesión de test:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return null
    }

    if (!data?.id) {
      console.error('❌ ERROR: INSERT no devolvió data válida')
      return null
    }

    console.log('✅ Sesión de test creada exitosamente:', {
      id: data.id,
      title: data.title,
      type: data.test_type,
      total_questions: data.total_questions,
    })

    sessionCache.set(cacheKey, data as TestSession)
    return data as TestSession

  } catch (error) {
    console.error('❌ Error en createDetailedTestSession:', error)
    return null
  }
}

/**
 * Cierra/elimina una sesión de test del cache
 */
export function closeTestSession(userId: string, tema: number, testNumber: number | string): void {
  const cacheKey = `test_session_${userId}_${tema}_${testNumber}`
  sessionCache.delete(cacheKey)
  console.log('🗑️ Sesión de test removida del cache')
}

/**
 * Cierra una sesión de usuario
 */
export async function closeUserSession(sessionId: string): Promise<void> {
  try {
    if (sessionId) {
      await supabase
        .from('user_sessions')
        .update({
          session_end: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      console.log('✅ Sesión de usuario cerrada:', sessionId)
    }

    sessionCache.clear()
  } catch (error) {
    console.error('❌ Error cerrando sesión:', error)
  }
}

/**
 * Actualiza la puntuación de un test
 */
export async function updateTestScore(sessionId: string, currentScore: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tests')
      .update({ score: currentScore })
      .eq('id', sessionId)

    if (error) throw error

    console.log('✅ Puntuación actualizada:', currentScore)
    return true
  } catch (error) {
    console.error('❌ Error actualizando puntuación:', error)
    return false
  }
}

/**
 * Limpia el cache de sesiones
 */
export function clearSessionCache(): void {
  sessionCache.clear()
  console.log('🧹 Cache de sesiones limpiado')
}

/**
 * Obtiene información del cache
 */
export function getSessionCacheInfo(): { size: number; maxSize: number } {
  return {
    size: sessionCache.size(),
    maxSize: 20,
  }
}

// Alias para compatibilidad
export const createUserSession = getOrCreateUserSession

// ============================================
// HOOKS PARA CLEANUP AUTOMÁTICO (Next.js)
// ============================================

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearSessionCache()
  })

  const handleRouteChange = (): void => {
    clearSessionCache()
  }

  if (typeof (window as Window & { next?: unknown }).next !== 'undefined') {
    window.addEventListener('routeChangeStart', handleRouteChange)
  }

  // Debug info en desarrollo
  if (process.env.NODE_ENV === 'development') {
    (window as Window & { sessionDebug?: unknown }).sessionDebug = {
      getCache: () => sessionCache,
      getCacheInfo: getSessionCacheInfo,
      clearCache: clearSessionCache,
    }
  }
}
