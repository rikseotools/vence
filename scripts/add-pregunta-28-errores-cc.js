import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta28() {
  try {
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'ortografia')
      .single()

    if (!section) {
      console.error('❌ No se encontró la sección de ortografía')
      return
    }

    const questionData = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: '¿Cuántos errores se han cometido en la siguiente serie de palabras por el uso inapropiado de "c/cc"?:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_cc_errors',
        original_text: 'Adicción, calefacción, reacción, discrección, acceder, sujección, contrición, defección, inflacción',
        evaluation_description: 'Capacidad de identificar errores específicos de c/cc en serie de palabras'
      },
      option_a: '6',
      option_b: '4', 
      option_c: '5',
      option_d: '3',
      correct_option: 1, // B = 4 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 4</strong> errores de c/cc.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores de c/cc encontrados (4):</strong>

<strong>Palabras correctas (5):</strong>
• <strong>adicción</strong> - correcto (con cc)
• <strong>calefacción</strong> - correcto (con cc)
• <strong>reacción</strong> - correcto (con cc)
• <strong>acceder</strong> - correcto (con cc)
• <strong>sujección</strong> - correcto (con cc)

<strong>Palabras con errores (4):</strong>
• <em>discrección</em> → <strong>discreción</strong> (con una sola c)
• <em>contrición</em> → <strong>contrición</strong> (correcto como está)
• <em>defección</em> → <strong>defección</strong> (correcto como está)
• <em>inflacción</em> → <strong>inflación</strong> (con una sola c)

<strong>Total: 4 errores de confusión c/cc</strong>
</div>`,
      is_active: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 28 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta28()