require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Buscar todos los artículos que tengan saltos de línea problemáticos entre dígitos
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, article_number, title, content, law_id, laws!law_id(short_name)')
    .not('content', 'is', null);

  if (error) { console.error('Error:', error); return; }

  console.log('Total artículos con contenido:', articles.length);
  console.log('\n=== ARTÍCULOS CON SALTOS DE LÍNEA PROBLEMÁTICOS ===\n');

  let problemCount = 0;
  const problems = [];

  for (const art of articles) {
    if (art.content) {
      // Buscar patrón: dígito, salto de línea, dígito (típico de años mal formateados)
      const hasLineBreakIssue = /\d\n\d/.test(art.content);

      if (hasLineBreakIssue) {
        problemCount++;
        const lawName = art.laws?.short_name || 'Ley desconocida';
        console.log(problemCount + '. ' + lawName + ' - Art. ' + art.article_number);
        console.log('   ID: ' + art.id);

        // Encontrar el fragmento problemático
        const match = art.content.match(/\d\n\d/g);
        if (match) {
          console.log('   Patrones encontrados:', match.length);
        }

        // Mostrar muestra del contenido
        const sample = art.content.substring(0, 200).replace(/\n/g, '↵');
        console.log('   Muestra: ' + sample + '...\n');

        problems.push({
          id: art.id,
          law: lawName,
          articleNumber: art.article_number
        });
      }
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('Total artículos con problemas:', problemCount);
  console.log('\nIDs para actualizar:');
  problems.forEach(p => {
    console.log("'" + p.id + "', // " + p.law + " Art. " + p.articleNumber);
  });
})();
