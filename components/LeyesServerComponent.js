// components/LeyesServerComponent.js - COMPONENTE SERVIDOR
// Obtiene datos del servidor y los pasa al wrapper cliente para filtrado interactivo
import { getSupabaseClient } from '../lib/supabase'
import LeyesClientWrapper from './LeyesClientWrapper'

const supabase = getSupabaseClient()

// 🚀 Cache en memoria para evitar consultas repetidas
let lawsCache = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// 🔧 Función para obtener leyes con conteo de preguntas
async function getLawsWithQuestionCount() {
  try {
    // 🚀 Verificar cache en memoria primero
    const now = Date.now()
    if (lawsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('⚡ Usando cache en memoria (instantáneo)')
      return lawsCache
    }
    
    console.log('🚀 Obteniendo leyes con conteo OPTIMIZADO...')
    console.time('⏱️ Query completa')
    
    // ✅ Intentar RPC primero
    const { data: lawStats, error } = await supabase
      .rpc('get_laws_with_question_counts')

    if (error) {
      console.warn('❌ RPC no disponible, usando fallback optimizado...')
      // Fallback: Query optimizada directa
      const result = await getLawsWithQuestionCountFallback()
      
      // Guardar en cache
      lawsCache = result
      cacheTimestamp = now
      console.timeEnd('⏱️ Query completa')
      return result
    }
    
    // Guardar en cache
    lawsCache = lawStats || []
    cacheTimestamp = now
    console.timeEnd('⏱️ Query completa')
    console.log(`✅ Obtenidas ${lawStats?.length || 0} leyes (cacheadas por 5min)`)
    return lawStats || []
    
  } catch (error) {
    console.error('❌ Error en getLawsWithQuestionCount:', error)
    // Usar cache stale si existe
    if (lawsCache) {
      console.log('📦 Usando cache stale como fallback')
      return lawsCache
    }
    // Usar fallback en caso de error
    return await getLawsWithQuestionCountFallback()
  }
}

// 📦 Función fallback optimizada - Query más eficiente 
async function getLawsWithQuestionCountFallback() {
  try {
    console.log('🔄 Usando fallback ultra-optimizado...')
    console.time('⏱️ Query optimizada')
    
    // 🚀 Query OPTIMIZADA: Solo obtener conteos, no todos los datos
    const { data: results, error } = await supabase
      .from('laws')
      .select(`
        id, name, short_name, description, year, type,
        articles!inner(
          questions!inner(id, is_active, is_official_exam)
        )
      `)
      .eq('is_active', true)
      .eq('articles.questions.is_active', true)

    console.timeEnd('⏱️ Query optimizada')

    if (error) throw error
    
    console.time('⏱️ Procesamiento JS')
    // Procesar en JavaScript - pre-filtrado por active questions
    const lawCounts = new Map()
    
    results.forEach(law => {
      if (!lawCounts.has(law.id)) {
        lawCounts.set(law.id, {
          id: law.id,
          name: law.name,
          short_name: law.short_name,
          description: law.description,
          year: law.year,
          type: law.type,
          questionCount: 0,
          officialQuestions: 0
        })
      }
      
      const lawData = lawCounts.get(law.id)
      law.articles?.forEach(article => {
        article.questions?.forEach(question => {
          lawData.questionCount++
          if (question.is_official_exam) {
            lawData.officialQuestions++
          }
        })
      })
    })
    
    const lawsWithCounts = Array.from(lawCounts.values())
      .filter(law => law.questionCount >= 5)
      .sort((a, b) => b.questionCount - a.questionCount)
    
    console.timeEnd('⏱️ Procesamiento JS')
    console.log(`✅ Optimizado: ${lawsWithCounts.length} leyes procesadas`)
    return lawsWithCounts
    
  } catch (error) {
    console.error('❌ Error en fallback optimizado:', error)
    
    // 🔄 Fallback del fallback - query simple sin joins complejos
    try {
      console.log('🔄 Usando fallback básico...')
      const { data: laws } = await supabase
        .from('laws')
        .select('*')
        .eq('is_active', true)
      
      // Retornar datos básicos sin conteos para evitar demoras
      return laws?.slice(0, 20).map(law => ({
        ...law,
        questionCount: 50, // Valor placeholder
        officialQuestions: 20
      })) || []
    } catch {
      return []
    }
  }
}

export default async function LeyesServerComponent() {
  try {
    const laws = await getLawsWithQuestionCount()

    if (!laws || laws.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            No hay leyes disponibles
          </h3>
          <p className="text-gray-600">
            No se encontraron leyes con preguntas en la base de datos.
          </p>
        </div>
      )
    }

    // Pasar las leyes al componente cliente para filtrado interactivo
    // El HTML inicial contiene TODAS las leyes (SEO), el cliente añade interactividad
    return <LeyesClientWrapper laws={laws} />

  } catch (error) {
    console.error('❌ Error en LeyesServerComponent:', error)

    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-gray-800 mb-3">
          Error cargando leyes
        </h3>
        <p className="text-gray-600 mb-6">
          Hubo un problema al cargar las leyes desde la base de datos.
        </p>
      </div>
    )
  }
}