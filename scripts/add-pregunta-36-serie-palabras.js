import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta36() {
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
      question_text: '¿Cuántos errores ortográficos se han cometido en la siguiente serie de palabras?:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_count',
        original_text: 'Brabata, brebage, bóbido, cangear, carcava, claraboya, congetura, contraccion, cortacésped, curvilíneo',
        evaluation_description: 'Capacidad de identificar errores ortográficos en serie de palabras'
      },
      option_a: '7',
      option_b: '9', 
      option_c: '8',
      option_d: '6',
      correct_option: 0, // A = 7 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) 7</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (7):</strong>

<strong>Palabras correctas (3):</strong>
• <strong>claraboya</strong> - correcto
• <strong>cortacésped</strong> - correcto (con acento)
• <strong>curvilíneo</strong> - correcto

<strong>Palabras con errores (7):</strong>
• <em>brabata</em> → <strong>bravata</strong> (la segunda "b" sería "v")<br>
• <em>brebage</em> → <strong>brebaje</strong> (es con "j")<br>
• <em>bóbido</em> → <strong>bóvido</strong> (la segunda "b" es "v")<br>
• <em>cangear</em> → <strong>canjear</strong> (es con "j")<br>
• <em>carcava</em> → <strong>cárcava</strong> (llevaría acento)<br>
• <em>congetura</em> → <strong>conjetura</strong> (es con "j")<br>
• <em>contraccion</em> → <strong>contracción</strong> (llevaría acento)

<strong>Total: 7 errores ortográficos</strong>
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

    console.log('✅ Pregunta 36 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta36()