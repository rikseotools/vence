// scripts/add-ordenacion-procedimiento-batch.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function letterToNumber(letter) {
  const mapping = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return mapping[letter];
}

const questions = [
  {
    question_text: "El artículo 70.2 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas regula el expediente administrativo y señala que:",
    option_a: "Los expedientes tendrán formato electrónico o formato papel y se formarán mediante la agregación ordenada de cuantos documentos, pruebas, dictámenes, informes, acuerdos, notificaciones y demás diligencias deban integrarlos, así como un índice numerado de todos los documentos que contenga cuando se remita. Asimismo, deberá constar en el expediente copia de la resolución adoptada.",
    option_b: "Los expedientes tendrán formato electrónico y se formarán mediante la agregación ordenada de cuantos documentos, pruebas, dictámenes, informes, acuerdos, notificaciones y demás diligencias deban integrarlos, así como un índice numerado de todos los documentos que contenga cuando se remita. Asimismo, deberá constar en el expediente copia electrónica certificada de la resolución adoptada.",
    option_c: "Los expedientes tendrán formato electrónico y se formarán mediante la agregación ordenada de cuantos documentos, pruebas, información auxiliar o de apoyo, notificaciones y demás diligencias deban integrarlos, así como un índice numerado de todos los documentos que contenga cuando se remita.",
    option_d: "Los expedientes tendrán formato electrónico y se formarán mediante la agregación ordenada de cuantos documentos, notas, borradores, opiniones, resúmenes, comunicaciones, informes y demás diligencias deban integrarlos, así como un índice numerado de todos los documentos que contenga cuando se remita. Asimismo, deberá constar en el expediente copia electrónica certificada de la resolución adoptada.",
    correct_option: "B",
    explanation: "Según el artículo 70.2 de la Ley 39/2015, los expedientes tendrán formato electrónico y deben incluir copia electrónica certificada de la resolución adoptada, junto con el índice numerado de documentos.",
    article_number: "70"
  },
  {
    question_text: "De acuerdo con el art. 71 de la Ley 39/2015, el procedimiento administrativo común, sometido al principio de celeridad, se impulsará de oficio en todos sus trámites y a través de medios electrónicos, respetando los principios de:",
    option_a: "Publicidad e igualdad.",
    option_b: "Transparencia y publicidad.",
    option_c: "Publicidad y Legalidad.",
    option_d: "Igualdad y transparencia",
    correct_option: "B",
    explanation: "El artículo 71 de la Ley 39/2015 establece que el procedimiento administrativo común se impulsará de oficio respetando los principios de transparencia y publicidad.",
    article_number: "71"
  },
  {
    question_text: "En base a lo establecido en la Ley 39/2015, señale la respuesta incorrecta en relación a lo establecido sobre los expedientes administrativos:",
    option_a: "Deberá constar en el expediente copia electrónica certificada de la resolución adoptada.",
    option_b: "Formará parte del expediente administrativo la información que tenga carácter auxiliar o de apoyo, como la contenida en aplicaciones, ficheros y bases de datos informáticas, notas, borradores, opiniones, resúmenes, comunicaciones e informes internos o entre órganos o entidades administrativas.",
    option_c: "Los expedientes administrativos tendrán formato electrónico y se formarán mediante la agregación ordenada de cuantos documentos, pruebas, dictámenes, informes, acuerdos, notificaciones y demás diligencias deban integrarlos, así como un índice numerado de todos los documentos que contenga cuando se remita.",
    option_d: "Un expediente administrativo es el conjunto ordenado de documentos y actuaciones que sirven de antecedente y fundamento a la resolución administrativa, así como las diligencias encaminadas a ejecutarla.",
    correct_option: "B",
    explanation: "La opción B es incorrecta porque según el artículo 70 de la Ley 39/2015, la información auxiliar o de apoyo NO forma parte del expediente administrativo. Esta pregunta busca la respuesta incorrecta.",
    article_number: "70"
  },
  {
    question_text: "Según lo dispuesto en la Ley 39/2015, ¿quiénes serán los responsables directos de la tramitación del procedimiento administrativo y del cumplimiento de sus plazos?:",
    option_a: "Las personas designadas como órgano instructor y los titulares de los órganos superiores de la Administración General del Estado.",
    option_b: "Las personas designadas como órgano instructor o, en su caso, los titulares de las unidades administrativas que tengan atribuida tal función.",
    option_c: "Las personas designadas como órgano competente para resolver o, en su caso, los titulares de las unidades administrativas que tengan atribuida tal función.",
    option_d: "Las personas designadas como órgano competente para resolver o, en su caso, los titulares de los centros administrativos que tengan atribuida tal función.",
    correct_option: "B",
    explanation: "Según el artículo 71 de la Ley 39/2015, los responsables directos de la tramitación del procedimiento y cumplimiento de plazos son las personas designadas como órgano instructor o los titulares de las unidades administrativas con tal función.",
    article_number: "71"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, ¿cómo se denomina al conjunto ordenado de documentos y actuaciones que sirven de antecedente y fundamento a la resolución administrativa, así como las diligencias encaminadas a ejecutarla?",
    option_a: "Expediente administrativo.",
    option_b: "Expediente reglamentario.",
    option_c: "Registro electrónico de apoderamientos.",
    option_d: "Apoderamiento administrativo.",
    correct_option: "A",
    explanation: "Según el artículo 70 de la Ley 39/2015, el expediente administrativo es el conjunto ordenado de documentos y actuaciones que sirven de antecedente y fundamento a la resolución administrativa.",
    article_number: "70"
  },
  {
    question_text: "Según la Ley 39/2015, cuando en virtud de una norma sea preciso remitir el expediente electrónico, ¿cuál de las siguientes no es correcta?:",
    option_a: "Se enviará completo, foliado, autentificado y acompañado de un índice, asimismo autentificado, de los documentos que contenga.",
    option_b: "La autenticación del índice del expediente, garantizará la integridad e inmutabilidad del expediente electrónico generado desde el momento de su firma.",
    option_c: "Se hará de acuerdo con lo previsto en el Esquema Nacional de Interoperabilidad y en las correspondientes Normas Técnicas de Interoperabilidad.",
    option_d: "Un mismo documento no puede formar parte de distintos expedientes electrónicos, salvo en los casos legalmente previstos.",
    correct_option: "D",
    explanation: "La opción D es incorrecta porque según el artículo 70 de la Ley 39/2015, un mismo documento SÍ puede formar parte de distintos expedientes electrónicos, salvo en casos legalmente previstos. Esta pregunta busca la respuesta incorrecta.",
    article_number: "70"
  }
];

async function addContentScopeQuestions() {
  console.log('🔧 AÑADIENDO PREGUNTAS DE ORDENACIÓN DEL PROCEDIMIENTO ADMINISTRATIVO\n');
  
  try {
    let addedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    for (const [index, questionData] of questions.entries()) {
      console.log(`📝 Procesando pregunta ${index + 1}/${questions.length}...`);
      
      // 1. Verificar si la pregunta ya existe (detectar duplicados)
      const { data: existingQuestion } = await supabase
        .from('questions')
        .select('id')
        .ilike('question_text', questionData.question_text.substring(0, 50) + '%')
        .single();
      
      if (existingQuestion) {
        console.log(`   ⚠️ Pregunta duplicada, saltando...`);
        duplicateCount++;
        continue;
      }
      
      // 2. Obtener la ley Ley 39/2015
      const { data: law } = await supabase
        .from('laws')
        .select('id')
        .eq('short_name', 'Ley 39/2015')
        .single();
      
      if (!law) {
        console.log(`   ❌ Ley 39/2015 no encontrada`);
        errorCount++;
        continue;
      }
      
      // 3. Obtener el artículo específico
      const { data: article } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', law.id)
        .eq('article_number', questionData.article_number)
        .single();
      
      if (!article) {
        console.log(`   ❌ Artículo ${questionData.article_number} de Ley 39/2015 no encontrado`);
        errorCount++;
        continue;
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
          exam_source: 'content_scope_batch_ordenacion',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (questionError) {
        console.log(`   ❌ Error insertando pregunta: ${questionError.message}`);
        errorCount++;
        continue;
      }
      
      console.log(`   ✅ Pregunta añadida con ID: ${newQuestion.id}`);
      addedCount++;
    }
    
    console.log('\n📊 RESUMEN:');
    console.log(`✅ Preguntas añadidas: ${addedCount}`);
    console.log(`⚠️ Preguntas duplicadas (ignoradas): ${duplicateCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📝 Total procesadas: ${questions.length}`);
    
    if (addedCount > 0) {
      console.log('\n🎯 Las preguntas se han añadido exitosamente al content_scope!');
      console.log('🔗 Ahora aparecerán en /test-oposiciones/procedimiento-administrativo/ordenacion');
      console.log('🔗 Y también en /test-personalizado?seccion=ordenacion');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar el script
addContentScopeQuestions();