#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yqbpstxowvgipqspqrgo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NzY3MDMsImV4cCI6MjA2NjQ1MjcwM30.LNP-D1h8Tm4c3XReQTLW5wc6Iihzk_5TuRTFgeAaiLw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const questionIds = [
  '63674223-7e64-409c-9481-9c3b4db7e7a3',
  'b7307d13-d7bf-4b72-9b90-3acfb23e0018',
  'a2f89c67-f10c-41bc-a856-392d3732d98a',
  '2e9547a8-d285-44eb-8640-79c9fdd17e53',
  'f4618938-27c1-4388-bdea-195b11b695d9',
  '37829fdb-bdd9-4030-9126-3dadb733f8ad',
  'ce2b1acc-2e63-4064-86f6-ae131a0cb725',
  '07e22f6a-7863-46b6-a5b2-d605d72e3770',
  '5a731471-5999-42fc-afaf-1bf1f9c48dd4',
  '479671ea-452a-4dac-8246-1fa42c65dc0a',
  'ce5ad92a-e0d5-403c-9d54-c3b205eda7b8',
  'b9247a6d-9067-4925-acab-6d870c387ade',
  '1b0baa01-5800-4da1-ac83-cb4669eb4c2c',
  'e8d368e4-fce0-41d0-ad9b-f07ce716c42f',
  'bcb2f9be-84df-4946-9889-879e29d7f5cd',
  '86ec20fb-a004-4b28-aae5-4783e9d2a109',
  '8fb5ea4b-6d58-4c19-b090-9158a59f7075',
  'af0aedca-1b4b-4302-8106-2bd912f97b6a',
  '2db79b93-0313-4f2d-9447-b58dc373d2d2',
  '57969daa-6822-4a9a-b697-e0ab189a1dd6',
  '64932671-8968-42f3-8563-adee4e75e804',
  '954b14c9-ea4d-4836-97ee-15ecc52d39f5',
  '2f9ab59f-3fc1-4a2a-b00b-d2a925b3ae9a',
  'e312617e-ac8b-4d09-aacb-70856b871d4a',
  'd2c74049-6b47-4037-a1df-738371d079be',
  'c3fea377-7ab9-4e45-bc44-93b78308473e',
  '4c6272d1-9efe-4429-84bd-5d2f931d075c',
  '1cb5cb8f-23fe-4f9f-9fc3-9db6e5bdbf19',
  '742fc821-e686-401c-b241-068cdcfa085d',
  'f87cb2e1-5964-4dc8-a509-d4fb3a790821',
  '44a3577d-9d65-4d9f-9cd4-9021643dfc7e',
  'a970db9f-1462-4f61-aa69-c32336da08d4',
  '3ca2b24e-ef6e-4598-97d2-2d606ed288aa',
  '5c8333f7-4adf-46b9-8949-13e133aa60f4',
  '396e11f2-e256-4e52-af95-ad641ace8afc',
  '6976e1b2-a24b-4293-8724-47929b0a7ef2',
  'a82a0621-58ee-432e-a941-2f7d324a6520',
  '61a80c12-2f32-4f12-ab80-035501371520',
  'acd1dc06-237b-48bd-869a-bf8a6822cb53',
  '3a4c8f24-3502-4ecb-a234-ad241d6714d3',
  'e46acb7e-43a8-4e70-aeed-8035e4872733'
];

async function getQuestionDetails(questionId) {
  const { data: question } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();
  return question;
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📋 LISTADO DETALLADO - PREGUNTAS WORD 365 (T604)');
  console.log('════════════════════════════════════════════════════════════\n');

  let badAnswer = [];
  let badExplanation = [];

  for (let i = 0; i < Math.min(5, questionIds.length); i++) {
    const q = await getQuestionDetails(questionIds[i]);
    if (!q) continue;

    console.log(`\n[${String(i + 1).padStart(2, '0')}] ${q.question_text.substring(0, 70)}`);
    console.log(`    ID: ${q.id.substring(0, 8)}`);
    console.log(`    ├─ Respuesta: ${String.fromCharCode(65 + q.correct_option)}`);
    console.log(`    ├─ Opción A: ${q.option_a.substring(0, 50)}`);
    console.log(`    ├─ Opción B: ${q.option_b.substring(0, 50)}`);
    console.log(`    ├─ Opción C: ${q.option_c.substring(0, 50)}`);
    console.log(`    ├─ Opción D: ${q.option_d.substring(0, 50)}`);
    console.log(`    ├─ Explicación: ${q.explanation ? q.explanation.substring(0, 50) : 'Sin explicación'}`);
    console.log(`    └─ Estado: ${q.topic_review_status || 'No verificado'}`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('✓ Primeras 5 preguntas mostradas (de 41 total)');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
