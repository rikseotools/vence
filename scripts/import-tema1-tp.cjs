// Importar preguntas Tema 1 Tramitación Procesal
// Paso 1: Análisis y detección
// Paso 2: Importación con vinculación a artículos

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMA1_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/Tema_1._La_Constitución_española_de_1978_(PRÓXIMAS_CONVOCATORIAS_TP_TL)');
const TOPIC_ID = 'a6351c86-dd4d-4a51-a615-8daf3ae07682';

// IDs de leyes
const LAWS = {
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941',
  LOTC: '2bc32b1a-9b5f-4e11-ba0b-3b014293882c',
  'LO 3/1981': '0425df52-bf4f-4220-a27d-63a9cbaac1c4',
  'LO 4/1981': 'd129456b-51ab-4e09-bd30-731386c1aff5'
};

// Artículo 0 CE para preguntas de estructura
const ARTICLE_0_CE = '2536184c-73ed-4568-9ac7-0bbf1da24dcb';

// Patrones para detectar ley
const LAW_PATTERNS = [
  { pattern: /ley org[aá]nica 3\/1981/i, lawKey: 'LO 3/1981' },
  { pattern: /defensor del pueblo/i, lawKey: 'LO 3/1981' },
  { pattern: /ley org[aá]nica 4\/1981/i, lawKey: 'LO 4/1981' },
  { pattern: /estados de alarma/i, lawKey: 'LO 4/1981' },
  { pattern: /ley org[aá]nica 2\/1979/i, lawKey: 'LOTC' },
  { pattern: /tribunal constitucional/i, lawKey: 'LOTC' },
  { pattern: /LOTC/i, lawKey: 'LOTC' },
  { pattern: /constituci[oó]n espa[nñ]ola/i, lawKey: 'CE' },
  { pattern: /\bCE\b/, lawKey: 'CE' },
  { pattern: /art[ií]culo\s+\d+.*CE/i, lawKey: 'CE' },
];

// Patrones para estructura (sin artículo específico)
const STRUCTURE_PATTERNS = [
  /cu[aá]ntos t[ií]tulos/i,
  /cu[aá]ntos art[ií]culos/i,
  /disposiciones? (adicionales?|transitorias?|derogatoria|final)/i,
  /estructura de la constituci[oó]n/i,
  /compone de/i,
  /se compone/i,
  /est[aá] formada/i,
  /consta de/i,
  /fecha.*sanci[oó]n/i,
  /fecha.*aprobaci[oó]n/i,
  /fecha.*promulgaci[oó]n/i,
  /pre[aá]mbulo/i,
];

const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Extraer número de artículo
function extractArticleNumber(text) {
  const patterns = [
    /art[ií]culo\s+(\d+)/i,
    /art\.\s*(\d+)/i,
    /art\s+(\d+)/i,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1];
  }
  return null;
}

// Detectar ley
function detectLaw(explanation, question) {
  const text = (explanation || '') + ' ' + (question || '');
  for (const { pattern, lawKey } of LAW_PATTERNS) {
    if (pattern.test(text)) {
      return lawKey;
    }
  }
  return null;
}

// ¿Es pregunta de estructura?
function isStructureQuestion(question, explanation) {
  const text = (question || '') + ' ' + (explanation || '');
  return STRUCTURE_PATTERNS.some(p => p.test(text));
}

// Cache de artículos
const articleCache = {};

async function getArticleId(lawId, articleNumber) {
  const key = `${lawId}-${articleNumber}`;
  if (articleCache[key] !== undefined) return articleCache[key];

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .eq('is_active', true)
    .single();

  articleCache[key] = data?.id || null;
  return articleCache[key];
}

// Verificar si pregunta ya existe
async function questionExists(questionText) {
  const { data } = await supabase
    .from('questions')
    .select('id')
    .eq('question_text', questionText)
    .single();
  return data?.id || null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  console.log('='.repeat(60));
  console.log('IMPORTAR TEMA 1 - TRAMITACIÓN PROCESAL');
  console.log('='.repeat(60));
  if (dryRun) console.log('🔍 MODO DRY-RUN (no se insertarán datos)\n');

  const files = fs.readdirSync(TEMA1_DIR).filter(f => f.endsWith('.json'));

  const stats = {
    total: 0,
    imported: 0,
    duplicates: 0,
    structure: 0,
    errors: [],
    byLaw: {}
  };

  for (const file of files) {
    const filePath = path.join(TEMA1_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const subtema = data.subtema;

    console.log(`\n📁 ${subtema} (${data.questionCount} preguntas)`);
    console.log('-'.repeat(50));

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      stats.total++;

      // Verificar duplicado
      const existingId = await questionExists(q.question);
      if (existingId) {
        stats.duplicates++;
        if (verbose) console.log(`  ⏭️  Duplicada: ${q.question.substring(0, 40)}...`);
        continue;
      }

      let articleId = null;
      let lawKey = null;

      // ¿Es pregunta de estructura?
      if (isStructureQuestion(q.question, q.explanation)) {
        articleId = ARTICLE_0_CE;
        lawKey = 'CE (Estructura)';
        stats.structure++;
      } else {
        // Detectar ley
        lawKey = detectLaw(q.explanation, q.question);
        if (!lawKey) {
          stats.errors.push({
            subtema,
            question: q.question.substring(0, 50),
            reason: 'No se detectó ley'
          });
          continue;
        }

        // Extraer artículo
        const articleNum = extractArticleNumber(q.explanation || '');
        if (!articleNum) {
          stats.errors.push({
            subtema,
            question: q.question.substring(0, 50),
            reason: `Ley ${lawKey} detectada pero sin artículo`
          });
          continue;
        }

        // Buscar artículo en BD
        const lawId = LAWS[lawKey];
        articleId = await getArticleId(lawId, articleNum);
        if (!articleId) {
          stats.errors.push({
            subtema,
            question: q.question.substring(0, 50),
            reason: `Art. ${articleNum} ${lawKey} no existe en BD`
          });
          continue;
        }
      }

      // Preparar datos
      const questionData = {
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: LETTER_TO_INDEX[q.correctAnswer],
        explanation: q.explanation || '',
        primary_article_id: articleId,
        difficulty: 'medium',
        is_active: true,
        is_official_exam: false,
        tags: ['Tema 1', subtema, 'Tramitación Procesal']
      };

      if (dryRun) {
        if (verbose) console.log(`  ✓ ${lawKey}: ${q.question.substring(0, 40)}...`);
        stats.imported++;
        stats.byLaw[lawKey] = (stats.byLaw[lawKey] || 0) + 1;
      } else {
        const { error } = await supabase.from('questions').insert(questionData);
        if (error) {
          if (error.message.includes('duplicate')) {
            stats.duplicates++;
          } else {
            stats.errors.push({
              subtema,
              question: q.question.substring(0, 50),
              reason: error.message
            });
          }
        } else {
          stats.imported++;
          stats.byLaw[lawKey] = (stats.byLaw[lawKey] || 0) + 1;
          if (verbose) console.log(`  ✅ ${lawKey}: ${q.question.substring(0, 40)}...`);
        }
      }
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`Total preguntas: ${stats.total}`);
  console.log(`✅ Importadas: ${stats.imported}`);
  console.log(`⏭️  Duplicadas: ${stats.duplicates}`);
  console.log(`📐 Estructura (Art. 0): ${stats.structure}`);
  console.log(`❌ Errores: ${stats.errors.length}`);

  console.log('\n📈 Por ley:');
  Object.entries(stats.byLaw).forEach(([law, count]) => {
    console.log(`   ${law}: ${count}`);
  });

  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORES (primeros 10):');
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`   - ${e.reason}: ${e.question}...`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... y ${stats.errors.length - 10} más`);
    }

    // Guardar errores para revisión
    fs.writeFileSync('/tmp/tema1-import-errors.json', JSON.stringify(stats.errors, null, 2));
    console.log('\n💾 Errores guardados en /tmp/tema1-import-errors.json');
  }

  if (dryRun) {
    console.log('\n⚠️  MODO DRY-RUN: No se insertó nada. Ejecuta sin --dry-run para importar.');
  }
}

main().catch(console.error);
