const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

// ALL error statuses
const ERROR_STATUSES = [
  'bad_answer', 'bad_explanation', 'bad_article',
  'bad_answer_and_explanation', 'all_wrong', 'wrong_article',
  'needs_review', 'error'
];

async function main() {
  // 1. Get ALL error questions with article info
  const { data: questions } = await supabase.from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, topic_review_status, primary_article_id,
      articles(id, article_number, title, content, law_id,
        laws(id, short_name))
    `)
    .in('topic_review_status', ERROR_STATUSES)
    .eq('is_active', true);

  console.log('Total error questions:', questions.length);

  // 2. Get ALL topic_scope entries
  const { data: scopes } = await supabase.from('topic_scope')
    .select('topic_id, law_id, article_numbers');

  // 3. Get all topics
  const { data: topics } = await supabase.from('topics')
    .select('id, title, topic_number, position_type');

  const topicMap = {};
  topics.forEach(t => { topicMap[t.id] = t; });

  // 4. Map each question to its topic(s) via law_id + article_number
  const topicErrors = {};
  const unmatchedQuestions = [];

  for (const q of questions) {
    if (!q.articles) {
      unmatchedQuestions.push({ id: q.id, status: q.topic_review_status, reason: 'no article' });
      continue;
    }
    const lawId = q.articles.law_id;
    const artNum = q.articles.article_number;

    // Find matching topic_scope
    const matchingScopes = scopes.filter(s => {
      if (s.law_id !== lawId) return false;
      if (!s.article_numbers) return false;
      return s.article_numbers.includes(artNum);
    });

    for (const scope of matchingScopes) {
      const topic = topicMap[scope.topic_id];
      if (!topic) continue;
      const key = `T${topic.topic_number} [${topic.position_type}]`;
      if (!topicErrors[key]) {
        topicErrors[key] = { title: topic.title, topic_id: topic.id, questions: [] };
      }
      topicErrors[key].questions.push({
        id: q.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
        explanation: q.explanation,
        status: q.topic_review_status,
        article_id: q.primary_article_id,
        article_number: q.articles.article_number,
        article_content: q.articles.content,
        law_short_name: q.articles.laws?.short_name || null,
        law_id: q.articles.law_id,
      });
    }

    if (matchingScopes.length === 0) {
      unmatchedQuestions.push({
        id: q.id,
        status: q.topic_review_status,
        article_number: q.articles?.article_number,
        law: q.articles?.laws?.short_name,
      });
    }
  }

  // 5. Print summary - group by auxiliar_administrativo first
  console.log('\n=== AUXILIAR ADMINISTRATIVO ERRORS ===');
  const auxAdmin = Object.entries(topicErrors)
    .filter(([k]) => k.includes('auxiliar_administrativo'))
    .sort((a, b) => b[1].questions.length - a[1].questions.length);
  for (const [key, val] of auxAdmin) {
    const statusBreakdown = {};
    val.questions.forEach(q => { statusBreakdown[q.status] = (statusBreakdown[q.status] || 0) + 1; });
    console.log(`${key} "${val.title}": ${val.questions.length} errors`, statusBreakdown);
  }

  console.log('\n=== TRAMITACION/AUXILIO ERRORS ===');
  const justicia = Object.entries(topicErrors)
    .filter(([k]) => k.includes('tramitacion') || k.includes('auxilio'))
    .sort((a, b) => b[1].questions.length - a[1].questions.length);
  for (const [key, val] of justicia) {
    const statusBreakdown = {};
    val.questions.forEach(q => { statusBreakdown[q.status] = (statusBreakdown[q.status] || 0) + 1; });
    console.log(`${key} "${val.title}": ${val.questions.length} errors`, statusBreakdown);
  }

  console.log('\n=== ADMINISTRATIVO (other) ERRORS ===');
  const admin = Object.entries(topicErrors)
    .filter(([k]) => k.includes('administrativo') && !k.includes('auxiliar'))
    .sort((a, b) => b[1].questions.length - a[1].questions.length);
  for (const [key, val] of admin) {
    const statusBreakdown = {};
    val.questions.forEach(q => { statusBreakdown[q.status] = (statusBreakdown[q.status] || 0) + 1; });
    console.log(`${key} "${val.title}": ${val.questions.length} errors`, statusBreakdown);
  }

  if (unmatchedQuestions.length > 0) {
    console.log('\n=== UNMATCHED ===');
    console.log(`${unmatchedQuestions.length} questions without topic match`);
    unmatchedQuestions.forEach(q => console.log(`  ${q.id} [${q.status}] art ${q.article_number} ${q.law}`));
  }

  // 6. Count unique question IDs across all topics
  const allIds = new Set();
  Object.values(topicErrors).forEach(v => v.questions.forEach(q => allIds.add(q.id)));
  console.log('\nUnique error questions (mapped):', allIds.size);
  console.log('Unmatched:', unmatchedQuestions.length);
  console.log('TOTAL:', allIds.size + unmatchedQuestions.length);
}

main().catch(console.error);
