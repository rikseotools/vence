// scripts/fix-tramitacion-articles.cjs
// Re-procesa preguntas de Tramitación Procesal que quedaron con artículos genéricos

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai').default;
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let openai = null;

// Alias de leyes (IA usa nombres comunes, BD usa nombres oficiales)
const LAW_ALIASES = {
  'LEC': 'Ley 1/2000',
  'LOPJ': 'LO 6/1985',
  'Ley 5/1995': 'LO 5/1995',
  'Ley 20/2011': 'LRC',
  'LRC': 'Ley 20/2011',
  'LECrim': 'LECrim',
  'CE': 'CE',
  'TUE': 'TUE',
  'TFUE': 'TFUE',
  'LO 3/2007': 'LO 3/2007',
  'LO 11/1985': 'LO 11/1985',
  'Ley 22/2003': 'Ley 22/2003',
  'Ley 1/2004': 'LO 1/2004',
  'Ley 55/2003': 'Ley 55/2003',
  'LO 36/2011': 'LRJS',
};

async function getOpenAI() {
  if (openai) return openai;

  const { data } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single();

  const apiKey = Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8');
  openai = new OpenAI({ apiKey });
  return openai;
}

async function findArticle(lawShortName, articleNumber) {
  const normalizedLawName = LAW_ALIASES[lawShortName] || lawShortName;
  const artNum = String(articleNumber).split('.')[0].trim();

  // Intentar búsquedas en orden de prioridad
  const attempts = [normalizedLawName, lawShortName];

  for (const name of attempts) {
    const { data: law } = await supabase
      .from('laws')
      .select('id, short_name')
      .eq('short_name', name)
      .single();

    if (law) {
      const { data: article } = await supabase
        .from('articles')
        .select('id, article_number, title')
        .eq('law_id', law.id)
        .eq('article_number', artNum)
        .single();

      if (article) {
        return { ...article, law_short_name: law.short_name };
      }
    }
  }

  // Búsqueda parcial como último recurso
  const { data: lawPartial } = await supabase
    .from('laws')
    .select('id, short_name')
    .ilike('short_name', `%${lawShortName}%`)
    .limit(1)
    .single();

  if (lawPartial) {
    const { data: article } = await supabase
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', lawPartial.id)
      .eq('article_number', artNum)
      .single();

    if (article) {
      return { ...article, law_short_name: lawPartial.short_name };
    }
  }

  return null;
}

async function analyzeQuestion(question) {
  const prompt = `Analiza esta pregunta de oposición y determina qué ley y artículo específico regula el contenido.

PREGUNTA:
${question.question_text}

OPCIONES:
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

RESPUESTA CORRECTA: ${['A', 'B', 'C', 'D'][question.correct_option]}

LEYES COMUNES (usa estos nombres):
- LEC o Ley 1/2000: Ley de Enjuiciamiento Civil
- LECrim: Ley de Enjuiciamiento Criminal
- LOPJ o LO 6/1985: Ley Orgánica del Poder Judicial
- CE: Constitución Española
- TUE: Tratado de la Unión Europea
- TFUE: Tratado de Funcionamiento de la UE
- LO 5/1995: Ley del Tribunal del Jurado
- Ley 20/2011 o LRC: Ley del Registro Civil
- Ley 29/1998: Ley Jurisdicción Contencioso-Administrativa
- Ley 7/1985: Ley de Bases del Régimen Local
- Ley 39/2015: Ley del Procedimiento Administrativo
- Ley 50/1997: Ley del Gobierno
- LRJS o Ley 36/2011: Ley Reguladora Jurisdicción Social
- Ley 22/2003: Ley Concursal
- LO 1/2004: Ley de Violencia de Género

INSTRUCCIONES:
- Identifica el artículo ESPECÍFICO que regula esta materia (NO el artículo 1 a menos que sea realmente ese)
- Responde SOLO en JSON:

{"law_short_name": "nombre ley", "article_number": "número artículo"}`;

  const client = await getOpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 200,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.choices[0].message.content.trim();
  const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonText);
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🔧 Corrección de artículos Tramitación Procesal');
  console.log('═'.repeat(60));

  // IDs de artículos genéricos a reemplazar
  const { data: ceLaw } = await supabase
    .from('laws').select('id').eq('short_name', 'CE').single();

  const { data: lecLaw } = await supabase
    .from('laws').select('id').eq('short_name', 'Ley 1/2000').single();

  const { data: ceArt7 } = await supabase
    .from('articles').select('id').eq('law_id', ceLaw.id).eq('article_number', '7').single();

  const { data: lecArt623 } = await supabase
    .from('articles').select('id').eq('law_id', lecLaw.id).eq('article_number', '623').single();

  // Obtener preguntas mal vinculadas
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
    .like('exam_source', '%Tramitación Procesal%')
    .or(`primary_article_id.eq.${ceArt7.id},primary_article_id.eq.${lecArt623?.id}`);

  console.log(`\n📝 ${questions.length} preguntas a corregir\n`);

  let fixed = 0, notFound = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`[${i + 1}/${questions.length}] ${q.question_text.substring(0, 50)}...`);

    try {
      const analysis = await analyzeQuestion(q);
      console.log(`   🔍 Detectado: ${analysis.law_short_name} Art. ${analysis.article_number}`);

      const article = await findArticle(analysis.law_short_name, analysis.article_number);

      if (article) {
        await supabase
          .from('questions')
          .update({ primary_article_id: article.id })
          .eq('id', q.id);

        console.log(`   ✅ Vinculado a ${article.law_short_name} Art. ${article.article_number}`);
        fixed++;
      } else {
        console.log(`   ⚠️ Artículo no encontrado en BD`);
        notFound++;
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
      notFound++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Corregidas: ${fixed}`);
  console.log(`⚠️ Sin encontrar: ${notFound}`);
}

main().catch(console.error);
