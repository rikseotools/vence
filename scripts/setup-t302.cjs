const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('=== SETUP T302 - EL ACTO ADMINISTRATIVO ===\n');

  // Buscar el topic T302
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title, position_type')
    .eq('topic_number', 302)
    .eq('position_type', 'administrativo');

  if (topics && topics.length > 0) {
    const topic = topics[0];
    console.log('Topic encontrado:');
    console.log('  ID:', topic.id);
    console.log('  Título:', topic.title);
  } else {
    console.log('❌ Topic 302 no encontrado');
    return;
  }

  const topicId = topics[0].id;

  // Verificar topic_scope existente
  const { data: existingScope } = await supabase
    .from('topic_scope')
    .select('id, law_id, laws:law_id(short_name)')
    .eq('topic_id', topicId);

  console.log('\nTopic scope existente:', existingScope?.length || 0, 'leyes');
  existingScope?.forEach(s => console.log('  -', s.laws?.short_name));

  // Analizar archivos para detectar leyes mencionadas
  const basePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_2,_El_acto_administrativo';
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));

  console.log('\n=== ARCHIVOS ENCONTRADOS ===');
  let totalQuestions = 0;
  const lawMentions = {};

  for (const file of files) {
    const content = fs.readFileSync(path.join(basePath, file), 'utf8');
    const data = JSON.parse(content);
    console.log(file.substring(0, 50) + ':', data.questions.length, 'preguntas');
    totalQuestions += data.questions.length;

    // Detectar leyes mencionadas en explicaciones
    data.questions.forEach(q => {
      const exp = (q.explanation || '').toLowerCase();
      if (exp.includes('39/2015') || exp.includes('lpac')) {
        lawMentions['Ley 39/2015'] = (lawMentions['Ley 39/2015'] || 0) + 1;
      }
      if (exp.includes('40/2015') || exp.includes('lrjsp')) {
        lawMentions['Ley 40/2015'] = (lawMentions['Ley 40/2015'] || 0) + 1;
      }
      if (exp.includes('30/1992')) {
        lawMentions['Ley 30/1992'] = (lawMentions['Ley 30/1992'] || 0) + 1;
      }
    });
  }

  console.log('\nTotal preguntas:', totalQuestions);
  console.log('\nLeyes mencionadas:');
  Object.entries(lawMentions).sort((a,b) => b[1] - a[1]).forEach(([law, count]) => {
    console.log('  ' + law + ':', count);
  });

  // Verificar leyes en BD
  console.log('\n=== VERIFICACIÓN DE LEYES ===');
  const lawsToCheck = ['Ley 39/2015', 'Ley 40/2015'];

  for (const lawName of lawsToCheck) {
    const { data: law } = await supabase
      .from('laws')
      .select('id, short_name')
      .eq('short_name', lawName)
      .single();

    if (law) {
      const { count } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('law_id', law.id);

      console.log('✅', lawName, '| ID:', law.id.substring(0,8), '|', count, 'artículos');
    } else {
      console.log('❌', lawName, '- No encontrada');
    }
  }

  // Crear topic_scope si no existe
  if (!existingScope || existingScope.length === 0) {
    console.log('\n=== CREANDO TOPIC_SCOPE ===');

    const { data: ley39 } = await supabase.from('laws').select('id').eq('short_name', 'Ley 39/2015').single();
    const { data: ley40 } = await supabase.from('laws').select('id').eq('short_name', 'Ley 40/2015').single();

    const scopeData = [
      {
        topic_id: topicId,
        law_id: ley39?.id,
        article_numbers: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52']
      },
      {
        topic_id: topicId,
        law_id: ley40?.id,
        article_numbers: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52']
      }
    ];

    for (const scope of scopeData) {
      if (scope.law_id) {
        const { error } = await supabase.from('topic_scope').insert(scope);
        if (error) {
          console.log('Error:', error.message);
        } else {
          console.log('✅ Scope creado para law_id', scope.law_id.substring(0,8));
        }
      }
    }
  }
})();
