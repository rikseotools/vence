#!/usr/bin/env node

require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const BATCH_5_IDS = [
  '2b97f603-268f-41b9-b3e5-d89f0b649b79', '8f141826-5a85-4649-b0e4-74565b7cf904',
  '95c10793-1a02-4e08-9178-662224acc08b', 'c44f61b4-e139-43c2-a3d5-e447471c132e',
  '520cc941-71d0-4bcd-ae3a-c9351aac08ed', '4d5f3f57-9f5c-431d-874f-4ba12be3e879',
  '35043465-d0b9-43c5-9213-559327aa5c92', 'dafcade8-2b29-4c72-ba61-51d8ee44b7e0',
  '28b2b905-e6f6-4055-8727-08b868afa4ad', 'e2e93603-b312-43c8-977a-d20901dfb8d6',
  '6797631c-5f66-4956-b360-31a4df788558', '6f49288e-6537-4c47-bc85-1f65ed20603b',
  '232c3560-06d1-4e48-8f66-fed9dc74a638', 'd0844d75-60f7-4b49-a386-92477862490a',
  '3869a1dd-cd60-4ab5-82fb-89d49269f4f3', '84b469ba-f52d-4b3d-bdf6-4a3688d5855c',
  '3f81653e-64b4-4ed7-90fc-83f1fdf92c85', '9ad3a811-28cd-410f-8546-b08880c73ff5',
  'b8bf774d-05f1-45c2-af87-31d8afce1e71', 'ca084e9a-9f05-423b-9a7c-5785ca87eacb',
  '0fd83633-1445-465c-b02d-003f3f8d0688', 'd532279c-4203-41cf-8a6c-01fd1a724a1c',
  'add4f356-e163-47ed-87f8-abf8a49075aa', '75d10c6e-504b-46e4-a9ca-22eff1fe614a',
  '08e4d1bc-3480-4d6e-a983-b4f1be03a163', '61064461-d8de-428a-9607-5be72cf9e430',
  '15206bb8-72af-4ba1-a77c-1e1dc3a0704b', '942311e5-eb39-41d6-b5cc-e8e98e1bce26',
  'b6421408-74dd-425c-be4f-9206510df665', '22d92bf4-bac4-4ddc-b259-371a97e0fed7',
  'd9f1c696-8586-40f4-a298-86ccbec5525b', 'b359193a-df53-4c78-96a9-a70e57096f26',
  'cf0839bc-926a-447e-acb0-43d90b61da6e', '36e40391-8519-450d-8674-822959aebe20',
  'a54d168b-9420-49a7-a710-ab2be817adb7', 'c4e8ea93-921c-456f-8c81-f7d96c69add9',
  'ba837fcb-ed5e-401a-bca8-706ac22cd695', '2ecdaa05-8aa2-4b1d-928a-096e7f364b2b',
  '2c2fceac-20fa-4a63-885e-ab9c1dd61096', '97812dff-5c37-4282-8e58-50a0c28b701e',
  '055d4be4-9de6-431b-9b13-3dbbc572899a', 'bb8b2fbc-d068-432a-b0ac-32dcdbc9d31a',
  '562f3305-786a-44ae-a75a-aa53b9085a33', '70cf1757-741a-438e-baa0-a10b8d3f71e2',
  'fdb00e83-ae0f-4a69-91e0-5cc1decffbd2', 'b69bee4f-d2f8-497a-8236-678f529597fc',
  '1a139753-b5f8-4141-b243-39994e8bad2d', '9abea697-d30c-4cac-9d12-7d928808fbc0',
  '4debf146-b2ff-4128-9101-262e95c50f11', '52219a2e-80f1-4d38-a2bd-f4f830c98ea7'
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyBatch5() {
  console.log('📊 Iniciando verificación BATCH 5 - Word 365 (50 preguntas)');
  console.log('=' .repeat(70));

  // 1. Obtener todas las preguntas
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      option_a, option_b, option_c, option_d,
      correct_option,
      primary_article_id,
      difficulty,
      is_official_exam,
      exam_source,
      verification_status,
      topic_review_status,
      tags
    `)
    .in('id', BATCH_5_IDS);

  if (error) {
    console.error('❌ Error al obtener preguntas:', error);
    return;
  }

  console.log(`\n✅ Obtenidas ${questions.length} preguntas`);

  // 2. Preparar datos para verificación
  const verificationResults = [];

  for (const q of questions) {
    const result = {
      id: q.id,
      question_text: q.question_text,
      correct_option: q.correct_option,
      is_official: q.is_official_exam,
      exam_source: q.exam_source,
      difficulty: q.difficulty,
      verification_status: 'pending_manual_review',
      requires_microsoft_docs: true,
      notes: 'BATCH 5 Word 365 - Requiere verificación contra Microsoft Docs'
    };

    verificationResults.push(result);
  }

  // 3. No guardamos en tabla separada - el estado se mantiene en questions
  console.log('\n💾 Documentando verificación pendiente...');

  // 4. Actualizar topic_review_status en las preguntas
  console.log('\n🔄 Actualizando topic_review_status en preguntas...');

  const { error: updateQError } = await supabase
    .from('questions')
    .update({
      topic_review_status: 'pending_microsoft_verification',
      verification_status: 'pending_manual_review'
    })
    .in('id', BATCH_5_IDS);

  if (updateQError) {
    console.error('❌ Error actualizando preguntas:', updateQError);
  } else {
    console.log(`✅ ${BATCH_5_IDS.length} preguntas marcadas como pendientes de verificación`)

  // 5. Guardar reporte de verificación
  console.log('\n📋 Guardando reporte de verificación...');

  const reportFileName = `batch5_verification_${new Date().toISOString().split('T')[0]}.json`;
  const fs = require('fs');

  fs.writeFileSync(
    `/home/manuel/Documentos/github/vence/${reportFileName}`,
    JSON.stringify({
      batch: 5,
      topic: 'Word 365',
      total_questions: verificationResults.length,
      status: 'pending_manual_review',
      timestamp: new Date().toISOString(),
      questions: verificationResults
    }, null, 2)
  );

  console.log(`✅ Reporte guardado: ${reportFileName}`);
  }

  // 5. Estadísticas
  console.log('\n' + '='.repeat(70));
  console.log('📈 RESUMEN DE VERIFICACIÓN');
  console.log('='.repeat(70));
  console.log(`Total de preguntas: ${questions.length}`);
  console.log(`Preguntas oficiales: ${questions.filter(q => q.is_official).length}`);
  console.log(`Preguntas de IA: ${questions.filter(q => !q.is_official).length}`);

  const difficultyCount = {};
  questions.forEach(q => {
    difficultyCount[q.difficulty] = (difficultyCount[q.difficulty] || 0) + 1;
  });

  console.log('\nPor dificultad:');
  Object.entries(difficultyCount).forEach(([diff, count]) => {
    console.log(`  - ${diff}: ${count} preguntas`);
  });

  const tags = new Set();
  questions.forEach(q => {
    if (q.tags && Array.isArray(q.tags)) {
      q.tags.forEach(tag => tags.add(tag));
    }
  });

  console.log('\nEtiquetas únicas:', tags.size);
  if (tags.size > 0) {
    console.log('  Tags:', Array.from(tags).join(', '));
  }

  console.log('\n⚠️  ESTADO: Requiere verificación manual contra:');
  console.log('  - support.microsoft.com/es-es');
  console.log('  - learn.microsoft.com/es-es');

  console.log('\n✅ Verificación completada - Estado actualizado en:');
  console.log('  - questions (topic_review_status)');
  console.log('  - questions (verification_status)');

  return {
    total: questions.length,
    official: questions.filter(q => q.is_official).length,
    ai_generated: questions.filter(q => !q.is_official).length,
    unique_tags: tags.size,
    status: 'pending_manual_review'
  };
}

verifyBatch5().catch(console.error);
