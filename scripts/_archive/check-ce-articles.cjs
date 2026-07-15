const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Buscar todas las leyes que puedan ser CE
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.ilike.%CE%,short_name.ilike.%1978%,name.ilike.%constitución%,short_name.ilike.%Constitución%');

  console.log('Leyes relacionadas con Constitución:');
  for (const law of (laws || [])) {
    const { count } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('law_id', law.id)
      .eq('is_active', true);

    console.log(' -', law.short_name);
    console.log('   ID:', law.id);
    console.log('   Artículos:', count);
  }

  if (!laws || laws.length === 0) {
    console.log('❌ No se encontró Constitución Española en la BD');
    console.log('\nBuscando todas las leyes...');

    const { data: allLaws } = await supabase
      .from('laws')
      .select('short_name')
      .order('short_name')
      .limit(30);

    console.log('Primeras 30 leyes:');
    for (const l of (allLaws || [])) {
      console.log('  -', l.short_name);
    }
  }
})();
