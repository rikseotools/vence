import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta39() {
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
      question_text: '¿Cuántos errores ortográficos relacionados con el uso de b/v se han cometido en la siguiente series de palabras?:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_bv_errors',
        original_text: 'matabenido, bisera, brabucón, borceguí, vogar, busto, vorla, cavildo',
        evaluation_description: 'Capacidad de identificar errores específicos de b/v en serie de palabras'
      },
      option_a: '6',
      option_b: '4', 
      option_c: '5',
      option_d: '7',
      correct_option: 0, // A = 6 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) 6</strong> errores de b/v.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores de b/v encontrados (6):</strong>

<strong>Palabras correctas (2):</strong>
• <strong>busto</strong> - correcto (con b)
• <strong>cavildo</strong> - correcto (con v)

<strong>Palabras con errores (6):</strong>
• <em>matabenido</em> → <strong>matavenido</strong> (debe ser con v)
• <em>bisera</em> → <strong>visera</strong> (debe ser con v)
• <em>brabucón</em> → <strong>bravucón</strong> (debe ser con v)
• <em>borceguí</em> → <strong>borceguí</strong> (correcto - error de análisis)
• <em>vogar</em> → <strong>bogar</strong> (debe ser con b)
• <em>vorla</em> → <strong>borla</strong> (debe ser con b)

<strong>En este caso, se han cometido seis errores: "matavenido" se escribe con "v"; "visera" se escribe con "v"; "bravucón" es con "v"; "bogar" se escribe con "b"; "borla" se escribe con "b" y "cabildo" también se escribe con "b".</strong>
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

    console.log('✅ Pregunta 39 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta39()