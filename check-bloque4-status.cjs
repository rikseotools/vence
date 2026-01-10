const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const temas = ['T401', 'T402', 'T403', 'T404', 'T405', 'T406', 'T407', 'T408', 'T409'];
  console.log('=== Estado Bloque IV ===\n');

  let total = 0;
  let sinArticuloTotal = 0;

  for (const tema of temas) {
    const { data, count } = await supabase
      .from('questions')
      .select('id, primary_article_id', { count: 'exact' })
      .contains('tags', [tema])
      .eq('is_active', true);

    const conArt = (data || []).filter(q => q.primary_article_id).length;
    const sinArt = (data || []).filter(q => !q.primary_article_id).length;

    const status = count > 0 ? '✅' : '⏳';
    console.log(status, tema + ':', count, 'preguntas (sin artículo:', sinArt + ')');
    total += (count || 0);
    sinArticuloTotal += sinArt;
  }

  console.log('\nTotal Bloque IV:', total, 'preguntas');
  console.log('Sin artículo vinculado:', sinArticuloTotal);

  // Verificar también preguntas con tag "Bloque IV" que no tienen tema específico
  const { data: bloqueIV } = await supabase
    .from('questions')
    .select('id, tags, primary_article_id')
    .contains('tags', ['Bloque IV'])
    .eq('is_active', true);

  const sinArtBloqueIV = (bloqueIV || []).filter(q => !q.primary_article_id).length;
  console.log('\nTotal con tag Bloque IV:', bloqueIV?.length || 0);
  console.log('Sin artículo (Bloque IV):', sinArtBloqueIV);
})();
