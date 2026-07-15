const { createClient } = require('./lib/pg-agnostic-client.cjs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Tags que procesé y su mapeo a topic_number
  const tagMapping = {
    'T101': 1,   // Constitución
    'T102': 2,   // La Corona
    'T204': 204, // Protección de datos
    'T301': 301, // Fuentes del derecho
    'T302': 302, // Acto administrativo
    'T305': 305  // Procedimientos
  };

  console.log('=== Verificación de topic_scope ===\n');

  for (const [tag, topicNum] of Object.entries(tagMapping)) {
    // Buscar el topic
    const { data: topic } = await supabase
      .from('topics')
      .select('id, title')
      .eq('position_type', 'administrativo')
      .eq('topic_number', topicNum)
      .single();

    if (!topic) {
      console.log(tag + ' -> topic_number ' + topicNum + ': ❌ NO EXISTE EN BD\n');
      continue;
    }

    console.log(tag + ' -> topic_number ' + topicNum + ': ' + topic.title?.substring(0, 40));

    // Buscar sus scopes
    const { data: scopes } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers, laws(short_name)')
      .eq('topic_id', topic.id);

    if (scopes && scopes.length > 0) {
      for (const s of scopes) {
        const lawName = s.laws?.short_name || 'Sin ley';
        const artCount = s.article_numbers?.length || 0;
        console.log('  ✓ ' + lawName + ': ' + artCount + ' artículos');
      }
    } else {
      console.log('  ⚠️ SIN SCOPE CONFIGURADO');
    }

    // Verificar cuántas preguntas tienen este tag
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .contains('tags', [tag])
      .eq('is_active', true);

    console.log('  📋 Preguntas con tag ' + tag + ': ' + count);
    console.log('');
  }

  // Verificar también los topics mal mapeados (206, 207)
  console.log('\n=== Topics que podrían estar mal (206, 207) ===\n');

  for (const topicNum of [206, 207]) {
    const { data: topic } = await supabase
      .from('topics')
      .select('id, title')
      .eq('position_type', 'administrativo')
      .eq('topic_number', topicNum)
      .single();

    if (topic) {
      console.log('topic_number ' + topicNum + ': EXISTE - ' + topic.title);
    } else {
      console.log('topic_number ' + topicNum + ': NO EXISTE');
    }
  }
})();
