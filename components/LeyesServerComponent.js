// components/LeyesServerComponent.js - COMPONENTE SERVIDOR COMPLETO
import Link from 'next/link'
import { getSupabaseClient } from '../lib/supabase'
import { getCanonicalSlug } from '../lib/lawMappingUtils'

const supabase = getSupabaseClient()

// 🔧 Función para obtener leyes con conteo de preguntas
async function getLawsWithQuestionCount() {
  try {
    console.log('🚀 Obteniendo leyes con conteo OPTIMIZADO (1 query)...')
    
    // ✅ QUERY ÚNICA optimizada con agregación en PostgreSQL
    const { data: lawStats, error } = await supabase
      .rpc('get_laws_with_question_counts')

    if (error) {
      console.warn('❌ RPC no disponible, usando fallback...')
      // Fallback: Query optimizada directa
      return await getLawsWithQuestionCountFallback()
    }
    
    console.log(`✅ Obtenidas ${lawStats?.length || 0} leyes en una sola query`)
    return lawStats || []
    
  } catch (error) {
    console.error('❌ Error en getLawsWithQuestionCount:', error)
    // Usar fallback en caso de error
    return await getLawsWithQuestionCountFallback()
  }
}

// 📦 Función fallback optimizada (mejor que el original)
async function getLawsWithQuestionCountFallback() {
  try {
    console.log('🔄 Usando fallback optimizado...')
    
    // Query que cuenta preguntas en PostgreSQL en lugar de loops
    const { data: results, error } = await supabase
      .from('laws')
      .select(`
        id, name, short_name, description, year, type,
        articles(
          questions(is_active, is_official_exam)
        )
      `)
      .eq('is_active', true)

    if (error) throw error
    
    // Procesar en JavaScript (rápido)
    const lawsWithCounts = results
      .map(law => {
        const allQuestions = law.articles?.flatMap(article => 
          (article.questions || []).filter(q => q.is_active)
        ) || []
        
        const questionCount = allQuestions.length
        const officialQuestions = allQuestions.filter(q => q.is_official_exam).length
        
        return {
          id: law.id,
          name: law.name,
          short_name: law.short_name,
          description: law.description,
          year: law.year,
          type: law.type,
          questionCount,
          officialQuestions
        }
      })
      .filter(law => law.questionCount >= 5)
      .sort((a, b) => b.questionCount - a.questionCount)
    
    console.log(`✅ Fallback: ${lawsWithCounts.length} leyes procesadas`)
    return lawsWithCounts
    
  } catch (error) {
    console.error('❌ Error en fallback:', error)
    return []
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

    return (
      <section className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            📚 Test de Leyes Disponibles
          </h2>
          <p className="text-xl text-gray-600">
            Elige la ley que quieres estudiar y comienza a practicar
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {laws.map((law) => {
            const canonicalSlug = getCanonicalSlug(law.short_name)
            
            return (
              <div
                key={law.id}
                className="group block"
              >
                <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border hover:border-blue-200">
                  
                  {/* Header colorido */}
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold mb-2 group-hover:text-blue-100 transition-colors">
                          {law.short_name}
                        </h3>
                        <div className="flex items-center space-x-4 text-blue-100">
                          <span className="text-sm">
                            📝 {law.questionCount} preguntas
                          </span>
                          {law.officialQuestions > 0 && (
                            <span className="text-sm">
                              🏛️ {law.officialQuestions} oficiales
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-3xl opacity-70">
                        ⚡
                      </div>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="p-6">
                    <h4 className="font-semibold text-gray-800 mb-3 line-clamp-2">
                      {law.name}
                    </h4>
                    
                    {law.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {law.description}
                      </p>
                    )}

                    {/* Botones de acción */}
                    <div className="space-y-3">
                      {/* Botón de test */}
                      <Link
                        href={`/leyes/${canonicalSlug}`}
                        className="block bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-center py-3 px-4 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                      >
                        🎯 Test {law.short_name}
                      </Link>
                      
                      {/* Enlace a teoría - SEO importante */}
                      <Link
                        href={`/teoria/${canonicalSlug}`}
                        className="block bg-gray-50 text-gray-700 text-center py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                      >
                        📖 Ver Teoría y Artículos
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Estadísticas generales */}
        <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              📊 Estadísticas Generales
            </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {laws.length}
              </div>
              <div className="text-gray-600 text-sm">Leyes Disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {laws.reduce((sum, law) => sum + law.questionCount, 0)}
              </div>
              <div className="text-gray-600 text-sm">Total Preguntas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {laws.reduce((sum, law) => sum + law.officialQuestions, 0)}
              </div>
              <div className="text-gray-600 text-sm">Preguntas Oficiales</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">100%</div>
              <div className="text-gray-600 text-sm">Gratis</div>
            </div>
          </div>
        </div>

        {/* Información SEO adicional de tu archivo original */}
        <div className="mt-16 bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            📖 Todo sobre los Test de Leyes en España
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">¿Qué son los Test de Leyes?</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Los <strong>test de leyes</strong> son cuestionarios especializados que evalúan el conocimiento 
                de la legislación española. Son fundamentales para la preparación de oposiciones, 
                estudios de derecho y actualización profesional.
              </p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                En <strong>iLoveTest</strong> encontrarás tests de las leyes más importantes de España, 
                desde la Constitución hasta códigos especializados, todos actualizados y gratuitos.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Ventajas de Practicar Online</h3>
              <ul className="text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Acceso 24/7</strong> desde cualquier dispositivo
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Contenido actualizado</strong> con las últimas reformas
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Explicaciones detalladas</strong> de cada respuesta
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Seguimiento del progreso</strong> y estadísticas
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Totalmente gratuito</strong> sin restricciones
                </li>
              </ul>
            </div>
          </div>
          
          {/* Información sobre rendimiento */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-700">
                <span className="font-semibold">⚡ Página optimizada:</span> 
                Los datos se cachean por 30 días para garantizar carga ultrarrápida. Un usuario regenera el cache para todos.
              </p>
            </div>
          </div>
        </div>
      </section>
    )
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
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Reintentar
        </button>
      </div>
    )
  }
}