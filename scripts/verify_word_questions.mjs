import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

const questionIds = [
  '6230efe2-b0e4-4a49-8132-a45d2011b333',
  '1779e1ab-0b23-47b8-85ba-aaee6b63c9f6',
  '8d13ec26-6f44-4055-bbd8-e1916b50eeeb',
  '557ddc62-ab17-407b-9ecc-8b8e5b510126',
  '24b7dca8-7ea9-4b83-9143-c319e73369e1',
  '4362e46a-dcd9-4378-9637-2efaf00b8c80',
  '8b8a5737-d913-4a5e-a194-e630a2361aa6',
  '7ce20362-1cfb-46ad-910c-c0b681d491c9',
  'b654ef0f-7e41-401d-af99-725aeec66df9',
  '692bd4e3-c1bc-4905-8e85-a97deab8a077',
  '60eb3b80-6c7d-424a-9de7-9b3d0e44d93e',
  'bc48fe1f-e557-4edd-9a4c-eeb153cb589e',
  '0850e05f-f45e-4f74-b4da-be6bf2d0f7a4',
  'ac74d591-b456-4129-b576-24f7277db2fc',
  '605d9487-6050-4844-974d-2ae83f8806b3',
  '57da1229-113c-4f84-a674-fc0c754dfa70',
  'ddc00a60-7790-4070-9e76-c07cf409a8dd',
  '8857aecf-53aa-4c0e-a0e9-94b5f032c321',
  'ab4a79b1-14f6-41e2-b1f2-a334c7ce6555',
  '536962de-3566-4b54-a179-6e695a106819',
  '37a4a195-5787-4f7c-832e-8d0cc8925640',
  'b18a2d0d-1be7-4d90-a0dd-ffb1ae6213a5',
  '4e16619a-32e6-4b12-9013-d709c518b4f0',
  'efa3552a-6255-4450-883f-6a26428fdae3',
  'ca66e7a8-47c6-4a94-ac96-07d1ea02120e',
  '083a1d7a-f467-45be-8582-ebf0e13cc79a',
  'c9361608-a50d-461b-bfb9-3cfdf047acd5',
  '59df729c-6d0a-407c-bd7a-319ff930bd63',
  '67609461-13fc-4dcf-9282-aaae399252e5',
  '65d227a9-1f9b-485d-9e41-5c10d72bd36f',
  '48ea703b-8170-426b-9bf0-8b58c6697c66',
  '306d8603-07e1-4a23-b0a0-9c053187bd6f',
  'e47aa545-7431-4c57-8e42-f674315f2b64',
  '7e987642-e6b8-4299-a39d-ca068a1c9bef',
  '82deea27-6f8e-4082-a2d7-7da7f0f730d5',
  'df21382a-c60b-46f2-abd2-0c4128d1fbe7',
  '88ca9799-ed19-41ff-847b-42b49d53b525',
  '708ba581-27ec-4510-a45b-3352d7859b9a',
  '8ec65abf-b3fc-4154-908b-0d4d079dc5f9',
  'c5fff275-ccf4-415e-bfe8-62a68bf16a67',
  'ed2f95cd-23c1-4bb9-a46e-61226e181a6e',
  'ec865f1c-110d-4a66-87ac-abd896ff38c3',
  '2370be19-e76d-4ee0-9fd0-598e405925fa',
  '789399b2-10b9-4130-99d3-f9b3e0995ff9',
  '3467f8b0-3205-4b4f-8ae0-45ccde2811ef',
  '8cadefaa-1e9c-4eff-bbb8-950f5467164c',
  'da62a6fb-01ef-495a-8bde-55a3d7986216',
  '7b710e66-c31d-46a9-aafb-80b3f434a4db',
  '85fa36d3-6332-44be-8c52-137b571cdae0',
  '18b63fe8-f882-4ef8-8e7b-ddfcdbbdd4f4'
];

(async () => {
  console.log('📊 BATCH 8 - 50 preguntas Word 365');
  console.log('Obteniendo preguntas de la BD...\n');

  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id')
    .in('id', questionIds);

  if (qError) {
    console.error('❌ Error al obtener preguntas:', qError);
    process.exit(1);
  }

  console.log(`✅ Obtuvimos ${questions.length} preguntas\n`);

  // Obtener articles para tener más contexto
  const articleIds = [...new Set(questions.map(q => q.primary_article_id).filter(Boolean))];

  const { data: articles } = await supabase
    .from('articles')
    .select('id, law_id, article_number')
    .in('id', articleIds);

  const articleMap = {};
  articles?.forEach(a => {
    articleMap[a.id] = a;
  });

  // Crear registros de verificación
  const verificationRecords = questions.map((q, idx) => {
    const correctOptionLetter = ['A', 'B', 'C', 'D'][q.correct_option];
    const article = articleMap[q.primary_article_id];

    return {
      question_id: q.id,
      article_id: q.primary_article_id,
      law_id: article?.law_id || null,
      ai_provider: 'microsoft_docs_verification',
      ai_model: 'word365_manual_verification',
      confidence: 'pending',
      explanation: `BATCH 8: Pregunta ${idx + 1}/50 - Verificación contra fuentes Microsoft oficial (support.microsoft.com/es-es o learn.microsoft.com/es-es). Respuesta correcta: ${correctOptionLetter}`,
      verified_at: null
    };
  });

  console.log(`📝 Preparando registros para verificación...\n`);

  // Insertar en lotes de 10
  for (let i = 0; i < verificationRecords.length; i += 10) {
    const batch = verificationRecords.slice(i, i + 10);
    const { error: insError } = await supabase
      .from('ai_verification_results')
      .upsert(batch, { onConflict: 'question_id,ai_provider' });

    if (insError) {
      console.error(`❌ Error al insertar lote ${i/10 + 1}:`, insError);
    } else {
      console.log(`✅ Lote ${(i/10 + 1).toString().padStart(2, '0')} insertado (${i + batch.length}/${verificationRecords.length})`);
    }

    // Pequeño delay entre lotes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('✅ BATCH PREPARADO PARA VERIFICACIÓN MANUAL');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`
📊 Resumen:
   - Preguntas: ${verificationRecords.length}
   - Batch: BATCH 8 - 50 preguntas Word 365
   - Topic: Word 365
   - AI Provider: microsoft_docs_verification
   - Status: pending (esperando verificación manual)

🔗 Fuentes oficiales REQUERIDAS:
   - https://support.microsoft.com/es-es/office/word
   - https://learn.microsoft.com/es-es/office/vba/api/word.application
   - https://learn.microsoft.com/es-es/office/

📋 Procedimiento de verificación:
   1. Para cada pregunta, verificar la respuesta correcta contra fuentes Microsoft oficiales
   2. Actualizar ai_verification_results:
      - confidence: 'high' si está verificado correctamente
      - confidence: 'low' si hay discrepancias
      - explanation: notas de verificación o referencias específicas
   3. Si hay errores, marcar en:
      - answer_ok: false (si la respuesta es incorrecta)
      - explanation_ok: false (si la explicación es incorrecta)
      - suggested_fix: la corrección necesaria
      - correct_option_should_be: la opción correcta si es diferente

✅ Registros listos en tabla 'ai_verification_results'
  `);

  console.log('═════════════════════════════════════════════════════════════════\n');
})();
