const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EPIGRAFE = `El Poder Judicial. El Consejo General del Poder Judicial: composición y funciones.
La jurisdicción: Jueces y Magistrados: Funciones y competencias. La independencia judicial.
El Ministerio Fiscal: Organización y funciones. Sistemas de acceso a las carreras judicial y fiscal.`;

const TEMAS_EPIGRAFE = [
  { tema: 'El Poder Judicial', contenido: 'Concepto general' },
  { tema: 'CGPJ', contenido: 'composición y funciones' },
  { tema: 'Jueces y Magistrados', contenido: 'Funciones y competencias' },
  { tema: 'Independencia judicial', contenido: 'Principio de independencia' },
  { tema: 'Ministerio Fiscal', contenido: 'Organización y funciones' },
  { tema: 'Acceso carreras', contenido: 'Sistemas de acceso judicial y fiscal' }
];

(async () => {
  console.log('═'.repeat(80));
  console.log('VERIFICACIÓN DE COBERTURA - TEMA 6');
  console.log('═'.repeat(80));
  console.log('\n📋 EPÍGRAFE OFICIAL:');
  console.log(EPIGRAFE);
  console.log('\n' + '═'.repeat(80));

  // 1. Obtener scope actual
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', 'tramitacion_procesal')
    .eq('topic_number', 6)
    .single();

  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('*, laws(id, short_name, name)')
    .eq('topic_id', topic.id);

  console.log('\n📚 SCOPE ACTUAL EN BD:\n');

  for (const scope of scopes) {
    console.log(`${scope.laws.short_name}:`);
    if (scope.article_numbers && scope.article_numbers.length > 0) {
      console.log(`   Artículos: ${scope.article_numbers[0]} - ${scope.article_numbers[scope.article_numbers.length - 1]} (${scope.article_numbers.length} total)`);
    } else {
      console.log(`   TODA LA LEY (sin filtro de artículos)`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🔍 ANÁLISIS DE COBERTURA:\n');

  // 2. Buscar artículos que contengan cada tema del epígrafe
  for (const item of TEMAS_EPIGRAFE) {
    console.log(`\n${item.tema}:`);
    console.log(`   Buscar: ${item.contenido}`);

    // Buscar en los artículos del scope actual
    let found = [];

    for (const scope of scopes) {
      const { data: articles } = await supabase
        .from('articles')
        .select('article_number, title, content')
        .eq('law_id', scope.laws.id)
        .or(
          `title.ilike.%${item.tema}%,content.ilike.%${item.tema}%,title.ilike.%${item.contenido}%,content.ilike.%${item.contenido}%`
        )
        .limit(10);

      if (articles && articles.length > 0) {
        // Filtrar por scope si tiene article_numbers
        const filtered = scope.article_numbers && scope.article_numbers.length > 0
          ? articles.filter(a => scope.article_numbers.includes(a.article_number))
          : articles;

        if (filtered.length > 0) {
          found.push({
            ley: scope.laws.short_name,
            articulos: filtered.map(a => a.article_number)
          });
        }
      }
    }

    if (found.length > 0) {
      console.log(`   ✅ CUBIERTO en:`);
      found.forEach(f => {
        console.log(`      ${f.ley}: Arts. ${f.articulos.slice(0, 5).join(', ')}${f.articulos.length > 5 ? '...' : ''}`);
      });
    } else {
      console.log(`   ❌ NO ENCONTRADO en el scope actual`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMEN:\n');

  // Verificar artículos específicos mencionados en archivo corregido
  const { data: lopj } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'LO 6/1985')
    .single();

  // Buscar artículos que mencionen CGPJ
  const { data: cgpjArticles } = await supabase
    .from('articles')
    .select('article_number, title')
    .eq('law_id', lopj.id)
    .or('title.ilike.%Consejo General%,content.ilike.%Consejo General del Poder Judicial%')
    .order('article_number')
    .limit(20);

  if (cgpjArticles && cgpjArticles.length > 0) {
    console.log('Artículos de LOPJ que mencionan CGPJ:');
    cgpjArticles.forEach(a => {
      const enScope = scopes.some(s =>
        s.laws.short_name === 'LO 6/1985' &&
        (!s.article_numbers || s.article_numbers.length === 0 || s.article_numbers.includes(a.article_number))
      );
      console.log(`   ${enScope ? '✅' : '❌'} Art. ${a.article_number}: ${a.title}`);
    });
  } else {
    console.log('❌ NO se encontraron artículos que mencionen "Consejo General del Poder Judicial"');
  }

  console.log('\n═'.repeat(80));
})();
