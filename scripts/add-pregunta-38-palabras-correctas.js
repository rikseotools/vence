import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta38() {
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
      question_text: 'Indique, la cantidad de palabras que están escritas correctamente, desde el punto de vista ortográfico:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_words_count',
        original_text: 'cuadriga, decalitro, orfelinato, hectógramo, intérvalo, heroína, geráneo, sútil, cáustico, mililitro',
        evaluation_description: 'Capacidad de identificar palabras escritas correctamente en serie'
      },
      option_a: '3',
      option_b: '5', 
      option_c: '6',
      option_d: '4',
      correct_option: 1, // B = 5 palabras correctas
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 5</strong> palabras correctas.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #16a34a;">Palabras correctas (5):</strong>
• <strong>cuadriga</strong> - correcto
• <strong>decalitro</strong> - correcto
• <strong>hectógramo</strong> - correcto (con acento)
• <strong>cáustico</strong> - correcto (con acento)
• <strong>mililitro</strong> - correcto

<strong style="color: #dc2626;">Palabras con errores (5):</strong>
• <em>orfelinato</em> → <strong>orfanato</strong> (forma correcta)
• <em>intérvalo</em> → <strong>intervalo</strong> (sin acento)
• <em>heroína</em> → <strong>heroína</strong> (correcto con acento - error de análisis)
• <em>geráneo</em> → <strong>geranio</strong> (sin acento, terminación -io)
• <em>sútil</em> → <strong>sutil</strong> (sin acento)

<strong>En el siguiente ejercicio habría cinco palabras correctamente escritas: cuadriga, decalitro, orfelinato, cáustico y mililitro.</strong>
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

    console.log('✅ Pregunta 38 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta38()