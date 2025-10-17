import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addPregunta12ErroresTranscribir() {
  try {
    console.log('🔍 Buscando categoría y sección de ortografía...')

    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-ortografica')
      .single()

    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'ortografia')
      .single()

    console.log('✅ Categoría y sección encontradas')

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Marque la cantidad de errores ortográficos cometidos al transcribir la siguiente serie de palabras:',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'avasto, apdicar, abédul, abjurar, hablativo, adjurar, adicto, ápside, alvino, anecdota',
        correct_text: 'abasto, aplicar, abedul, abjurar, hablativo, adjurar, adicto, ápside, alvino, anécdota',
        error_count: 5,
        errors_found: [
          {
            incorrect: 'avasto',
            correct: 'abasto',
            position: 1,
            error_type: 'ortografía',
            explanation: 'Error de consonante: abasto (con b)'
          },
          {
            incorrect: 'apdicar',
            correct: 'aplicar',
            position: 2,
            error_type: 'ortografía',
            explanation: 'Error de consonante: aplicar (con l, no d)'
          },
          {
            incorrect: 'abédul',
            correct: 'abedul',
            position: 3,
            error_type: 'acentuación',
            explanation: 'Sobra tilde: abedul (palabra llana terminada en consonante)'
          },
          {
            incorrect: 'hablativo',
            correct: 'ablativo',
            position: 5,
            error_type: 'ortografía',
            explanation: 'Sobra h: ablativo (sin h inicial)'
          },
          {
            incorrect: 'anecdota',
            correct: 'anécdota',
            position: 10,
            error_type: 'acentuación',
            explanation: 'Falta tilde: anécdota (palabra esdrújula)'
          }
        ],
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos y de acentuación al transcribir palabras'
      },
      option_a: '6',
      option_b: '4',
      option_c: '5',
      option_d: '3',
      correct_option: 2, // C = 5 errores
      explanation: null,
      difficulty: 'medium',
      time_limit_seconds: 120,
      question_subtype: 'error_detection',
      is_active: true,
      is_verified: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error al insertar pregunta:', error)
      return
    }

    console.log('✅ Pregunta 12 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: C) 5 errores')
    console.log('📚 Errores: avasto→abasto, apdicar→aplicar, abédul→abedul, hablativo→ablativo, anecdota→anécdota')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

addPregunta12ErroresTranscribir()