const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('=== BÚSQUEDA DE CÓDIGO CIVIL ===');

  // Buscar con diferentes términos
  const { data: civil } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.ilike.%civil%,name.ilike.%civil%,short_name.ilike.%CC%,short_name.ilike.%1889%');

  console.log('Resultados:');
  if (civil && civil.length > 0) {
    civil.forEach(l => {
      console.log('  ' + l.short_name + ' | ' + l.id.substring(0,8) + ' | ' + (l.name || '').substring(0,60));
    });
  } else {
    console.log('  No encontrado');
  }

  // Verificar artículos CE
  console.log('\n=== ARTÍCULOS CE NECESARIOS ===');
  const ceNeeded = ['9', '72', '81', '82', '83', '84', '85', '86', '87', '92', '96', '97', '104', '107', '116', '128', '137', '149', '150', '161'];

  const { data: ceArts } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', '6ad91a6c-43e7-4952-8e3e-dea3c82da37c')
    .in('article_number', ceNeeded);

  const ceExisting = ceArts ? ceArts.map(a => a.article_number) : [];
  const ceMissing = ceNeeded.filter(n => ceExisting.indexOf(n) === -1);

  console.log('Existentes: ' + ceExisting.length + '/' + ceNeeded.length);
  console.log('Faltan: ' + (ceMissing.length > 0 ? ceMissing.join(', ') : 'Ninguno'));

  // Verificar Ley 50/1997
  console.log('\n=== ARTÍCULOS LEY 50/1997 (23-27) ===');
  const { data: ley50 } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'Ley 50/1997')
    .single();

  if (ley50) {
    const { data: ley50Arts } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', ley50.id);

    console.log('Artículos existentes: ' + (ley50Arts ? ley50Arts.map(a => a.article_number).join(', ') : 'Ninguno'));
  }

  // Verificar Ley 39/2015 (128-133)
  console.log('\n=== ARTÍCULOS LEY 39/2015 (128-133) ===');
  const { data: lpacArts } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', '218452f5-9ee5-45d9-bea0-4c3c52cd13df')
    .in('article_number', ['128', '129', '130', '131', '132', '133']);

  console.log('Existentes: ' + (lpacArts ? lpacArts.map(a => a.article_number).join(', ') : 'Ninguno'));
})();
