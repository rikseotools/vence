/**
 * Script para verificar BATCH 4 de 50 preguntas de Word 365
 * CRÍTICO: Solo usar support.microsoft.com/es-es o learn.microsoft.com/es-es
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const questionIds = [
  '7fa7aae8-ecf3-4fb2-8e37-d175a8450cda',
  'b7cb56a9-c1e0-4dab-9be1-bdbc299baf2d',
  'f519006a-3f71-4dc5-b7bf-4c93c8f2b24b',
  '07144c87-2bb8-44d1-9b13-aeda7a153e0a',
  '25fdffde-22ac-4a7b-bcca-13e56966eeff',
  '32d3d34a-6276-4a01-800a-6ddd1c034fbb',
  '7fbca3a0-8717-4ef7-bce2-6f51e8f9edde',
  '203a682c-cc64-463a-8822-cb4bef940f70',
  '8c1e12a7-499a-4a41-a803-12635b3fd216',
  '42fe67b1-395e-432f-b567-d506b9af8413',
  'b10e8309-81ed-47e7-a6f6-bc03d2ae1b1c',
  'b808676f-1d24-47aa-a44f-fb62351bdc40',
  '63744a86-68fc-4419-98c0-22ec3a68c523',
  'f9ac2200-b55f-466d-abc6-2266188ab27c',
  'd9669bbc-35db-42c5-97ae-d67d59a78f65',
  '16ffb613-2149-4c8d-b24d-ec8438c357a2',
  '69a0da4e-bcd3-4b89-81a3-e1472fe2d84b',
  'fe67c5a5-4101-4177-930b-dc96efe6c403',
  'ae73eee1-7fa8-4e87-9d2e-8b0ca3b87709',
  '9cbd9527-c02c-40ef-a58e-bd3e303fcf64',
  'd36d53d4-2b84-4ee6-92df-e715b2e6c2ef',
  'c9fe438a-da9e-4ca7-ba96-6781c25c885a',
  '1b20e943-826e-4a9d-b4bc-142d94bb0b86',
  'af230caf-8ae6-47d7-af5b-6fad1cbd40d2',
  'a30241f7-794d-493b-a33f-8b0ab7def57b',
  '1659f85f-1e2d-41c4-9b4f-c053fde05822',
  'd4e34fa5-09fb-4925-91a8-16a914788b01',
  'b05201a1-8d83-4df3-8eb2-387c924342e7',
  'ed5b7ae6-2f4e-453f-854e-3bf46799ad77',
  'efbeea0d-e868-41dd-8d23-98e77b70c157',
  'f2c203d4-06fb-430b-8f3b-61c469e4f2fb',
  '01f56445-942c-4603-ac9e-513796522e59',
  '0791f162-bc58-4647-82fa-56b32d70e625',
  'b8b081b7-375e-4cca-8cf6-6fe096d889c5',
  '224a59ba-2b39-4ac7-8653-13b14d8f91e1',
  '8aa999ce-7d48-4bbd-acb6-82d278f3d15b',
  'e2649a23-995b-4039-87ad-21158dca9e76',
  '535037a7-1485-4376-9c4d-760019f28147',
  'ccc00f8c-7c79-40b0-b223-90d6ab5e52de',
  'a879cad5-5f8e-4f2f-a781-58e6316479f0',
  '7e855639-212f-44a3-a558-fc178b4054e7',
  'fc412415-d7ef-41e2-9035-1f5974230111',
  '4364b8b9-e0a2-43d2-9d21-b47c3ef53784',
  'faf16271-81e8-49a5-8f4a-b7560d68a232',
  '8d9d4e45-6e9e-47f0-974f-a1842bba859e',
  'bd6f9442-e4a2-4a87-bc81-897761678e84',
  '06e86010-2efd-4e8d-9a63-9fd8f89430dc',
  'e3dbd865-35a4-4f81-91f8-0c95852ab713',
  '4158718c-94a6-4c44-bbc4-5b07075abef2',
  '0ddb6d5a-0a8f-4b8f-9137-9255c9eeb7df'
];

async function main() {
  console.log('🔍 Obteniendo preguntas de BATCH 4...\n');

  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation')
    .in('id', questionIds)
    .order('question_text');

  if (error) {
    console.error('❌ Error al obtener preguntas:', error);
    process.exit(1);
  }

  console.log(`✅ Se obtuvieron ${questions.length} preguntas\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Mostrar todas las preguntas para análisis
  questions.forEach((q, idx) => {
    const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option];
    console.log(`${idx + 1}. [${q.id}]`);
    console.log(`   Pregunta: ${q.question_text}`);
    console.log(`   A) ${q.option_a}`);
    console.log(`   B) ${q.option_b}`);
    console.log(`   C) ${q.option_c}`);
    console.log(`   D) ${q.option_d}`);
    console.log(`   ✓ Correcta: ${correctLetter}) ${q[`option_${correctLetter.toLowerCase()}`]}`);
    console.log(`   💡 Explicación: ${q.explanation.substring(0, 200)}...`);
    console.log('');
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Total de preguntas para verificar: ${questions.length}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
