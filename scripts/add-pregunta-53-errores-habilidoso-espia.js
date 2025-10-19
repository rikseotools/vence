import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta53() {
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
      question_text: 'Localice los errores ortográficos cometidos en la siguiente frase y marque la opción de respuesta que indique dichos errores:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Un habilidoso expía descifró el geroglífico inventado por un grupo de trileros',
        error_count: 2,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de localizar errores ortográficos en frase específica'
      },
      option_a: 'Dos errores',
      option_b: 'Ningún error', 
      option_c: 'Tres errores',
      option_d: 'Un error',
      correct_option: 0, // A = Dos errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Dos errores</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en la frase (2):</strong>

<strong>1.</strong> <em>expía</em> → <strong>espía</strong> (se escribe con s, no con x)
<strong>2.</strong> <em>geroglífico</em> → <strong>jeroglífico</strong> (se escribe con j, no con g)

<strong>Palabras correctas:</strong> Un, habilidoso, descifró, el, inventado, por, un, grupo, de, trileros

<strong>SOLUCIÓN:</strong> La frase correcta sería: "Un habilidoso espía descifró el jeroglífico inventado por un grupo de trileros"

<strong>Análisis de errores:</strong>
• "expía" → "espía" (persona que observa secretamente)
• "geroglífico" → "jeroglífico" (escritura de signos y figuras)
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

    console.log('✅ Pregunta 53 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta53()