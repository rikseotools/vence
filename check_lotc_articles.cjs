const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Buscar la ley LOTC
  const { data: lotc, error: lotcError } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .ilike('short_name', '%LOTC%')
    .single();

  if (lotcError) {
    console.error('❌ Error buscando LOTC:', lotcError);
    return;
  }

  console.log('📚 LOTC encontrada:');
  console.log(`   ${lotc.short_name}`);
  console.log(`   ID: ${lotc.id}\n`);

  // Buscar artículos de LOTC
  const { data: articles, error: artError } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', lotc.id)
    .order('article_number');

  if (artError) {
    console.error('❌ Error buscando artículos:', artError);
    return;
  }

  console.log(`📄 Artículos de LOTC en la tabla articles: ${articles.length} total\n`);

  if (articles.length > 0) {
    console.log('Primeros 10 artículos:');
    articles.slice(0, 10).forEach(art => {
      console.log(`   Art. ${art.article_number}: ${art.title || 'Sin título'}`);
    });

    if (articles.length > 10) {
      console.log(`   ... y ${articles.length - 10} artículos más`);
    }

    console.log(`\nNúmeros de artículos: ${articles.map(a => a.article_number).join(', ')}`);
  } else {
    console.log('⚠️  No hay artículos de LOTC en la tabla articles');
  }
})();
