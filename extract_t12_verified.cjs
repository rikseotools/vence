const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

// All 25 T12 question IDs that were corrected
const allIds = [
  '9857d4e8-a4b3-41cd-8a10-f0333e6374b2',
  '5c1bd852-da7f-4ad8-b787-cfbd3e7a949e',
  '499ad8fc-1c7b-4700-8426-f5cc9b0796b7',
  '34efdef1-d08c-4e97-9fa6-c750d80cce34',
  'c63e76a1-6409-41af-a7d2-b289d7928973',
  '14095591-0d25-4abf-8ae1-05f9d3db189c',
  'e573ff0d-bc0c-4a87-8765-d7e90117ea04',
  '60bbf4d1-b4bf-4979-aa63-c227c9b0a1ec',
  '828e694b-f0f2-45d5-9ac7-b569dba652cc',
  '08faf005-528b-457d-a3b4-3832e669d6d6',
  '061004c8-3f7d-48b2-ab96-b0452f99bc0a',
  'a18b2c99-baef-4f70-8dd2-f40d50e4b9a8',
  '0abb7ee9-a37b-487d-8077-459b6e47fdba',
  '32dd2375-9f4e-42a2-acdb-512bf723f1f2',
  '48001f52-4d70-4d58-a522-0f2449dd221f',
  'c6a73875-4fa4-4ad6-8f31-fb35a81db3cb',
  '1340ca36-a6e3-4f57-8b6f-54138b50e821',
  '37a55534-8443-4a3a-8a37-5bf46f74d00b',
  'ec349e6f-f7cb-4da8-99b5-9a771f05b8f7',
  '9ca093c6-96cf-487d-9003-07aafca2e76d',
  '3830eca3-3bed-4ffb-a417-694264af1c40',
  '8ab5799e-9f3e-4308-80e8-c940cb5599f0',
  'd9f5a780-7fb6-41a3-a097-15b9ec326403',
  'e8211275-e7f5-44f3-9c55-85f4b3fe76d2',
  'f6ca2391-27fa-469a-8418-d6c243807a85',
];

async function main() {
  const allQuestions = [];

  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const { data: questions } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles(id, article_number, title, content, law_id,
          laws(id, short_name))
      `)
      .in('id', batch);

    allQuestions.push(...(questions || []));
  }

  const formatted = allQuestions.map(q => ({
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
    article_number: q.articles?.article_number || null,
    article_content: q.articles?.content || null,
    law_short_name: q.articles?.laws?.short_name || null,
  }));

  console.log('Total extraídas:', formatted.length);

  const batchSize = Math.ceil(formatted.length / 3);
  for (let i = 0; i < 3; i++) {
    const batch = formatted.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`t12_verify_batch_${i+1}.json`, JSON.stringify(batch, null, 2));
    console.log(`t12_verify_batch_${i+1}.json: ${batch.length} preguntas`);
  }
}

main().catch(console.error);
