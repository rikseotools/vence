const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const lawId = '95680d57-6e5d-4ff7-85a9-9d09fd21de64'; // Ley 40/2015
  const needed = ['8', '9', '10', '12', '13', '14', '23', '24', '41'];

  const { data } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', lawId)
    .in('article_number', needed);

  const existing = data ? data.map(a => a.article_number) : [];
  const missing = needed.filter(n => existing.indexOf(n) === -1);

  console.log('Artículos Ley 40/2015 necesarios:', needed.join(', '));
  console.log('Existentes:', existing.join(', ') || 'Ninguno');
  console.log('Faltan:', missing.join(', ') || 'Ninguno');

  // Ver cuántos artículos tiene en total
  const { count } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', lawId);

  console.log('\nTotal artículos Ley 40/2015 en BD:', count);
})();
