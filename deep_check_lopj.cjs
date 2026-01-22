const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 INVESTIGACIÓN PROFUNDA - LOPJ ARTÍCULOS 122-148\n');
  console.log('═'.repeat(80));

  // 1. Obtener TODAS las leyes con short_name similar
  console.log('\n1️⃣ Buscando leyes LOPJ...\n');
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.ilike.%LOPJ%,short_name.eq.LO 6/1985,name.ilike.%Poder Judicial%');

  console.log(`Encontradas ${laws?.length || 0} leyes:`);
  laws?.forEach(l => {
    console.log(`   ${l.short_name} - ${l.name}`);
    console.log(`   ID: ${l.id}`);
  });

  // 2. Para CADA ley, verificar artículos 122-148
  for (const law of laws || []) {
    console.log(`\n2️⃣ Verificando artículos en: ${law.short_name}`);
    console.log('─'.repeat(80));

    // Contar total
    const { count: total } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('law_id', law.id);

    console.log(`   Total artículos: ${total}`);

    // Buscar específicamente 122, 125, 130, 140, 145, 148
    const testArticles = ['122', '125', '130', '140', '145', '148'];

    for (const artNum of testArticles) {
      const { data: found, count } = await supabase
        .from('articles')
        .select('article_number, title', { count: 'exact' })
        .eq('law_id', law.id)
        .eq('article_number', artNum);

      if (count > 0) {
        console.log(`   ✅ Art. ${artNum}: ${found[0].title?.substring(0, 60) || 'Sin título'}...`);
      }
    }

    // Listar TODOS los artículos entre 115 y 155
    const { data: range } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', law.id)
      .order('article_number');

    const filtered = range?.filter(a => {
      const num = parseInt(a.article_number);
      return num >= 115 && num <= 155;
    }) || [];

    console.log(`\n   Artículos entre 115-155 (${filtered.length} total):`);
    if (filtered.length > 0) {
      console.log(`   ${filtered.map(a => a.article_number).join(', ')}`);
    } else {
      console.log('   NINGUNO');
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('3️⃣ VERIFICACIÓN FINAL\n');

  // Verificar si existe ALGÚN artículo 122 en TODA la base de datos
  const { data: any122, count: count122 } = await supabase
    .from('articles')
    .select('article_number, law_id, laws(short_name)', { count: 'exact' })
    .eq('article_number', '122');

  console.log(`¿Existe artículo "122" en ALGUNA ley? ${count122 > 0 ? 'SÍ' : 'NO'}`);
  if (count122 > 0) {
    any122.forEach(a => {
      console.log(`   - Encontrado en: ${a.laws?.short_name || 'desconocida'}`);
    });
  }

  console.log('\n✅ Investigación completada');
})();
