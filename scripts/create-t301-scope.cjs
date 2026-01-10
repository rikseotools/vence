const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Verificar Art. 1 del Código Civil
  const { data: ccArt } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', '899e61d1-e168-482b-9e86-4e7787eab6fc');

  console.log('=== ARTÍCULOS CÓDIGO CIVIL ===');
  if (ccArt && ccArt.length > 0) {
    ccArt.forEach(a => console.log('  ✅ Art. ' + a.article_number + ': ' + (a.title || '').substring(0,50)));
  } else {
    console.log('  ❌ No hay artículos');
    return;
  }

  // Obtener IDs de las leyes para T301
  const { data: ley50 } = await supabase.from('laws').select('id').eq('short_name', 'Ley 50/1997').single();
  const { data: ley39 } = await supabase.from('laws').select('id').eq('short_name', 'Ley 39/2015').single();

  const laws = {
    'CE': '6ad91a6c-41ec-431f-9c80-5f5566834941',
    'Código Civil': '899e61d1-e168-482b-9e86-4e7787eab6fc',
    'Ley 50/1997': ley50?.id,
    'Ley 39/2015': ley39?.id
  };

  console.log('\n=== LEYES PARA T301 ===');
  Object.entries(laws).forEach(([name, id]) => console.log('  ' + name + ': ' + (id ? id.substring(0,8) : 'N/A')));

  // Buscar el topic T301
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title, position_type')
    .ilike('title', '%fuentes%derecho%');

  console.log('\n=== TOPIC T301 ===');
  if (topics && topics.length > 0) {
    topics.forEach(t => console.log('  ' + t.topic_number + ' | ' + t.position_type + ' | ' + t.id.substring(0,8) + ' | ' + t.title));

    // Usar el topic de administrativo
    const topic = topics.find(t => t.position_type === 'administrativo');
    if (topic) {
      console.log('\nUsando topic:', topic.id);

      // Verificar si ya existe topic_scope
      const { data: existingScope } = await supabase
        .from('topic_scope')
        .select('id, law_id')
        .eq('topic_id', topic.id);

      if (existingScope && existingScope.length > 0) {
        console.log('Ya existe topic_scope con ' + existingScope.length + ' leyes');
      } else {
        // Crear topic_scope
        console.log('\nCreando topic_scope...');

        const scopeData = [
          { topic_id: topic.id, law_id: laws['CE'], article_numbers: ['1', '9', '66', '72', '81', '82', '83', '84', '85', '86', '87', '90', '91', '92', '93', '94', '95', '96', '97'] },
          { topic_id: topic.id, law_id: laws['Código Civil'], article_numbers: ['1', '2', '3', '4', '5'] },
          { topic_id: topic.id, law_id: laws['Ley 50/1997'], article_numbers: ['22', '23', '24', '25', '26', '27'] },
          { topic_id: topic.id, law_id: laws['Ley 39/2015'], article_numbers: ['127', '128', '129', '130', '131', '132', '133'] }
        ];

        for (const scope of scopeData) {
          const { error } = await supabase.from('topic_scope').insert(scope);
          if (error) {
            console.log('Error en ' + scope.law_id + ': ' + error.message);
          } else {
            console.log('  ✅ Scope creado para law_id ' + scope.law_id.substring(0,8));
          }
        }
      }
    }
  } else {
    console.log('  No encontrado');
  }
})();
