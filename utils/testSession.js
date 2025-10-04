// utils/testSession.js - VERSIÓN CORREGIDA SIN VARIABLES GLOBALES
// ========================================
// 🚨 FIX CRÍTICO: Eliminar variables globales que causan race conditions
// ========================================

import { getSupabaseClient } from '../lib/supabase' // 🔧 USAR SINGLETON

const supabase = getSupabaseClient()

// ✅ ELIMINAR VARIABLES GLOBALES PROBLEMÁTICAS
// ❌ let currentUserSession = null
// ❌ let sessionCache = new Map()
// ❌ let isCreatingUserSession = false 
// ❌ let isCreatingTestSession = false

// ✅ CACHE LOCAL CON LÍMITES para evitar memory leaks
class LimitedSessionCache {
  constructor(maxSize = 20) {
    this.cache = new Map()
    this.maxSize = maxSize
  }
  
  set(key, value) {
    // Si el cache está lleno, eliminar el más antiguo
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }
  
  get(key) {
    return this.cache.get(key)
  }
  
  has(key) {
    return this.cache.has(key)
  }
  
  delete(key) {
    return this.cache.delete(key)
  }
  
  clear() {
    this.cache.clear()
  }
  
  size() {
    return this.cache.size
  }
}

// ✅ CACHE LIMITADO en lugar de Map sin límites
const sessionCache = new LimitedSessionCache(20)

// Detectar información del dispositivo
export const getDeviceInfo = () => {
  if (typeof window === 'undefined') return {}
  
  const userAgent = navigator.userAgent
  const screen = window.screen
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  
  return {
    user_agent: userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    device_model: /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 
            /Tablet|iPad/.test(userAgent) ? 'tablet' : 'desktop',
    browser_language: 'es',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    color_depth: screen.colorDepth,
    pixel_ratio: window.devicePixelRatio,
    connection_type: connection?.effectiveType || 'unknown',
    platform: navigator.platform,
    online_status: navigator.onLine
  }
}

// ✅ MEJORADO: Obtener o crear sesión de usuario SIN VARIABLES GLOBALES
export const getOrCreateUserSession = async (userId) => {
  try {
    console.log('🔍 Verificando sesión existente para usuario:', userId)
    
    if (!userId) {
      console.error('❌ userId es requerido')
      return null
    }
    
    // Verificar cache primero
    const cacheKey = `user_session_${userId}`
    if (sessionCache.has(cacheKey)) {
      const cachedSession = sessionCache.get(cacheKey)
      console.log('✅ Usando sesión de cache:', cachedSession.id)
      return cachedSession
    }

    // Buscar sesión activa en la base de datos (últimas 24 horas)
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)
    
    const { data: existingSessions, error: searchError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('session_start', yesterday.toISOString())
      .is('session_end', null) // Sesiones no terminadas
      .order('session_start', { ascending: false })
      .limit(1)

    if (searchError) {
      console.error('❌ Error buscando sesiones:', searchError)
    }

    // Si existe sesión activa, actualizarla y usarla
    if (existingSessions && existingSessions.length > 0) {
      const existingSession = existingSessions[0]
      console.log('✅ Reutilizando sesión existente:', existingSession.id)
      
      // Actualizar timestamp
      await supabase
        .from('user_sessions')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSession.id)
      
      // Guardar en cache
      sessionCache.set(cacheKey, existingSession)
      return existingSession
    }

    // Crear nueva sesión solo si no existe una activa
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
      bounce_indicator: false
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
    
    // Guardar en cache
    sessionCache.set(cacheKey, data)
    return data
    
  } catch (error) {
    console.error('❌ Error en getOrCreateUserSession:', error)
    return null
  }
}

// ✅ MEJORADO: Crear sesión de test SIN VARIABLES GLOBALES
export const createDetailedTestSession = async (userId, tema, testNumber, questions, config, startTime, pageLoadTime, userSession = null) => {
  try {
    console.log('🆕 Creando sesión de test...')
    
    if (!questions || questions.length === 0) {
      console.error('❌ No se puede crear sesión: No hay preguntas disponibles')
      return null
    }

    if (!userId) {
      console.error('❌ userId es requerido para crear sesión de test')
      return null
    }

    // Verificar cache primero
    const cacheKey = `test_session_${userId}_${tema}_${testNumber}`
    if (sessionCache.has(cacheKey)) {
      const cachedSession = sessionCache.get(cacheKey)
      console.log('✅ Reutilizando sesión de test de cache:', cachedSession.id)
      return cachedSession
    }

    // Buscar test activo reciente (últimos 30 minutos)
    const thirtyMinutesAgo = new Date()
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)
    
    const { data: activeTests } = await supabase
      .from('tests')
      .select('*')
      .eq('user_id', userId)
      .eq('tema_number', parseInt(tema))
      .eq('test_number', parseInt(testNumber))
      .eq('is_completed', false)
      .gte('started_at', thirtyMinutesAgo.toISOString())
      .order('started_at', { ascending: false })
      .limit(1)

    if (activeTests && activeTests.length > 0) {
      const activeTest = activeTests[0]
      console.log('✅ Reutilizando test activo:', activeTest.id)
      sessionCache.set(cacheKey, activeTest)
      return activeTest
    }

    const safeTitle = `Test Tema ${tema || 'X'} - ${testNumber || '1'}`.substring(0, 100)
    
    // Validar que questions sea un array
    if (!Array.isArray(questions)) {
      console.error('❌ ERROR: questions no es un array:', typeof questions, questions)
      throw new Error(`Questions debe ser un array, recibido: ${typeof questions}`)
    }
    
    const questionsMetadata = {
      question_ids: questions.map(q => q.metadata?.id || `temp_${Date.now()}_${Math.random()}`),
      article_ids: questions.map(q => q.article?.id || null),
      article_numbers: questions.map(q => q.article?.number || 'unknown'),
      difficulties: questions.map(q => q.metadata?.difficulty || 'medium'),
      laws: questions.map(q => q.article?.law_short_name || 'unknown'),
      total_questions: questions.length,
      estimated_duration: questions.length * 60
    }
    
    const insertData = {
      user_id: userId,
      title: safeTitle,
      test_type: 'practice',
      total_questions: questions.length,
      score: 0,
      tema_number: parseInt(tema) || null,
      test_number: parseInt(testNumber) || null,
      time_limit_minutes: config?.timeLimit || null,
      started_at: new Date().toISOString(),
      completed_at: null,
      is_completed: false,
      questions_metadata: JSON.stringify(questionsMetadata),
      user_session_data: JSON.stringify(getDeviceInfo()),
      performance_metrics: JSON.stringify({
        start_time: startTime,
        expected_duration_minutes: questions.length * 2,
        load_time: Date.now() - pageLoadTime
      })
    }
    
    const { data, error } = await supabase
      .from('tests')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Error creando sesión de test:', error.message, error)
      return null
    }
    
    console.log('✅ Sesión de test creada exitosamente:', data.id)
    
    // Guardar en cache
    sessionCache.set(cacheKey, data)
    
    return data
  } catch (error) {
    console.error('❌ Error en createDetailedTestSession:', error)
    return null
  }
}

// ✅ MEJORADO: Cerrar sesión de test
export const closeTestSession = (userId, tema, testNumber) => {
  const cacheKey = `test_session_${userId}_${tema}_${testNumber}`
  sessionCache.delete(cacheKey)
  console.log('🗑️ Sesión de test removida del cache')
}

// ✅ MEJORADO: Cerrar sesión de usuario
export const closeUserSession = async (sessionId) => {
  try {
    if (sessionId) {
      await supabase
        .from('user_sessions')
        .update({ 
          session_end: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
      
      console.log('✅ Sesión de usuario cerrada:', sessionId)
    }
    
    // Limpiar cache
    sessionCache.clear()
    
  } catch (error) {
    console.error('❌ Error cerrando sesión:', error)
  }
}

// Actualizar puntuación del test
export const updateTestScore = async (sessionId, currentScore) => {
  try {
    const { error } = await supabase
      .from('tests')
      .update({ 
        score: currentScore
      })
      .eq('id', sessionId)
    if (error) throw error
    console.log('✅ Puntuación actualizada:', currentScore)
    return true
  } catch (error) {
    console.error('❌ Error actualizando puntuación:', error)
    return false
  }
}

// ✅ NUEVO: Limpiar cache al cambiar de página
export const clearSessionCache = () => {
  sessionCache.clear()
  console.log('🧹 Cache de sesiones limpiado')
}

// ✅ NUEVO: Obtener información del cache
export const getSessionCacheInfo = () => {
  return {
    size: sessionCache.size(),
    maxSize: sessionCache.maxSize
  }
}

// 🔄 Mantener compatibilidad con código existente
export const createUserSession = getOrCreateUserSession

// ✅ NUEVO: Hook para cleanup automático (Next.js)
if (typeof window !== 'undefined') {
  // Limpiar cache al cerrar página
  window.addEventListener('beforeunload', () => {
    clearSessionCache()
  })
  
  // Limpiar cache al cambiar de ruta (para Next.js)
  const handleRouteChange = () => {
    clearSessionCache()
  }
  
  // Si existe Next.js router
  if (typeof window.next !== 'undefined') {
    window.addEventListener('routeChangeStart', handleRouteChange)
  }
  
  // Debug info en desarrollo
  if (process.env.NODE_ENV === 'development') {
    window.sessionDebug = {
      getCache: () => sessionCache,
      getCacheInfo: getSessionCacheInfo,
      clearCache: clearSessionCache
    }
  }
}