/**
 * Script para importar preguntas del Tema 10 de Tramitación Procesal
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitamos service role para inserts
);

const TOPIC_ID = '3a4b2f43-911c-448e-8703-ccb38289ca07';
const TEMA_DIR = 'preguntas-para-subir/tramitacion-procesal/Tema_10._Modernización_de_la_Oficina_judicial_(PROXIMAS_CONVOCATORIAS_TP_TL)';

// Mapeo de referencias de ley en explicaciones a law_id en BD
const LAW_MAPPINGS = {
  'Ley Orgánica 6/1985': 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff', // LOPJ
  'LO 6/1985': 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  'LOPJ': 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  'Ley 18/2011': null, // Buscar
  'Reglamento (UE) nº 910/2014': null, // eIDAS
  'Reglamento 1/2005': null, // CGPJ
  'Instrucción 2/2003': null, // CGPJ
  'Ley Orgánica 3/2018': null, // LOPDGDD
};

async function initLawMappings() {
  // LOPJ ya está
  // Buscar el resto
  const searches = [
    { pattern: 'eIDAS', key: 'Reglamento (UE) nº 910/2014' },
    { pattern: 'Reglamento 1/2005', key: 'Reglamento 1/2005' },
    { pattern: 'Instrucción 2/2003', key: 'Instrucción 2/2003' },
    { pattern: '18/2011', key: 'Ley 18/2011' },
    { pattern: 'LOPDGDD', key: 'Ley Orgánica 3/2018' },
    { pattern: '3/2018', key: 'Ley Orgánica 3/2018' },
    { pattern: 'Ley 1/2000', key: 'Ley 1/2000' },
    { pattern: 'LECrim', key: 'LECrim' },
    { pattern: 'Ley 19/2013', key: 'Ley 19/2013' },
  ];

  for (const s of searches) {
    const { data } = await supabase
      .from('laws')
      .select('id, short_name')
      .ilike('short_name', `%${s.pattern}%`)
      .limit(1)
      .single();

    if (data) {
      LAW_MAPPINGS[s.key] = data.id;
      console.log(`✓ ${s.key} -> ${data.short_name}`);
    }
  }
}

function extractLawAndArticle(explanation) {
  if (!explanation) return { lawId: null, articleNumber: null };

  // Patrones comunes
  const patterns = [
    /Ley Orgánica (\d+\/\d+)[^\n]*\n+Artículo (\d+[a-z]*(?: bis| ter| quater| quinquies| sexies| septies| octies| nonies| decies)?)/i,
    /LO (\d+\/\d+)[^\n]*\n+Artículo (\d+[a-z]*)/i,
    /Artículo (\d+)[^\n]*de la (Ley Orgánica \d+\/\d+|LOPJ)/i,
    /Instrucción (\d+\/\d+)[^\n]*\n+([IVXLCDM]+|Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|Séptimo|Octavo|Noveno|Décimo)/i,
    /Reglamento (\d+\/\d+)[^\n]*\n+Artículo (\d+)/i,
    /Ley (\d+\/\d+)[^\n]*\n+Artículo (\d+)/i,
    /Reglamento \(UE\)[^\n]*\n+Artículo (\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = explanation.match(pattern);
    if (match) {
      return {
        lawRef: match[1] || match[2],
        articleNumber: match[2] || match[1]
      };
    }
  }

  return { lawRef: null, articleNumber: null };
}

async function findArticle(lawId, articleNumber) {
  if (!lawId || !articleNumber) return null;

  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .limit(1)
    .single();

  return data?.id || null;
}

function convertCorrectAnswer(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
}

async function importQuestions() {
  await initLawMappings();

  const files = fs.readdirSync(TEMA_DIR).filter(f => f.endsWith('.json'));
  console.log(`\nEncontrados ${files.length} archivos JSON`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = path.join(TEMA_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`\n📄 ${file}: ${content.questions?.length || 0} preguntas`);

    if (!content.questions?.length) continue;

    for (const q of content.questions) {
      // Verificar si ya existe (por texto similar)
      const { data: existing } = await supabase
        .from('questions')
        .select('id')
        .eq('topic_id', TOPIC_ID)
        .ilike('question_text', q.question.substring(0, 50) + '%')
        .limit(1);

      if (existing?.length) {
        totalSkipped++;
        continue;
      }

      // Extraer ley y artículo de la explicación
      const { lawRef, articleNumber } = extractLawAndArticle(q.explanation);
      let primaryArticleId = null;

      // Intentar encontrar el artículo
      if (q.explanation) {
        // Buscar referencias conocidas
        for (const [ref, lawId] of Object.entries(LAW_MAPPINGS)) {
          if (lawId && q.explanation.includes(ref)) {
            const artMatch = q.explanation.match(/Artículo\s+(\d+[a-z]*(?: bis| ter| quater)?)/i);
            if (artMatch) {
              primaryArticleId = await findArticle(lawId, artMatch[1]);
              if (primaryArticleId) break;
            }
          }
        }
      }

      // Preparar pregunta
      const questionData = {
        topic_id: TOPIC_ID,
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: convertCorrectAnswer(q.correctAnswer),
        explanation: q.explanation || '',
        primary_article_id: primaryArticleId,
        is_active: true,
        difficulty: 2, // Medium
        is_official_exam: false,
        source: 'opositatest',
        verification_status: 'pending'
      };

      const { error } = await supabase
        .from('questions')
        .insert(questionData);

      if (error) {
        console.error(`❌ Error insertando: ${q.question.substring(0, 40)}...`, error.message);
        totalErrors++;
      } else {
        totalImported++;
      }
    }
  }

  console.log('\n========== RESUMEN ==========');
  console.log(`✅ Importadas: ${totalImported}`);
  console.log(`⏭️  Saltadas (ya existían): ${totalSkipped}`);
  console.log(`❌ Errores: ${totalErrors}`);
}

importQuestions().catch(console.error);
