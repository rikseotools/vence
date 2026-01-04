const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: article } = await supabase
    .from('articles')
    .select('id, title')
    .ilike('title', '%introducción%')
    .single();

  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, explanation, correct_option, content_hash')
    .eq('primary_article_id', article.id)
    .eq('is_active', true);

  console.log('📊 VERIFICACIÓN COMPLETA\n');
  console.log('📍 Artículo:', article.title);
  console.log('📝 Preguntas:', questions.length);

  // Explicaciones
  const sinExpl = questions.filter(q => !q.explanation || q.explanation === 'Sin explicación disponible' || q.explanation.length < 20);
  const conTabla = questions.filter(q => q.explanation && q.explanation.includes('|'));
  
  console.log('\n📖 EXPLICACIONES:');
  console.log('   Sin explicación:', sinExpl.length);
  console.log('   Con tabla (|):', conTabla.length);
  console.log('   Con explicación válida:', questions.length - sinExpl.length);

  // Content hash
  const sinHash = questions.filter(q => !q.content_hash);
  console.log('\n🔐 CONTENT HASH:');
  console.log('   Con hash:', questions.length - sinHash.length);
  console.log('   Sin hash:', sinHash.length);

  // Correct option format
  const correctOptions = questions.map(q => q.correct_option);
  const validOptions = correctOptions.filter(c => c >= 0 && c <= 3);
  console.log('\n✅ RESPUESTAS (0=A, 1=B, 2=C, 3=D):');
  console.log('   Formato válido:', validOptions.length + '/' + questions.length);

  // Ejemplo de pregunta con tabla
  if (conTabla.length > 0) {
    console.log('\n📋 EJEMPLO CON TABLA:');
    console.log('   Pregunta:', conTabla[0].question_text.substring(0, 50) + '...');
    console.log('   Explicación:');
    console.log('   ' + conTabla[0].explanation.substring(0, 200).replace(/\n/g, '\n   '));
  }

  // Resultado final
  console.log('\n' + '═'.repeat(50));
  if (sinExpl.length === 0 && sinHash.length === 0 && validOptions.length === questions.length) {
    console.log('✅ TODO CORRECTO');
  } else {
    console.log('⚠️  HAY PROBLEMAS');
  }
})();
