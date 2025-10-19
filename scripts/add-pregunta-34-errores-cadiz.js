import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta34() {
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
        original_text: 'Las celebres Cortes de Cadiz, que hicieron hincapie en aunar eterogéneas opiniones, se reunieron en 1810.',
        error_count: 4,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frase histórica'
      },
      option_a: '3',
      option_b: '2', 
      option_c: '4',
      option_d: '5',
      correct_option: 2, // C = 4 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) 4</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (4):</strong>

<strong>1.</strong> <em>celebres</em> → <strong>célebres</strong> (llevaría acento)<br>
<strong>2.</strong> <em>Cadiz</em> → <strong>Cádiz</strong> (llevaría acento)<br>
<strong>3.</strong> <em>hincapie</em> → <strong>hincapié</strong> (llevaría acento)<br>
<strong>4.</strong> <em>eterogéneas</em> → <strong>heterogéneas</strong> (con h inicial)

<strong>Total de errores: 4</strong>
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

    console.log('✅ Pregunta 34 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta34()