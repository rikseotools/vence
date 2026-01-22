const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data: lopj } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('short_name', 'LO 6/1985')
    .single();

  console.log('🔍 Buscando artículos del CGPJ en LOPJ...\n');

  // 1. Buscar por título
  const { data: byTitle } = await supabase
    .from('articles')
    .select('article_number, title')
    .eq('law_id', lopj.id)
    .or('title.ilike.%Consejo General%,title.ilike.%CGPJ%')
    .order('article_number')
    .limit(30);

  console.log('📋 Por título (Consejo General/CGPJ):');
  if (byTitle && byTitle.length > 0) {
    byTitle.forEach(a => console.log(`   ${a.article_number}: ${a.title}`));
  } else {
    console.log('   Ninguno');
  }

  // 2. Ver estructura completa de artículos
  const { data: all } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', lopj.id)
    .order('article_number');

  // Encontrar huecos en la numeración
  console.log('\n📊 Análisis de numeración (mostrando huecos):');

  let lastNum = 0;
  const gaps = [];

  all.forEach(a => {
    const num = parseInt(a.article_number);
    if (!isNaN(num) && num > lastNum + 1) {
      gaps.push({ start: lastNum + 1, end: num - 1 });
    }
    lastNum = num;
  });

  console.log('\nHuecos importantes (>10 artículos):');
  gaps.filter(g => (g.end - g.start) > 10).forEach(g => {
    console.log(`   Arts. ${g.start}-${g.end} FALTAN (${g.end - g.start + 1} artículos)`);
  });

  // 3. Verificar rango específico 100-200
  const range = all.filter(a => {
    const num = parseInt(a.article_number);
    return num >= 100 && num <= 200;
  }).map(a => a.article_number);

  console.log(`\n📄 Artículos entre 100-200 (${range.length} total):`);
  console.log(`   ${range.join(', ')}`);

  // 4. Buscar LIBRO II (que es donde está el CGPJ tradicionalmente)
  const { data: libroII } = await supabase
    .from('articles')
    .select('article_number, title')
    .eq('law_id', lopj.id)
    .ilike('title', '%LIBRO%II%')
    .limit(5);

  console.log('\n📖 Referencias a LIBRO II:');
  if (libroII && libroII.length > 0) {
    libroII.forEach(a => console.log(`   ${a.article_number}: ${a.title}`));
  } else {
    console.log('   Ninguno con "LIBRO II" en título');
  }
})();
