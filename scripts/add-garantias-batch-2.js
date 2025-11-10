// scripts/add-garantias-batch-2.js
// Script para añadir las 17 preguntas restantes de Procedimiento Administrativo: Garantías

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Función para convertir letra a número
function letterToNumber(letter) {
  const mapping = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return mapping[letter.toUpperCase()];
}

// Las 17 preguntas restantes de garantías
const garantiasRemainingQuestions = [
  {
    question_text: "De acuerdo con la Ley 39/2015, ¿cuál es el plazo máximo para resolver y notificar las solicitudes en procedimientos ordinarios?",
    option_a: "Tres meses, salvo que por norma con rango de ley se establezca otro distinto.",
    option_b: "Seis meses en todos los casos.",
    option_c: "Un año como máximo.",
    option_d: "No hay plazo máximo establecido.",
    correct_option: "A",
    article_reference: "54",
    explanation: "Según la Ley 39/2015, el plazo máximo para resolver y notificar es de tres meses, salvo que una norma con rango de ley establezca un plazo distinto. Este plazo garantiza la celeridad en la resolución de los procedimientos administrativos."
  },
  {
    question_text: "¿Cuándo se entiende desistida una solicitud según la Ley 39/2015?",
    option_a: "Cuando el interesado no subsane en el plazo otorgado, siempre que se le haya advertido.",
    option_b: "Automáticamente después de 30 días sin actividad.",
    option_c: "Solo cuando el interesado lo comunique expresamente.",
    option_d: "Nunca se entiende desistida automáticamente.",
    correct_option: "A",
    article_reference: "68",
    explanation: "El artículo 68 establece que se entiende desistida la solicitud cuando el interesado no subsane las deficiencias en el plazo otorgado, siempre que se le haya advertido de esta consecuencia. Esto protege el derecho del ciudadano mediante la advertencia previa."
  },
  {
    question_text: "Según el artículo 53 de la Ley 39/2015, ¿pueden los interesados obtener información sobre el estado de tramitación de los procedimientos?",
    option_a: "Solo si han transcurrido más de tres meses.",
    option_b: "Sí, tienen derecho a conocer el estado de tramitación de los procedimientos en los que tengan la condición de interesados.",
    option_c: "Solo mediante solicitud formal con justificación del interés.",
    option_d: "No, es información reservada de la Administración.",
    correct_option: "B",
    article_reference: "53",
    explanation: "El artículo 53 reconoce expresamente el derecho de los interesados a conocer el estado de tramitación de los procedimientos. Este derecho fundamental garantiza la transparencia administrativa y permite al ciudadano conocer la situación de sus expedientes."
  },
  {
    question_text: "¿Qué establece la Ley 39/2015 sobre la representación mediante abogado o procurador?",
    option_a: "Es obligatoria en todos los procedimientos administrativos.",
    option_b: "Está prohibida en procedimientos administrativos.",
    option_c: "Los interesados pueden actuar asistidos de asesor cuando lo consideren conveniente.",
    option_d: "Solo es obligatoria en procedimientos sancionadores.",
    correct_option: "C",
    article_reference: "5",
    explanation: "El artículo 5 de la Ley 39/2015 permite que los interesados actúen asistidos de asesor cuando lo consideren conveniente. La asistencia letrada no es obligatoria en el procedimiento administrativo, a diferencia del judicial, manteniendo la accesibilidad ciudadana."
  },
  {
    question_text: "En relación con las comunicaciones electrónicas, según la Ley 39/2015, ¿cuándo se entiende practicada una notificación?",
    option_a: "En el momento del envío por la Administración.",
    option_b: "Cuando el interesado accede al contenido de la notificación.",
    option_c: "Siempre a los 10 días del envío.",
    option_d: "Solo cuando el interesado confirma la recepción.",
    correct_option: "B",
    article_reference: "53",
    explanation: "Según la normativa de la Ley 39/2015, las notificaciones electrónicas se entienden practicadas cuando el interesado accede al contenido. Esto garantiza que efectivamente ha tomado conocimiento del contenido notificado, no solo del envío."
  },
  {
    question_text: "¿Qué sucede si un órgano administrativo recibe una solicitud para la que no tiene competencia según la Ley 39/2015?",
    option_a: "Debe archivar inmediatamente la solicitud.",
    option_b: "Debe remitirla al órgano competente e informar al interesado.",
    option_c: "Debe devolver la solicitud al interesado sin más trámite.",
    option_d: "Debe iniciar el procedimiento igualmente.",
    correct_option: "B",
    article_reference: "54",
    explanation: "La Ley 39/2015 establece que cuando se recibe una solicitud sin competencia, debe remitirse al órgano competente e informar al interesado. Esto evita que el ciudadano tenga que identificar el órgano correcto y agiliza la tramitación."
  },
  {
    question_text: "Según el artículo 56 de la Ley 39/2015, ¿quién puede acordar medidas provisionales?",
    option_a: "Solo el órgano competente para resolver el procedimiento.",
    option_b: "Cualquier funcionario público.",
    option_c: "El órgano competente para iniciar o instruir el procedimiento.",
    option_d: "Únicamente el superior jerárquico del instructor.",
    correct_option: "C",
    article_reference: "56",
    explanation: "El artículo 56 faculta al órgano competente para iniciar o instruir el procedimiento para acordar medidas provisionales. Esto permite adoptar medidas urgentes desde el inicio, sin esperar a que se complete la instrucción del expediente."
  },
  {
    question_text: "¿Cuál es el efecto del silencio administrativo en los procedimientos iniciados a solicitud del interesado según la regla general?",
    option_a: "Siempre es desestimatorio.",
    option_b: "Siempre es estimatorio.",
    option_c: "Es estimatorio, salvo que una norma establezca lo contrario.",
    option_d: "No produce ningún efecto.",
    correct_option: "C",
    article_reference: "54",
    explanation: "La regla general establecida en la Ley 39/2015 es que el silencio administrativo tiene efectos estimatorios en procedimientos iniciados a solicitud del interesado, salvo que una norma con rango de ley disponga lo contrario. Esto favorece al ciudadano ante la inactividad administrativa."
  },
  {
    question_text: "Según el artículo 62 de la Ley 39/2015, ¿debe la Administración comunicar siempre al denunciante el resultado de la denuncia?",
    option_a: "Sí, en todos los casos.",
    option_b: "No, nunca debe comunicar el resultado.",
    option_c: "Solo cuando la denuncia resulte en procedimiento sancionador.",
    option_d: "Solo cuando las normas reguladoras del procedimiento así lo establezcan.",
    correct_option: "D",
    article_reference: "62",
    explanation: "El artículo 62 establece que la comunicación del resultado de la denuncia al denunciante solo es obligatoria cuando las normas reguladoras del procedimiento específico así lo prevean. No existe una obligación general de comunicación."
  },
  {
    question_text: "¿Puede un menor de edad iniciar un procedimiento administrativo según la Ley 39/2015?",
    option_a: "Nunca, debe actuar siempre su representante legal.",
    option_b: "Solo si está emancipado.",
    option_c: "Sí, para el ejercicio y defensa de aquellos derechos cuya actuación esté permitida sin asistencia.",
    option_d: "Solo con autorización judicial.",
    correct_option: "C",
    article_reference: "3",
    explanation: "El artículo 3 permite que los menores actúen por sí mismos para el ejercicio y defensa de aquellos derechos e intereses cuya actuación esté permitida por el ordenamiento jurídico sin asistencia. Esto reconoce cierta autonomía a los menores en determinados ámbitos."
  },
  {
    question_text: "¿Qué establece la Ley 39/2015 sobre el derecho a utilizar las lenguas cooficiales?",
    option_a: "No regula este aspecto.",
    option_b: "Solo se puede usar el castellano.",
    option_c: "Los ciudadanos pueden dirigirse a las Administraciones Públicas en cualquiera de las lenguas cooficiales.",
    option_d: "Solo en determinadas Comunidades Autónomas.",
    correct_option: "C",
    article_reference: "53",
    explanation: "La Ley 39/2015 reconoce el derecho de los ciudadanos a dirigirse a las Administraciones Públicas en cualquiera de las lenguas cooficiales del territorio. Este derecho garantiza el uso normalizado de las lenguas cooficiales en las relaciones administrativas."
  },
  {
    question_text: "Según el artículo 64 de la Ley 39/2015, ¿qué debe contener el acuerdo de iniciación en procedimientos sancionadores?",
    option_a: "Solo la identificación del presunto responsable.",
    option_b: "La separación entre la fase instructora y la sancionadora, identificación del instructor y órgano competente para resolver.",
    option_c: "Únicamente los hechos denunciados.",
    option_d: "Solo la normativa aplicable.",
    correct_option: "B",
    article_reference: "64",
    explanation: "El artículo 64 exige que el acuerdo de iniciación establezca la separación entre la fase instructora y sancionadora, identifique al instructor y al órgano competente para resolver. Esta separación garantiza la imparcialidad en el procedimiento sancionador."
  },
  {
    question_text: "¿Cuándo pueden los interesados presentar alegaciones según la Ley 39/2015?",
    option_a: "Solo al final del procedimiento.",
    option_b: "En cualquier momento del procedimiento, mientras no se haya dictado resolución definitiva.",
    option_c: "Solo al inicio del procedimiento.",
    option_d: "Solo cuando la Administración lo solicite expresamente.",
    correct_option: "B",
    article_reference: "53",
    explanation: "El artículo 53 reconoce el derecho a presentar alegaciones en cualquier momento del procedimiento anterior al trámite de audiencia. Este derecho fundamental permite una defensa activa y continuada de los intereses durante toda la tramitación."
  },
  {
    question_text: "¿Qué debe hacer la Administración si detecta que faltan documentos esenciales para resolver según la Ley 39/2015?",
    option_a: "Resolver con los documentos disponibles.",
    option_b: "Archivar el expediente inmediatamente.",
    option_c: "Requerir al interesado para que aporte los documentos necesarios.",
    option_d: "Suspender indefinidamente el procedimiento.",
    correct_option: "C",
    article_reference: "68",
    explanation: "La Ley 39/2015 obliga a la Administración a requerir la aportación de documentos esenciales para resolver. Esto garantiza que las resoluciones se adopten con todos los elementos necesarios y protege el derecho del interesado a aportar documentación relevante."
  },
  {
    question_text: "Según el artículo 57 de la Ley 39/2015, ¿puede acumularse un procedimiento sancionador con uno de responsabilidad patrimonial?",
    option_a: "Nunca pueden acumularse.",
    option_b: "Sí, si guardan identidad sustancial o íntima conexión y el mismo órgano es competente.",
    option_c: "Solo con autorización judicial.",
    option_d: "Solo si el interesado lo solicita.",
    correct_option: "B",
    article_reference: "57",
    explanation: "El artículo 57 permite la acumulación de procedimientos, incluidos sancionadores y de responsabilidad patrimonial, cuando guarden identidad sustancial o íntima conexión y sea el mismo órgano competente. Esto evita duplicidades y mejora la eficiencia administrativa."
  },
  {
    question_text: "¿Qué garantía fundamental establece la Ley 39/2015 respecto al procedimiento administrativo?",
    option_a: "Solo el derecho a ser oído.",
    option_b: "El derecho a un procedimiento contradictorio.",
    option_c: "Solo el derecho a la defensa.",
    option_d: "No establece garantías específicas.",
    correct_option: "B",
    article_reference: "53",
    explanation: "La Ley 39/2015 establece como garantía fundamental el derecho a un procedimiento contradictorio, que incluye el derecho a ser oído, aportar documentos, formular alegaciones y participar activamente en la defensa de los intereses. Es la base del debido proceso administrativo."
  },
  {
    question_text: "¿Cuál es el plazo general para interponer recurso de reposición según la Ley 39/2015?",
    option_a: "Quince días hábiles.",
    option_b: "Un mes a contar desde el día siguiente al de la notificación del acto.",
    option_c: "Tres meses en todos los casos.",
    option_d: "No hay plazo establecido.",
    correct_option: "B",
    article_reference: "53",
    explanation: "Aunque el recurso de reposición se regula en otros artículos, las garantías del artículo 53 incluyen el derecho a recurrir. El plazo general es de un mes desde el día siguiente al de la notificación, garantizando un período razonable para ejercer el derecho de recurso."
  }
];

async function addGarantiasRemainingQuestions() {
  try {
    console.log('🔍 INICIANDO BATCH 2 - GARANTÍAS (17 PREGUNTAS RESTANTES)...\n');

    // 1. Buscar el content scope de garantías
    const { data: contentScope, error: scopeError } = await supabase
      .from('content_scope')
      .select('*')
      .eq('id', 'e9b43aaf-ddb7-4a65-93c1-9a92bd97c843')
      .single();

    if (scopeError) {
      console.log('❌ Error buscando content scope:', scopeError.message);
      return;
    }

    console.log('✅ Content scope encontrado:', contentScope.id);

    // 2. Buscar la ley 39/2015
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'Ley 39/2015')
      .single();

    if (lawError) {
      console.log('❌ Error buscando ley:', lawError.message);
      return;
    }

    console.log('✅ Ley encontrada:', law.id);

    // 3. Obtener artículos disponibles
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', law.id);

    if (articlesError) {
      console.log('❌ Error obteniendo artículos:', articlesError.message);
      return;
    }

    console.log('✅ Artículos disponibles:', articles.length);

    // 4. Procesar y añadir las 17 preguntas restantes
    let addedCount = 0;
    let errorCount = 0;

    for (const questionData of garantiasRemainingQuestions) {
      // Buscar el artículo correspondiente
      const article = articles.find(a => a.article_number === questionData.article_reference);
      
      if (!article) {
        console.log('❌ Artículo no encontrado:', questionData.article_reference);
        errorCount++;
        continue;
      }

      // Preparar la pregunta para inserción
      const questionInsert = {
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_option: letterToNumber(questionData.correct_option),
        explanation: questionData.explanation,
        primary_article_id: article.id,
        difficulty: 'medium',
        question_type: 'single',
        is_official_exam: false,
        is_active: true
      };

      // Insertar pregunta
      const { data, error } = await supabase
        .from('questions')
        .insert(questionInsert)
        .select();

      if (error) {
        console.log('❌ Error insertando pregunta:', error.message);
        errorCount++;
      } else {
        addedCount++;
        console.log(`✅ Pregunta ${addedCount + 47} añadida: ${questionData.question_text.substring(0, 60)}...`);
      }
    }

    // 5. Verificar total de preguntas en la sección
    const { data: totalQuestions, error: countError } = await supabase
      .from('questions')
      .select('id')
      .in('primary_article_id', articles.filter(a => contentScope.article_numbers.includes(a.article_number)).map(a => a.id));

    const totalCount = totalQuestions?.length || 0;

    console.log('\n📊 RESUMEN BATCH 2:');
    console.log('✅ Preguntas añadidas exitosamente:', addedCount);
    console.log('❌ Preguntas con errores:', errorCount);
    console.log('📝 Total procesadas en este batch:', garantiasRemainingQuestions.length);

    console.log('\n🎯 ESTADO FINAL SECCIÓN GARANTÍAS:');
    console.log('📚 Total preguntas en garantías:', totalCount);
    console.log('📊 Batch 1: 47 preguntas');
    console.log('📊 Batch 2:', addedCount, 'preguntas');
    console.log('🌐 URL: /test-oposiciones/procedimiento-administrativo/garantias');

    if (totalCount >= 60) {
      console.log('\n🎉 ¡SECCIÓN GARANTÍAS COMPLETADA! Más de 60 preguntas disponibles.');
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

addGarantiasRemainingQuestions();