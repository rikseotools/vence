import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta67() {
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
      question_text: 'Señale la frase que no contenga faltas de ortografía.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'no_spelling_errors',
        evaluation_description: 'Capacidad de identificar la frase sin faltas de ortografía'
      },
      option_a: 'El médico le dijo que debía tomar las pastillas cada ocho horas.',
      option_b: 'El médico le dijo que devia tomar las pastillas cada ocho oras.', 
      option_c: 'El medico le dijo que debía tomar las pastillas cada ocho horas.',
      option_d: 'El médico le dijo que debía tomar las pastillas cada ocho oras.',
      correct_option: 0, // A = todas las palabras correctas
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) El médico le dijo que debía tomar las pastillas cada ocho horas</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Correcta:</strong> "médico" (con tilde), "debía" (con tilde), "horas" (con h) - todo correcto

<strong style="color: #dc2626;">B) Errores:</strong> "devia" → <strong>debía</strong> (falta tilde) y "oras" → <strong>horas</strong> (falta h)

<strong style="color: #dc2626;">C) Error:</strong> "medico" → <strong>médico</strong> (falta la tilde)

<strong style="color: #dc2626;">D) Error:</strong> "oras" → <strong>horas</strong> (falta la h inicial)

<strong>Reglas aplicadas:</strong>
• "Médico" lleva tilde por ser palabra esdrújula
• "Debía" lleva tilde por ser palabra llana terminada en vocal
• "Horas" se escribe con h inicial
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

    console.log('✅ Pregunta 67 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta67()