require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .ilike('short_name', '%Plan Gobierno Abierto%')
    .order('short_name');

  if (error) { console.error('Error:', error); return; }

  console.log('Planes de Gobierno Abierto encontrados:', laws.length);

  for (const law of laws) {
    console.log('\n=== ' + law.short_name + ' ===');
    console.log('Law ID:', law.id);

    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', law.id)
      .order('article_number');

    if (!articles || articles.length === 0) {
      console.log('  (Sin artículos)');
      continue;
    }

    for (const art of articles) {
      console.log('\n  Art. ' + art.article_number + ': ' + (art.title || '(sin título)'));

      if (art.content) {
        // Buscar dígitos separados por saltos de línea
        const hasLineBreakIssue = /\d\n\d/.test(art.content);

        if (hasLineBreakIssue) {
          console.log('  ⚠️  PROBLEMA: Saltos de línea entre dígitos');
          const sample = art.content.substring(0, 400);
          console.log('  Muestra:', JSON.stringify(sample));
        } else {
          console.log('  ✅ Contenido OK');
        }
        console.log('  Longitud:', art.content.length, 'chars');
      } else {
        console.log('  ⚠️  Sin contenido');
      }
    }
  }
})();
