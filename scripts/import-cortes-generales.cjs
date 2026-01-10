const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const CE_ID = '6ad91a6c-41ec-431f-9c80-5f5566834941';
const DIR_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_3,_Las_Cortes_Generales';
const PROGRESS_FILE = '/home/manuel/Documentos/github/vence/docs/import-progress.json';

// Extraer número de artículo de la explicación
function extractArticleNumber(text) {
  // Patrones: "Art. 67", "artículo 67", "Artículo 67.2"
  const patterns = [
    /art[íi]culo\s+(\d+)/i,
    /art\.\s*(\d+)/i
  ];

  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1];
  }
  return null;
}

async function verifyArticlesExist() {
  console.log('=== Verificando artículos de Cortes Generales ===\n');

  // Artículos del Título III CE (Cortes Generales): 66-96
  const cortesArticles = [];
  for (let i = 66; i <= 96; i++) cortesArticles.push(String(i));

  const missing = [];
  const existing = {};

  for (const artNum of cortesArticles) {
    const { data: art } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', CE_ID)
      .eq('article_number', artNum)
      .eq('is_active', true)
      .single();

    if (art) {
      existing[artNum] = art.id;
    } else {
      missing.push(artNum);
    }
  }

  console.log('Artículos existentes:', Object.keys(existing).length);
  if (missing.length > 0) {
    console.log('❌ Artículos FALTANTES:', missing.join(', '));
  }

  return { existing, missing };
}

async function importQuestions(existingArticles) {
  console.log('\n=== Importando preguntas de Cortes Generales ===\n');

  const files = fs.readdirSync(DIR_PATH).filter(f => f.endsWith('.json'));
  let imported = 0, skipped = 0, errors = [];

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(DIR_PATH, fileName), 'utf8');
    const data = JSON.parse(content);
    const tag = fileName.replace(/_/g, ' ').replace('.json', '').substring(0, 25);

    for (const q of data.questions) {
      // Verificar si ya existe
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('question_text', q.question);

      if (count > 0) {
        skipped++;
        continue;
      }

      // Extraer artículo de la explicación
      const text = (q.explanation || '') + ' ' + (q.question || '');
      const artNum = extractArticleNumber(text);

      if (!artNum) {
        errors.push({
          question: q.question.substring(0, 50),
          reason: 'No se detectó artículo'
        });
        continue;
      }

      const articleId = existingArticles[artNum];
      if (!articleId) {
        errors.push({
          question: q.question.substring(0, 50),
          reason: `Artículo ${artNum} no existe en BD`
        });
        continue;
      }

      // Insertar pregunta
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
        is_official_exam: false,
        tags: [tag.trim(), 'T103', 'Bloque I']
      });

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('content_hash')) {
          skipped++;
        } else {
          errors.push({
            question: q.question.substring(0, 50),
            reason: error.message.substring(0, 50)
          });
        }
      } else {
        imported++;
        console.log('  ✅ Art', artNum + ':', q.question.substring(0, 45) + '...');
      }
    }
  }

  return { imported, skipped, errors };
}

function updateProgress(imported, skipped, errors) {
  const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));

  progress.lastUpdated = new Date().toISOString().split('T')[0];
  progress.directories['Tema_3,_Las_Cortes_Generales'] = {
    status: errors.length === 0 ? 'completed' : 'partial',
    total: 119,
    imported,
    skipped,
    errors: errors.slice(0, 10), // Solo guardar primeros 10 errores
    notes: 'Todas referencian Constitución Española'
  };
  progress.completed += imported;

  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  console.log('\n✅ Progreso actualizado en docs/import-progress.json');
}

(async () => {
  const { existing, missing } = await verifyArticlesExist();

  if (missing.length > 0) {
    console.log('\n⚠️ Hay artículos faltantes. Revisar antes de importar.');
    return;
  }

  const { imported, skipped, errors } = await importQuestions(existing);

  console.log('\n=== RESUMEN ===');
  console.log('Importadas:', imported);
  console.log('Omitidas (duplicadas):', skipped);
  console.log('Errores:', errors.length);

  if (errors.length > 0) {
    console.log('\nErrores:');
    for (const e of errors.slice(0, 10)) {
      console.log('  -', e.question);
      console.log('    Razón:', e.reason);
    }
  }

  updateProgress(imported, skipped, errors);

  // Verificar total T103
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .contains('tags', ['T103'])
    .eq('is_active', true);
  console.log('\nTotal T103 en BD:', count);
})();
