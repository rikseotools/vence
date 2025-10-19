import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta32() {
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
      question_text: 'Si las letras pares del alfabeto estuvieran tachadas, ¿cuál sería la duodécima letra tachada?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'logical_reasoning',
        evaluation_description: 'Capacidad de razonamiento lógico con secuencias alfabéticas'
      },
      option_a: 'V',
      option_b: 'T', 
      option_c: 'U',
      option_d: 'W',
      correct_option: 3, // D = W
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) W</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>SOLUCIÓN:</strong>

<strong>Alfabeto completo:</strong><br>
A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z

<strong>Letras en posiciones pares (tachadas):</strong><br>
B, D, F, H, J, L, N, O, Q, S, U, W, Y

<strong>Contando las letras tachadas:</strong><br>
1ª: B, 2ª: D, 3ª: F, 4ª: H, 5ª: J, 6ª: L, 7ª: N, 8ª: O, 9ª: Q, 10ª: S, 11ª: U, <strong>12ª: W</strong>

<strong>La duodécima letra tachada es W.</strong>
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

    console.log('✅ Pregunta 32 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta32()