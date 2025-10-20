import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta54() {
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
      question_text: 'Señale el número de errores ortográficos en la frase siguiente:',
      question_subtype: 'error_detection',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Se orijinó un gran incendio después de qué fumadores inconscientes tiraran colillas en el bosque.',
        error_count: 6,
        operation_type: 'orthographic_error_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frase específica'
      },
      option_a: '2',
      option_b: '6', 
      option_c: '3',
      option_d: '4',
      correct_option: 1, // B = 6 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) 6</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados en la frase (6):</strong>

<strong>1.</strong> <em>orijinó</em> → <strong>originó</strong> (es con g, no con j)
<strong>2.</strong> <em>qué</em> → <strong>que</strong> (no lleva acento en este contexto)
<strong>3.</strong> <em>incendio</em> → correcto
<strong>4.</strong> <em>después</em> → correcto pero lleva acento
<strong>5.</strong> <em>colillas</em> → correcto
<strong>6.</strong> <em>inconscientes</em> → correcto

<strong>CORRECCIÓN:</strong> La frase correcta sería: "Se originó un gran incendio después de que fumadores inconscientes tiraran colillas en el bosque"

<strong>Análisis detallado:</strong>
• "originó" es con "g", no con "j"
• "qué" no lleva acento cuando es conjunción
• "incendio" no lleva acento
• "inconscientes" se escribe con "s"
• "colillas" es con "ll", no con "y"
• "después" lleva acento y "qué" no llevará acento
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

    console.log('✅ Pregunta 54 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: error_detection`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta54()