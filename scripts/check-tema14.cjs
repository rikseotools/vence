const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Ver todos los temas de auxiliar administrativo
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title, position_type')
    .eq('position_type', 'auxiliar_administrativo')
    .order('topic_number');

  console.log('Temas de auxiliar_administrativo_estado:');
  topics?.forEach(t => console.log('  Tema ' + t.topic_number + ': ' + t.title));
  console.log('');

  // Buscar tema 14 específicamente
  const tema14 = topics?.find(t => t.topic_number === 14);

  if (!tema14) {
    console.log('❌ No se encontró tema 14');

    // Buscar si existe con otro position_type
    const { data: allTema14 } = await supabase
      .from('topics')
      .select('id, topic_number, title, position_type')
      .eq('topic_number', 14);

    console.log('');
    console.log('Temas 14 en toda la BD:');
    allTema14?.forEach(t => console.log('  - ' + t.position_type + ': ' + t.title));
    return;
  }

  console.log('TEMA 14:', tema14.title);
  console.log('');

  // Buscar topic_scope
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers, laws(short_name, name)')
    .eq('topic_id', tema14.id);

  let total = 0;
  for (const s of scopes || []) {
    const count = s.article_numbers?.length || 0;
    total += count;
    console.log((s.laws?.short_name || 'Ley desconocida') + ': ' + count + ' artículos');
    console.log('  → ' + (s.article_numbers?.slice(0, 20).join(', ') || 'ninguno') + (count > 20 ? '...' : ''));
    console.log('');
  }

  console.log('TOTAL en topic_scope:', total, 'artículos');

  // Ver todos los artículos del RDL 5/2015 en el tema 14
  const ebepScope = scopes?.find(s => s.laws?.short_name === 'RDL 5/2015');
  if (ebepScope) {
    console.log('');
    console.log('=== ARTÍCULOS DEL RDL 5/2015 EN TEMA 14 ===');
    console.log('Total:', ebepScope.article_numbers?.length);
    console.log('Lista completa:', ebepScope.article_numbers?.join(', '));

    // Verificar si hay artículo 101
    if (ebepScope.article_numbers?.includes('101')) {
      console.log('');
      console.log('⚠️ Incluye artículo 101 (que NO existe en el EBEP real)');
    }
  }

  // También verificar el Tema 13 que también tiene EBEP
  const { data: tema13 } = await supabase
    .from('topics')
    .select('id, title')
    .eq('position_type', 'auxiliar_administrativo')
    .eq('topic_number', 13)
    .single();

  if (tema13) {
    const { data: scopesTema13 } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers, laws(short_name)')
      .eq('topic_id', tema13.id);

    const ebep13 = scopesTema13?.find(s => s.laws?.short_name === 'RDL 5/2015');
    if (ebep13) {
      console.log('');
      console.log('=== ARTÍCULOS DEL RDL 5/2015 EN TEMA 13 ===');
      console.log('Total:', ebep13.article_numbers?.length);
      console.log('Lista completa:', ebep13.article_numbers?.join(', '));
    }
  }

  // Contar total de artículos del EBEP en todos los temas de auxiliar
  const { data: allTopics } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', 'auxiliar_administrativo');

  const topicIds = allTopics?.map(t => t.id) || [];

  const { data: allScopes } = await supabase
    .from('topic_scope')
    .select('article_numbers, laws(short_name)')
    .in('topic_id', topicIds);

  const ebepScopes = allScopes?.filter(s => s.laws?.short_name === 'RDL 5/2015') || [];
  const allEbepArticles = new Set();
  ebepScopes.forEach(s => {
    s.article_numbers?.forEach(a => allEbepArticles.add(a));
  });

  console.log('');
  console.log('=== TOTAL ARTÍCULOS RDL 5/2015 EN AUXILIAR ADMINISTRATIVO ===');
  console.log('Artículos únicos:', allEbepArticles.size);
  console.log('Lista:', [...allEbepArticles].sort((a,b) => parseInt(a) - parseInt(b)).join(', '));
})();
