require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔍 Exportando topic scope para Administrativo C1...\n');

  // Obtener todos los topics de administrativo
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'administrativo')
    .order('topic_number');

  if (topicsError) {
    console.error('❌ Error obteniendo topics:', topicsError);
    return;
  }

  console.log(`✅ Encontrados ${topics.length} temas para Administrativo C1\n`);

  const resultado = [];

  for (const topic of topics) {
    const { data: scopes, error: scopeError } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        title_numbers,
        chapter_numbers,
        weight,
        laws (id, short_name, name)
      `)
      .eq('topic_id', topic.id);

    if (scopeError) {
      console.error(`❌ Error en tema ${topic.topic_number}:`, scopeError);
      continue;
    }

    resultado.push({
      topic_number: topic.topic_number,
      title: topic.title,
      leyes: scopes.filter(s => s.laws).map(s => ({
        nombre: s.laws.short_name,
        nombre_completo: s.laws.name,
        articulos: s.article_numbers || [],
        titulos: s.title_numbers || [],
        capitulos: s.chapter_numbers || [],
        weight: s.weight
      }))
    });

    console.log(`Tema ${topic.topic_number}: ${scopes.filter(s => s.laws).length} leyes`);
  }

  // Guardar resultado
  const fs = require('fs');
  fs.writeFileSync(
    'topic_scope_administrativo_c1.json',
    JSON.stringify(resultado, null, 2),
    'utf8'
  );

  console.log('\n✅ Archivo topic_scope_administrativo_c1.json creado');
  console.log(`📊 Total temas: ${resultado.length}`);
  console.log(`📋 Total leyes: ${resultado.reduce((sum, t) => sum + t.leyes.length, 0)}`);
  console.log(`📄 Total artículos: ${resultado.reduce((sum, t) => sum + t.leyes.reduce((s, l) => s + l.articulos.length, 0), 0)}`);
})();
