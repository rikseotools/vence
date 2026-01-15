// scripts/update-hot-articles-tramitacion.cjs
// Actualiza hot_articles para Tramitación Procesal

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔥 Actualizando hot_articles para Tramitación Procesal...');

  // Obtener estadísticas de artículos en preguntas oficiales
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      exam_source,
      primary_article_id,
      articles!primary_article_id (
        id,
        article_number,
        law_id,
        laws!law_id (short_name)
      )
    `)
    .like('exam_source', '%Tramitación Procesal%')
    .eq('is_official_exam', true)
    .eq('is_active', true);

  if (error) {
    console.error('Error cargando preguntas:', error.message);
    return;
  }

  // Agrupar por artículo
  const articleStats = {};
  questions.forEach(q => {
    if (q.articles && q.articles.id) {
      const artId = q.articles.id;
      if (articleStats[artId] === undefined) {
        articleStats[artId] = {
          article_id: artId,
          law_id: q.articles.law_id,
          article_number: q.articles.article_number,
          law_name: q.articles.laws ? q.articles.laws.short_name : '',
          total_appearances: 0,
          exam_sources: new Set()
        };
      }
      articleStats[artId].total_appearances++;
      articleStats[artId].exam_sources.add(q.exam_source);
    }
  });

  console.log(`📊 Encontrados ${Object.keys(articleStats).length} artículos únicos`);

  // Insertar/actualizar hot_articles
  let inserted = 0;
  let errors = 0;

  for (const stats of Object.values(articleStats)) {
    const uniqueExams = stats.exam_sources.size;
    let priorityLevel = 'low';
    if (stats.total_appearances >= 5) priorityLevel = 'critical';
    else if (stats.total_appearances >= 3) priorityLevel = 'high';
    else if (stats.total_appearances >= 2) priorityLevel = 'medium';

    const hotnessScore = stats.total_appearances * 10 + uniqueExams * 5;

    const { error: upsertError } = await supabase
      .from('hot_articles')
      .upsert({
        article_id: stats.article_id,
        law_id: stats.law_id,
        target_oposicion: 'tramitacion_procesal',
        article_number: stats.article_number,
        law_name: stats.law_name,
        total_official_appearances: stats.total_appearances,
        unique_exams_count: uniqueExams,
        priority_level: priorityLevel,
        hotness_score: hotnessScore,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'article_id,target_oposicion'
      });

    if (upsertError) {
      console.error('Error:', stats.law_name, 'Art.', stats.article_number, upsertError.message);
      errors++;
    } else {
      inserted++;
    }
  }

  console.log(`✅ Insertados/actualizados: ${inserted} hot_articles`);
  if (errors > 0) console.log(`❌ Errores: ${errors}`);

  // Verificar
  const { count } = await supabase
    .from('hot_articles')
    .select('id', { count: 'exact', head: true })
    .eq('target_oposicion', 'tramitacion_procesal');

  console.log(`\n📈 Total hot_articles para tramitacion_procesal: ${count}`);

  // Mostrar top artículos
  const { data: topArticles } = await supabase
    .from('hot_articles')
    .select('law_name, article_number, total_official_appearances, priority_level')
    .eq('target_oposicion', 'tramitacion_procesal')
    .order('total_official_appearances', { ascending: false })
    .limit(10);

  console.log('\n🏆 Top 10 artículos hot:');
  topArticles.forEach((a, i) => {
    console.log(`   ${i+1}. ${a.law_name} Art. ${a.article_number} - ${a.total_official_appearances} apariciones (${a.priority_level})`);
  });
}

main().catch(console.error);
