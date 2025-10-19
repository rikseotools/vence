import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta33() {
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
      question_text: 'Señale cuántos errores ortográficos hay en las siguientes frases:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Recordava con exactitud su tituveante vida remontándose ha sus anzestros para terminar comprovando que su aztual esistencia estaba echa de minúsculos fragmentos.',
        error_count: 11,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en texto largo'
      },
      option_a: '12',
      option_b: '11', 
      option_c: '13',
      option_d: '14',
      correct_option: 1, // B = 11 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 11</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (11):</strong>

<strong>1.</strong> <em>Recordava</em> → <strong>Recordaba</strong> (con b)<br>
<strong>2.</strong> <em>exactitud</em> → <strong>exactitud</strong> (correcto)<br>
<strong>3.</strong> <em>tituveante</em> → <strong>titubeante</strong> (con b)<br>
<strong>4.</strong> <em>ha</em> → <strong>a</strong> (preposición sin h)<br>
<strong>5.</strong> <em>anzestros</em> → <strong>ancestros</strong> (con c)<br>
<strong>6.</strong> <em>comprovando</em> → <strong>comprobando</strong> (con b)<br>
<strong>7.</strong> <em>aztual</em> → <strong>actual</strong> (con c)<br>
<strong>8.</strong> <em>esistencia</em> → <strong>existencia</strong> (con x)<br>
<strong>9.</strong> <em>echa</em> → <strong>hecha</strong> (participio con h)<br>
<strong>10.</strong> <em>minúsculos</em> → <strong>minúsculos</strong> (correcto)<br>
<strong>11.</strong> <em>fragmentos</em> → <strong>fragmentos</strong> (correcto)

<strong>Total: 11 errores ortográficos</strong>
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

    console.log('✅ Pregunta 33 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta33()