// Preparar preguntas del Tema 1 para análisis con IA
// Genera un archivo JSON con preguntas + artículos candidatos

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMA1_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/Tema_1._La_Constitución_española_de_1978_(PRÓXIMAS_CONVOCATORIAS_TP_TL)');

// IDs de leyes para Tema 1
const LAWS = {
  CE: { id: '6ad91a6c-41ec-431f-9c80-5f5566834941', name: 'Constitución Española' },
  LOTC: { id: '2bc32b1a-9b5f-4e11-ba0b-3b014293882c', name: 'LO Tribunal Constitucional' },
  'LO 3/1981': { id: '0425df52-bf4f-4220-a27d-63a9cbaac1c4', name: 'LO Defensor del Pueblo' },
  'LO 4/1981': { id: 'd129456b-51ab-4e09-bd30-731386c1aff5', name: 'LO Estados de Alarma' }
};

// Artículo 0 CE para estructura
const ARTICLE_0_CE = {
  id: '2536184c-73ed-4568-9ac7-0bbf1da24dcb',
  law: 'CE',
  number: '0',
  title: 'Estructura de la Constitución',
  content: 'La CE tiene 169 artículos, Título Preliminar, 10 Títulos, 4 Disp. Adicionales, 9 Disp. Transitorias, 1 Disp. Derogatoria, 1 Disp. Final.'
};

// Extraer posibles números de artículo de un texto
function extractPossibleArticles(text) {
  const matches = text.match(/art[íi]culo\s*(\d+)/gi) || [];
  const numbers = matches.map(m => m.match(/\d+/)[0]);
  return [...new Set(numbers)];
}

// Detectar ley probable
function detectProbableLaw(text) {
  if (/defensor del pueblo|lo 3\/1981/i.test(text)) return 'LO 3/1981';
  if (/estados? de alarma|excepci[oó]n|sitio|lo 4\/1981/i.test(text)) return 'LO 4/1981';
  if (/tribunal constitucional|lotc|lo 2\/1979/i.test(text)) return 'LOTC';
  return 'CE'; // Default
}

async function main() {
  console.log('='.repeat(60));
  console.log('PREPARAR TEMA 1 PARA ANÁLISIS CON IA');
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
  const files = fs.readdirSync(TEMA1_DIR).filter(f => f.endsWith('.json'));
  const allQuestions = [];
  let questionId = 0;

  for (const file of files) {
    const filePath = path.join(TEMA1_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`\n📁 ${data.subtema} (${data.questionCount} preguntas)`);

    for (const q of data.questions) {
      questionId++;

      const fullText = `${q.question} ${q.explanation || ''}`;
      const probableLaw = detectProbableLaw(fullText);
      const possibleArticleNums = extractPossibleArticles(fullText);

      // Obtener artículos candidatos
      let candidateArticles = [];

      if (possibleArticleNums.length > 0) {
        // Si hay números de artículo, buscar esos específicos
        const lawArticles = allArticles[probableLaw] || allArticles['CE'];
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

      // Si no hay candidatos claros, podría ser pregunta de estructura
      const isStructureQ = /cu[aá]ntos (t[ií]tulos|art[ií]culos)|disposiciones|estructura|se compone|fecha.*(sanci[oó]n|vigor)/i.test(fullText);

      if (isStructureQ || candidateArticles.length === 0) {
        candidateArticles.unshift(ARTICLE_0_CE);
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
        candidateArticles: candidateArticles.slice(0, 5), // Max 5 candidatos
        // Campos a rellenar por IA:
        verified_article_id: null,
        verified_article_number: null,
        verified_law: null,
        ai_confidence: null,
        ai_notes: null
      });
    }
  }

  // Guardar para procesamiento con IA
  const outputPath = '/tmp/tema1-questions-for-ai.json';
  fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`Total preguntas: ${allQuestions.length}`);
  console.log(`Con artículos candidatos: ${allQuestions.filter(q => q.candidateArticles.length > 0).length}`);
  console.log(`Posible estructura: ${allQuestions.filter(q => q.candidateArticles[0]?.number === '0').length}`);
  console.log(`\n💾 Guardado en: ${outputPath}`);

  // Mostrar distribución por subtema
  console.log('\n📈 Por subtema:');
  const bySubtema = {};
  allQuestions.forEach(q => {
    bySubtema[q.subtema] = (bySubtema[q.subtema] || 0) + 1;
  });
  Object.entries(bySubtema).forEach(([s, c]) => console.log(`   ${s}: ${c}`));

  // Crear batches para agentes paralelos (20 preguntas por batch)
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
    batches.push(allQuestions.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n🔄 Batches para agentes: ${batches.length} (de ${BATCH_SIZE} preguntas)`);

  // Guardar batches
  batches.forEach((batch, idx) => {
    fs.writeFileSync(`/tmp/tema1-batch-${idx + 1}.json`, JSON.stringify(batch, null, 2));
  });
  console.log(`💾 Batches guardados en /tmp/tema1-batch-{1-${batches.length}}.json`);
}

main().catch(console.error);
