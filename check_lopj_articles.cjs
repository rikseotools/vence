const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Obtener LOPJ
  const { data: lopj } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'LO 6/1985')
    .single();

  // Obtener TODOS los artículos de LOPJ
  const { data: articles } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', lopj.id)
    .order('article_number');

  // Filtrar los que están en el rango 122-148
  const cgpjArticles = articles.filter(a => {
    const num = parseInt(a.article_number);
    return num >= 122 && num <= 148;
  });

  console.log(`📊 Artículos de LOPJ en rango 122-148: ${cgpjArticles.length}`);
  console.log(`Artículos: ${cgpjArticles.map(a => a.article_number).join(', ')}`);

  if (cgpjArticles.length === 0) {
    console.log('\n❌ NO HAY ARTÍCULOS 122-148 en la tabla articles');
    console.log('\n📋 Verificando qué artículos hay cerca:');

    const nearby = articles.filter(a => {
      const num = parseInt(a.article_number);
      return num >= 100 && num <= 160;
    });

    console.log(`Artículos entre 100-160: ${nearby.map(a => a.article_number).join(', ')}`);
  }

  // Verificar también los del Ministerio Fiscal (541-584)
  const mfArticles = articles.filter(a => {
    const num = parseInt(a.article_number.replace(/\D/g, ''));
    return num >= 541 && num <= 584;
  });

  console.log(`\n📊 Artículos del MF en rango 541-584: ${mfArticles.length}`);
})();
