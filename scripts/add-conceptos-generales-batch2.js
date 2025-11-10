// scripts/add-conceptos-generales-batch2.js
// Segundo lote de preguntas para conceptos generales procedimiento administrativo

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function letterToNumber(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()];
}

// Preguntas extraídas de las imágenes (excluyendo Ley 1/2015 que no existe)
const questionsBatch = [
  {
    question_text: "La Ley 39/2015 del Procedimiento Administrativo Común de las Administraciones Públicas no regula:",
    option_a: "El procedimiento de reclamación de responsabilidad de las Administraciones Públicas.",
    option_b: "El procedimiento administrativo sancionador.",
    option_c: "El procedimiento de expropiación forzosa.",
    option_d: "El procedimiento administrativo común a todas las Administraciones Públicas.",
    correct_option: "C",
    explanation: "La Ley 39/2015 regula el procedimiento administrativo común, el sancionador y el de responsabilidad patrimonial, pero no el procedimiento de expropiación forzosa, que se rige por su normativa específica.",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  },
  {
    question_text: "¿Qué establece el artículo 3 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas respecto a la capacidad de obrar de los grupos de afectados?",
    option_a: "No tendrán capacidad de obrar en el procedimiento administrativo",
    option_b: "Tendrán capacidad de obrar cuando una disposición de carácter general así lo declare expresamente",
    option_c: "Tendrán capacidad de obrar cuando un reglamento así lo declare expresamente",
    option_d: "Tendrán capacidad de obrar cuando la ley así lo declare expresamente",
    correct_option: "D",
    explanation: "El artículo 3 de la Ley 39/2015 establece que los grupos de afectados tendrán capacidad de obrar cuando la ley así lo declare expresamente.",
    law_short_name: "Ley 39/2015",
    article_number: "3"
  },
  {
    question_text: "La Ley 40/2015 de Régimen Jurídico del Sector Público establece y regula:",
    option_a: "El procedimiento administrativo común a todas las Administraciones Públicas.",
    option_b: "Las bases del régimen jurídico de las Administraciones Públicas.",
    option_c: "Los requisitos de validez y eficacia de los actos administrativos.",
    option_d: "Los principios a los que se ha de ajustar el ejercicio de la iniciativa legislativa y la potestad reglamentaria.",
    correct_option: "B",
    explanation: "La Ley 40/2015 establece y regula las bases del régimen jurídico de las Administraciones Públicas, según su artículo 1.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, el Sector Público comprende:",
    option_a: "Las Administraciones de las Comunidades Autónomas.",
    option_b: "Las Entidades que integran la Administración Local.",
    option_c: "El sector público institucional.",
    option_d: "Todas son correctas.",
    correct_option: "D",
    explanation: "Según el artículo 2 de la Ley 39/2015, el sector público comprende todas las opciones mencionadas: las Administraciones autonómicas, locales y el sector público institucional.",
    law_short_name: "Ley 39/2015",
    article_number: "2"
  },
  {
    question_text: "La Ley 39/2015 del Procedimiento Administrativo Común de las Administraciones Públicas tiene por objeto:",
    option_a: "Regular la organización y funcionamiento de la Administración General del Estado y de su sector público institucional para el desarrollo de sus actividades.",
    option_b: "Regular los principios a los que se ha de ajustar el ejercicio de la iniciativa legislativa y la potestad reglamentaria.",
    option_c: "Regular los principios del sistema de responsabilidad de las Administraciones Públicas y de la potestad sancionadora.",
    option_d: "Regular las bases del régimen jurídico de las Administraciones Públicas.",
    correct_option: "B",
    explanation: "Según el artículo 1 de la Ley 39/2015, su objeto es regular los principios del ejercicio de la iniciativa legislativa y potestad reglamentaria, entre otros aspectos.",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  },
  {
    question_text: "La fecha de entrada en vigor de la Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público data de:",
    option_a: "2 de septiembre de 2015.",
    option_b: "2 de octubre de 2016.",
    option_c: "2 de septiembre de 2016.",
    option_d: "2 de octubre de 2015.",
    correct_option: "B",
    explanation: "La Ley 40/2015 entró en vigor el 2 de octubre de 2016, con las salvedades y efectos indicados.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "De conformidad con el artículo 1 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, solo mediante ley, cuando resulte eficaz, proporcionado y necesario para la consecución de los fines propios del procedimiento, y de manera motivada, podrán incluirse:",
    option_a: "Especialidades del procedimiento referidas a los órganos competentes",
    option_b: "Formas especiales de iniciación y terminación, publicación e informes a recabar",
    option_c: "Trámites adicionales o distintos del Procedimiento Administrativo Común de las Administraciones Públicas",
    option_d: "Plazos propios del concreto procedimiento por razón de la materia",
    correct_option: "C",
    explanation: "El artículo 1 de la Ley 39/2015 establece que solo mediante ley pueden incluirse trámites adicionales o distintos del Procedimiento Administrativo Común.",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  },
  {
    question_text: "De acuerdo con el artículo 4 de la Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público, la competencia para establecer medidas que limiten el ejercicio de derechos individuales o colectivos o exijan el cumplimiento de requisitos para el desarrollo de una actividad corresponde a:",
    option_a: "Las Administraciones Públicas, dentro del ejercicio de sus competencias.",
    option_b: "Los Ministros correspondientes.",
    option_c: "Los Secretarios de Estado.",
    option_d: "El Gobierno.",
    correct_option: "A",
    explanation: "Según el artículo 4 de la Ley 40/2015, esta competencia corresponde a las Administraciones Públicas dentro del ejercicio de sus competencias.",
    law_short_name: "Ley 40/2015",
    article_number: "4"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, señale la respuesta incorrecta, el sector público institucional se integra por:",
    option_a: "Las entidades de derecho privado vinculadas o dependientes de las Administraciones Públicas.",
    option_b: "Los órganos colegiados de asistencia.",
    option_c: "Cualesquiera organismos públicos y entidades de derecho público vinculados o dependientes de las Administraciones Públicas.",
    option_d: "Las Universidades públicas.",
    correct_option: "B",
    explanation: "Los órganos colegiados de asistencia no forman parte del sector público institucional según el artículo 2 de la Ley 39/2015.",
    law_short_name: "Ley 39/2015",
    article_number: "2"
  },
  {
    question_text: "La fecha de publicación de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas fue:",
    option_a: "El 2 de septiembre de 2015.",
    option_b: "El 2 de octubre de 2016.",
    option_c: "El 2 de octubre de 2015.",
    option_d: "El 2 de septiembre de 2016.",
    correct_option: "C",
    explanation: "La Ley 39/2015 fue publicada el 2 de octubre de 2015.",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  },
  {
    question_text: "En relación con la estructura de la Ley 39/2015 de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, se denomina \"de la tramitación simplificada del procedimiento administrativo común\" al:",
    option_a: "Capítulo VI del Título IV.",
    option_b: "Capítulo II del Título IV.",
    option_c: "Capítulo IV del Título IV.",
    option_d: "Capítulo VII del Título IV.",
    correct_option: "A",
    explanation: "El Capítulo VI del Título IV de la Ley 39/2015 se denomina \"de la tramitación simplificada del procedimiento administrativo común\".",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  },
  {
    question_text: "Según la Ley 40/2015, en el ámbito de la Administración General del Estado, la delegación de competencias entre órganos de un mismo Ministerio relacionados jerárquicamente deberá ser aprobada previamente:",
    option_a: "Por los órganos ministeriales de quienes dependen los órganos delegado y delegante.",
    option_b: "Por la Subsecretaría del Departamento ministerial.",
    option_c: "Por el órgano ministerial de quien depende el órgano delegado.",
    option_d: "Por el órgano ministerial de quien depende el órgano delegante.",
    correct_option: "D",
    explanation: "Según el artículo 9 de la Ley 40/2015, la delegación debe ser aprobada por el órgano ministerial de quien depende el órgano delegante.",
    law_short_name: "Ley 40/2015",
    article_number: "9"
  },
  {
    question_text: "De conformidad con el artículo 1 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, ¿cómo podrán establecerse especialidades del procedimiento referidas a los órganos competentes?",
    option_a: "Reglamentariamente.",
    option_b: "Mediante ley ordinaria.",
    option_c: "Mediante ley orgánica.",
    option_d: "Mediante Real Decreto ley.",
    correct_option: "A",
    explanation: "Las especialidades del procedimiento referidas a los órganos competentes pueden establecerse reglamentariamente según el artículo 1 de la Ley 39/2015.",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, el sector público institucional se integra por:",
    option_a: "Cualesquiera organismos públicos y entidades de derecho público vinculados o dependientes de las Administraciones Públicas.",
    option_b: "La Administración General del Estado.",
    option_c: "Las Entidades que integran la Administración Local.",
    option_d: "Las Administraciones de las Comunidades Autónomas.",
    correct_option: "A",
    explanation: "Según el artículo 2 de la Ley 39/2015, el sector público institucional se integra por organismos públicos y entidades de derecho público vinculados o dependientes de las Administraciones Públicas.",
    law_short_name: "Ley 39/2015",
    article_number: "2"
  },
  {
    question_text: "¿Cómo se estructura la Ley 40/2015?",
    option_a: "En un Título Preliminar, 6 Títulos, 12 Disposiciones Adicionales, 2 Disposiciones Transitorias, 1 Disposición Derogatoria y 14 Disposiciones Finales.",
    option_b: "En un Título Preliminar, 4 Títulos, 22 Disposiciones Adicionales, 6 Disposiciones Transitorias, 1 Disposición Derogatoria y 21 Disposiciones Finales.",
    option_c: "En un Título Preliminar, 3 Títulos, 30 Disposiciones Adicionales, 4 Disposiciones Transitorias, 1 Disposición Derogatoria y 18 Disposiciones Finales.",
    option_d: "En un Título Preliminar, 8 Títulos, 8 Disposiciones Adicionales, 9 Disposiciones Transitorias, 1 Disposición Derogatoria y 3 Disposiciones Finales.",
    correct_option: "C",
    explanation: "La Ley 40/2015 se estructura en un Título Preliminar, 3 Títulos, 30 Disposiciones Adicionales, 4 Disposiciones Transitorias, 1 Disposición Derogatoria y 18 Disposiciones Finales.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "Según la Ley 39/2015, tienen la consideración de Administraciones Públicas:",
    option_a: "Las entidades de derecho privado vinculadas o dependientes de las Administraciones Públicas.",
    option_b: "Las Corporaciones de Derecho privado.",
    option_c: "Las Universidades públicas.",
    option_d: "Los organismos públicos y entidades de derecho público vinculados o dependientes de las Administraciones Públicas.",
    correct_option: "D",
    explanation: "Según los artículos 2 y 3 de la Ley 39/2015, tienen la consideración de Administraciones Públicas los organismos públicos y entidades de derecho público vinculados o dependientes de las Administraciones Públicas.",
    law_short_name: "Ley 39/2015",
    article_number: "2"
  },
  {
    question_text: "Cada una de las Administraciones Públicas recogidas en el artículo 2 de la Ley 40/2015 de Régimen Jurídico del Sector Público, actúa para el cumplimiento de sus fines con personalidad jurídica:",
    option_a: "Plena, para cada órgano que integra la Administración del Estado",
    option_b: "Única",
    option_c: "Solidaria",
    option_d: "Propia, para cada órgano que integra la Administración del Estado",
    correct_option: "B",
    explanation: "Según el artículo 3 de la Ley 40/2015, cada Administración Pública actúa con personalidad jurídica única.",
    law_short_name: "Ley 40/2015",
    article_number: "3"
  },
  {
    question_text: "La Ley 40/2015 se estructura en:",
    option_a: "1 Título preliminar, 3 títulos, 12 disposiciones adicionales, 4 disposiciones transitorias, 1 disposición derogatoria y 18 disposiciones finales.",
    option_b: "1 Título preliminar, 3 títulos, 10 disposiciones adicionales, 4 disposiciones transitorias, 1 disposición derogatoria y 18 disposiciones finales.",
    option_c: "1 Título preliminar, 3 títulos, 18 disposiciones adicionales, 4 disposiciones transitorias, 1 disposición derogatoria y 18 disposiciones finales.",
    option_d: "1 Título preliminar, 3 títulos, 30 disposiciones adicionales, 4 disposiciones transitorias, 1 disposición derogatoria y 18 disposiciones finales.",
    correct_option: "D",
    explanation: "La Ley 40/2015 se estructura en 1 Título preliminar, 3 títulos, 30 disposiciones adicionales, 4 disposiciones transitorias, 1 disposición derogatoria y 18 disposiciones finales.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "Según la Ley 40/2015, las Administraciones Públicas que, en el ejercicio de sus respectivas competencias, establezcan medidas que limiten el ejercicio de derechos individuales o colectivos o exijan el cumplimiento de requisitos para el desarrollo de una actividad, deberán aplicar el principio de:",
    option_a: "Responsabilidad.",
    option_b: "Eficacia.",
    option_c: "Autonomía.",
    option_d: "Proporcionalidad.",
    correct_option: "D",
    explanation: "Según el artículo 4 de la Ley 40/2015, las Administraciones Públicas deben aplicar el principio de proporcionalidad cuando establezcan medidas limitativas de derechos.",
    law_short_name: "Ley 40/2015",
    article_number: "4"
  },
  {
    question_text: "¿Cómo se denomina la Ley que regula el Régimen Jurídico del Sector Público?",
    option_a: "Ley Orgánica 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público.",
    option_b: "Ley 40/2015, de 12 de octubre, de Régimen Jurídico del Sector Público.",
    option_c: "Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público.",
    option_d: "Ley Orgánica 40/2015, de 12 de octubre, de Régimen Jurídico del Sector Público.",
    correct_option: "C",
    explanation: "La denominación correcta es Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "Los principios del sistema de responsabilidad de las Administraciones Públicas se regulan en:",
    option_a: "La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público.",
    option_b: "La Ley 1/2015, de 1 de abril, de garantía de la calidad de los servicios públicos y de la buena administración.",
    option_c: "La Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas.",
    option_d: "La Constitución española.",
    correct_option: "A",
    explanation: "Los principios del sistema de responsabilidad de las Administraciones Públicas se regulan en la Ley 40/2015, según su artículo 1.",
    law_short_name: "Ley 40/2015",
    article_number: "1"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, las Entidades que integran la Administración Local forman parte de:",
    option_a: "Las entidades públicas instrumentales.",
    option_b: "El sector público institucional.",
    option_c: "La organización central.",
    option_d: "El sector público.",
    correct_option: "D",
    explanation: "Según el artículo 2 de la Ley 39/2015, las Entidades que integran la Administración Local forman parte del sector público.",
    law_short_name: "Ley 39/2015",
    article_number: "2"
  },
  {
    question_text: "¿En qué norma se regulan los requisitos de validez y eficacia de los actos administrativos?",
    option_a: "En la Constitución Española.",
    option_b: "En la Ley 19/2013 de Actos y resoluciones administrativas.",
    option_c: "En la Ley 40/2015 de Régimen Jurídico del Sector Público.",
    option_d: "En la Ley 39/2015 del Procedimiento Administrativo Común de las Administraciones Públicas.",
    correct_option: "D",
    explanation: "Los requisitos de validez y eficacia de los actos administrativos se regulan en la Ley 39/2015, según su artículo 1.",
    law_short_name: "Ley 39/2015",
    article_number: "1"
  }
];

async function addContentScopeQuestionsBatch2() {
  console.log('🔧 AÑADIENDO SEGUNDO LOTE DE PREGUNTAS CONCEPTOS GENERALES\n')
  
  let addedCount = 0
  let duplicateCount = 0
  let errorCount = 0
  
  for (const [index, questionData] of questionsBatch.entries()) {
    console.log(`📝 Procesando pregunta ${index + 1}/${questionsBatch.length}...`)
    
    try {
      // 1. Verificar duplicados por similitud de texto
      const { data: existingQuestion } = await supabase
        .from('questions')
        .select('id')
        .ilike('question_text', questionData.question_text.substring(0, 80) + '%')
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
        errorCount++
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
        errorCount++
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
          exam_source: 'content_scope_batch2'
        })
        .select('id')
        .single()
      
      if (questionError) {
        console.log(`   ❌ Error insertando: ${questionError.message}`)
        errorCount++
        continue
      }
      
      console.log(`   ✅ Pregunta añadida: ${newQuestion.id}`)
      addedCount++
      
    } catch (error) {
      console.log(`   ❌ Error procesando pregunta: ${error.message}`)
      errorCount++
    }
  }
  
  console.log(`\n📊 RESUMEN DEL LOTE 2:`)
  console.log(`✅ Preguntas añadidas: ${addedCount}`)
  console.log(`⚠️ Duplicadas ignoradas: ${duplicateCount}`)
  console.log(`❌ Errores: ${errorCount}`)
  console.log(`📝 Total procesadas: ${questionsBatch.length}`)
  
  if (addedCount > 0) {
    console.log(`\n🎯 ${addedCount} nuevas preguntas añadidas a content_scope conceptos-generales!`)
    console.log('🔗 Disponibles en: http://localhost:3000/test-personalizado?seccion=conceptos-generales')
  }
}

addContentScopeQuestionsBatch2()