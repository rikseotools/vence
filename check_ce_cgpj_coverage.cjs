const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('═'.repeat(80));
  console.log('VERIFICACIÓN: CGPJ EN LA CONSTITUCIÓN ESPAÑOLA');
  console.log('═'.repeat(80));

  // Obtener CE
  const { data: ce } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'CE')
    .single();

  console.log('\n🔍 Artículos de la CE en el scope actual del Tema 6 (117-127):\n');

  for (let artNum = 117; artNum <= 127; artNum++) {
    const { data: article } = await supabase
      .from('articles')
      .select('article_number, title, content')
      .eq('law_id', ce.id)
      .eq('article_number', artNum.toString())
      .single();

    if (article) {
      console.log(`📄 Art. ${article.article_number}: ${article.title || 'Sin título'}`);

      // Resaltar si menciona CGPJ o composición
      const mentionsCGPJ = article.content?.match(/consejo general del poder judicial|cgpj/i);
      const mentionsComposition = article.content?.match(/composición|miembros|vocales/i);

      if (mentionsCGPJ || mentionsComposition) {
        console.log(`   ⭐ RELEVANTE para CGPJ`);
        console.log(`   Contenido:`);
        console.log(`   ${article.content?.substring(0, 600).replace(/\n/g, '\n   ')}`);
      } else {
        console.log(`   ${article.content?.substring(0, 200).replace(/\n/g, '\n   ')}...`);
      }
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('🔍 Buscando "Consejo General" en toda la CE:\n');

  const { data: cgpjCE } = await supabase
    .from('articles')
    .select('article_number, title, content')
    .eq('law_id', ce.id)
    .ilike('content', '%Consejo General del Poder Judicial%')
    .order('article_number');

  if (cgpjCE && cgpjCE.length > 0) {
    console.log(`Encontrados ${cgpjCE.length} artículos que mencionan CGPJ:\n`);
    cgpjCE.forEach(a => {
      const inScope = parseInt(a.article_number) >= 117 && parseInt(a.article_number) <= 127;
      console.log(`${inScope ? '✅ EN SCOPE' : '❌ FUERA'} Art. ${a.article_number}: ${a.title || 'Sin título'}`);
    });
  } else {
    console.log('❌ No se encontró "Consejo General del Poder Judicial" en la CE');
    console.log('Probando búsqueda más amplia...\n');

    const { data: consejo } = await supabase
      .from('articles')
      .select('article_number, title, content')
      .eq('law_id', ce.id)
      .or('content.ilike.%Consejo General%,content.ilike.%órgano de gobierno%')
      .order('article_number');

    if (consejo && consejo.length > 0) {
      consejo.forEach(a => {
        const inScope = parseInt(a.article_number) >= 117 && parseInt(a.article_number) <= 127;
        console.log(`${inScope ? '✅ EN SCOPE' : '❌ FUERA'} Art. ${a.article_number}: ${a.title || 'Sin título'}`);
        const match = a.content.match(/.{0,150}(Consejo General|órgano de gobierno).{0,150}/i);
        if (match) {
          console.log(`   "${match[0]}"`);
        }
        console.log('');
      });
    }
  }

  console.log('═'.repeat(80));
  console.log('📊 RESUMEN: Cobertura del CGPJ en el epígrafe\n');

  console.log('El epígrafe dice: "El Consejo General del Poder Judicial: composición y funciones"\n');
  console.log('Cobertura actual:');
  console.log('  ✅ CE arts. 117-127: Poder Judicial (incluye mención al CGPJ si existe)');
  console.log('  ❌ LOPJ: Falta gobierno del PJ y CGPJ (arts. 104-105)');
  console.log('');
  console.log('Nota: Los artículos específicos sobre composición del CGPJ (122-148 LOPJ)');
  console.log('      fueron suprimidos en la reforma LO 3/2024.');
  console.log('');

  console.log('═'.repeat(80));
})();
