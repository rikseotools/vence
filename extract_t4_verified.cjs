const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

const allIds = [
  'f6156db6-e423-4637-9b6f-5712d9a482d4','95b3724b-37ce-4b47-a008-ecd79e63e1b7',
  '891a1415-c820-4423-ad87-93bec6fb7a54','b3996bc4-83a2-48cf-b594-fe7683d1a088',
  '60305c21-e6e2-458b-b669-0d6a0d09afb9','3cd99c99-d756-435c-977b-ec5ac7d69f15',
  'ef957b1d-21ec-4ece-99d5-769faac770be','51a76dcb-ef30-4a23-81bf-b44b0a368d7e',
  '8ee67b87-a49c-441c-a766-52f2c597a212','b6bf6e70-ff39-4abc-9e60-d312d5257aaa',
  'deaeda3b-dd7e-46b0-96af-cb32d4e891f5','0a29d9a8-cc19-4663-a2f5-108ad4704229',
  '28cc208e-2678-4988-b526-c1fde9f011ec','a917f6f9-73a9-45f9-9460-d5c42e44c0a0',
  'f3e00125-e2a5-4a78-8b3f-f51534d2e506','28f1d981-b8ba-4bf8-8855-c891fa7cfaec',
  'fc4a3d12-4ce5-48f3-9e4b-90355dcd7b8b','cf2d953a-e57a-45e5-a267-00a0db573b9c',
  '6a7e3ee8-a82d-4ebc-ae06-429577d47ecd','79f11f9d-1e3d-435b-b951-96ad8e09c5a8',
  '1fd451c1-2dd2-4fbe-8007-3e2016190d10','a2895199-b6e8-43a0-8ffd-d855e407e97a',
  '6bc13156-9834-45cb-8e89-87df0398c9b1','f8a3fb73-0fd5-44c9-9a5e-bf507d11b3d8',
  'eaa63152-f13a-43c2-91b2-6d22f1fdc44f','73dda456-3b5f-4ede-aaa0-584240443ade',
  'd301d70f-c065-40d0-bde1-8cf33f6a10da','5e22f494-a138-4ada-8b97-f6b50e915077',
  '87b6bbdd-79e9-4676-989e-bc0cb8e0579e','42efeefb-e2bb-45d7-9a38-6332e5296c0b',
  '668f925e-52fe-4a13-b57e-406de2bc5d81','5f6f1d45-a7da-447d-84c9-927beee6f5de',
  '155a99fc-b452-4ae3-a43c-585ce7ffa44e','f341e488-f099-4045-a36f-477b0f0599cc',
  '14dc3d54-b437-4591-8520-7efb0fb4fa7b','3f9a3fac-3cd5-413f-8bdb-309cd35792e1',
  '04efb88a-b15f-40ed-88bb-7594aa754a22',
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

  // Split into 3 batches of ~12-13
  const batchSize = Math.ceil(formatted.length / 3);
  for (let i = 0; i < 3; i++) {
    const batch = formatted.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`t4_verify_batch_${i+1}.json`, JSON.stringify(batch, null, 2));
    console.log(`t4_verify_batch_${i+1}.json: ${batch.length} preguntas`);
  }
}

main().catch(console.error);
