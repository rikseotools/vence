const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LAWS = {
  'CE': '6ad91a6c-41ec-431f-9c80-5f5566834941',
  'Código Civil': '899e61d1-e168-482b-9e86-4e7787eab6fc'
};

async function getArticleId(law, articleNum) {
  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', LAWS[law])
    .eq('article_number', articleNum)
    .single();
  return data?.id;
}

(async () => {
  console.log('=== IMPORTACIÓN MANUAL T301 ===\n');

  // Pregunta 1: Fuentes indirectas
  const art1CC = await getArticleId('Código Civil', '1');
  console.log('Art. 1 CC:', art1CC);

  const q1 = {
    question_text: 'Dentro del estudio de las fuentes del Derecho Administrativo, ¿cuál de las siguientes fuentes no tendrá el carácter de indirecta?',
    option_a: 'Tratados internacionales no publicados en el Boletín Oficial del Estado.',
    option_b: 'Jurisprudencia.',
    option_c: 'Doctrina científica.',
    option_d: 'Costumbre.',
    correct_option: 3, // D
    explanation: 'Las fuentes DIRECTAS del Derecho Administrativo son: Constitución, Ley, Reglamento, y Costumbre. Las fuentes INDIRECTAS son: Jurisprudencia, Tratados no publicados en BOE, y Doctrina científica. La costumbre es fuente DIRECTA, no indirecta.',
    primary_article_id: art1CC,
    difficulty: 'medium',
    is_active: true,
    is_official_exam: false,
    tags: ['Fuentes del derecho', 'T301', 'Bloque III']
  };

  // Pregunta 2: Tratados internacionales CC
  const q2 = {
    question_text: 'De acuerdo con lo previsto en el Código Civil, las normas jurídicas contenidas en los tratados internacionales:',
    option_a: 'Aunque no pueden llegar a tener aplicación directa en España, tendrán carácter informador del ordenamiento jurídico interno.',
    option_b: 'Serán de aplicación directa en España cuando hayan pasado a formar parte de su ordenamiento interno.',
    option_c: 'En ningún caso, pueden llegar a tener aplicación directa en España.',
    option_d: 'Serán de aplicación directa en España desde la firma del tratado internacional correspondiente.',
    correct_option: 1, // B
    explanation: '**Art. 1.5 Código Civil**\n\nLas normas jurídicas contenidas en los tratados internacionales no serán de aplicación directa en España en tanto no hayan pasado a formar parte del ordenamiento interno mediante su publicación íntegra en el BOE.\n\nEs decir, SÍ pueden tener aplicación directa, pero solo DESPUÉS de publicarse en el BOE.',
    primary_article_id: art1CC,
    difficulty: 'medium',
    is_active: true,
    is_official_exam: false,
    tags: ['Fuentes del derecho', 'T301', 'Bloque III']
  };

  // Pregunta 3: Decreto-ley vs decreto legislativo
  const art82CE = await getArticleId('CE', '82');
  console.log('Art. 82 CE:', art82CE);

  const q3 = {
    question_text: '¿En qué se diferencia un decreto-ley de un decreto legislativo?',
    option_a: 'En que el decreto legislativo está previsto para redacción de textos articulados y el decreto-ley para refundir varios textos legales en uno solo.',
    option_b: 'En que el decreto-ley es una disposición legislativa provisional que se dicta por el Gobierno en caso de extraordinaria y urgente necesidad; y el decreto legislativo es fruto de una delegación expresa de las Cortes Generales en el Gobierno para dictar normas con rango de ley sobre materias determinadas.',
    option_c: 'En que el decreto-ley necesita de una ley de bases que determine el alcance de la regulación que se le encomienda y el decreto legislativo tiene que estar previsto en una ley ordinaria.',
    option_d: 'En que el decreto legislativo no puede versar sobre materias reservadas a una ley orgánica y el decreto-ley sí.',
    correct_option: 1, // B
    explanation: '**Arts. 82, 85 y 86 CE**\n\n• **Decreto Legislativo** (Art. 82): Fruto de DELEGACIÓN de las Cortes al Gobierno para dictar normas con rango de ley.\n• **Decreto-Ley** (Art. 86): Disposición PROVISIONAL dictada por el Gobierno en caso de extraordinaria y urgente necesidad.\n\nLa diferencia clave: el decreto legislativo requiere delegación previa; el decreto-ley se dicta por urgencia sin delegación previa.',
    primary_article_id: art82CE,
    difficulty: 'medium',
    is_active: true,
    is_official_exam: false,
    tags: ['La Ley', 'T301', 'Bloque III']
  };

  // Pregunta 4: Materias reservadas a Ley Orgánica
  const art81CE = await getArticleId('CE', '81');
  console.log('Art. 81 CE:', art81CE);

  const q4 = {
    question_text: '¿Qué materia no se encuentra reservada a Ley orgánica, de conformidad con lo regulado en la Constitución Española?',
    option_a: 'La composición, organización y funciones de los Tribunales Económico-Administrativos',
    option_b: 'La composición del Consejo de Estado.',
    option_c: 'El estado de alarma.',
    option_d: 'Las formas de ejercicio de la iniciativa popular para la presentación de proposiciones de ley.',
    correct_option: 0, // A
    explanation: '**Art. 81 CE - Materias reservadas a Ley Orgánica**\n\nSon Leyes Orgánicas las relativas a:\n• Desarrollo de derechos fundamentales y libertades públicas\n• Estatutos de Autonomía\n• Régimen electoral general\n• Las demás previstas en la CE\n\nLos Tribunales Económico-Administrativos NO están reservados a LO. En cambio:\n• Consejo de Estado → Art. 107 CE (LO)\n• Estados de alarma → Art. 116 CE (LO)\n• Iniciativa popular → Art. 87.3 CE (LO)',
    primary_article_id: art81CE,
    difficulty: 'medium',
    is_active: true,
    is_official_exam: false,
    tags: ['La Ley', 'T301', 'Bloque III']
  };

  // Insertar las 4 preguntas
  const questions = [q1, q2, q3, q4];
  let imported = 0;

  for (const q of questions) {
    if (!q.primary_article_id) {
      console.log('❌ Sin artículo para:', q.question_text.substring(0, 40));
      continue;
    }

    const { error } = await supabase.from('questions').insert(q);
    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
        console.log('⏭️ Ya existe:', q.question_text.substring(0, 40));
      } else {
        console.log('❌ Error:', error.message);
      }
    } else {
      console.log('✅ Importada:', q.question_text.substring(0, 40));
      imported++;
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Importadas:', imported);
})();
