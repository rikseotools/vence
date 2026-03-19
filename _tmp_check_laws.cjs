const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data } = await s.from('laws').select('slug, short_name, name').eq('is_active', true).order('slug');
  for (const l of data) {
    if (l.name !== l.short_name) {
      console.log(`${l.slug} | ${l.short_name} | ${l.name}`);
    }
  }
})();
