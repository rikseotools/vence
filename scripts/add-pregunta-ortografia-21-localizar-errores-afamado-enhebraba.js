import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia21() {
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
      question_text: 'Localice los errores ortográficos que se han cometido en la siguiente frase y marque la opción de respuesta que indique dichos errores: "El afamado modisto enebraba la aguja para hacer un iIván en el chaqué y la levita del invitado a la ceremonia".',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_count',
        evaluation_description: 'Localizar errores ortográficos en frase'
      },
      option_a: 'Ningún error',
      option_b: 'Tres errores',
      option_c: 'Un error',
      option_d: 'Dos errores',
      correct_option: 3, // D = Dos errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Dos errores</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Errores encontrados en la frase:</strong>

1. <strong style="color: #dc2626;">"enebraba"</strong> → <strong style="color: #16a34a;">"enhebraba"</strong> (falta la 'h' intercalada)

2. <strong style="color: #dc2626;">"iIván"</strong> → <strong style="color: #16a34a;">"hilván"</strong> (se escribe con 'h' inicial)

<strong>Palabras que están correctas:</strong>
• "afamado" - correcto
• "modisto" - correcto  
• "aguja" - correcto
• "chaqué" - correcto
• "levita" - correcto

<strong>Explicación de los errores:</strong>
• "enhebraba" - del verbo enhebrar (pasar el hilo por el ojo de la aguja)
• "hilván" - costura provisional con puntadas largas

<strong>Frase corregida:</strong> "El afamado modisto enhebraba la aguja para hacer un hilván en el chaqué y la levita del invitado a la ceremonia"
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

    console.log('✅ Pregunta Ortografía 21 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia21()