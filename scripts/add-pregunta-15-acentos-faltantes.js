import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addPregunta15AcentosFaltantes() {
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
      question_text: 'Indique cuántos acentos habría que poner en el siguiente listado de palabras:',
      content_data: {
        chart_type: 'missing_accents',
        original_text: 'anecdota, pleyade, axiomatico, coleoptero, lexico, aspid, hiato, pirotecnia',
        correct_text: 'anécdota, pléyade, axiomático, coleóptero, léxico, áspid, hiato, pirotecnia',
        missing_accents: 6,
        words_needing_accents: [
          {
            word: 'anecdota',
            correct: 'anécdota',
            explanation: 'Falta tilde: anécdota (palabra esdrújula)'
          },
          {
            word: 'pleyade',
            correct: 'pléyade',
            explanation: 'Falta tilde: pléyade (palabra esdrújula)'
          },
          {
            word: 'axiomatico',
            correct: 'axiomático',
            explanation: 'Falta tilde: axiomático (palabra esdrújula)'
          },
          {
            word: 'coleoptero',
            correct: 'coleóptero',
            explanation: 'Falta tilde: coleóptero (palabra esdrújula)'
          },
          {
            word: 'lexico',
            correct: 'léxico',
            explanation: 'Falta tilde: léxico (palabra esdrújula)'
          },
          {
            word: 'aspid',
            correct: 'áspid',
            explanation: 'Falta tilde: áspid (palabra llana terminada en consonante)'
          }
        ],
        words_correct: ['hiato', 'pirotecnia'],
        evaluation_description: 'Capacidad de identificar palabras que necesitan acentuación ortográfica'
      },
      option_a: '6',
      option_b: '7', 
      option_c: '5',
      option_d: '8',
      correct_option: 0, // A = 6 acentos
      explanation: 'Las palabras donde faltaría acento serían: "anécdota", "pléyade", "axiomático", "coleóptero", "léxico" y "áspid". Respuesta correcta: 6 palabras.',
      difficulty: 'medium',
      time_limit_seconds: 120,
      question_subtype: 'missing_accents',
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

    console.log('✅ Pregunta 15 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: A) 6 acentos')
    console.log('📚 Palabras que necesitan acento: anécdota, pléyade, axiomático, coleóptero, léxico, áspid')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

addPregunta15AcentosFaltantes()