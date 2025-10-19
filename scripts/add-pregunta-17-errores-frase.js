import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta17() {
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
      question_text: 'Señale cuántos errores ortográficos hay en las siguientes frases:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Mientras recorría el trayecto que le conducía asta su hogar oía el lebe rumor de sus bisceras y pensava en los malentendidos que havían tenido lugar durante la jornada.',
        error_count: 13,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar y contar errores ortográficos en textos'
      },
      option_a: '16',
      option_b: '13', 
      option_c: '14',
      option_d: '15',
      correct_option: 1, // B = 13 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 13</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados (13):</strong>
• <em>asta</em> → <strong>hasta</strong> (h inicial)
• <em>lebe</em> → <strong>leve</strong> (v en lugar de b)
• <em>bisceras</em> → <strong>vísceras</strong> (v y tilde)
• <em>pensava</em> → <strong>pensaba</strong> (b en lugar de v)
• <em>havían</em> → <strong>habían</strong> (b en lugar de v)

<strong>Total: 13 errores de ortografía</strong>
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

    console.log('✅ Pregunta 17 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta17()