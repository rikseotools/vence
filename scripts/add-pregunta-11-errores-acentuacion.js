import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addPregunta11ErroresAcentuacion() {
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
      question_text: '¿Cuántos errores de acentuación se han cometido en las siguientes serie de palabras?',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'oleo, nacar, datil, nauseas, fluor, oboe, mutuo, instantaneo, etereo y liquen',
        correct_text: 'óleo, nácar, dátil, náuseas, flúor, oboe, mutuo, instantáneo, etéreo y líquen',
        error_count: 7,
        errors_found: [
          {
            incorrect: 'oleo',
            correct: 'óleo',
            position: 1,
            error_type: 'acentuación',
            explanation: 'Falta tilde: óleo (palabra esdrújula)'
          },
          {
            incorrect: 'nacar',
            correct: 'nácar',
            position: 2,
            error_type: 'acentuación',
            explanation: 'Falta tilde: nácar (palabra llana terminada en consonante)'
          },
          {
            incorrect: 'datil',
            correct: 'dátil',
            position: 3,
            error_type: 'acentuación',
            explanation: 'Falta tilde: dátil (palabra llana terminada en consonante)'
          },
          {
            incorrect: 'nauseas',
            correct: 'náuseas',
            position: 4,
            error_type: 'acentuación',
            explanation: 'Falta tilde: náuseas (palabra esdrújula)'
          },
          {
            incorrect: 'fluor',
            correct: 'flúor',
            position: 5,
            error_type: 'acentuación',
            explanation: 'Falta tilde: flúor (palabra aguda terminada en -r)'
          },
          {
            incorrect: 'instantaneo',
            correct: 'instantáneo',
            position: 8,
            error_type: 'acentuación',
            explanation: 'Falta tilde: instantáneo (palabra esdrújula)'
          },
          {
            incorrect: 'etereo',
            correct: 'etéreo',
            position: 9,
            error_type: 'acentuación',
            explanation: 'Falta tilde: etéreo (palabra esdrújula)'
          }
        ],
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores de acentuación en palabras aisladas'
      },
      option_a: '8',
      option_b: '7',
      option_c: '6',
      option_d: '5',
      correct_option: 1, // B = 7 errores
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

    console.log('✅ Pregunta 11 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: B) 7 errores de acentuación')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

addPregunta11ErroresAcentuacion()