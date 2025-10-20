import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta56() {
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
      question_text: 'Marque la opción que contiene un error de tilde diacrítica.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'diacritical_accent_error',
        evaluation_description: 'Capacidad de identificar errores de tilde diacrítica en palabras'
      },
      option_a: 'Dé, más, sólamente',
      option_b: 'Sé, tú, mí', 
      option_c: 'Si, como, cuando',
      option_d: 'Té, aún, cuál',
      correct_option: 0, // A = sólamente es incorrecto
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Dé, más, sólamente</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">✗ A) Dé, más, sólamente</strong> - Contiene error:
• Dé (del verbo dar) ✓
• Más (cantidad, contrario de menos) ✓
• <strong>Sólamente</strong> ❌ (debería ser "solamente" sin tilde)

<strong style="color: #16a34a;">B) Sé, tú, mí</strong> - Todas correctas:
• Sé (del verbo saber o ser) ✓
• Tú (pronombre personal) ✓
• Mí (pronombre con preposición) ✓

<strong style="color: #16a34a;">C) Si, como, cuando</strong> - Todas correctas:
• Si (condicional, sin tilde) ✓
• Como (manera, sin tilde) ✓
• Cuando (tiempo, sin tilde) ✓

<strong style="color: #16a34a;">D) Té, aún, cuál</strong> - Todas correctas:
• Té (infusión) ✓
• Aún (todavía) ✓
• Cuál (interrogativo) ✓

<strong>El error está en "sólamente"</strong> - "solamente" es un adverbio que no lleva tilde diacrítica.
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

    console.log('✅ Pregunta 56 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta56()