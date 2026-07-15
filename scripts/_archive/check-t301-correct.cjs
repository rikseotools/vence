const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs correctos
const CE_ID = '6ad91a6c-41ec-431f-9c80-5f5566834941';

(async () => {
  console.log('=== VERIFICACIÓN T301 - FUENTES DEL DERECHO ===\n');

  // Verificar artículos CE necesarios
  const ceNeeded = ['9', '72', '81', '82', '83', '84', '85', '86', '87', '92', '96', '97', '104', '107', '116', '128', '137', '149', '150', '161'];

  const { data: ceArts } = await supabase
    .from('articles')
    .select('article_number')
    .eq('law_id', CE_ID)
    .in('article_number', ceNeeded);

  const ceExisting = ceArts ? ceArts.map(a => a.article_number) : [];
  const ceMissing = ceNeeded.filter(n => ceExisting.indexOf(n) === -1);

  console.log('CONSTITUCIÓN ESPAÑOLA:');
  console.log('  Necesarios: ' + ceNeeded.length);
  console.log('  Existentes: ' + ceExisting.length + ' → ' + ceExisting.join(', '));
  console.log('  Faltan: ' + (ceMissing.length > 0 ? ceMissing.join(', ') : 'Ninguno'));

  // Verificar Ley 50/1997
  const { data: ley50 } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'Ley 50/1997')
    .single();

  if (ley50) {
    const { data: ley50Arts } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', ley50.id)
      .in('article_number', ['23', '24', '25', '26', '27']);

    console.log('\nLEY 50/1997 (del Gobierno):');
    console.log('  Artículos 23-27: ' + (ley50Arts ? ley50Arts.map(a => a.article_number).join(', ') : 'Ninguno'));
  }

  // Verificar Ley 39/2015 (128-133)
  const { data: lpac } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'Ley 39/2015')
    .single();

  if (lpac) {
    const { data: lpacArts } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', lpac.id)
      .in('article_number', ['128', '129', '130', '131', '132', '133']);

    const lpacExisting = lpacArts ? lpacArts.map(a => a.article_number) : [];
    const lpacNeeded = ['128', '129', '130', '131', '132', '133'];
    const lpacMissing = lpacNeeded.filter(n => lpacExisting.indexOf(n) === -1);

    console.log('\nLEY 39/2015 (LPAC - Título VI Potestad Reglamentaria):');
    console.log('  Existentes: ' + (lpacExisting.length > 0 ? lpacExisting.join(', ') : 'Ninguno'));
    console.log('  Faltan: ' + (lpacMissing.length > 0 ? lpacMissing.join(', ') : 'Ninguno'));
  }

  // Buscar Código Civil
  console.log('\nCÓDIGO CIVIL:');
  const { data: cc } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.eq.CC,short_name.ilike.%Código Civil%,name.ilike.%Código Civil%');

  if (cc && cc.length > 0) {
    cc.forEach(l => {
      console.log('  Encontrado: ' + l.short_name + ' | ' + l.id);
    });
  } else {
    console.log('  NO existe - hay que crearlo');
  }
})();
