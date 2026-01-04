const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const folder = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_7,_La_Ley_de_transparencia,_acceso_a_la_información_pública_y_buen_gobierno/';
const TEMA_7_ID = 'ffd10cc2-d8f9-4e41-a008-db46b096c682';
const LEY_19_2013_ID = 'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798';

const letterToNum = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

(async () => {
  // 1. Configurar topic_scope
  console.log('🔧 Configurando topic_scope...');
  await supabase.from('topic_scope').delete().eq('topic_id', TEMA_7_ID);

  // Obtener todos los artículos de Ley 19/2013
  const { data: articles } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', LEY_19_2013_ID);

  await supabase.from('topic_scope').insert({
    topic_id: TEMA_7_ID,
    law_id: LEY_19_2013_ID,
    article_numbers: articles.map(a => a.article_number)
  });
  console.log('✅ Ley 19/2013 scope: ' + articles.length + ' artículos');

  // 2. Crear mapeo de artículos
  const articleMap = {};
  for (const a of articles) {
    articleMap[a.article_number] = a.id;
  }
  const defaultArticleId = articleMap['1'] || articles[0].id;

  // 3. Cargar preguntas existentes
  const { data: existing } = await supabase.from('questions').select('question_text');
  const existingSet = new Set(existing.map(q => normalize(q.question_text)));
  console.log('\nPreguntas existentes: ' + existingSet.size);

  // 4. Procesar preguntas
  const files = fs.readdirSync(folder).filter(f => f.endsWith('.json'));
  const toInsert = [];
  let duplicates = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(folder, file)));

    for (const q of data.questions) {
      if (existingSet.has(normalize(q.question))) {
        duplicates++;
        continue;
      }

      const exp = q.explanation || '';
      let articleId = defaultArticleId;

      // Detectar artículo de Ley 19/2013
      const artMatch = exp.match(/[Aa]rt[íi]culo\s+(\d+)/);
      if (artMatch) {
        const num = artMatch[1];
        if (articleMap[num]) {
          articleId = articleMap[num];
        }
      }

      toInsert.push({
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: letterToNum[q.correctAnswer],
        explanation: q.explanation,
        primary_article_id: articleId,
        is_active: true,
        is_official_exam: false
      });
    }
  }

  console.log('\n📊 RESUMEN:');
  console.log('  Duplicadas: ' + duplicates);
  console.log('  Nuevas: ' + toInsert.length);

  // 5. Insertar
  if (toInsert.length > 0) {
    console.log('\n📤 Insertando...');
    let inserted = 0, errors = 0;

    for (let i = 0; i < toInsert.length; i += 10) {
      const batch = toInsert.slice(i, i + 10);
      const { error } = await supabase.from('questions').insert(batch);
      if (error) errors += batch.length;
      else inserted += batch.length;
    }

    console.log('✅ Insertadas: ' + inserted);
    if (errors > 0) console.log('❌ Errores: ' + errors);
  }

  // 6. Contar total
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', TEMA_7_ID);

  let total = 0;
  for (const scope of scopes) {
    const { data: arts } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);

    if (arts && arts.length > 0) {
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .in('primary_article_id', arts.map(a => a.id))
        .eq('is_active', true);
      total += count || 0;
    }
  }

  console.log('\n📊 TOTAL TEMA 7: ' + total + ' preguntas');
})();
