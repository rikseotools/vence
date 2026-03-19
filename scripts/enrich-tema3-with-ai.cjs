// Preparar preguntas Tema 3 Tramitación Procesal para verificación con IA
// Tema 3: El Gobierno y la Administración

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Leyes del Tema 3
const LAWS = {
  'CE': { id: '6ad91a6c-41ec-431f-9c80-5f5566834941', name: 'Constitución Española' },
  'Ley 50/1997': { id: '1ed89e01-ace0-4894-8bd4-fa00db74d34a', name: 'Ley del Gobierno' },
  'Ley 40/2015': { id: '95680d57-feb1-41c0-bb27-236024815feb', name: 'LRJSP' }
};

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal/Tema_3._El_Gobierno_y_la_Administración_(PRÓXIMAS_CONVOCATORIAS_TP_TL)';

// Patrones para detectar ley y artículo
function detectLawAndArticle(text) {
  const patterns = [
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?(?:CE|Constituci[oó]n)/i, law: 'CE' },
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?Ley\s*50\/1997/i, law: 'Ley 50/1997' },
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?Ley\s*(?:del\s*)?Gobierno/i, law: 'Ley 50/1997' },
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?Ley\s*40\/2015/i, law: 'Ley 40/2015' },
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?LRJSP/i, law: 'Ley 40/2015' },
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?L[Rr]egimen\s*Jur[ií]dico/i, law: 'Ley 40/2015' }
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      return { law: p.law, articleNum: match[1] };
    }
  }
  return null;
}

async function getArticleCandidates(lawKey, articleNum) {
  const law = LAWS[lawKey];
  if (!law) return [];

  const { data } = await supabase
    .from('articles')
    .select('id, article_number, title, content')
    .eq('law_id', law.id)
    .eq('article_number', articleNum)
    .eq('is_active', true)
    .limit(1);

  return data?.map(a => ({
    id: a.id,
    law: lawKey,
    number: a.article_number,
    title: a.title,
    content: a.content?.substring(0, 500) + '...'
  })) || [];
}

async function main() {
  console.log('='.repeat(60));
  console.log('PREPARAR TEMA 3 - EL GOBIERNO Y LA ADMINISTRACIÓN');
  console.log('='.repeat(60));

  const allQuestions = [];
  const files = fs.readdirSync(BASE_PATH).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(BASE_PATH, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const subtema = file.replace('.json', '').replace(/_/g, ' ');

    console.log(`\n📁 ${subtema}: ${data.questions?.length || 0} preguntas`);

    for (const q of data.questions || []) {
      const detected = detectLawAndArticle(q.explanation || q.question);
      let candidates = [];

      if (detected) {
        candidates = await getArticleCandidates(detected.law, detected.articleNum);
      }

      allQuestions.push({
        id: allQuestions.length + 1,
        file: file,
        subtema: subtema,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        probableLaw: detected?.law || null,
        possibleArticleNums: detected ? [detected.articleNum] : [],
        candidateArticles: candidates,
        // Campos para que la IA complete
        verified_article_id: null,
        verified_article_number: null,
        verified_law: null,
        ai_confidence: null,
        ai_notes: null
      });
    }
  }

  console.log(`\n📚 Total: ${allQuestions.length} preguntas`);

  // Estadísticas de detección
  const withCandidates = allQuestions.filter(q => q.candidateArticles.length > 0).length;
  console.log(`✅ Con artículo candidato: ${withCandidates}`);
  console.log(`⚠️  Sin candidato: ${allQuestions.length - withCandidates}`);

  // Dividir en batches de 20
  const batchSize = 20;
  const numBatches = Math.ceil(allQuestions.length / batchSize);

  for (let i = 0; i < numBatches; i++) {
    const batch = allQuestions.slice(i * batchSize, (i + 1) * batchSize);
    const batchPath = `/tmp/tema3-batch-${i + 1}.json`;
    fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2));
    console.log(`  📦 Batch ${i + 1}: ${batch.length} preguntas → ${batchPath}`);
  }

  console.log(`\n✅ ${numBatches} batches creados en /tmp/tema3-batch-*.json`);
  console.log('\nSiguiente paso: lanzar agentes para verificar artículos');
}

main().catch(console.error);
