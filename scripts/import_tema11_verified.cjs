/**
 * Importa preguntas verificadas del Tema 11 a la BD
 * Combina datos verificados con datos originales
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOPJ_ID = 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff';
const RD_1608_ID = 'c1700262-1ccb-41fd-a024-355d9795c441';
const TEMA_DIR = 'preguntas-para-subir/tramitacion-procesal/Tema_11._El_letrado_de_la_Administración_de_Justicia_(PRÓXIMAS_CONVOCATORIAS_TP_TL)';

function convertCorrectAnswer(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
}

async function findArticle(lawId, articleNumber) {
  if (!lawId || !articleNumber) return null;
  const normalizedNum = articleNumber.toString().trim();

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', normalizedNum)
    .limit(1)
    .single();

  return data?.id || null;
}

async function main() {
  // 1. Cargar preguntas originales con opciones
  const files = fs.readdirSync(TEMA_DIR).filter(f => f.endsWith('.json'));
  const originalQuestions = [];

  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(TEMA_DIR, file), 'utf8'));
    data.questions.forEach((q, idx) => {
      originalQuestions.push({
        ...q,
        originalIndex: originalQuestions.length + 1
      });
    });
  });

  console.log(`Preguntas originales: ${originalQuestions.length}`);

  // 2. Cargar datos verificados
  const verifiedMap = new Map();
  for (let i = 1; i <= 7; i++) {
    const file = `/tmp/tema11-batch-${i}-verified.json`;
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      data.forEach(q => verifiedMap.set(q.id, q));
    }
  }

  console.log(`Verificaciones cargadas: ${verifiedMap.size}`);

  // 3. Corrección manual: Pregunta 135 tiene respuesta incorrecta
  const v135 = verifiedMap.get(135);
  if (v135) {
    console.log('⚠️  Corrigiendo pregunta 135: D -> B');
    v135.correctAnswer = 'B';
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // 4. Procesar cada pregunta original
  for (let i = 0; i < originalQuestions.length; i++) {
    const orig = originalQuestions[i];
    const verified = verifiedMap.get(i + 1); // IDs empiezan en 1

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .ilike('question_text', orig.question.substring(0, 50) + '%')
      .limit(1);

    if (existing?.length) {
      skipped++;
      continue;
    }

    // Determinar article_id
    let articleId = verified?.verified_article_id;

    // Si no hay artículo verificado, buscar en RD 1608/2005 o LOPJ
    if (!articleId && orig.explanation) {
      // Intentar RD 1608/2005
      const rdMatch = orig.explanation.match(/[Aa]rt[íi]culo\s*(\d+)[^\n]*(?:RD|Real Decreto|Reglamento)/i) ||
                      orig.explanation.match(/(?:RD|Reglamento)[^\n]*[Aa]rt[íi]culo\s*(\d+)/i);
      if (rdMatch) {
        articleId = await findArticle(RD_1608_ID, rdMatch[1]);
      }

      // Si no, intentar LOPJ
      if (!articleId) {
        const lopjMatch = orig.explanation.match(/[Aa]rt[íi]culo\s*(\d+[a-z]*(?: bis| ter| quater)?)/i);
        if (lopjMatch) {
          articleId = await findArticle(LOPJ_ID, lopjMatch[1]);
        }
      }
    }

    // Fallback: artículo 440 LOPJ
    if (!articleId) {
      articleId = await findArticle(LOPJ_ID, '440');
    }

    if (!articleId) {
      console.log(`⚠️  Sin artículo para pregunta ${i + 1}`);
      errors++;
      continue;
    }

    // Usar respuesta corregida si existe
    const correctAnswer = verified?.correctAnswer || orig.correctAnswer;

    // Insertar pregunta
    const questionData = {
      question_text: orig.question,
      option_a: orig.options.find(o => o.letter === 'A')?.text || '',
      option_b: orig.options.find(o => o.letter === 'B')?.text || '',
      option_c: orig.options.find(o => o.letter === 'C')?.text || '',
      option_d: orig.options.find(o => o.letter === 'D')?.text || '',
      correct_option: convertCorrectAnswer(correctAnswer),
      explanation: orig.explanation || '',
      primary_article_id: articleId,
      is_active: true,
      difficulty: 'medium',
      is_official_exam: false,
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      topic_review_status: 'perfect'
    };

    const { error } = await supabase
      .from('questions')
      .insert(questionData);

    if (error) {
      console.error(`❌ Error [${i + 1}]:`, error.message);
      errors++;
    } else {
      imported++;
      if (imported % 20 === 0) {
        console.log(`✅ Importadas: ${imported}...`);
      }
    }
  }

  console.log('\n========== RESUMEN ==========');
  console.log(`✅ Importadas: ${imported}`);
  console.log(`⏭️  Saltadas: ${skipped}`);
  console.log(`❌ Errores: ${errors}`);

  // 5. Actualizar topic_scope si es necesario
  if (imported > 0) {
    console.log('\n📊 Verificando topic_scope...');
    const TOPIC_11_ID = 'f5c65f8b-6e2b-47f8-b569-b83125ae6f0c';

    // Añadir RD 1608/2005 si no está
    const { data: existingScope } = await supabase
      .from('topic_scope')
      .select('id')
      .eq('topic_id', TOPIC_11_ID)
      .eq('law_id', RD_1608_ID);

    if (!existingScope?.length) {
      await supabase.from('topic_scope').insert({
        topic_id: TOPIC_11_ID,
        law_id: RD_1608_ID,
        weight: 1
      });
      console.log('✅ Añadido RD 1608/2005 a topic_scope');
    }
  }
}

main().catch(console.error);
