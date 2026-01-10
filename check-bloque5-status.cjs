const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Contar preguntas por tema en Bloque V
  const { data: all, error } = await supabase
    .from('questions')
    .select('id, tags, primary_article_id, explanation')
    .eq('is_active', true);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const temas = ['T501', 'T502', 'T503', 'T504', 'T505', 'T506'];
  console.log('=== Estado de preguntas por tema (Bloque V) ===\n');

  let totalSinArticulo = [];

  for (const tema of temas) {
    const preguntas = all.filter(q => q.tags && q.tags.includes(tema));
    const conArticulo = preguntas.filter(q => q.primary_article_id);
    const sinArticulo = preguntas.filter(q => !q.primary_article_id);

    console.log(tema + ':');
    console.log('  Total:', preguntas.length);
    console.log('  Con artículo:', conArticulo.length);
    console.log('  Sin artículo:', sinArticulo.length);
    console.log('');

    totalSinArticulo = totalSinArticulo.concat(sinArticulo.map(q => ({...q, tema})));
  }

  // Verificar leyes existentes
  console.log('=== Leyes relacionadas con Bloque V ===\n');
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name, is_active, boe_url')
    .or('short_name.ilike.%30/1984%,short_name.ilike.%5/2015%,short_name.ilike.%364/1995%,short_name.ilike.%365/1995%,short_name.ilike.%33/1986%,short_name.ilike.%462/2002%,short_name.ilike.%Orden%1992%,short_name.ilike.%Orden%1996%');

  for (const law of (laws || [])) {
    const hasUrl = law.boe_url ? '✅' : '❌';
    console.log(hasUrl, law.short_name);
    console.log('   ID:', law.id);
  }

  // Si hay preguntas sin artículo, analizar qué leyes necesitan
  if (totalSinArticulo.length > 0) {
    console.log('\n=== Análisis de preguntas sin artículo ===\n');

    const lawRefs = {};
    for (const q of totalSinArticulo) {
      const text = (q.explanation || '').toLowerCase();

      if (text.includes('30/1984')) lawRefs['Ley 30/1984'] = (lawRefs['Ley 30/1984'] || 0) + 1;
      if (text.includes('30 de julio de 1992') || text.includes('confección de nómina')) lawRefs['Orden 30/07/1992'] = (lawRefs['Orden 30/07/1992'] || 0) + 1;
      if (text.includes('1 de febrero de 1996')) lawRefs['Orden 01/02/1996'] = (lawRefs['Orden 01/02/1996'] || 0) + 1;
      if (text.includes('5/2015') || text.includes('trebep')) lawRefs['TREBEP'] = (lawRefs['TREBEP'] || 0) + 1;
      if (text.includes('364/1995')) lawRefs['RD 364/1995'] = (lawRefs['RD 364/1995'] || 0) + 1;
      if (text.includes('462/2002')) lawRefs['RD 462/2002'] = (lawRefs['RD 462/2002'] || 0) + 1;
      if (text.includes('33/1986')) lawRefs['RD 33/1986'] = (lawRefs['RD 33/1986'] || 0) + 1;
      if (text.includes('365/1995')) lawRefs['RD 365/1995'] = (lawRefs['RD 365/1995'] || 0) + 1;
    }

    console.log('Leyes referenciadas en preguntas sin artículo:');
    for (const [ref, count] of Object.entries(lawRefs).sort((a,b) => b[1] - a[1])) {
      console.log('  -', ref + ':', count, 'preguntas');
    }

    console.log('\nEjemplos:');
    for (const q of totalSinArticulo.slice(0, 3)) {
      console.log('  [' + q.tema + ']', (q.explanation || '').substring(0, 100) + '...');
    }
  } else {
    console.log('\n✅ Todas las preguntas de Bloque V tienen artículo vinculado');
  }
})();
