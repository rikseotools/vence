const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const scopeCorregido = JSON.parse(
  fs.readFileSync('./data/temarios/tramitacion-procesal-scope-corregido.json', 'utf8')
);

async function checkTema(numero) {
  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, description')
    .eq('position_type', 'tramitacion_procesal')
    .eq('topic_number', numero)
    .single();

  if (!topic) return null;

  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('*, laws(short_name)')
    .eq('topic_id', topic.id);

  const esperado = scopeCorregido.temas.find(t => t.numero === numero);

  return {
    numero,
    title: topic.title,
    scopeActual: scopes?.map(s => ({
      ley: s.laws.short_name,
      articulos: s.article_numbers?.length || 0
    })) || [],
    scopeEsperado: esperado?.scope_correcto || [],
    accion: esperado?.accion || 'OK',
    status: esperado?.accion === 'CORRECTO' ? '✅' : '⚠️'
  };
}

(async () => {
  console.log('═'.repeat(80));
  console.log('ANÁLISIS DE TEMAS - TRAMITACIÓN PROCESAL');
  console.log('═'.repeat(80));
  console.log('');

  const temasARevisar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  for (const num of temasARevisar) {
    const analisis = await checkTema(num);
    if (!analisis) continue;

    console.log(`${analisis.status} TEMA ${analisis.numero}: ${analisis.title}`);
    console.log(`   Acción: ${analisis.accion}`);

    if (analisis.scopeActual.length > 0) {
      console.log('   Scope BD:');
      analisis.scopeActual.forEach(s => {
        console.log(`     - ${s.ley}: ${s.articulos > 0 ? s.articulos + ' arts' : 'TODA LA LEY'}`);
      });
    }

    if (analisis.scopeEsperado.length > 0 && analisis.accion !== 'CORRECTO') {
      console.log('   Scope esperado:');
      analisis.scopeEsperado.forEach(s => {
        console.log(`     - ${s.ley}: ${s.articulos}`);
      });
    }
    console.log('');
  }

  console.log('═'.repeat(80));
})();
