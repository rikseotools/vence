const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const temaNumber = parseInt(process.argv[2]) || 2;

(async () => {
  // Buscar el tema
  const { data: topic } = await supabase
    .from('topics')
    .select('id, topic_number, title, description')
    .eq('position_type', 'tramitacion_procesal')
    .eq('topic_number', temaNumber)
    .single();

  if (!topic) {
    console.log(`❌ Tema ${temaNumber} no encontrado`);
    return;
  }

  console.log(`📚 TEMA ${temaNumber}: ${topic.title}`);
  console.log('━'.repeat(80));
  console.log('\n📋 EPÍGRAFE OFICIAL:');
  console.log(topic.description);
  console.log('\n' + '━'.repeat(80));

  // Obtener el scope
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('*, laws(short_name, name)')
    .eq('topic_id', topic.id);

  console.log('\n🔍 SCOPE EN BD:\n');

  if (!scopes || scopes.length === 0) {
    console.log('❌ No hay scope configurado para este tema');
    return;
  }

  for (const scope of scopes) {
    console.log(`📚 ${scope.laws.short_name} (${scope.laws.name})`);

    if (scope.article_numbers && scope.article_numbers.length > 0) {
      console.log(`   📄 Artículos (${scope.article_numbers.length}): ${scope.article_numbers.slice(0, 50).join(', ')}${scope.article_numbers.length > 50 ? '...' : ''}`);
    } else {
      console.log('   ⚠️  Sin artículos específicos (incluye toda la ley con preguntas)');
    }
    console.log('');
  }

  // Mostrar también del archivo de temario
  const fs = require('fs');
  const temario = JSON.parse(fs.readFileSync('./data/temarios/tramitacion-procesal.json', 'utf8'));
  const temaInfo = temario.temas.find(t => t.numero === temaNumber);

  if (temaInfo) {
    console.log('━'.repeat(80));
    console.log('\n📖 DEL ARCHIVO tramitacion-procesal.json:\n');
    console.log(`Título: ${temaInfo.titulo}`);
    console.log(`Epígrafe: ${temaInfo.epigrafe}`);
  }
})();
