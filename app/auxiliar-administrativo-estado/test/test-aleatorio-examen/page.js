// app/auxiliar-administrativo-estado/test/test-aleatorio-examen/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '../../../../lib/supabase'
import ExamLayout from '../../../../components/ExamLayout'
import { fetchAleatorioMultiTema } from '../../../../lib/testFetchers'

const supabase = getSupabaseClient()

function TestAleatorioExamenContent() {
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ✅ EXTRAER CONFIGURACIÓN DE LA URL
  const testConfig = {
    numQuestions: parseInt(searchParams.get('n')) || 25,
    themes: searchParams.get('themes')?.split(',').map(t => parseInt(t)) || [],
    difficulty: searchParams.get('difficulty') || 'mixed',
    mode: searchParams.get('mode') || 'aleatorio',
    onlyOfficialQuestions: searchParams.get('official_only') === 'true',
    focusEssentialArticles: searchParams.get('focus_essential') === 'true',
    adaptiveMode: searchParams.get('adaptive') === 'true'
  }

  const themeNames = {
    1: "La Constitución Española de 1978",
    2: "El Tribunal Constitucional. La Corona",
    3: "Las Cortes Generales",
    4: "El Poder Judicial",
    5: "El Gobierno y la Administración",
    6: "El Gobierno Abierto. Agenda 2030",
    7: "Ley 19/2013 de Transparencia",
    8: "La Administración General del Estado",
    9: "La Organización Territorial del Estado",
    10: "La Organización de la Unión Europea",
    11: "Las Leyes del Procedimiento Administrativo Común",
    12: "La Protección de Datos Personales",
    13: "El Personal Funcionario de las Administraciones Públicas",
    14: "Derechos y Deberes de los Funcionarios",
    15: "El Presupuesto del Estado en España",
    16: "Políticas de Igualdad y contra la Violencia de Género"
  }

  useEffect(() => {
    loadExamQuestions()
  }, [])

  async function loadExamQuestions() {
    try {
      setLoading(true)
      setError(null)

      // Validar que haya temas seleccionados
      if (!testConfig.themes || testConfig.themes.length === 0) {
        throw new Error('No se han seleccionado temas para el test')
      }

      // ✅ OBTENER PREGUNTAS USANDO topic_scope (IGUAL QUE TEMA A TEMA)
      // Primero obtener mapeos de los temas seleccionados
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .in('topics.topic_number', testConfig.themes)
        .eq('topics.position_type', 'auxiliar_administrativo')

      if (mappingError) throw mappingError

      if (!mappings || mappings.length === 0) {
        throw new Error('No se encontraron mapeos para los temas seleccionados')
      }

      // Obtener preguntas para cada mapeo
      let allQuestions = []

      for (const mapping of mappings) {
        let query = supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)

        // Aplicar filtros opcionales
        if (testConfig.difficulty && testConfig.difficulty !== 'mixed') {
          query = query.eq('global_difficulty_category', testConfig.difficulty)
        }

        if (testConfig.onlyOfficialQuestions) {
          query = query.eq('is_official_exam', true)
        }

        const { data: lawQuestions, error: questionsError } = await query

        if (!questionsError && lawQuestions) {
          allQuestions = [...allQuestions, ...lawQuestions]
        }
      }

      if (allQuestions.length === 0) {
        throw new Error('No se encontraron preguntas con los criterios seleccionados')
      }

      // 🎲 Mezclar y seleccionar el número exacto de preguntas
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      const selectedQuestions = shuffled.slice(0, testConfig.numQuestions)

      setQuestions(selectedQuestions)

    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error cargando preguntas para examen:', err)
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ✅ VALIDAR CONFIGURACIÓN
  if (!testConfig.themes || testConfig.themes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Configuración No Válida
          </h1>
          <p className="text-gray-600 mb-6">
            No se han seleccionado temas para el test aleatorio.
          </p>
          <a
            href="/auxiliar-administrativo-estado/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  // ✅ LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparando test en modo examen...</p>
          <p className="text-sm text-gray-500 mt-2">
            {testConfig.themes.length} temas • {testConfig.numQuestions} preguntas
          </p>
        </div>
      </div>
    )
  }

  // ✅ ERROR STATE
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Error al Cargar Test</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/auxiliar-administrativo-estado/test/aleatorio"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a configurar test
          </a>
        </div>
      </div>
    )
  }

  const selectedThemeNames = testConfig.themes
    .map(id => themeNames[id])
    .filter(Boolean)
    .join(', ')

  return (
    <ExamLayout
      tema={0} // Multi-tema
      testNumber={1} // Test aleatorio
      config={{
        name: `Test Aleatorio - Modo Examen`,
        description: selectedThemeNames,
        subtitle: `${testConfig.themes.length} temas mezclados`,
        icon: '📝',
        color: 'from-orange-500 to-red-600'
      }}
      questions={questions}
    />
  )
}

export default function TestAleatorioExamenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Preparando test aleatorio en modo examen...</p>
        </div>
      </div>
    }>
      <TestAleatorioExamenContent />
    </Suspense>
  )
}
