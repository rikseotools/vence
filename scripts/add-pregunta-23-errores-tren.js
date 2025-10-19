import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta23() {
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
      question_text: 'Señale el número de errores ortográficos existentes en la siguiente frase:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Un tren es un vehículo conpuesto por bagones, remolcados por una máquina, culla energuía se basa abitualmente en la electricidad o el carvón.',
        error_count: 7,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en texto técnico'
      },
      option_a: '7',
      option_b: '10', 
      option_c: '9',
      option_d: '11',
      correct_option: 0, // A = 7 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) 7</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en orden de aparición (7):</strong>

<strong>1.</strong> <em>conpuesto</em> → <strong>compuesto</strong> (mp en lugar de np)<br>
<strong>2.</strong> <em>bagones</em> → <strong>vagones</strong> (v en lugar de b)<br>
<strong>3.</strong> <em>culla</em> → <strong>cuya</strong> (ll en lugar de y)<br>
<strong>4.</strong> <em>energuía</em> → <strong>energía</strong> (sin u antes de í)<br>
<strong>5.</strong> <em>abitualmente</em> → <strong>habitualmente</strong> (falta h inicial)<br>
<strong>6.</strong> <em>carvón</em> → <strong>carbón</strong> (b en lugar de v)<br>
<strong>7.</strong> Falta <strong>punto final</strong> al terminar la oración

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

    console.log('✅ Pregunta 23 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta23()