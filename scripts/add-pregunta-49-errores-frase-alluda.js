import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta49() {
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
      question_text: 'Señale los errores ortográficos en la siguiente frase:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'necesita alluda para realizar barias actibidades basicas',
        error_count: 6,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frase específica'
      },
      option_a: '5',
      option_b: '4', 
      option_c: '6',
      option_d: '3',
      correct_option: 2, // C = 6 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) 6</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en la frase (6):</strong>

<strong>1.</strong> <em>alluda</em> → <strong>ayuda</strong> (se escribe con y, no con ll)<br>
<strong>2.</strong> <em>barias</em> → <strong>varias</strong> (se escribe con v, no con b)<br>
<strong>3.</strong> <em>actibidades</em> → <strong>actividades</strong> (lleva v, no b)<br>
<strong>4.</strong> <em>basicas</em> → <strong>básicas</strong> (lleva tilde por ser esdrújula)<br>

<strong>Palabras correctas:</strong> necesita, para, realizar

<strong>SOLUCIÓN:</strong> La frase correcta sería: "necesita ayuda para realizar varias actividades básicas"
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

    console.log('✅ Pregunta 49 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta49()