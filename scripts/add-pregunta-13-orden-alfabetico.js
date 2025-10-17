import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addPregunta13OrdenAlfabetico() {
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
      question_text: '¿Qué serie indica el orden alfabético correcto de las siguientes palabras?',
      content_data: {
        chart_type: 'alphabetical_order',
        original_words: ['girada', 'girándula', 'giraldete', 'giramiento'],
        correct_order: ['girada', 'giraldete', 'giramiento', 'girándula'],
        options: [
          {
            letter: 'A',
            order: ['girada', 'girándula', 'giraldete', 'giramiento']
          },
          {
            letter: 'B', 
            order: ['giraldete', 'girada', 'giramiento', 'girándula']
          },
          {
            letter: 'C',
            order: ['girada', 'giraldete', 'giramiento', 'girándula']
          },
          {
            letter: 'D',
            order: ['giramiento', 'girada', 'giraldete', 'girándula']
          }
        ],
        explanation: 'El orden alfabético correcto se determina letra por letra: gir-a-da, gir-a-l-dete, gir-a-m-iento, gir-á-n-dula',
        evaluation_description: 'Capacidad de ordenar palabras alfabéticamente considerando cada letra secuencialmente'
      },
      option_a: 'girada, girándula, giraldete, giramiento.',
      option_b: 'giraldete, girada, giramiento, girándula.',
      option_c: 'girada, giraldete, giramiento, girándula.',
      option_d: 'giramiento, girada, giraldete, girándula.',
      correct_option: 2, // C = orden alfabético correcto
      explanation: 'La forma correcta de ordenar las palabras por orden alfabético es: girada, giraldete, giramiento, girándula. Se compara letra por letra hasta encontrar la diferencia.',
      difficulty: 'medium',
      time_limit_seconds: 90,
      question_subtype: 'alphabetical_order',
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

    console.log('✅ Pregunta 13 añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: C) girada, giraldete, giramiento, girándula')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

addPregunta13OrdenAlfabetico()