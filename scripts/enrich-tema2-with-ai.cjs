// Preparar preguntas del Tema 2 para análisis con IA
// Tema 2: Igualdad y no discriminación por razón de género

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMA2_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/Tema_2._Derecho_de_igualdad_y_no_discriminación_por_razón_de_género_(PRÓXIMAS_CONVOCATORIAS_TP_TL)');

// IDs de leyes para Tema 2
const LAWS = {
  'LO 3/2007': { id: '6e59eacd-9298-4164-9d78-9e9343d9a900', name: 'LO Igualdad efectiva mujeres/hombres' },
  'LO 1/2004': { id: 'f5c17b23-2547-43d2-800c-39f5ea925c2f', name: 'LO Violencia de Género' },
  'Ley 15/2022': { id: 'aa7d0693-106f-47a8-b41d-9c713d20781d', name: 'Ley Igualdad de trato' },
  'Ley 4/2023': { id: 'd3a41325-047e-4d6a-99c5-fd8d5c8dc782', name: 'Ley Igualdad personas trans' },
  'CE': { id: '6ad91a6c-41ec-431f-9c80-5f5566834941', name: 'Constitución Española' }
};

// Extraer posibles números de artículo de un texto
function extractPossibleArticles(text) {
  const matches = text.match(/art[íi]culo\s*(\d+)/gi) || [];
  const numbers = matches.map(m => m.match(/\d+/)[0]);
  return [...new Set(numbers)];
}

// Detectar ley probable según el subtema
function detectProbableLaw(subtema, text) {
  // Por subtema
  if (subtema.includes('LO_32007') || subtema.includes('3/2007')) return 'LO 3/2007';
  if (subtema.includes('LO_12004') || subtema.includes('1/2004')) return 'LO 1/2004';
  if (subtema.includes('152022') || subtema.includes('15/2022')) return 'Ley 15/2022';
  if (subtema.includes('42023') || subtema.includes('4/2023')) return 'Ley 4/2023';

  // Por contenido
  const lowerText = text.toLowerCase();
  if (lowerText.includes('violencia de género') || lowerText.includes('lo 1/2004')) return 'LO 1/2004';
  if (lowerText.includes('igualdad efectiva') || lowerText.includes('lo 3/2007')) return 'LO 3/2007';
  if (lowerText.includes('ley 15/2022') || lowerText.includes('no discriminación')) return 'Ley 15/2022';
  if (lowerText.includes('ley 4/2023') || lowerText.includes('trans')) return 'Ley 4/2023';
  if (lowerText.includes('constitución') || lowerText.includes('art. 14 ce')) return 'CE';

  return 'LO 3/2007'; // Default
}

async function main() {
  console.log('='.repeat(60));
  console.log('PREPARAR TEMA 2 PARA ANÁLISIS CON IA');
  console.log('Igualdad y no discriminación por razón de género');
  console.log('='.repeat(60));

  // Cargar todos los artículos relevantes
  console.log('\n📚 Cargando artículos de la BD...');

  const allArticles = {};

  for (const [lawKey, lawData] of Object.entries(LAWS)) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', lawData.id)
      .eq('is_active', true)
      .order('article_number');

    allArticles[lawKey] = articles || [];
    console.log(`  ${lawKey}: ${articles?.length || 0} artículos`);
  }

  // Procesar archivos JSON
  const files = fs.readdirSync(TEMA2_DIR).filter(f => f.endsWith('.json'));
  const allQuestions = [];
  let questionId = 0;

  for (const file of files) {
    const filePath = path.join(TEMA2_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`\n📁 ${data.subtema} (${data.questionCount} preguntas)`);

    for (const q of data.questions) {
      questionId++;

      const fullText = `${q.question} ${q.explanation || ''}`;
      const probableLaw = detectProbableLaw(file, fullText);
      const possibleArticleNums = extractPossibleArticles(fullText);

      // Obtener artículos candidatos
      let candidateArticles = [];

      if (possibleArticleNums.length > 0) {
        const lawArticles = allArticles[probableLaw] || [];
        candidateArticles = lawArticles
          .filter(a => possibleArticleNums.includes(a.article_number))
          .map(a => ({
            id: a.id,
            law: probableLaw,
            number: a.article_number,
            title: a.title,
            content: a.content?.substring(0, 500) + (a.content?.length > 500 ? '...' : '')
          }));
      }

      allQuestions.push({
        id: questionId,
        file: file,
        subtema: data.subtema,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        probableLaw: probableLaw,
        possibleArticleNums: possibleArticleNums,
        candidateArticles: candidateArticles.slice(0, 5),
        verified_article_id: null,
        verified_article_number: null,
        verified_law: null,
        ai_confidence: null,
        ai_notes: null
      });
    }
  }

  // Guardar para procesamiento con IA
  const outputPath = '/tmp/tema2-questions-for-ai.json';
  fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`Total preguntas: ${allQuestions.length}`);
  console.log(`Con artículos candidatos: ${allQuestions.filter(q => q.candidateArticles.length > 0).length}`);
  console.log(`\n💾 Guardado en: ${outputPath}`);

  // Mostrar distribución por ley probable
  console.log('\n📈 Por ley probable:');
  const byLaw = {};
  allQuestions.forEach(q => {
    byLaw[q.probableLaw] = (byLaw[q.probableLaw] || 0) + 1;
  });
  Object.entries(byLaw).forEach(([l, c]) => console.log(`   ${l}: ${c}`));

  // Crear batches para agentes paralelos (20 preguntas por batch)
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
    batches.push(allQuestions.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n🔄 Batches para agentes: ${batches.length} (de ${BATCH_SIZE} preguntas)`);

  // Guardar batches
  batches.forEach((batch, idx) => {
    fs.writeFileSync(`/tmp/tema2-batch-${idx + 1}.json`, JSON.stringify(batch, null, 2));
  });
  console.log(`💾 Batches guardados en /tmp/tema2-batch-{1-${batches.length}}.json`);
}

main().catch(console.error);
