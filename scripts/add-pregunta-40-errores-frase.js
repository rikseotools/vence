import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta40() {
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
      question_text: 'En la siguiente frase se han cometido errores ortográficos, indique cuántos son:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'El eximio jefe hizó incapié en el cunplimiento de las ordenes dictadas por el superior.',
        error_count: 5,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frase específica'
      },
      option_a: '5',
      option_b: '6', 
      option_c: '4',
      option_d: '3',
      correct_option: 0, // A = 5 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) 5</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (5):</strong>

<strong>1.</strong> <em>eximio</em> → <strong>eximio</strong> (correcto - no es error)<br>
<strong>2.</strong> <em>hizó</em> → <strong>hizo</strong> (no lleva acento)<br>
<strong>3.</strong> <em>incapié</em> → <strong>hincapié</strong> (es con h)<br>
<strong>4.</strong> <em>cunplimiento</em> → <strong>cumplimiento</strong> (lleva m antes de p)<br>
<strong>5.</strong> <em>ordenes</em> → <strong>órdenes</strong> (llevaría acento)

<strong>La respuesta correcta sería a) cinco errores que serían: "eximio" no lleva acento; "hizo" no lleva acento, "hincapié" es con "h", "cumplimiento" lleva "m" antes de "p" y "órdenes" llevaría acento.</strong>
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

    console.log('✅ Pregunta 40 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta40()