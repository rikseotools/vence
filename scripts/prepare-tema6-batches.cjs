require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMA6_DIR = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal/Tema_6._El_poder_judicial._El_CGPJ._El_Ministerio_Fiscal._(PRÓXIMAS_CONVOCATORIAS_TP_TL)';

const LAWS = {
  LOPJ: 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  EOMF: '8f8cb31f-c8ca-4967-9fa6-6fc94d77a932',
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941'
};

// Patrones para detectar artículos en explicaciones
const ARTICLE_PATTERNS = [
  /Art(?:ículo)?\.?\s*(\d+(?:\s*bis|\s*ter|\s*quater)?)/gi,
  /artículo\s+(\d+(?:\s*bis|\s*ter|\s*quater)?)/gi
];

// Detectar ley en explicación
function detectLaw(explanation) {
  const exp = explanation.toLowerCase();
  if (exp.includes('constitución') || exp.includes(' ce')) return 'CE';
  if (exp.includes('50/1981') || exp.includes('ministerio fiscal') || exp.includes('eomf')) return 'EOMF';
  if (exp.includes('6/1985') || exp.includes('lopj') || exp.includes('poder judicial')) return 'LOPJ';
  return null;
}

// Extraer número de artículo
function extractArticleNumber(explanation) {
  for (const pattern of ARTICLE_PATTERNS) {
    const matches = [...explanation.matchAll(pattern)];
    if (matches.length > 0) {
      // Normalizar número
      let num = matches[0][1].trim();
      // Convertir "veinte" a "20" si es necesario
      const wordToNum = {
        'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
        'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
        'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
        'dieciséis': '16', 'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19',
        'veinte': '20'
      };
      if (wordToNum[num.toLowerCase()]) {
        num = wordToNum[num.toLowerCase()];
      }
      return num;
    }
  }
  return null;
}

async function main() {
  console.log('=== PREPARANDO BATCHES TEMA 6 ===\n');

  // 1. Cargar todos los JSONs
  const files = fs.readdirSync(TEMA6_DIR).filter(f => f.endsWith('.json'));
  let allQuestions = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(TEMA6_DIR, file)));
    const subtema = data.subtema || file.replace('.json', '');

    for (const q of data.questions || []) {
      allQuestions.push({
        ...q,
        subtema,
        file
      });
    }
  }

  console.log('Total preguntas cargadas:', allQuestions.length);

  // 2. Cargar artículos de las leyes
  const articleCache = {};

  for (const [lawName, lawId] of Object.entries(LAWS)) {
    const { data } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', lawId)
      .eq('is_active', true);

    articleCache[lawName] = data || [];
    console.log(`${lawName}: ${articleCache[lawName].length} artículos cargados`);
  }

  // 3. Verificar duplicados existentes
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('question_text')
    .eq('is_active', true);

  const existingSet = new Set(existingQuestions?.map(q => q.question_text.trim().toLowerCase()) || []);
  console.log('Preguntas existentes en BD:', existingSet.size);

  // 4. Procesar cada pregunta
  const enrichedQuestions = [];
  let duplicates = 0;
  let noLawDetected = 0;

  for (const q of allQuestions) {
    // Verificar duplicado
    if (existingSet.has(q.question.trim().toLowerCase())) {
      duplicates++;
      continue;
    }

    // Detectar ley
    const lawName = detectLaw(q.explanation);
    if (!lawName) {
      noLawDetected++;
      // Intentar inferir por subtema
      if (q.subtema.toLowerCase().includes('ministerio fiscal')) {
        q.inferredLaw = 'EOMF';
      } else if (q.subtema.toLowerCase().includes('constitución') || q.subtema.toLowerCase().includes('poder judicial')) {
        q.inferredLaw = 'CE';
      } else {
        q.inferredLaw = 'LOPJ';
      }
    }

    const targetLaw = lawName || q.inferredLaw;
    const articleNum = extractArticleNumber(q.explanation);

    // Buscar artículo candidato
    let candidateArticles = [];
    if (targetLaw && articleCache[targetLaw]) {
      if (articleNum) {
        // Buscar artículo específico
        const exact = articleCache[targetLaw].find(a =>
          a.article_number === articleNum ||
          a.article_number === articleNum.toString()
        );
        if (exact) {
          candidateArticles = [exact];
        }
      }

      // Si no encontramos, añadir algunos candidatos basados en contenido
      if (candidateArticles.length === 0) {
        candidateArticles = articleCache[targetLaw].slice(0, 5);
      }
    }

    enrichedQuestions.push({
      id: require('crypto').randomUUID(),
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      subtema: q.subtema,
      detectedLaw: targetLaw,
      detectedArticle: articleNum,
      candidateArticles: candidateArticles.map(a => ({
        id: a.id,
        number: a.article_number,
        title: a.title,
        contentPreview: a.content?.substring(0, 200)
      })),
      // Campos para que la IA complete
      verified_article_id: null,
      verified_article_number: null,
      verified_law: null,
      ai_verification: null
    });
  }

  console.log('\nResultados:');
  console.log('- Duplicadas (omitidas):', duplicates);
  console.log('- Sin ley detectada (inferida):', noLawDetected);
  console.log('- A verificar:', enrichedQuestions.length);

  // 5. Dividir en batches de 20
  const BATCH_SIZE = 20;
  const batches = [];

  for (let i = 0; i < enrichedQuestions.length; i += BATCH_SIZE) {
    batches.push(enrichedQuestions.slice(i, i + BATCH_SIZE));
  }

  console.log('- Batches creados:', batches.length);

  // 6. Guardar batches
  for (let i = 0; i < batches.length; i++) {
    const filename = `/tmp/tema6-batch-${i + 1}.json`;
    fs.writeFileSync(filename, JSON.stringify(batches[i], null, 2));
    console.log(`Guardado: ${filename} (${batches[i].length} preguntas)`);
  }

  console.log('\n✅ Preparación completada');
  console.log(`Ejecutar verificación IA en ${batches.length} batches`);
}

main().catch(console.error);
