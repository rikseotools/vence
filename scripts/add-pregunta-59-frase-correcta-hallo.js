import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta59() {
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
      question_text: 'Selecciona la frase que está escrita correctamente.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_sentence_selection',
        evaluation_description: 'Capacidad de seleccionar la frase con escritura correcta'
      },
      option_a: 'La víscera dañada fueron extirpadas por el cirujano.',
      option_b: 'Si hubiera estudiado mas, hubiera aprobado el examen.', 
      option_c: 'Todos los alumnos aprobaron menos Juan, que haya suspendido.',
      option_d: 'La policía halló al sospechoso escondido en un cobertizo.',
      correct_option: 3, // D = halló está correcta
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) La policía halló al sospechoso escondido en un cobertizo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Error:</strong> "la víscera dañada fueron" → concordancia incorrecta, debería ser "las vísceras dañadas fueron" o "la víscera dañada fue"

<strong style="color: #dc2626;">B) Error:</strong> "mas" → <strong>más</strong> (lleva tilde cuando significa "cantidad")

<strong style="color: #dc2626;">C) Error:</strong> "menos Juan" → <strong>excepto Juan</strong> y "que haya" → <strong>que ha</strong> (tiempo verbal incorrecto)

<strong style="color: #16a34a;">✓ D) Correcta:</strong> "halló" (encontrar) está perfectamente escrita y toda la frase es correcta.

<strong>EXPLICACIÓN:</strong>
• Correcta: "halló" viene de "hallar" (encontrar), y la frase está perfectamente escrita.
• Incorrecta: la palabra víscera lleva tilde, sí, pero el error aquí está en el contexto, en plural debe escribirse "las vísceras dañadas". También existiría la forma de ponerlo en singular pero sería "la víscera dañada fue extirpada por el cirujano".
• Incorrecta: la repetición de "hubiera" es un error de estilo; la forma recomendada es: "Si hubiera estudiado más, habría aprobado".
• Incorrecta: "Haya" está mal usada, debería ser haya solo en subjuntivo correcto, pero aquí corresponde ha (del verbo haber): "que ha suspendido".
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

    console.log('✅ Pregunta 59 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta59()