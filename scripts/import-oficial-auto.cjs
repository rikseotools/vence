const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Mapeo de términos en explicación a short_name de ley
const LAW_PATTERNS = [
  { pattern: /constitución española/i, shortName: 'CE' },
  { pattern: /\bCE\b/, shortName: 'CE' },
  { pattern: /ley 39\/2015/i, shortName: 'LPAC' },
  { pattern: /procedimiento administrativo común/i, shortName: 'LPAC' },
  { pattern: /ley 40\/2015/i, shortName: 'LRJSP' },
  { pattern: /régimen jurídico del sector público/i, shortName: 'LRJSP' },
  { pattern: /ley 19\/2013/i, shortName: 'LTAIBG' },
  { pattern: /transparencia/i, shortName: 'LTAIBG' },
  { pattern: /ley 9\/2017/i, shortName: 'LCSP' },
  { pattern: /contratos del sector público/i, shortName: 'LCSP' },
  { pattern: /estatuto básico.*empleado/i, shortName: 'TREBEP' },
  { pattern: /\bTREBEP\b/i, shortName: 'TREBEP' },
  { pattern: /real decreto legislativo 5\/2015/i, shortName: 'TREBEP' },
  { pattern: /ley 47\/2003/i, shortName: 'LGP' },
  { pattern: /ley general presupuestaria/i, shortName: 'LGP' },
  { pattern: /ley orgánica 3\/2007/i, shortName: 'LOI' },
  { pattern: /igualdad efectiva/i, shortName: 'LOI' },
  { pattern: /ley orgánica 1\/2004/i, shortName: 'LOVG' },
  { pattern: /violencia de género/i, shortName: 'LOVG' },
  { pattern: /ley 53\/1984/i, shortName: 'LI' },
  { pattern: /incompatibilidades/i, shortName: 'LI' },
  { pattern: /ley 50\/1997/i, shortName: 'LG' },
  { pattern: /ley del gobierno/i, shortName: 'LG' },
  { pattern: /ley 6\/1997/i, shortName: 'LOFAGE' },
  { pattern: /LOFAGE/i, shortName: 'LOFAGE' },
  { pattern: /ley 7\/1985/i, shortName: 'LBRL' },
  { pattern: /bases.*régimen local/i, shortName: 'LBRL' },
  { pattern: /reglamento general de recaudación/i, shortName: 'RGR' },
  { pattern: /real decreto 939\/2005/i, shortName: 'RGR' },
  { pattern: /RGPD/i, shortName: 'RGPD' },
  { pattern: /reglamento.*2016\/679/i, shortName: 'RGPD' },
  { pattern: /protección de datos/i, shortName: 'LOPDGDD' },
  { pattern: /ley orgánica 3\/2018/i, shortName: 'LOPDGDD' },
  { pattern: /TFUE/i, shortName: 'TFUE' },
  { pattern: /tratado de funcionamiento/i, shortName: 'TFUE' },
  { pattern: /TUE/i, shortName: 'TUE' },
  { pattern: /tratado de la unión europea/i, shortName: 'TUE' },
  { pattern: /real decreto 364\/1995/i, shortName: 'RGIF' },
  { pattern: /reglamento general de ingreso/i, shortName: 'RGIF' },
  { pattern: /orden apu\/1461\/2002/i, shortName: 'Orden APU/1461/2002' },
  { pattern: /word/i, shortName: 'Procesadores de texto' },
  { pattern: /excel/i, shortName: 'Hojas de cálculo. Excel' },
  { pattern: /access/i, shortName: 'Base de datos: Access' },
  { pattern: /windows/i, shortName: 'Informática Básica' },
  { pattern: /informática/i, shortName: 'Informática Básica' },
  { pattern: /hardware/i, shortName: 'Informática Básica' },
  { pattern: /software/i, shortName: 'Informática Básica' },
];

// Extraer número de artículo de la explicación
function extractArticleNumber(explanation) {
  // Buscar "Artículo X" o "Art. X" o "artículo X"
  const patterns = [
    /artículo\s+(\d+)/i,
    /art\.\s*(\d+)/i,
    /art\s+(\d+)/i,
  ];

  for (const p of patterns) {
    const match = explanation.match(p);
    if (match) return match[1];
  }
  return null;
}

// Detectar ley de la explicación
function detectLaw(explanation, topic) {
  const text = explanation + ' ' + topic;

  for (const { pattern, shortName } of LAW_PATTERNS) {
    if (pattern.test(text)) {
      return shortName;
    }
  }
  return null;
}

// Cache de leyes y artículos
const lawCache = {};
const articleCache = {};

async function getLawId(shortName) {
  if (lawCache[shortName]) return lawCache[shortName];

  const { data } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', shortName)
    .single();

  if (data) {
    lawCache[shortName] = data.id;
    return data.id;
  }
  return null;
}

async function getArticleId(lawId, articleNumber) {
  const key = `${lawId}-${articleNumber}`;
  if (articleCache[key]) return articleCache[key];

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .eq('is_active', true)
    .single();

  if (data) {
    articleCache[key] = data.id;
    return data.id;
  }
  return null;
}

(async () => {
  console.log('=== Importando preguntas oficiales automáticamente ===\n');

  const filePath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/examenes-oficiales/oficial_2026-01-06.json';
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const questions = data.questions;

  console.log(`Total preguntas: ${questions.length}\n`);

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = i + 1;

    // Detectar ley y artículo
    const lawShortName = detectLaw(q.explanation || '', q.topic || '');
    const articleNumber = extractArticleNumber(q.explanation || '');

    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('questions')
      .select('id, is_official_exam, primary_article_id')
      .eq('question_text', q.question)
      .single();

    if (existing) {
      // Ya existe - actualizar como oficial
      const { error } = await supabase
        .from('questions')
        .update({
          is_official_exam: true,
          exam_position: 'administrativo',
          exam_source: 'OpositaTest - Examen Oficial C1'
        })
        .eq('id', existing.id);

      if (!error) {
        if (existing.is_official_exam) {
          console.log(`${num}. ⏭️  Ya era oficial: ${q.question.substring(0, 50)}...`);
          skipped++;
        } else {
          console.log(`${num}. ✅ Marcada oficial: ${q.question.substring(0, 50)}...`);
          updated++;
        }
      }
      continue;
    }

    // No existe - necesitamos insertar
    if (!lawShortName || !articleNumber) {
      console.log(`${num}. ❌ No detecté ley/artículo: ${q.question.substring(0, 50)}...`);
      console.log(`      Ley: ${lawShortName}, Art: ${articleNumber}`);
      errors.push({ num, question: q.question.substring(0, 50), reason: 'No detecté ley/artículo' });
      continue;
    }

    const lawId = await getLawId(lawShortName);
    if (!lawId) {
      console.log(`${num}. ❌ Ley no encontrada: ${lawShortName}`);
      errors.push({ num, question: q.question.substring(0, 50), reason: `Ley ${lawShortName} no encontrada` });
      continue;
    }

    const articleId = await getArticleId(lawId, articleNumber);
    if (!articleId) {
      console.log(`${num}. ❌ Art. ${articleNumber} no existe en ${lawShortName}`);
      errors.push({ num, question: q.question.substring(0, 50), reason: `Art. ${articleNumber} no existe en ${lawShortName}` });
      continue;
    }

    // Insertar nueva pregunta
    const { error } = await supabase.from('questions').insert({
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
      is_official_exam: true,
      exam_position: 'administrativo',
      exam_source: 'OpositaTest - Examen Oficial C1',
      tags: ['Oficial C1', 'Bloque I']
    });

    if (!error) {
      console.log(`${num}. ✨ Insertada: ${q.question.substring(0, 50)}... → Art.${articleNumber} ${lawShortName}`);
      inserted++;
    } else {
      console.log(`${num}. ❌ Error insertando: ${error.message}`);
      errors.push({ num, question: q.question.substring(0, 50), reason: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`✅ Actualizadas como oficial: ${updated}`);
  console.log(`✨ Insertadas nuevas: ${inserted}`);
  console.log(`⏭️  Ya eran oficiales: ${skipped}`);
  console.log(`❌ Errores: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ERRORES:');
    errors.forEach(e => console.log(`   ${e.num}. ${e.reason}: ${e.question}...`));
  }

  // Contar total oficiales
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_official_exam', true);

  console.log(`\n📈 Total preguntas oficiales en BD: ${count}`);
})();
