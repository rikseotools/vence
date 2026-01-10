const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('=== BUSCANDO CONSTITUCIÓN ESPAÑOLA ===');

  // Buscar todas las leyes que puedan ser la CE
  const { data: allCE } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.ilike.%CE%,short_name.ilike.%Constituc%,name.ilike.%Constituc%');

  console.log('\nLeyes encontradas con CE o Constituc:');
  if (allCE) {
    allCE.forEach(l => {
      console.log('  ' + l.short_name + ' | ' + l.id + ' | ' + (l.name || '').substring(0,60));
    });
  }

  // Si encontramos la CE, ver sus artículos
  const ceId = '6ad91a6c-43e7-4952-8e3e-dea3c82da37c';

  console.log('\n=== ARTÍCULOS DE LA CE (' + ceId + ') ===');

  const { data: ceArts, count } = await supabase
    .from('articles')
    .select('article_number, title', { count: 'exact' })
    .eq('law_id', ceId)
    .order('article_number');

  console.log('Total artículos:', count);

  if (ceArts && ceArts.length > 0) {
    console.log('Primeros 30 artículos:');
    ceArts.slice(0, 30).forEach(a => {
      console.log('  Art. ' + a.article_number + ': ' + (a.title || '').substring(0, 50));
    });
  } else {
    console.log('NO hay artículos para este law_id');
  }

  // Buscar si hay otra ley CE
  console.log('\n=== BUSCAR OTRA CE ===');
  const { data: otherCE } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('short_name', 'CE');

  if (otherCE) {
    for (const law of otherCE) {
      const { count: artCount } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('law_id', law.id);

      console.log(law.short_name + ' (' + law.id + '): ' + artCount + ' artículos');
    }
  }
})();
