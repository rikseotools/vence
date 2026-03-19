// Preparar preguntas Tema 10 Tramitación Procesal para verificación con IA
// Tema 10: Modernización de la Oficina judicial

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Leyes del Tema 10
const LAWS = {
  'LOPJ': { id: '2e4bb49d-9c1a-453c-9365-a660af9540c4', name: 'LO 6/1985 LOPJ' },
  'LO 6/1985': { id: '2e4bb49d-9c1a-453c-9365-a660af9540c4', name: 'LO 6/1985 LOPJ' },
  'RDL 6/2023': { id: 'aad76dbd-af93-443f-95a9-e1d5f72d7c97', name: 'RDL 6/2023' },
  'RD 1065/2015': { id: '0b9e66ca-15e6-476f-82a1-16dddbefcaba', name: 'RD 1065/2015 LexNET' },
  'LexNET': { id: '0b9e66ca-15e6-476f-82a1-16dddbefcaba', name: 'RD 1065/2015 LexNET' },
  'RD 937/2003': { id: '4d42a044-5c30-4ed5-945b-bde656591a1d', name: 'RD 937/2003 Archivos' },
  'RGPD': { id: '8a6ee7ea-91eb-4ad8-8313-e8e0a19f8a0f', name: 'Reglamento UE 2016/679' },
  'Reglamento 2016/679': { id: '8a6ee7ea-91eb-4ad8-8313-e8e0a19f8a0f', name: 'Reglamento UE 2016/679' },
  'LOPDGDD': { id: 'e4d2a6d0-92e2-492b-85f1-31c12ad88e8d', name: 'LO 3/2018 LOPDGDD' },
  'LO 3/2018': { id: 'e4d2a6d0-92e2-492b-85f1-31c12ad88e8d', name: 'LO 3/2018 LOPDGDD' }
};

const BASE_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal/Tema_10._Modernización_de_la_Oficina_judicial_(PROXIMAS_CONVOCATORIAS_TP_TL)';

// Patrones para detectar ley y artículo
function detectLawAndArticle(text) {
  if (!text) return null;

  const patterns = [
    // LOPJ
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?(?:LOPJ|LO\s*6\/1985|Ley\s*Org[áa]nica.*Poder\s*Judicial)/i, law: 'LOPJ' },
    // RDL 6/2023
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:del?\s*)?(?:RDL?\s*6\/2023|Real\s*Decreto-Ley\s*6\/2023)/i, law: 'RDL 6/2023' },
    // RD 1065/2015 LexNET
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:del?\s*)?(?:RD\s*1065\/2015|Real\s*Decreto\s*1065\/2015|LexNET)/i, law: 'RD 1065/2015' },
    // RD 937/2003 Archivos
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:del?\s*)?(?:RD\s*937\/2003|Real\s*Decreto\s*937\/2003)/i, law: 'RD 937/2003' },
    // RGPD
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:del?\s*)?(?:RGPD|Reglamento.*2016\/679|Reglamento\s*General.*Protecci[oó]n.*Datos)/i, law: 'RGPD' },
    // LOPDGDD
    { regex: /art[íi]culo?\s*(\d+(?:\.\d+)?)\s*(?:de\s*la\s*)?(?:LOPDGDD|LO\s*3\/2018|Ley.*Protecci[oó]n.*Datos.*Garant[ií]a)/i, law: 'LOPDGDD' }
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      return { law: p.law, articleNum: match[1] };
    }
  }
  return null;
}

// Detectar si es pregunta del Código de Conducta (que no tiene artículos en BD)
function isCodigoConducta(text) {
  if (!text) return false;
  return /C[oó]digo\s*de\s*Conducta|Instrucci[oó]n\s*2\/2003/i.test(text);
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
  console.log('PREPARAR TEMA 10 - MODERNIZACIÓN DE LA OFICINA JUDICIAL');
  console.log('='.repeat(60));

  const allQuestions = [];
  const skippedCodigoConducta = [];

  let files;
  try {
    files = fs.readdirSync(BASE_PATH).filter(f => f.endsWith('.json'));
  } catch (e) {
    console.error('Error leyendo directorio:', e.message);
    return;
  }

  for (const file of files) {
    const filePath = path.join(BASE_PATH, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const subtema = file.replace('.json', '').replace(/_/g, ' ');

    console.log(`\n📁 ${subtema}: ${data.questions?.length || 0} preguntas`);

    for (const q of data.questions || []) {
      const fullText = (q.question || '') + ' ' + (q.explanation || '');

      // Saltar preguntas del Código de Conducta
      if (isCodigoConducta(fullText)) {
        skippedCodigoConducta.push({
          question: q.question?.substring(0, 80) + '...',
          file: file
        });
        continue;
      }

      const detected = detectLawAndArticle(fullText);
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

  console.log(`\n📚 Total procesables: ${allQuestions.length} preguntas`);
  console.log(`⚠️  Código de Conducta (pendiente): ${skippedCodigoConducta.length} preguntas`);

  // Estadísticas de detección
  const withCandidates = allQuestions.filter(q => q.candidateArticles.length > 0).length;
  console.log(`\n✅ Con artículo candidato: ${withCandidates}`);
  console.log(`🔍 Sin candidato (IA buscará): ${allQuestions.length - withCandidates}`);

  // Dividir en batches de 20
  const batchSize = 20;
  const numBatches = Math.ceil(allQuestions.length / batchSize);

  console.log(`\n📦 Creando ${numBatches} batches...`);

  for (let i = 0; i < numBatches; i++) {
    const batch = allQuestions.slice(i * batchSize, (i + 1) * batchSize);
    const batchPath = `/tmp/tema10-batch-${i + 1}.json`;
    fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2));
    console.log(`  Batch ${i + 1}: ${batch.length} preguntas → ${batchPath}`);
  }

  // Guardar preguntas pendientes del Código de Conducta
  if (skippedCodigoConducta.length > 0) {
    fs.writeFileSync('/tmp/tema10-codigo-conducta-pendiente.json',
      JSON.stringify(skippedCodigoConducta, null, 2));
    console.log(`\n⚠️  Preguntas Código de Conducta guardadas en /tmp/tema10-codigo-conducta-pendiente.json`);
  }

  console.log(`\n✅ ${numBatches} batches creados en /tmp/tema10-batch-*.json`);
  console.log('\nSiguiente paso: lanzar agentes para verificar artículos');
}

main().catch(console.error);
