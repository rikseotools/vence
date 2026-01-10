const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// CE article IDs
const CE_ART_86 = 'bd388256-c87b-4c3e-be77-5893ec6e8bab';

const corrections = [
  // Respuestas incorrectas - cambiar correct_option
  { id: '24f53ebf-d318-4b1a-b94b-c08c785db825', correct: 2, reason: 'Art. 82.2: ley de bases para formación textos articulados (B), no rango superior (A)' },
  { id: '7e8b5e67-76ee-40b5-bb21-228669a8b9cf', correct: 3, reason: 'Art. 82.2: ley de BASES (no orgánica). Opción C correcta sobre delegación.' },
  { id: '296a07f2-3c8a-4b68-b215-65cd7df4641f', correct: 4, reason: 'Art. 82.4 y 83: A, B, C todas correctas. Respuesta D (todas).' },
  { id: '318e19c0-9e16-40e2-9f89-70f12ebbf048', correct: 4, reason: 'Art. 82.2 y 82.4: A, B, C todas correctas. Respuesta D (todas).' },
  { id: 'd3554d6f-dec3-489e-8b14-746b5a207e00', correct: 4, reason: 'Art. 86.1: Decretos-LEYES (D), no Leyes Marco (C).' },
  { id: '6ddb9615-e2ae-45c3-894e-9e6f14e53be2', correct: 4, reason: 'Art. 86.2: Solo CONGRESO convalida (D), no Congreso Y Senado (C).' },
  { id: '6110a4e6-6c0c-4942-ad2b-19144d4814c2', correct: 3, reason: 'Art. 86.2: CONGRESO convalida (C), no Cortes Generales (B).' },
  { id: '5230fb59-a316-4d32-a156-a1afdc145eb7', correct: 2, reason: 'Art. 81.2: mayoría CONGRESO (no Cortes). Opción B sobre delegación es correcta.' },
  { id: '37bc661f-ec78-43e6-a474-7d72461bd630', correct: 3, reason: 'Pregunta pide INCORRECTA. C es incorrecta (no se puede delegar régimen electoral).' },
  { id: '6ff000d0-7eb7-4bf9-9f89-0e7149fd2fe8', correct: 2, reason: 'B explica correctamente: D-ley provisional urgencia, DL delegación expresa.' },
  { id: 'b16c33ba-3d45-49cd-936f-60524298bb42', correct: 3, reason: 'Art. 74.2: decisiones políticas (C) NO están en lista de mayoría cada cámara.' },

  // Preguntas sin correct_option definido
  { id: '462ab6b6-18ba-42d2-a785-68e0fa716990', correct: 1, reason: 'Art. 86.2: Congreso se pronuncia en 30 días (A) es correcto.' },
  { id: '5b95fcec-be88-4d94-9484-c8289c21cbed', correct: 1, reason: 'Art. 86.1: dictados en casos extraordinaria y urgente necesidad (A).' },
  { id: '43c3651e-c0b8-4bfa-8a75-2c0bc16b721e', correct: 1, reason: 'Art. 86.1: materias excluidas correctamente listadas en A.' },
  { id: 'a6b9654e-526a-40d9-b06d-fe596de69225', correct: 1, reason: 'Art. 67.1: NO prohíbe acumular Asamblea CCAA con Senador, solo con Diputado. A es correcta.' },
];

// Pregunta 10: necesita cambio de artículo también
const q10 = {
  id: '49d97b06-af2c-4b64-8f42-99aa56a1d493',
  correct: 4, // Ninguna es correcta (A y B son DL, C es parcialmente incorrecta)
  newArticle: CE_ART_86,
  reason: 'Art. incorrecto (82→86). Ninguna opción es totalmente correcta: A/B son decretos legislativos, C dice "cualquier" pero hay excepciones.'
};

// Pregunta 15: verificar cuál NO es ley orgánica
const q15 = {
  id: 'e7d9440c-e0fe-4ebe-b853-bf173a4c361f',
  correct: 1, // A - Tribunales Económico-Administrativos no está en art. 81
  reason: 'Art. 81: Tribunales Económico-Administrativos (A) NO está reservado a LO.'
};

(async () => {
  console.log('Corrigiendo 17 preguntas de T103...\n');

  let fixed = 0;

  // Correcciones normales (solo correct_option)
  for (const c of corrections) {
    const { error } = await s.from('questions')
      .update({
        correct_option: c.correct,
        topic_review_status: 'perfect'
      })
      .eq('id', c.id);

    if (error) {
      console.log('❌', c.id.substring(0,8), '-', error.message);
    } else {
      console.log('✅', c.id.substring(0,8), '- Resp →', ['A','B','C','D'][c.correct-1]);
      fixed++;
    }

    // Update AI verification
    await s.from('ai_verification_results')
      .update({
        article_ok: true,
        answer_ok: true,
        explanation: 'Corregido manualmente. ' + c.reason
      })
      .eq('question_id', c.id);
  }

  // Pregunta 10: cambiar artículo también
  {
    const { error } = await s.from('questions')
      .update({
        correct_option: q10.correct,
        primary_article_id: q10.newArticle,
        topic_review_status: 'perfect'
      })
      .eq('id', q10.id);

    if (error) {
      console.log('❌', q10.id.substring(0,8), '-', error.message);
    } else {
      console.log('✅', q10.id.substring(0,8), '- Resp → D, Art → 86 CE');
      fixed++;
    }

    await s.from('ai_verification_results')
      .update({
        article_id: q10.newArticle,
        article_ok: true,
        answer_ok: true,
        explanation: 'Corregido manualmente. ' + q10.reason
      })
      .eq('question_id', q10.id);
  }

  // Pregunta 15
  {
    const { error } = await s.from('questions')
      .update({
        correct_option: q15.correct,
        topic_review_status: 'perfect'
      })
      .eq('id', q15.id);

    if (error) {
      console.log('❌', q15.id.substring(0,8), '-', error.message);
    } else {
      console.log('✅', q15.id.substring(0,8), '- Resp → A');
      fixed++;
    }

    await s.from('ai_verification_results')
      .update({
        article_ok: true,
        answer_ok: true,
        explanation: 'Corregido manualmente. ' + q15.reason
      })
      .eq('question_id', q15.id);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Total corregidas: ${fixed}/17`);
})();
