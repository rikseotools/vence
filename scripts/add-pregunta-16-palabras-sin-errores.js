import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta16() {
  try {
    // Buscar la categoría y sección de ortografía
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
      question_text: 'Marque la cantidad de palabras en las que no se ha cometido un error ortográfico: Cubil, crujir, chantaje, churumbel, demagogía, desahuciar, deshojar, devanéo, discóbolo, dúo.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar palabras sin errores ortográficos'
      },
      option_a: '7',
      option_b: '6', 
      option_c: '5',
      option_d: '4',
      correct_option: 0, // A = 7 palabras correctas
      explanation: `La respuesta correcta es <strong>A) 7</strong> palabras sin errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #16a34a;">✓ Palabras CORRECTAS (7):</strong>
• <strong>Cubil</strong> - correcto
• <strong>Crujir</strong> - correcto  
• <strong>Chantaje</strong> - correcto
• <strong>Desahuciar</strong> - correcto
• <strong>Deshojar</strong> - correcto
• <strong>Discóbolo</strong> - correcto
• <strong>Dúo</strong> - correcto

<strong style="color: #dc2626;">✗ Palabras con ERRORES (3):</strong>
• <em>Churumbel</em> → debería ser <strong>churumbel</strong> (sin "m" antes de "b")
• <em>Demagogía</em> → debería ser <strong>demagogia</strong> (sin tilde)
• <em>Devanéo</em> → debería ser <strong>devaneo</strong> (sin tilde)
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

    console.log('✅ Pregunta 16 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta16()