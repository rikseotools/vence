const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Buscar tema 6
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', 'tramitacion_procesal')
    .eq('topic_number', 6)
    .single();

  // Buscar LOPJ
  const { data: lopj } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('short_name', 'LO 6/1985')
    .single();

  // Obtener scope de LOPJ para tema 6
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('article_numbers')
    .eq('topic_id', topic.id)
    .eq('law_id', lopj.id)
    .single();

  console.log('📋 TEMA 6 - Scope LOPJ en BD:\n');
  console.log('Artículos configurados:', scope.article_numbers.length);
  console.log('Rango:', scope.article_numbers[0], '-', scope.article_numbers[scope.article_numbers.length - 1]);
  console.log('\nPrimeros 10:', scope.article_numbers.slice(0, 10).join(', '));
  console.log('Últimos 10:', scope.article_numbers.slice(-10).join(', '));

  // Verificar si incluye artículos del CGPJ (122-148)
  const cgpjArticles = scope.article_numbers.filter(a => {
    const num = parseInt(a);
    return num >= 122 && num <= 148;
  });

  const mfArticles = scope.article_numbers.filter(a => {
    const num = parseInt(a);
    return num >= 541 && num <= 584;
  });

  console.log('\n📊 Análisis:');
  console.log(`  CGPJ (arts. 122-148): ${cgpjArticles.length} artículos`);
  console.log(`  Ministerio Fiscal (arts. 541-584): ${mfArticles.length} artículos`);

  if (cgpjArticles.length === 0) {
    console.log('\n❌ PROBLEMA: Faltan artículos del CGPJ (122-148)');
    console.log('   El epígrafe menciona "CGPJ: composición y funciones"');
  } else {
    console.log('\n✅ Incluye artículos del CGPJ');
  }
})();
