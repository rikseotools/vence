// scripts/add-content-scope-questions.js
// Script para añadir las 10 preguntas de conceptos generales como topic_scope

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Función helper para convertir letra a número
function letterToNumber(letter) {
  const map = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
  return map[letter.toUpperCase()];
}

// Las 10 preguntas de conceptos generales que me diste
const questionsBatch = [
  {
    question_text: "¿Cuál es uno de los principios de actuación de las Administraciones Públicas según la Ley 39/2015?",
    option_a: "Discrecionalidad absoluta",
    option_b: "Transparencia y participación",
    option_c: "Secreto administrativo",
    option_d: "Autonomía total",
    correct_option: "B",
    explanation: "La Ley 39/2015 establece entre sus principios la transparencia y participación ciudadana como pilares fundamentales de la actuación administrativa.",
    law_short_name: "Ley 39/2015",
    article_number: "3"
  },
  {
    question_text: "El derecho a conocer el estado de tramitación de los procedimientos está regulado en:",
    option_a: "Artículo 13 de la Ley 39/2015",
    option_b: "Artículo 15 de la Ley 39/2015", 
    option_c: "Artículo 53 de la Ley 39/2015",
    option_d: "No está regulado específicamente",
    correct_option: "A",
    explanation: "El artículo 13 de la Ley 39/2015 establece el derecho de los ciudadanos a conocer el estado de tramitación de los procedimientos en los que tengan condición de interesados.",
    law_short_name: "Ley 39/2015",
    article_number: "13"
  },
  {
    question_text: "¿Cuál es la capacidad de obrar general ante las Administraciones Públicas?",
    option_a: "A partir de los 16 años",
    option_b: "A partir de los 18 años para todos los actos",
    option_c: "Los menores de edad para actos que les afecten directamente",
    option_d: "Solo para mayores de edad con plena capacidad",
    correct_option: "C",
    explanation: "La Ley 39/2015 reconoce capacidad de obrar a los menores de edad para actos y procedimientos administrativos que les afecten directamente.",
    law_short_name: "Ley 39/2015",
    article_number: "3"
  },
  {
    question_text: "Los principios informadores del procedimiento administrativo incluyen:",
    option_a: "Solo el principio de legalidad",
    option_b: "Contradicción, audiencia y publicidad",
    option_c: "Únicamente la eficiencia",
    option_d: "Solo la celeridad",
    correct_option: "B",
    explanation: "Los principios de contradicción, audiencia y publicidad son fundamentales en el procedimiento administrativo común.",
    law_short_name: "Ley 39/2015",
    article_number: "3"
  },
  {
    question_text: "¿Qué artículo de la Constitución establece el principio de eficacia de la Administración?",
    option_a: "Artículo 9.3 CE",
    option_b: "Artículo 103.1 CE",
    option_c: "Artículo 106 CE",
    option_d: "Artículo 105 CE",
    correct_option: "B",
    explanation: "El artículo 103.1 de la Constitución establece que la Administración Pública sirve con objetividad los intereses generales y actúa con eficacia.",
    law_short_name: "CE",
    article_number: "103"
  },
  {
    question_text: "El control judicial de la actividad administrativa está regulado en el artículo:",
    option_a: "103 CE",
    option_b: "105 CE", 
    option_c: "106 CE",
    option_d: "107 CE",
    correct_option: "C",
    explanation: "El artículo 106 de la Constitución establece el control judicial de la potestad reglamentaria y la legalidad de la actuación administrativa.",
    law_short_name: "CE",
    article_number: "106"
  },
  {
    question_text: "¿En qué artículo de la Ley 40/2015 se regula la organización administrativa?",
    option_a: "Artículo 1",
    option_b: "Artículo 2",
    option_c: "Artículo 3",
    option_d: "Artículo 4",
    correct_option: "A",
    explanation: "El artículo 1 de la Ley 40/2015 establece los principios generales de organización y funcionamiento del sector público.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "Los principios de buena administración se encuentran regulados en:",
    option_a: "Ley 39/2015, artículo 1",
    option_b: "Ley 40/2015, artículo 3", 
    option_c: "Ley 39/2015, artículo 3",
    option_d: "Constitución, artículo 103",
    correct_option: "C",
    explanation: "El artículo 3 de la Ley 39/2015 establece los principios de buena administración que deben regir la actuación administrativa.",
    law_short_name: "Ley 39/2015",
    article_number: "3"
  },
  {
    question_text: "¿Qué derechos tienen los interesados en el procedimiento administrativo según el artículo 13 de la Ley 39/2015?",
    option_a: "Solo derecho de audiencia",
    option_b: "Conocer estado de tramitación y obtener copias",
    option_c: "Únicamente a ser notificados",
    option_d: "Solo derecho de recurso",
    correct_option: "B",
    explanation: "El artículo 13 reconoce múltiples derechos, incluyendo conocer el estado de tramitación y obtener copias de documentos.",
    law_short_name: "Ley 39/2015",
    article_number: "13"
  },
  {
    question_text: "El concepto de interesado en el procedimiento administrativo se define en:",
    option_a: "Artículo 3 de la Ley 39/2015",
    option_b: "Artículo 4 de la Ley 39/2015",
    option_c: "Artículo 5 de la Ley 39/2015",
    option_d: "Artículo 13 de la Ley 39/2015",
    correct_option: "B",
    explanation: "El artículo 4 de la Ley 39/2015 define quiénes tienen la consideración de interesados en el procedimiento administrativo.",
    law_short_name: "Ley 39/2015",
    article_number: "4"
  }
]

async function addQuestionsAsTopicScope() {
  console.log('🔧 AÑADIENDO 10 PREGUNTAS DE CONCEPTOS GENERALES COMO TOPIC_SCOPE\n')
  
  try {
    let addedCount = 0
    let duplicateCount = 0
    
    for (const [index, questionData] of questionsBatch.entries()) {
      console.log(`📝 Procesando pregunta ${index + 1}/10...`)
      
      // 1. Verificar si la pregunta ya existe (detectar duplicados)
      const { data: existingQuestion } = await supabase
        .from('questions')
        .select('id')
        .ilike('question_text', questionData.question_text.substring(0, 50) + '%')
        .single()
      
      if (existingQuestion) {
        console.log(`   ⚠️ Pregunta duplicada, saltando...`)
        duplicateCount++
        continue
      }
      
      // 2. Obtener la ley
      const { data: law } = await supabase
        .from('laws')
        .select('id')
        .eq('short_name', questionData.law_short_name)
        .single()
      
      if (!law) {
        console.log(`   ❌ Ley ${questionData.law_short_name} no encontrada`)
        continue
      }
      
      // 3. Obtener el artículo
      const { data: article } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', law.id)
        .eq('article_number', questionData.article_number)
        .single()
      
      if (!article) {
        console.log(`   ❌ Artículo ${questionData.article_number} de ${questionData.law_short_name} no encontrado`)
        continue
      }
      
      // 4. Insertar la pregunta
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          question_text: questionData.question_text,
          option_a: questionData.option_a,
          option_b: questionData.option_b,
          option_c: questionData.option_c,
          option_d: questionData.option_d,
          correct_option: letterToNumber(questionData.correct_option),
          explanation: questionData.explanation,
          primary_article_id: article.id,
          is_active: true,
          difficulty: 'medium',
          is_official_exam: false,
          exam_source: 'content_scope_batch',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()
      
      if (questionError) {
        console.log(`   ❌ Error insertando pregunta: ${questionError.message}`)
        continue
      }
      
      console.log(`   ✅ Pregunta añadida con ID: ${newQuestion.id}`)
      addedCount++
    }
    
    console.log('\n📊 RESUMEN:')
    console.log(`✅ Preguntas añadidas: ${addedCount}`)
    console.log(`⚠️ Preguntas duplicadas (ignoradas): ${duplicateCount}`)
    console.log(`📝 Total procesadas: ${questionsBatch.length}`)
    
    if (addedCount > 0) {
      console.log('\n🎯 Las preguntas se han añadido exitosamente al content_scope!')
      console.log('🔗 Ahora aparecerán en /test-personalizado?seccion=conceptos-generales')
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message)
  }
}

// Ejecutar el script
addQuestionsAsTopicScope()