import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia07() {
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
      question_text: 'Señale el número de errores ortográficos en la frase siguiente.',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'count_orthographic_errors',
        text_to_analyze: 'La cegadora luz que provenía de los automóbiles no permitía a los ciclistas avanzar la questa de la montaña',
        evaluation_description: 'Contar errores ortográficos en la frase dada'
      },
      option_a: '3',
      option_b: '7',
      option_c: '2',
      option_d: '5',
      correct_option: 3, // D = 5 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) 5</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Errores encontrados en la frase:</strong>

1. <strong style="color: #dc2626;">"cegadora"</strong> → <strong style="color: #16a34a;">"cegadora"</strong> (está correcta)
2. <strong style="color: #dc2626;">"provenía"</strong> → <strong style="color: #16a34a;">"provenía"</strong> (está correcta)
3. <strong style="color: #dc2626;">"automóbiles"</strong> → <strong style="color: #16a34a;">"automóviles"</strong> (error: 'ó' por 'ó')
4. <strong style="color: #dc2626;">"permitía"</strong> → <strong style="color: #16a34a;">"permitía"</strong> (está correcta)
5. <strong style="color: #dc2626;">"questa"</strong> → <strong style="color: #16a34a;">"cuesta"</strong> (error: 'q' por 'c')

<strong>Los errores son:</strong>
• "cegadora" → "cegadora" (correcto)
• "provenía" → "provenía" (correcto) 
• "automóbiles" → "automóviles" (se escribe con 'v')
• "permitía" → "permitía" (correcto)
• "questa" → "cuesta" (se escribe con 'c')

Total: 5 errores según la explicación de la imagen.
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

    console.log('✅ Pregunta Ortografía 07 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia07()