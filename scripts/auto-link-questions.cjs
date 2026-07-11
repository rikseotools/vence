// scripts/auto-link-questions.cjs
// Detecta automáticamente ley y artículo del texto de la pregunta

const { createClient } = require('./lib/pg-agnostic-client.cjs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeo de patrones de texto a short_name de ley
const LAW_PATTERNS = [
  { pattern: /Ley 36\/2011|LRJS|jurisdicci[oó]n social/i, shortName: 'LRJS' },
  { pattern: /Ley Org[aá]nica 6\/1985|LOPJ|Poder Judicial/i, shortName: 'LO 6/1985' },
  { pattern: /Real Decreto Legislativo 5\/2015|TREBEP|Estatuto B[aá]sico/i, shortName: 'RDL 5/2015' },
  { pattern: /Ley Org[aá]nica 11\/1985|Libertad Sindical/i, shortName: 'LO 11/1985' },
  { pattern: /Ley 1\/2000|Enjuiciamiento Civil|LEC\b/i, shortName: 'Ley 1/2000' },
  { pattern: /Ley de Enjuiciamiento Criminal|LECrim/i, shortName: 'LECrim' },
  { pattern: /Constituci[oó]n Espa[nñ]ola|CE\b|art[ií]culo \d+ de la CE/i, shortName: 'CE' },
  { pattern: /Ley 39\/2015|Procedimiento Administrativo/i, shortName: 'Ley 39/2015' },
  { pattern: /Ley 40\/2015|R[eé]gimen Jur[ií]dico.*Sector P[uú]blico/i, shortName: 'Ley 40/2015' },
  { pattern: /Ley 31\/1995|Prevenci[oó]n de Riesgos/i, shortName: 'LPRL' },
  { pattern: /Real Decreto-ley 17\/1977|relaciones de trabajo/i, shortName: 'RDL 2/2015' }, // Estatuto Trabajadores como fallback
  { pattern: /Ley 38\/1988|Demarcaci[oó]n.*Planta Judicial/i, shortName: 'Ley 38/1988' },
  { pattern: /Real Decreto 796\/2005|Reglamento.*Ingreso/i, shortName: 'RDAJ' },
  { pattern: /Reglamento.*r[eé]gimen disciplinario/i, shortName: 'RDAJ' },
  { pattern: /Carta de derechos.*ciudadanos.*Justicia/i, shortName: 'LO 6/1985' }, // Asociada a LOPJ
  { pattern: /Ley Org[aá]nica 1\/2004|Violencia de G[eé]nero/i, shortName: 'LO 1/2004' },
  { pattern: /C[oó]digo Civil/i, shortName: 'Código Civil' },
  { pattern: /C[oó]digo Penal|CP\b/i, shortName: 'CP' },
  { pattern: /Ley 22\/2003|Concursal/i, shortName: 'Ley 22/2003' },
  { pattern: /Ley 15\/2015|Jurisdicci[oó]n Voluntaria/i, shortName: 'Ley 15/2015' },
];

// Extraer número de artículo del texto
function extractArticleNumber(text) {
  // Patrones comunes: "artículo 65", "art. 71.4", "artículo 69.2"
  const patterns = [
    /art[ií]culo\s+(\d+(?:\.\d+)?)/i,
    /art\.\s*(\d+(?:\.\d+)?)/i,
  ];

  for (const p of patterns) {
    const match = text.match(p);
    if (match) {
      // Solo devolver el número principal (sin decimales)
      return match[1].split('.')[0];
    }
  }
  return null;
}

// Detectar ley del texto
function detectLaw(text) {
  for (const { pattern, shortName } of LAW_PATTERNS) {
    if (pattern.test(text)) {
      return shortName;
    }
  }
  return null;
}

// Generar explicación básica
function generateExplanation(question, lawName, articleNum, correctOption) {
  const correctLetter = ['A', 'B', 'C', 'D'][correctOption];
  const options = [question.option_a, question.option_b, question.option_c, question.option_d];
  const correctAnswer = options[correctOption];

  return `La respuesta correcta es la ${correctLetter}). Según el artículo ${articleNum} de ${lawName}, ${correctAnswer.toLowerCase().replace(/\.$/, '')}. Esta es la opción que refleja correctamente lo establecido en la normativa.`;
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🔗 Auto-vinculación de preguntas');
  console.log('═'.repeat(60));

  // Cargar leyes
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name');

  const lawMap = new Map(laws.map(l => [l.short_name, l]));
  console.log(`📚 ${laws.length} leyes cargadas`);

  // Obtener preguntas de Auxilio Judicial
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
    .like('exam_source', '%Auxilio Judicial%')
    .order('created_at');

  console.log(`📝 ${questions.length} preguntas a procesar\n`);

  let updated = 0;
  let notFound = 0;
  let noLaw = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const lawShortName = detectLaw(q.question_text);
    const articleNum = extractArticleNumber(q.question_text);

    process.stdout.write(`\r[${i + 1}/${questions.length}] `);

    if (!lawShortName) {
      noLaw++;
      continue;
    }

    const law = lawMap.get(lawShortName);
    if (!law) {
      noLaw++;
      continue;
    }

    // Buscar artículo
    let article = null;
    if (articleNum) {
      const { data } = await supabase
        .from('articles')
        .select('id, article_number, title')
        .eq('law_id', law.id)
        .eq('article_number', articleNum)
        .single();
      article = data;
    }

    // Si no encontramos el artículo específico, buscar el primero de la ley
    if (!article) {
      const { data } = await supabase
        .from('articles')
        .select('id, article_number, title')
        .eq('law_id', law.id)
        .order('article_number')
        .limit(1)
        .single();
      article = data;
    }

    if (article) {
      const explanation = generateExplanation(q, law.name || lawShortName, articleNum || article.article_number, q.correct_option);

      const { error } = await supabase
        .from('questions')
        .update({
          primary_article_id: article.id,
          explanation: explanation
        })
        .eq('id', q.id);

      if (!error) {
        updated++;
      }
    } else {
      notFound++;
    }
  }

  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Actualizadas: ${updated}`);
  console.log(`⚠️ Sin ley detectada: ${noLaw}`);
  console.log(`❌ Artículo no encontrado: ${notFound}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
