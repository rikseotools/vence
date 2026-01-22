const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Artículos candidatos basados en búsqueda anterior, pero vamos a filtrar
const CANDIDATE_RANGES = {
  cgpj_core: [104, 105], // Menciones iniciales de CGPJ en gobierno del PJ
  acceso_carreras: [301, 302, 304, 305, 306, 307, 308] // Sistema de ingreso
};

(async () => {
  console.log('═'.repeat(80));
  console.log('ANÁLISIS DETALLADO - ARTÍCULOS CORE PARA TEMA 6');
  console.log('═'.repeat(80));

  const { data: lopj } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'LO 6/1985')
    .single();

  console.log('\n🔍 PARTE 1: CGPJ - Composición y Funciones\n');
  console.log('Analizando artículos 104-105 (gobierno del Poder Judicial):\n');

  for (const artNum of CANDIDATE_RANGES.cgpj_core) {
    const { data: article } = await supabase
      .from('articles')
      .select('article_number, title, content')
      .eq('law_id', lopj.id)
      .eq('article_number', artNum.toString())
      .single();

    if (article) {
      console.log(`📄 Artículo ${article.article_number}`);
      console.log(`   Título: ${article.title || 'Sin título'}`);
      console.log(`   Contenido (primeros 500 chars):`);
      console.log(`   ${article.content?.substring(0, 500).replace(/\n/g, '\n   ')}...`);
      console.log('');
    }
  }

  // Buscar artículos que ESPECÍFICAMENTE regulen composición del CGPJ
  console.log('─'.repeat(80));
  console.log('Buscando artículos específicos sobre "composición del Consejo":\n');

  const { data: composicionArticles } = await supabase
    .from('articles')
    .select('article_number, title, content')
    .eq('law_id', lopj.id)
    .ilike('content', '%composición del Consejo General%')
    .order('article_number')
    .limit(10);

  if (composicionArticles && composicionArticles.length > 0) {
    composicionArticles.forEach(a => {
      console.log(`📄 Art. ${a.article_number}: ${a.title || 'Sin título'}`);
      const match = a.content.match(/.{0,200}composición del Consejo General.{0,200}/i);
      if (match) {
        console.log(`   "${match[0]}..."`);
      }
      console.log('');
    });
  } else {
    console.log('❌ No se encontraron artículos sobre composición del CGPJ');
  }

  console.log('═'.repeat(80));
  console.log('🔍 PARTE 2: Sistemas de Acceso a las Carreras\n');
  console.log('Analizando artículos 301-308 (ingreso en la carrera judicial):\n');

  for (const artNum of CANDIDATE_RANGES.acceso_carreras) {
    const { data: article } = await supabase
      .from('articles')
      .select('article_number, title, content')
      .eq('law_id', lopj.id)
      .eq('article_number', artNum.toString())
      .single();

    if (article) {
      console.log(`📄 Artículo ${article.article_number}`);
      console.log(`   Título: ${article.title || 'Sin título'}`);
      console.log(`   Contenido (primeros 400 chars):`);
      console.log(`   ${article.content?.substring(0, 400).replace(/\n/g, '\n   ')}...`);
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('📊 COMPARACIÓN CON SCOPE ACTUAL\n');

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', 'tramitacion_procesal')
    .eq('topic_number', 6)
    .single();

  const { data: currentScope } = await supabase
    .from('topic_scope')
    .select('article_numbers')
    .eq('topic_id', topic.id)
    .eq('law_id', lopj.id)
    .single();

  console.log('Scope actual de LOPJ en Tema 6:');
  console.log(`  ${currentScope.article_numbers.length} artículos: ${currentScope.article_numbers.slice(0, 10).join(', ')}...`);
  console.log('');

  const allCandidates = [
    ...CANDIDATE_RANGES.cgpj_core,
    ...CANDIDATE_RANGES.acceso_carreras
  ].map(n => n.toString());

  const missing = allCandidates.filter(a => !currentScope.article_numbers.includes(a));

  console.log('Artículos candidatos a AÑADIR (filtrados):');
  console.log(`  ${missing.join(', ')}`);
  console.log('');
  console.log('Estos artículos cubren:');
  console.log('  ✅ CGPJ: gobierno del Poder Judicial (arts. 104-105)');
  console.log('  ✅ Acceso a carrera judicial: ingreso, oposición, Escuela Judicial (arts. 301-308)');
  console.log('');

  console.log('═'.repeat(80));
  console.log('💡 RECOMENDACIÓN FINAL\n');

  console.log('Para cubrir el epígrafe completo del Tema 6, se recomienda AÑADIR:');
  console.log('');
  console.log('1. Artículos 104-105: Gobierno del Poder Judicial y CGPJ');
  console.log('2. Artículos 301-308: Sistema de acceso a las carreras judicial y fiscal');
  console.log('');
  console.log(`Total: ${missing.length} artículos nuevos`);
  console.log(`Scope actual: ${currentScope.article_numbers.length} artículos`);
  console.log(`Scope propuesto: ${currentScope.article_numbers.length + missing.length} artículos`);
  console.log('');
  console.log('Nota: Los artículos 122-148 sobre composición del CGPJ fueron suprimidos en');
  console.log('      la reforma de 2024 (LO 3/2024), por lo que NO existen en la ley vigente.');
  console.log('');

  console.log('═'.repeat(80));
})();
