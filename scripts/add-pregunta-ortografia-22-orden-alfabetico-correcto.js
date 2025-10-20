import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia22() {
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
      question_text: '¿Qué serie indica el orden alfabético correcto de las siguientes palabras?',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'word_list_analysis',
        question_type: 'alphabetical_order',
        evaluation_description: 'Determinar el orden alfabético correcto'
      },
      option_a: 'Pacto, pareja, patrimonio, paleontólogo, partido',
      option_b: 'Paleontólogo, pacto, partido, pareja, patrimonio',
      option_c: 'Patrimonio, partido, pareja, pacto, paleontólogo',
      option_d: 'Pacto, paleontólogo, pareja, partido, patrimonio',
      correct_option: 3, // D
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Pacto, paleontólogo, pareja, partido, patrimonio</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Orden alfabético correcto:</strong>

1. **Pacto** (pac...)
2. **Paleontólogo** (pal...)  
3. **Pareja** (par-e...)
4. **Partido** (par-t...)
5. **Patrimonio** (pat...)

<strong>Explicación del ordenamiento:</strong>
• Todas empiezan por "PA", así que vamos a la tercera letra
• "Pacto" (C) va antes que "Paleontólogo" (L)
• "Paleontólogo" (L) va antes que "Pareja" (R)
• Entre "Pareja" y "Partido", ambas empiezan por "PAR", pero "E" va antes que "T"
• "Patrimonio" (T) va al final

<strong>Regla:</strong> Se ordenan letra por letra de izquierda a derecha hasta encontrar la primera diferencia.
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

    console.log('✅ Pregunta Ortografía 22 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia22()