const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('questions')
    .select('tags')
    .contains('tags', ['T301'])
    .eq('is_active', true);

  console.log('=== PREGUNTAS T301 ===');
  console.log('Total:', data?.length);

  const byTag = {};
  data?.forEach(q => {
    const tags = q.tags || [];
    tags.forEach(tag => {
      if (tag !== 'T301' && tag !== 'Bloque III') {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    });
  });

  console.log('\nPor subcategoría:');
  Object.entries(byTag).sort((a,b) => b[1] - a[1]).forEach(([tag, count]) => {
    console.log('  ' + tag + ': ' + count);
  });
})();
