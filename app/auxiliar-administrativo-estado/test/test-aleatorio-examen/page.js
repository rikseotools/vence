// app/auxiliar-administrativo-estado/test/test-aleatorio-examen/page.js
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '../../../../lib/supabase'
import ExamLayout from '../../../../components/ExamLayout'
import ExamLoadingIndicator from '../../../../components/ExamLoadingIndicator'
import { fetchAleatorioMultiTema } from '../../../../lib/testFetchers'
import { normalizeLawShortName } from '../../../../lib/lawMappingUtils'

const supabase = getSupabaseClient()

// Mapeo de exam_position para filtrar preguntas oficiales por oposición
const EXAM_POSITION_VALUES = [
  'auxiliar administrativo del estado',
  'auxiliar administrativo',
  'auxiliar_administrativo',
  'auxiliar_administrativo_estado'
]

function TestAleatorioExamenContent() {
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState({
    currentPhase: 'connecting',
    currentMapping: 0,
    totalMappings: 0,
    currentLaw: '',
    questionsFound: 0,
    message: 'Conectando con la base de datos...'
  })

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
      console.log('🚀 INICIANDO carga de preguntas para examen...')
      console.log('📋 Configuración:', testConfig)

      // Validar que haya temas seleccionados
      if (!testConfig.themes || testConfig.themes.length === 0) {
        throw new Error('No se han seleccionado temas para el test')
      }

      // ✅ OBTENER PREGUNTAS USANDO topic_scope (IGUAL QUE TEMA A TEMA)
      // Primero obtener mapeos de los temas seleccionados
      console.log('📚 Obteniendo mapeos para temas:', testConfig.themes)
      setLoadingProgress({
        currentPhase: 'fetching_mappings',
        currentMapping: 0,
        totalMappings: 0,
        currentLaw: '',
        questionsFound: 0,
        message: 'Obteniendo estructura de temas...'
      })

      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .in('topics.topic_number', testConfig.themes)
        .eq('topics.position_type', 'auxiliar_administrativo_estado')

      if (mappingError) {
        console.error('❌ Error obteniendo mapeos:', mappingError)
        throw mappingError
      }

      if (!mappings || mappings.length === 0) {
        throw new Error('No se encontraron mapeos para los temas seleccionados')
      }

      console.log(`✅ Encontrados ${mappings.length} mapeos`)

      // Actualizar progreso con el total de mapeos
      setLoadingProgress(prev => ({
        ...prev,
        totalMappings: mappings.length,
        currentPhase: 'processing_laws',
        message: `Procesando ${mappings.length} combinaciones de leyes y temas...`
      }))

      // Obtener preguntas para cada mapeo
      let allQuestions = []
      let mappingIndex = 0

      for (const mapping of mappings) {
        mappingIndex++
        // Normalizar el nombre de la ley usando nuestra función centralizada
        const normalizedLawName = normalizeLawShortName(mapping.laws?.short_name)
        console.log(`\n🔍 Procesando mapeo ${mappingIndex}/${mappings.length}: ${mapping.laws?.short_name}${normalizedLawName !== mapping.laws?.short_name ? ` → ${normalizedLawName}` : ''}`)

        // Actualizar progreso con la ley actual
        setLoadingProgress(prev => ({
          ...prev,
          currentMapping: mappingIndex,
          currentLaw: normalizedLawName,
          message: `Buscando preguntas en ${normalizedLawName} (${mappingIndex}/${mappings.length})`
        }))

        // Filtrar artículos vacíos o inválidos
        const validArticleNumbers = mapping.article_numbers?.filter(art => art && art.toString().trim() !== '') || []

        if (validArticleNumbers.length === 0) {
          console.log(`⚠️ Sin artículos válidos para ${mapping.laws?.short_name}, saltando...`)
          continue
        }

        console.log(`  📝 Artículos a buscar (${validArticleNumbers.length}):`, validArticleNumbers.slice(0, 5), validArticleNumbers.length > 5 ? '...' : '')

        try {
          // Construir query base - SIN topics porque no hay relación directa
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
            .eq('articles.laws.short_name', normalizedLawName)
            .in('articles.article_number', validArticleNumbers)

          // Aplicar filtros opcionales
          if (testConfig.difficulty && testConfig.difficulty !== 'mixed') {
            query = query.eq('global_difficulty_category', testConfig.difficulty)
          }

          if (testConfig.onlyOfficialQuestions) {
            query = query.eq('is_official_exam', true)
            // Filtrar por exam_position de la oposición actual (auxiliar_administrativo)
            // Incluir NULL para compatibilidad con preguntas legacy
            query = query.or(`exam_position.is.null,exam_position.in.(${EXAM_POSITION_VALUES.map(v => `"${v}"`).join(',')})`)
          }

          const { data: lawQuestions, error: questionsError } = await query

          if (questionsError) {
            // Si falla la query con .in(), intentar con queries individuales para artículos con caracteres especiales
            console.error(`❌ Error con ley ${normalizedLawName}:`, questionsError.message)
            console.log(`  🔄 Intentando método alternativo con queries individuales...`)

            let fallbackQuestions = []
            let successfulArticles = 0
            let failedArticles = 0

            for (const articleNumber of validArticleNumbers) {
              try {
                let individualQuery = supabase
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
                  .eq('articles.laws.short_name', normalizedLawName)
                  .eq('articles.article_number', articleNumber)

                // Aplicar filtros opcionales
                if (testConfig.difficulty && testConfig.difficulty !== 'mixed') {
                  individualQuery = individualQuery.eq('global_difficulty_category', testConfig.difficulty)
                }

                if (testConfig.onlyOfficialQuestions) {
                  individualQuery = individualQuery.eq('is_official_exam', true)
                }

                const { data: articleQuestions, error: articleError } = await individualQuery

                if (!articleError && articleQuestions) {
                  fallbackQuestions = [...fallbackQuestions, ...articleQuestions]
                  successfulArticles++
                } else {
                  failedArticles++
                  if (failedArticles <= 3) { // Solo mostrar los primeros 3 errores
                    console.log(`    ⚠️ Artículo ${articleNumber} falló:`, articleError?.message)
                  }
                }
              } catch (err) {
                failedArticles++
              }
            }

            console.log(`  📊 Resultado fallback: ${successfulArticles} exitosos, ${failedArticles} fallidos`)

            if (fallbackQuestions.length > 0) {
              // Agregar el tema de origen a cada pregunta
              const questionsWithTopic = fallbackQuestions.map(q => ({
                ...q,
                source_topic: mapping.topics?.topic_number || 0
              }))
              allQuestions = [...allQuestions, ...questionsWithTopic]
            }
          } else if (lawQuestions && lawQuestions.length > 0) {
            console.log(`  ✅ Query exitosa: ${lawQuestions.length} preguntas encontradas`)
            // Agregar el tema de origen a cada pregunta
            const questionsWithTopic = lawQuestions.map(q => ({
              ...q,
              source_topic: mapping.topics?.topic_number || 0
            }))
            allQuestions = [...allQuestions, ...questionsWithTopic]

            // Actualizar contador de preguntas encontradas
            setLoadingProgress(prev => ({
              ...prev,
              questionsFound: prev.questionsFound + lawQuestions.length
            }))
          } else {
            console.log(`  ⚠️ Sin preguntas para ${normalizedLawName}`)
          }
        } catch (err) {
          console.error(`⚠️ Error procesando ley ${normalizedLawName}: ${err.message}`)
        }
      }

      if (allQuestions.length === 0) {
        console.error('❌ NO SE ENCONTRARON PREGUNTAS!')
        throw new Error('No se encontraron preguntas con los criterios seleccionados')
      }

      console.log(`\n📊 RESUMEN FINAL:`)
      console.log(`  ✅ Total de preguntas disponibles: ${allQuestions.length}`)
      console.log(`  🎯 Preguntas solicitadas: ${testConfig.numQuestions}`)

      // Actualizar progreso - fase de selección
      setLoadingProgress({
        currentPhase: 'selecting',
        currentMapping: mappings.length,
        totalMappings: mappings.length,
        currentLaw: '',
        questionsFound: allQuestions.length,
        message: `Seleccionando ${testConfig.numQuestions} preguntas de ${allQuestions.length} disponibles...`
      })

      // 📊 Aplicar selección proporcional para multi-tema
      let selectedQuestions = []

      if (testConfig.themes.length > 1) {
        console.log('\n📊 APLICANDO SELECCIÓN PROPORCIONAL en modo examen')

        // Calcular distribución
        const questionsPerTheme = Math.floor(testConfig.numQuestions / testConfig.themes.length)
        const remainder = testConfig.numQuestions % testConfig.themes.length

        // Agrupar por tema
        const questionsByTheme = {}
        testConfig.themes.forEach(theme => {
          questionsByTheme[theme] = allQuestions.filter(q => q.source_topic === theme)
          console.log(`📚 Tema ${theme}: ${questionsByTheme[theme].length} preguntas disponibles`)
        })

        // Determinar cuántas preguntas por tema (asignar extras a los que tienen más)
        const sortedThemes = [...testConfig.themes].sort((a, b) =>
          questionsByTheme[b].length - questionsByTheme[a].length
        )

        const questionsNeeded = {}
        testConfig.themes.forEach((theme, index) => {
          questionsNeeded[theme] = questionsPerTheme
          if (sortedThemes.indexOf(theme) < remainder) {
            questionsNeeded[theme]++
          }
        })

        // Seleccionar proporcionalmente
        testConfig.themes.forEach(theme => {
          const themeQuestions = questionsByTheme[theme]
          const needed = questionsNeeded[theme]
          const available = themeQuestions.length

          const shuffled = [...themeQuestions].sort(() => Math.random() - 0.5)
          const selected = shuffled.slice(0, Math.min(needed, available))

          selectedQuestions.push(...selected)
          console.log(`✅ Tema ${theme}: ${selected.length} preguntas seleccionadas`)
        })

        // Si faltan preguntas, completar con las restantes
        if (selectedQuestions.length < testConfig.numQuestions) {
          const remaining = allQuestions.filter(q =>
            !selectedQuestions.some(sq => sq.id === q.id)
          )
          const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5)
          const additional = shuffledRemaining.slice(0, testConfig.numQuestions - selectedQuestions.length)
          selectedQuestions.push(...additional)
          console.log(`⚠️ Agregadas ${additional.length} preguntas adicionales para completar`)
        }

        // Mezclar el resultado final
        selectedQuestions = [...selectedQuestions].sort(() => Math.random() - 0.5)

        // Verificar distribución final
        const finalDistribution = {}
        selectedQuestions.forEach(q => {
          finalDistribution[q.source_topic] = (finalDistribution[q.source_topic] || 0) + 1
        })

        console.log('📊 DISTRIBUCIÓN FINAL:')
        Object.entries(finalDistribution).forEach(([theme, count]) => {
          const percentage = ((count / selectedQuestions.length) * 100).toFixed(1)
          console.log(`   - Tema ${theme}: ${count} preguntas (${percentage}%)`)
        })

      } else {
        // Un solo tema: selección aleatoria normal
        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
        selectedQuestions = shuffled.slice(0, testConfig.numQuestions)
      }

      console.log(`\n✅ PREGUNTAS SELECCIONADAS: ${selectedQuestions.length}`)
      console.log('🎮 Iniciando modo examen...\n')

      setQuestions(selectedQuestions)

    } catch (err) {
      console.error('❌ ERROR FATAL cargando preguntas para examen:', err)
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
    const selectedThemeNames = testConfig.themes
      .map(id => themeNames[id])
      .filter(Boolean)

    return (
      <ExamLoadingIndicator
        numQuestions={testConfig.numQuestions}
        numThemes={testConfig.themes.length}
        themeNames={selectedThemeNames}
        progress={loadingProgress}
      />
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
      <ExamLoadingIndicator
        numQuestions={25}
        numThemes={1}
        themeNames={[]}
      />
    }>
      <TestAleatorioExamenContent />
    </Suspense>
  )
}
