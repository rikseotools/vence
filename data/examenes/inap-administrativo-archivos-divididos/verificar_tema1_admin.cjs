require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('🔍 VERIFICANDO TEMA 1 DE ADMINISTRATIVO C1\n');
  console.log('='.repeat(80));

  // Buscar Tema 1 de Administrativo
  const { data: tema1Admin } = await supabase
    .from('topics')
    .select('id, topic_number, title, position_type')
    .eq('position_type', 'administrativo')
    .eq('topic_number', 1)
    .single();

  console.log('\n📋 TEMA 1 - ADMINISTRATIVO:');
  console.log('ID:', tema1Admin.id);
  console.log('Título:', tema1Admin.title);
  console.log('Position type:', tema1Admin.position_type);

  // Obtener topic_scope para este tema
  const { data: scopeAdmin } = await supabase
    .from('topic_scope')
    .select('article_numbers, law_id, laws(id, short_name, name)')
    .eq('topic_id', tema1Admin.id);

  console.log('\n📚 Leyes asociadas al Tema 1:', scopeAdmin.length);
  scopeAdmin.forEach(s => {
    if (s.laws) {
      console.log(`  - ${s.laws.short_name}: ${s.article_numbers ? s.article_numbers.length : 0} artículos`);
    }
  });

  // Verificar específicamente LOTC
  const tieneTC = scopeAdmin.find(s => s.laws && (s.laws.short_name === 'LOTC' || s.laws.short_name.includes('2/1979')));

  console.log('\n🔍 ¿Tiene LOTC (Tribunal Constitucional)?', tieneTC ? '✅ SÍ' : '❌ NO');

  if (!tieneTC) {
    console.log('\n⚠️  LOTC NO está asociada al Tema 1 de Administrativo');

    // Verificar si LOTC está en Tema 1 de AUXILIAR
    const { data: tema1Aux } = await supabase
      .from('topics')
      .select('id')
      .eq('position_type', 'auxiliar_administrativo')
      .eq('topic_number', 1)
      .single();

    if (tema1Aux) {
      const { data: scopeAux } = await supabase
        .from('topic_scope')
        .select('laws(short_name)')
        .eq('topic_id', tema1Aux.id);

      const tieneTCAux = scopeAux?.find(s => s.laws && (s.laws.short_name === 'LOTC' || s.laws.short_name.includes('2/1979')));
      console.log('¿Está en Tema 1 de AUXILIAR?', tieneTCAux ? '✅ SÍ' : '❌ NO');

      if (tieneTCAux) {
        console.log('\n💡 CONCLUSIÓN: La LOTC existe en BD pero está asociada a AUXILIAR, no a ADMINISTRATIVO');
      }
    }

    // Ver en qué temas de Administrativo está la LOTC
    const { data: leyTC } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'LOTC')
      .single();

    if (leyTC) {
      const { data: temasConTC } = await supabase
        .from('topic_scope')
        .select('topics(topic_number, title, position_type)')
        .eq('law_id', leyTC.id);

      const temasAdmin = temasConTC.filter(t => t.topics.position_type === 'administrativo');

      if (temasAdmin.length > 0) {
        console.log('\n📋 LOTC está en estos temas de ADMINISTRATIVO:');
        temasAdmin.forEach(t => {
          console.log(`   Tema ${t.topics.topic_number}: ${t.topics.title.substring(0, 60)}...`);
        });
      } else {
        console.log('\n❌ LOTC NO está en ningún tema de ADMINISTRATIVO');
      }
    }
  } else {
    console.log('\n✅ PERFECTO: LOTC sí está en Tema 1 de Administrativo');
    console.log('Artículos:', tieneTC.article_numbers ? tieneTC.article_numbers.length : 0);
  }

  console.log('\n' + '='.repeat(80));
})();
