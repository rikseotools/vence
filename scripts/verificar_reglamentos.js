import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔍 VERIFICACIÓN DE ARTÍCULOS Y PREGUNTAS DE REGLAMENTOS\n');
console.log('=' .repeat(80));

// 1. Ver qué artículos de RCD tienen preguntas activas
console.log('\n📚 1. ARTÍCULOS DE REGLAMENTO DEL CONGRESO CON PREGUNTAS:\n');

const { data: rcdArticulos } = await supabase
  .from('articles')
  .select(`
    article_number,
    laws!inner(short_name),
    questions!primary_article_id(id)
  `)
  .in('laws.short_name', ['Reglamento del Congreso', 'RCD', 'Reglamento Congreso'])
  .eq('questions.is_active', true);

// Contar preguntas por artículo
const rcdConteo = {};
rcdArticulos?.forEach(art => {
  const num = art.article_number;
  if (!rcdConteo[num]) rcdConteo[num] = 0;
  if (art.questions && art.questions.length > 0) {
    rcdConteo[num] += art.questions.length;
  }
});

const rcdOrdenados = Object.entries(rcdConteo)
  .filter(([_, count]) => count > 0)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

rcdOrdenados.forEach(([art, count]) => {
  console.log(`  Artículo ${art}: ${count} pregunta(s)`);
});

// 2. Ver qué artículos de RS tienen preguntas activas
console.log('\n📚 2. ARTÍCULOS DE REGLAMENTO DEL SENADO CON PREGUNTAS:\n');

const { data: rsArticulos } = await supabase
  .from('articles')
  .select(`
    article_number,
    laws!inner(short_name),
    questions!primary_article_id(id)
  `)
  .in('laws.short_name', ['Reglamento del Senado', 'RS'])
  .eq('questions.is_active', true);

// Contar preguntas por artículo
const rsConteo = {};
rsArticulos?.forEach(art => {
  const num = art.article_number;
  if (!rsConteo[num]) rsConteo[num] = 0;
  if (art.questions && art.questions.length > 0) {
    rsConteo[num] += art.questions.length;
  }
});

const rsOrdenados = Object.entries(rsConteo)
  .filter(([_, count]) => count > 0)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

rsOrdenados.forEach(([art, count]) => {
  console.log(`  Artículo ${art}: ${count} pregunta(s)`);
});

// 3. Verificar específicamente los artículos mapeados en topic_scope
console.log('\n🎯 3. VERIFICACIÓN DE ARTÍCULOS MAPEADOS EN topic_scope:\n');

// Para RCD - artículos 133, 134, 135
console.log('Reglamento del Congreso - Artículos mapeados: 133, 134, 135');
for (const artNum of ['133', '134', '135']) {
  const { data, count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('articles.article_number', artNum)
    .in('articles.laws.short_name', ['Reglamento del Congreso', 'RCD', 'Reglamento Congreso'])
    .eq('is_active', true);

  if (rcdConteo[artNum]) {
    console.log(`  ✅ Artículo ${artNum}: ${rcdConteo[artNum]} pregunta(s) activa(s)`);
  } else {
    console.log(`  ❌ Artículo ${artNum}: SIN preguntas activas`);
  }
}

// Para RS - artículos 148, 149, 150, 151
console.log('\nReglamento del Senado - Artículos mapeados: 148, 149, 150, 151');
for (const artNum of ['148', '149', '150', '151']) {
  if (rsConteo[artNum]) {
    console.log(`  ✅ Artículo ${artNum}: ${rsConteo[artNum]} pregunta(s) activa(s)`);
  } else {
    console.log(`  ❌ Artículo ${artNum}: SIN preguntas activas`);
  }
}

// 4. TOP 10 artículos con más preguntas
console.log('\n📊 4. TOP 10 ARTÍCULOS CON MÁS PREGUNTAS:\n');

console.log('Reglamento del Congreso:');
const topRcd = Object.entries(rcdConteo)
  .filter(([_, count]) => count > 0)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

topRcd.forEach(([art, count], i) => {
  console.log(`  ${i + 1}. Artículo ${art}: ${count} preguntas`);
});

console.log('\nReglamento del Senado:');
const topRs = Object.entries(rsConteo)
  .filter(([_, count]) => count > 0)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

topRs.forEach(([art, count], i) => {
  console.log(`  ${i + 1}. Artículo ${art}: ${count} preguntas`);
});

// 5. Ver una muestra de preguntas para verificar correspondencia
console.log('\n📝 5. MUESTRA DE PREGUNTAS Y SU CORRESPONDENCIA:\n');

// Obtener 2 preguntas de RCD
const { data: muestraRcd } = await supabase
  .from('questions')
  .select(`
    id,
    question_text,
    correct_option,
    option_a,
    option_b,
    option_c,
    option_d,
    articles!inner(
      article_number,
      title,
      content,
      laws!inner(short_name)
    )
  `)
  .in('articles.laws.short_name', ['Reglamento del Congreso', 'RCD', 'Reglamento Congreso'])
  .eq('is_active', true)
  .limit(2);

console.log('Ejemplos de Reglamento del Congreso:');
muestraRcd?.forEach((p, i) => {
  console.log(`\n${i + 1}. Artículo ${p.articles.article_number}`);
  console.log(`   Pregunta: "${p.question_text.substring(0, 100)}..."`);
  const respuesta = p[`option_${p.correct_option.toLowerCase()}`];
  console.log(`   Respuesta correcta (${p.correct_option}): "${respuesta}"`);
  if (p.articles.content) {
    console.log(`   Contenido del artículo: "${p.articles.content.substring(0, 200)}..."`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('\n🎯 CONCLUSIONES:');
console.log('- Los artículos mapeados en topic_scope necesitan revisión');
console.log('- Hay otros artículos con más preguntas que podrían ser más relevantes');
console.log('- Es necesario actualizar el mapeo de artículos en topic_scope');