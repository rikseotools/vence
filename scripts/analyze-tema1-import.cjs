// Análisis de importación Tema 1 Tramitación Procesal
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMA1_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/Tema_1._La_Constitución_española_de_1978_(PRÓXIMAS_CONVOCATORIAS_TP_TL)');
const TOPIC_ID = 'a6351c86-dd4d-4a51-a615-8daf3ae07682'; // Tema 1 TP
const CE_LAW_ID = '6ad91a6c-41ec-431f-9c80-5f5566834941';

// Patrones para detectar ley
const LAW_PATTERNS = [
  { pattern: /constitución española/i, shortName: 'CE', lawId: CE_LAW_ID },
  { pattern: /\bCE\b/, shortName: 'CE', lawId: CE_LAW_ID },
  { pattern: /art(?:ículo|\.)\s*\d+.*CE/i, shortName: 'CE', lawId: CE_LAW_ID },
];

// Extraer número de artículo
function extractArticleNumber(explanation) {
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

// Detectar ley
function detectLaw(explanation) {
  for (const { pattern, shortName, lawId } of LAW_PATTERNS) {
    if (pattern.test(explanation)) {
      return { shortName, lawId };
    }
  }
  return null;
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

async function main() {
  console.log('='.repeat(60));
  console.log('ANÁLISIS DE IMPORTACIÓN - TEMA 1 TRAMITACIÓN PROCESAL');
  console.log('='.repeat(60));

  // Obtener topic_scope actual
  const { data: scopeData } = await supabase
    .from('topic_scope')
    .select('article_numbers')
    .eq('topic_id', TOPIC_ID)
    .eq('law_id', CE_LAW_ID)
    .single();

  const currentScope = new Set(scopeData?.article_numbers || []);
  console.log(`\nTopic scope actual: ${currentScope.size} artículos CE`);

  // Leer todos los JSON del tema
  const files = fs.readdirSync(TEMA1_DIR).filter(f => f.endsWith('.json'));
  console.log(`Archivos JSON: ${files.length}\n`);

  const results = {
    total: 0,
    canImport: 0,
    missingArticle: [],
    noLawDetected: [],
    noArticleDetected: [],
    articlesNotInScope: new Set(),
    articleCounts: {}
  };

  for (const file of files) {
    const filePath = path.join(TEMA1_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const subtema = data.subtema;

    console.log(`\n📁 ${subtema} (${data.questionCount} preguntas)`);
    console.log('-'.repeat(50));

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      results.total++;

      // Detectar ley
      const law = detectLaw(q.explanation || '');
      if (!law) {
        results.noLawDetected.push({
          subtema,
          question: q.question.substring(0, 60) + '...',
          explanation: (q.explanation || '').substring(0, 100)
        });
        continue;
      }

      // Extraer artículo
      const articleNum = extractArticleNumber(q.explanation || '');
      if (!articleNum) {
        results.noArticleDetected.push({
          subtema,
          question: q.question.substring(0, 60) + '...',
          explanation: (q.explanation || '').substring(0, 100)
        });
        continue;
      }

      // Verificar artículo existe en BD
      const articleId = await getArticleId(law.lawId, articleNum);
      if (!articleId) {
        results.missingArticle.push({
          subtema,
          question: q.question.substring(0, 60) + '...',
          law: law.shortName,
          article: articleNum
        });
        continue;
      }

      // Verificar si está en topic_scope
      if (!currentScope.has(articleNum)) {
        results.articlesNotInScope.add(articleNum);
      }

      // Contar artículos
      results.articleCounts[articleNum] = (results.articleCounts[articleNum] || 0) + 1;

      results.canImport++;
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`Total preguntas: ${results.total}`);
  console.log(`✅ Pueden importarse: ${results.canImport}`);
  console.log(`❌ Sin ley detectada: ${results.noLawDetected.length}`);
  console.log(`❌ Sin artículo detectado: ${results.noArticleDetected.length}`);
  console.log(`❌ Artículo no existe en BD: ${results.missingArticle.length}`);

  if (results.articlesNotInScope.size > 0) {
    console.log(`\n⚠️  Artículos NO en topic_scope (hay que añadir):`);
    const sorted = [...results.articlesNotInScope].sort((a,b) => parseInt(a) - parseInt(b));
    console.log(`   ${sorted.join(', ')}`);
  }

  if (results.noLawDetected.length > 0) {
    console.log('\n❌ PREGUNTAS SIN LEY DETECTADA:');
    results.noLawDetected.slice(0, 5).forEach(q => {
      console.log(`   - ${q.subtema}: ${q.question}`);
    });
    if (results.noLawDetected.length > 5) {
      console.log(`   ... y ${results.noLawDetected.length - 5} más`);
    }
  }

  if (results.noArticleDetected.length > 0) {
    console.log('\n❌ PREGUNTAS SIN ARTÍCULO DETECTADO:');
    results.noArticleDetected.slice(0, 5).forEach(q => {
      console.log(`   - ${q.subtema}: ${q.question}`);
    });
    if (results.noArticleDetected.length > 5) {
      console.log(`   ... y ${results.noArticleDetected.length - 5} más`);
    }
  }

  if (results.missingArticle.length > 0) {
    console.log('\n❌ ARTÍCULOS QUE NO EXISTEN EN BD:');
    const uniqueArts = [...new Set(results.missingArticle.map(m => `${m.law} Art.${m.article}`))];
    console.log(`   ${uniqueArts.join(', ')}`);
  }

  // Top artículos
  console.log('\n📈 TOP 10 ARTÍCULOS MÁS PREGUNTADOS:');
  const sorted = Object.entries(results.articleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sorted.forEach(([art, count]) => {
    const inScope = currentScope.has(art) ? '✅' : '⚠️';
    console.log(`   ${inScope} Art. ${art}: ${count} preguntas`);
  });

  // Guardar resultados
  fs.writeFileSync('/tmp/tema1-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Resultados guardados en /tmp/tema1-analysis.json');
}

main().catch(console.error);
