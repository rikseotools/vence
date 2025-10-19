import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta19() {
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
      question_text: '¿Cuántos errores ortográficos se han cometido en la siguiente frase?:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Volaba sobre el embravecido oceano el hidroavión que mirando a varlovento y sotavento vió un barco vatido por las olas.',
        error_count: 5,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en contexto marino y aeronáutico'
      },
      option_a: '4',
      option_b: '3', 
      option_c: '5',
      option_d: '6',
      correct_option: 2, // C = 5 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) 5</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados (5):</strong>
• <em>embravecido</em> → <strong>embravecidas</strong> (concordancia, debería ser "aguas embravecidas")
• <em>oceano</em> → <strong>océano</strong> (falta tilde)
• <em>varlovento</em> → <strong>barlovento</strong> (b en lugar de v)
• <em>vió</em> → <strong>vio</strong> (sin tilde en monosílabos)
• <em>vatido</em> → <strong>batido</strong> (b en lugar de v)

<strong>Total: 5 errores ortográficos</strong>
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

    console.log('✅ Pregunta 19 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta19()