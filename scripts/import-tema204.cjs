const { createClient } = require('./lib/pg-agnostic-client.cjs');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '45b9727b-66ba-4d05-8a1b-7cc955e7914c';
const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_4,_Protección_de_datos_personales';

// IDs de las leyes
const LAW_IDS = {
  'LO 3/2018': '146b7e50-e089-44a6-932c-773954f8d96b',
  'RGPD': 'a227ef14-439f-4b94-9b3c-a161a3355ae5'
};

const FILES = [
  'La_protección_de_datos_personales._Régimen_Jurídico.json',
  'Principios.json',
  'Derechos.json',
  'Responsable_del_tratamiento,_encargado_del_tratamiento_y_delegado_de_protección_de_datos.json',
  'Autoridades_de_protección_de_datos.json',
  'Garantía_de_los_derechos_digitales.json',
  'Breve_referencia_al_régimen_sancionador.json'
];

// Cache de artículos
let articlesCache = {};

async function loadArticlesCache() {
  // Cargar artículos de LO 3/2018
  const { data: lopdgdd } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', LAW_IDS['LO 3/2018'])
    .eq('is_active', true);

  (lopdgdd || []).forEach(a => {
    articlesCache[`lopdgdd_${a.article_number}`] = a.id;
  });

  // Cargar artículos de RGPD
  const { data: rgpd } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', LAW_IDS['RGPD'])
    .eq('is_active', true);

  (rgpd || []).forEach(a => {
    articlesCache[`rgpd_${a.article_number}`] = a.id;
  });

  console.log(`📚 Cache cargado: ${Object.keys(articlesCache).length} artículos`);
}

function detectLawAndArticle(explanation) {
  if (!explanation) return { lawId: null, articleId: null };

  let lawId = null;
  let articleNum = null;

  // Detectar ley
  if (explanation.includes('Ley Orgánica 3/2018') || explanation.includes('LO 3/2018') ||
      explanation.includes('LOPDGDD') || explanation.includes('Protección de Datos Personales y garantía')) {
    lawId = LAW_IDS['LO 3/2018'];

    // Extraer número de artículo
    const match = explanation.match(/Artículo\s+(\d+(?:\s*bis)?)/i);
    if (match) {
      articleNum = match[1].replace(/\s+/g, ' ').trim();
      const articleId = articlesCache[`lopdgdd_${articleNum}`];
      if (articleId) return { lawId, articleId };
    }
  }

  if (explanation.includes('Reglamento (UE) 2016/679') || explanation.includes('RGPD') ||
      explanation.includes('Reglamento general de protección')) {
    lawId = LAW_IDS['RGPD'];

    // Extraer número de artículo
    const match = explanation.match(/Artículo\s+(\d+)/i);
    if (match) {
      articleNum = match[1];
      const articleId = articlesCache[`rgpd_${articleNum}`];
      if (articleId) return { lawId, articleId };
    }
  }

  return { lawId, articleId: null };
}

function correctOptionToNumber(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
}

function generateContentHash(question) {
  const content = `${question}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('🚀 Iniciando importación de Tema 204 - Protección de Datos\n');

  // 1. Cargar cache de artículos
  await loadArticlesCache();

  // 2. Verificar/Crear topic_scope
  const { data: existingScopes } = await supabase
    .from('topic_scope')
    .select('*')
    .eq('topic_id', TOPIC_ID);

  if (!existingScopes || existingScopes.length === 0) {
    console.log('\n📁 Creando topic_scope...');

    // Crear scope para LO 3/2018
    await supabase.from('topic_scope').insert({
      topic_id: TOPIC_ID,
      law_id: LAW_IDS['LO 3/2018'],
      article_numbers: null, // todos los artículos
      weight: 0.6
    });

    // Crear scope para RGPD
    await supabase.from('topic_scope').insert({
      topic_id: TOPIC_ID,
      law_id: LAW_IDS['RGPD'],
      article_numbers: null, // todos los artículos
      weight: 0.4
    });

    console.log('✅ Topic_scope creados (LO 3/2018 + RGPD)');
  } else {
    console.log(`\n📁 Topic_scope existentes: ${existingScopes.length}`);
  }

  // 3. Importar preguntas
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let withArticle = 0;
  let withoutArticle = 0;

  for (const fileName of FILES) {
    const filePath = path.join(BASE_PATH, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Archivo no encontrado: ${fileName}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const questions = data.questions || [];
    const subtema = data.subtema || fileName.replace('.json', '');

    console.log(`\n📄 ${subtema}: ${questions.length} preguntas`);

    for (const q of questions) {
      const contentHash = generateContentHash(q.question);

      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('questions')
        .select('id')
        .eq('content_hash', contentHash)
        .limit(1);

      if (existing && existing.length > 0) {
        totalSkipped++;
        continue;
      }

      // Detectar ley y artículo
      const { lawId, articleId } = detectLawAndArticle(q.explanation);

      if (articleId) withArticle++;
      else withoutArticle++;

      // Generar tags
      const tags = [
        'Protección de Datos',
        'Tema 204',
        'Bloque II',
        subtema.replace(/_/g, ' ')
      ];

      // Preparar pregunta
      const questionData = {
        question_text: q.question,
        option_a: q.options.find(o => o.letter === 'A')?.text || '',
        option_b: q.options.find(o => o.letter === 'B')?.text || '',
        option_c: q.options.find(o => o.letter === 'C')?.text || '',
        option_d: q.options.find(o => o.letter === 'D')?.text || '',
        correct_option: correctOptionToNumber(q.correctAnswer),
        explanation: q.explanation || '',
        difficulty: 'medium',
        question_type: 'single',
        tags: tags,
        is_active: true,
        is_official_exam: false,
        exam_source: 'opositatest',
        primary_article_id: articleId,
        content_hash: contentHash
      };

      // Insertar
      const { error: insertError } = await supabase
        .from('questions')
        .insert(questionData);

      if (insertError) {
        if (insertError.code === '23505') { // Duplicado
          totalSkipped++;
        } else {
          console.error(`  ❌ Error: ${insertError.message}`);
          totalErrors++;
        }
      } else {
        totalImported++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 RESUMEN:`);
  console.log(`   ✅ Importadas: ${totalImported}`);
  console.log(`   ⏭️ Saltadas (duplicadas): ${totalSkipped}`);
  console.log(`   ❌ Errores: ${totalErrors}`);
  console.log(`   🔗 Con artículo vinculado: ${withArticle}`);
  console.log(`   ⚠️ Sin artículo: ${withoutArticle}`);
  console.log(`   📝 Total procesadas: ${totalImported + totalSkipped + totalErrors}`);
}

main().catch(console.error);
