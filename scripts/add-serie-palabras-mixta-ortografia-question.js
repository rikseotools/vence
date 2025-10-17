import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addSeriePalabrasMixtaOrtografiaQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección de ortografía...')

    // 1. Buscar la categoría de capacidad ortográfica
    const { data: category } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-ortografica')
      .single()

    if (!category) {
      console.error('❌ No se encontró la categoría capacidad-ortografica')
      return
    }

    console.log('✅ Categoría encontrada:', category.display_name)

    // 2. Buscar la sección de ortografía
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'ortografia')
      .single()

    if (!section) {
      console.error('❌ No se encontró la sección ortografia')
      return
    }

    console.log('✅ Sección encontrada:', section.display_name)

    // 3. Crear la pregunta con el contenido de la serie de palabras
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Indique, de la siguiente serie de palabras, en cuántas palabras se ha cometido un error ortográfico:',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'bufé, abatar, truhan, chalé, elite, laser, dandí, poni, alevín, casete',
        correct_text: 'bufé, abatir, truhán, chalé, élite, láser, dandi, poni, alevín, casete',
        error_count: 4,
        errors_found: [
          {
            incorrect: 'abatar',
            correct: 'abatir',
            position: 2,
            error_type: 'conjugación',
            explanation: 'Forma verbal incorrecta: abatir'
          },
          {
            incorrect: 'laser',
            correct: 'láser',
            position: 6,
            error_type: 'acentuación',
            explanation: 'Falta tilde: láser (palabra aguda terminada en -r)'
          },
          {
            incorrect: 'dandí',
            correct: 'dandi',
            position: 7,
            error_type: 'acentuación',
            explanation: 'Sobra tilde: dandi (palabra llana terminada en vocal)'
          },
          {
            incorrect: 'truhan',
            correct: 'truhán',
            position: 3,
            error_type: 'acentuación',
            explanation: 'Falta tilde: truhán (palabra aguda terminada en -n)'
          }
        ],
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en una serie de palabras aisladas'
      },
      option_a: '5',
      option_b: '4',
      option_c: '6', 
      option_d: '3',
      correct_option: 1, // B = 4 errores
      explanation: null, // Se maneja en el componente
      difficulty: 'medium',
      time_limit_seconds: 120,
      question_subtype: 'error_detection',
      is_active: true,
      is_verified: true
    }

    console.log('📝 Insertando pregunta de serie de palabras ortográficas...')

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error al insertar pregunta:', error)
      return
    }

    console.log('✅ Pregunta de serie de palabras ortográficas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: B) 4 errores')
    console.log('📚 Errores identificados: abatar→abatir, laser→láser, dandí→dandi, truhan→truhán')
    console.log('♻️  Reutiliza el componente ErrorDetectionQuestion existente')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

addSeriePalabrasMixtaOrtografiaQuestion()