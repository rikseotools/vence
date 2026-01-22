require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const temasAuxiliar = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,101,102,103,104,105,106,107,108,109,110,111,112];
  const resultado = [];
  
  console.log('📊 Exportando topic_scope de auxiliar_administrativo...\n');
  
  for (const numTema of temasAuxiliar) {
    const { data: topic } = await supabase
      .from('topics')
      .select('id, topic_number, title')
      .eq('position_type', 'auxiliar_administrativo')
      .eq('topic_number', numTema)
      .single();
    
    if (!topic) {
      console.log(`⚠️  Tema ${numTema}: NO ENCONTRADO`);
      continue;
    }
    
    const { data: scopes } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        title_numbers,
        chapter_numbers,
        weight,
        laws (id, short_name, name)
      `)
      .eq('topic_id', topic.id);
    
    resultado.push({
      topic_number: topic.topic_number,
      title: topic.title,
      leyes: scopes.filter(s => s.laws).map(s => ({
        nombre: s.laws.short_name,
        nombre_completo: s.laws.name,
        articulos: s.article_numbers || [],
        titulos: s.title_numbers || [],
        capitulos: s.chapter_numbers || [],
        weight: s.weight
      }))
    });
    
    console.log(`✅ Tema ${numTema}: ${scopes.length} leyes`);
  }
  
  fs.writeFileSync(
    'data/examenes/inap-administrativo-archivos-divididos/topic_scope_auxiliar_admin.json',
    JSON.stringify(resultado, null, 2)
  );
  
  console.log(`\n✅ Exportado: topic_scope_auxiliar_admin.json (${resultado.length} temas)`);
})();
