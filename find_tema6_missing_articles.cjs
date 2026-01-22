const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EPIGRAFE = `El Poder Judicial. El Consejo General del Poder Judicial: composición y funciones.
La jurisdicción: Jueces y Magistrados: Funciones y competencias. La independencia judicial.
El Ministerio Fiscal: Organización y funciones. Sistemas de acceso a las carreras judicial y fiscal.`;

(async () => {
  console.log('═'.repeat(80));
  console.log('BÚSQUEDA DE ARTÍCULOS FALTANTES - TEMA 6');
  console.log('═'.repeat(80));
  console.log('\n📋 EPÍGRAFE:');
  console.log(EPIGRAFE);
  console.log('\n' + '═'.repeat(80));

  // Obtener LOPJ
  const { data: lopj } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', 'LO 6/1985')
    .single();

  console.log('\n🔍 BÚSQUEDA 1: CGPJ - Composición y Funciones\n');
  console.log('Buscando artículos que mencionen:');
  console.log('- "Consejo General del Poder Judicial"');
  console.log('- "CGPJ"');
  console.log('- "composición"');
  console.log('- "funciones"');
  console.log('- "miembros"');
  console.log('');

  const { data: cgpjArticles } = await supabase
    .from('articles')
    .select('article_number, title, content')
    .eq('law_id', lopj.id)
    .or(
      'title.ilike.%Consejo General%,' +
      'title.ilike.%CGPJ%,' +
      'title.ilike.%composición%,' +
      'content.ilike.%Consejo General del Poder Judicial%,' +
      'content.ilike.%composición del Consejo%,' +
      'content.ilike.%miembros del Consejo%'
    )
    .order('article_number')
    .limit(50);

  if (cgpjArticles && cgpjArticles.length > 0) {
    console.log(`Encontrados ${cgpjArticles.length} artículos relacionados con CGPJ:\n`);

    cgpjArticles.forEach(a => {
      const num = parseInt(a.article_number);
      const inCurrentScope = (num === 13 || num === 14 || (num >= 541 && num <= 584));
      const status = inCurrentScope ? '✅ EN SCOPE' : '❌ FUERA';

      console.log(`${status} Art. ${a.article_number}: ${a.title?.substring(0, 80) || 'Sin título'}`);

      // Mostrar snippet de contenido si menciona composición o funciones
      if (a.content?.match(/composición|funciones|miembros/i)) {
        const snippet = a.content.substring(0, 150).replace(/\n/g, ' ');
        console.log(`   📝 "${snippet}..."`);
      }
    });
  } else {
    console.log('❌ No se encontraron artículos relacionados con CGPJ');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🔍 BÚSQUEDA 2: Acceso a las Carreras Judicial y Fiscal\n');
  console.log('Buscando artículos que mencionen:');
  console.log('- "acceso"');
  console.log('- "carrera judicial"');
  console.log('- "carrera fiscal"');
  console.log('- "ingreso"');
  console.log('- "oposición"');
  console.log('');

  const { data: accesoArticles } = await supabase
    .from('articles')
    .select('article_number, title, content')
    .eq('law_id', lopj.id)
    .or(
      'title.ilike.%acceso%,' +
      'title.ilike.%carrera judicial%,' +
      'title.ilike.%ingreso%,' +
      'content.ilike.%acceso a la carrera%,' +
      'content.ilike.%sistemas de ingreso%,' +
      'content.ilike.%oposición%'
    )
    .order('article_number')
    .limit(50);

  if (accesoArticles && accesoArticles.length > 0) {
    console.log(`Encontrados ${accesoArticles.length} artículos relacionados con acceso a carreras:\n`);

    accesoArticles.forEach(a => {
      const num = parseInt(a.article_number);
      const inCurrentScope = (num === 13 || num === 14 || (num >= 541 && num <= 584));
      const status = inCurrentScope ? '✅ EN SCOPE' : '❌ FUERA';

      console.log(`${status} Art. ${a.article_number}: ${a.title?.substring(0, 80) || 'Sin título'}`);

      // Mostrar snippet si menciona sistemas o acceso
      if (a.content?.match(/sistema.*acceso|ingreso.*carrera|oposición/i)) {
        const snippet = a.content.substring(0, 150).replace(/\n/g, ' ');
        console.log(`   📝 "${snippet}..."`);
      }
    });
  } else {
    console.log('❌ No se encontraron artículos relacionados con acceso a carreras');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🔍 BÚSQUEDA 3: Rango 104-200 (donde tradicionalmente está CGPJ)\n');

  const { data: rangeArticles } = await supabase
    .from('articles')
    .select('article_number, title')
    .eq('law_id', lopj.id)
    .order('article_number');

  const filtered = rangeArticles.filter(a => {
    const num = parseInt(a.article_number);
    return num >= 104 && num <= 200;
  });

  console.log(`Artículos existentes entre 104-200: ${filtered.length}\n`);

  if (filtered.length > 0) {
    // Mostrar primeros 10 y últimos 10
    console.log('Primeros artículos:');
    filtered.slice(0, 10).forEach(a => {
      const num = parseInt(a.article_number);
      const inCurrentScope = (num >= 541 && num <= 584);
      const status = inCurrentScope ? '✅' : '  ';
      console.log(`${status} Art. ${a.article_number}: ${a.title?.substring(0, 70) || 'Sin título'}`);
    });

    if (filtered.length > 20) {
      console.log(`\n... (${filtered.length - 20} artículos intermedios) ...\n`);
    }

    if (filtered.length > 10) {
      console.log('Últimos artículos:');
      filtered.slice(-10).forEach(a => {
        const num = parseInt(a.article_number);
        const inCurrentScope = (num >= 541 && num <= 584);
        const status = inCurrentScope ? '✅' : '  ';
        console.log(`${status} Art. ${a.article_number}: ${a.title?.substring(0, 70) || 'Sin título'}`);
      });
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMEN Y RECOMENDACIÓN\n');

  // Identificar artículos candidatos para añadir al scope
  const cgpjCandidates = cgpjArticles?.filter(a => {
    const num = parseInt(a.article_number);
    return !(num === 13 || num === 14 || (num >= 541 && num <= 584));
  }).map(a => a.article_number) || [];

  const accesoCandidates = accesoArticles?.filter(a => {
    const num = parseInt(a.article_number);
    return !(num === 13 || num === 14 || (num >= 541 && num <= 584));
  }).map(a => a.article_number) || [];

  const allCandidates = [...new Set([...cgpjCandidates, ...accesoCandidates])].sort((a, b) => {
    return parseInt(a) - parseInt(b);
  });

  if (allCandidates.length > 0) {
    console.log('✅ Artículos candidatos a AÑADIR al scope de Tema 6:');
    console.log(`\n   ${allCandidates.join(', ')}\n`);
    console.log(`Total: ${allCandidates.length} artículos`);
    console.log('\nEstos artículos cubren los elementos faltantes del epígrafe:');
    console.log('  - CGPJ: composición y funciones');
    console.log('  - Sistemas de acceso a las carreras judicial y fiscal');
  } else {
    console.log('❌ No se encontraron artículos adicionales para cubrir el epígrafe');
  }

  console.log('\n' + '═'.repeat(80));
})();
