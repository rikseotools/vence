import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia20() {
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
      question_text: 'Su tarea consiste en localizar los errores ortográficos cometidos en la siguiente frase y marcar la opción de respuesta que indique dichos errores: "La explosión en la cantera arrojo güijarros, graba y piedras a lo largo de todo el camino".',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_count',
        evaluation_description: 'Localizar errores ortográficos en frase y contar'
      },
      option_a: 'Tres errores',
      option_b: 'Ningún error',
      option_c: 'Un error',
      option_d: 'Dos errores',
      correct_option: 0, // A = Tres errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Tres errores</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Errores encontrados en la frase:</strong>

1. <strong style="color: #dc2626;">"arrojo"</strong> → <strong style="color: #16a34a;">"arrojó"</strong> (falta tilde, es palabra aguda)

2. <strong style="color: #dc2626;">"güijarros"</strong> → <strong style="color: #16a34a;">"guijarros"</strong> (no lleva diéresis)

3. <strong style="color: #dc2626;">"graba"</strong> → <strong style="color: #16a34a;">"grava"</strong> (se escribe con 'v')

<strong>Explicación de los errores:</strong>
• "arrojó" lleva tilde por ser palabra aguda terminada en vocal
• "guijarros" no lleva diéresis porque la 'u' no suena
• "grava" se escribe con 'v' (conjunto de piedras)

<strong>Frase corregida:</strong> "La explosión en la cantera arrojó guijarros, grava y piedras a lo largo de todo el camino"
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

    console.log('✅ Pregunta Ortografía 20 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia20()