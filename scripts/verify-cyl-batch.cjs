/**
 * Verificación y asignación de artículos para preguntas CyL
 * Recibe: tema number, lee preguntas + artículos del scope, asigna primary_article_id
 *
 * Uso: TEMA=2 node /tmp/verify-cyl-batch.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TEMA = parseInt(process.env.TEMA);
const PLACEHOLDER = '2536184c-73ed-4568-9ac7-0bbf1da24dcb';

if (!TEMA) { console.error('Set TEMA env var'); process.exit(1); }

(async () => {
  console.log(`\n=== Verificando T${TEMA} ===\n`);

  // 1. Get topic
  const { data: topic } = await sb.from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo_cyl')
    .eq('topic_number', TEMA)
    .single();

  if (!topic) { console.error('Topic not found'); process.exit(1); }

  // 2. Get topic_scope (laws + article_numbers)
  const { data: scopes } = await sb.from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topic.id);

  if (!scopes || scopes.length === 0) { console.error('No scope for this topic'); process.exit(1); }

  // 3. Get all articles from scope
  const articles = [];
  for (const scope of scopes) {
    const { data: arts } = await sb.from('articles')
      .select('id, article_number, title, content, law_id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);

    if (arts) articles.push(...arts);
  }

  // Get law names
  const lawIds = [...new Set(scopes.map(s => s.law_id))];
  const { data: laws } = await sb.from('laws')
    .select('id, short_name')
    .in('id', lawIds);
  const lawMap = {};
  laws.forEach(l => lawMap[l.id] = l.short_name);

  console.log(`Scope: ${scopes.length} leyes, ${articles.length} artículos`);
  articles.forEach(a => console.log(`  Art. ${a.article_number} ${lawMap[a.law_id]} (${a.id})`));

  // 4. Get questions for this topic (by tag)
  let questions = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, tags')
      .eq('primary_article_id', PLACEHOLDER)
      .eq('topic_review_status', 'pending')
      .contains('tags', [`Tema ${TEMA}`])
      .range(page * 100, (page + 1) * 100 - 1);
    if (!data || data.length === 0) break;
    questions.push(...data);
    page++;
    if (data.length < 100) break;
  }

  console.log(`\nPreguntas a verificar: ${questions.length}\n`);

  // 5. For each question, find best matching article
  let assigned = 0, noMatch = 0, errors = 0;

  for (const q of questions) {
    const qText = (q.question_text + ' ' + q.explanation).toLowerCase();

    let bestArticle = null;
    let bestScore = 0;

    for (const art of articles) {
      if (!art.content) continue;
      let score = 0;
      const artContent = art.content.toLowerCase();
      const lawName = (lawMap[art.law_id] || '').toLowerCase();

      // Check if question mentions this article number
      const artNum = art.article_number;
      const patterns = [
        `artículo ${artNum}`,
        `art. ${artNum}`,
        `art ${artNum}`,
        `articulo ${artNum}`,
      ];

      for (const p of patterns) {
        if (qText.includes(p)) { score += 10; break; }
      }

      // Check if question mentions the law
      if (lawName && qText.includes(lawName.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim())) {
        score += 5;
      }

      // Check content overlap (keywords from question found in article)
      const qWords = new Set(qText.split(/\s+/).filter(w => w.length > 4));
      const artWords = new Set(artContent.split(/\s+/).filter(w => w.length > 4));
      let overlap = 0;
      for (const w of qWords) if (artWords.has(w)) overlap++;
      score += overlap * 0.1;

      // Check if options text appears in article content
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
      for (const opt of opts) {
        const optWords = opt.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        for (const w of optWords) {
          if (artContent.includes(w)) { score += 0.5; break; }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestArticle = art;
      }
    }

    // Threshold: 2 for legal articles (mention art. number), 0.5 for virtual/tech articles
    const threshold = articles.some(a => a.article_number !== '0' && parseInt(a.article_number) > 0) ? 0.5 : 0.3;
    if (bestArticle && bestScore >= threshold) {
      const { error } = await sb.from('questions')
        .update({ primary_article_id: bestArticle.id })
        .eq('id', q.id);

      if (error) { errors++; }
      else {
        assigned++;
        if (assigned <= 5 || assigned % 20 === 0) {
          console.log(`  ✅ Q${q.id.substring(0,8)} → Art. ${bestArticle.article_number} ${lawMap[bestArticle.law_id]} (score: ${bestScore.toFixed(1)})`);
        }
      }
    } else {
      noMatch++;
      if (noMatch <= 3) {
        console.log(`  ⚠️  Sin match: "${q.question_text.substring(0, 60)}..." (best: ${bestScore.toFixed(1)})`);
      }
    }
  }

  console.log(`\n=== T${TEMA} Resultado ===`);
  console.log(`Asignadas: ${assigned}`);
  console.log(`Sin match: ${noMatch}`);
  console.log(`Errores: ${errors}`);
})();
