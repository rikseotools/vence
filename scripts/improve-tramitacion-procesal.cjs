// scripts/improve-tramitacion-procesal.cjs
// Usa IA (OpenAI) para encontrar el artículo correcto y generar explicación didáctica
// para las preguntas de Tramitación Procesal

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai').default;
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let openai = null;

// Obtener API key de OpenAI desde la BD
async function getOpenAI() {
  if (openai) return openai;

  const { data, error } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single();

  if (error || !data?.api_key_encrypted) {
    throw new Error('OpenAI API key not found in database');
  }

  const apiKey = Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8');
  openai = new OpenAI({ apiKey });
  return openai;
}

// Obtener leyes disponibles
async function getLaws() {
  const { data } = await supabase
    .from('laws')
    .select('id, short_name, official_name')
    .order('short_name');
  return data || [];
}

// Alias de leyes (IA usa nombres comunes, BD usa nombres oficiales)
const LAW_ALIASES = {
  'LEC': 'Ley 1/2000',
  'LOPJ': 'LO 6/1985',
  'Ley 5/1995': 'LO 5/1995', // Ley del Jurado
  'Ley 20/2011': 'LRC', // Ley Registro Civil
  'LRC': 'Ley 20/2011',
  'LECrim': 'LECrim',
  'CE': 'CE',
  'TUE': 'TUE',
  'TFUE': 'TFUE',
  'LO 3/2007': 'LO 3/2007',
  'LO 11/1985': 'LO 11/1985',
};

// Buscar artículo en la BD
async function findArticle(lawShortName, articleNumber) {
  // Normalizar nombre de ley con alias
  const normalizedLawName = LAW_ALIASES[lawShortName] || lawShortName;

  // Primero buscar la ley por short_name exacto
  let { data: law } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('short_name', normalizedLawName)
    .single();

  if (!law) {
    // Intentar con el nombre original
    const { data: lawOriginal } = await supabase
      .from('laws')
      .select('id, short_name')
      .eq('short_name', lawShortName)
      .single();

    if (lawOriginal) {
      law = lawOriginal;
    } else {
      // Intentar búsqueda parcial
      const { data: lawPartial } = await supabase
        .from('laws')
        .select('id, short_name')
        .ilike('short_name', `%${lawShortName}%`)
        .limit(1)
        .single();

      if (!lawPartial) return null;
      law = lawPartial;
    }
  }

  // Normalizar número de artículo (quitar puntos, etc)
  const artNum = String(articleNumber).split('.')[0].trim();

  // Buscar el artículo
  const { data: article } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .eq('article_number', artNum)
    .single();

  if (article) {
    return { ...article, law_short_name: law.short_name };
  }
  return null;
}

// Analizar pregunta con IA
async function analyzeQuestion(question, laws) {
  const lawList = laws.slice(0, 100).map(l => `- ${l.short_name}: ${l.official_name || ''}`).join('\n');

  const prompt = `Analiza esta pregunta de oposición de Tramitación Procesal y determina:
1. Qué ley y artículo específico regula el contenido de la pregunta
2. Una explicación didáctica de por qué la respuesta correcta es correcta

PREGUNTA:
${question.question_text}

OPCIONES:
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

RESPUESTA CORRECTA: ${['A', 'B', 'C', 'D'][question.correct_option]}

LEYES COMUNES EN TRAMITACIÓN PROCESAL (usa exactamente estos nombres):
- LEC: Ley de Enjuiciamiento Civil
- LECrim: Ley de Enjuiciamiento Criminal
- LOPJ: Ley Orgánica del Poder Judicial
- CE: Constitución Española
- TUE: Tratado de la Unión Europea
- TFUE: Tratado de Funcionamiento de la Unión Europea
- Ley 1/2000: Ley de Enjuiciamiento Civil
- LO 6/1985: Ley Orgánica del Poder Judicial
- Ley 5/1995: Ley del Tribunal del Jurado
- Ley 20/2011: Ley del Registro Civil
- LO 3/2007: Ley para la igualdad efectiva
- LO 11/1985: Ley Orgánica de Libertad Sindical

INSTRUCCIONES:
- Identifica la ley específica que regula este tema
- Identifica el artículo concreto que responde a la pregunta (solo el número)
- La explicación debe ser didáctica, clara y citar el artículo
- Responde SOLO en formato JSON válido, sin markdown ni backticks

{
  "law_short_name": "nombre corto exacto",
  "article_number": "número del artículo (solo número, ej: 24, 56, 148)",
  "explanation": "Explicación de 2-4 frases explicando por qué la respuesta correcta es correcta según el artículo X de la Ley Y"
}`;

  try {
    const client = await getOpenAI();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.choices[0].message.content.trim();
    // Limpiar posibles marcadores de código
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('Error IA:', e.message);
    return null;
  }
}

// Procesar una pregunta
async function processQuestion(question, laws, index, total) {
  console.log(`\n[${index + 1}/${total}] Procesando...`);
  console.log(`   📝 ${question.question_text.substring(0, 70)}...`);

  const analysis = await analyzeQuestion(question, laws);

  if (!analysis) {
    console.log('   ❌ Error en análisis IA');
    return false;
  }

  console.log(`   🔍 Detectado: ${analysis.law_short_name}, Art. ${analysis.article_number}`);

  // Buscar artículo en BD
  const article = await findArticle(analysis.law_short_name, analysis.article_number);

  if (article) {
    // Actualizar pregunta con artículo correcto y explicación
    const { error } = await supabase
      .from('questions')
      .update({
        primary_article_id: article.id,
        explanation: analysis.explanation
      })
      .eq('id', question.id);

    if (error) {
      console.log(`   ❌ Error actualizando: ${error.message}`);
      return false;
    }

    console.log(`   ✅ Vinculado a ${article.law_short_name} Art. ${article.article_number}`);
    console.log(`   📖 ${analysis.explanation.substring(0, 80)}...`);
    return true;
  } else {
    // Solo actualizar explicación, mantener artículo actual
    const { error } = await supabase
      .from('questions')
      .update({ explanation: analysis.explanation })
      .eq('id', question.id);

    if (error) {
      console.log(`   ❌ Error actualizando explicación: ${error.message}`);
      return false;
    }

    console.log(`   ⚠️ Art. ${analysis.article_number} de ${analysis.law_short_name} no encontrado en BD`);
    console.log(`   📖 Explicación actualizada: ${analysis.explanation.substring(0, 60)}...`);
    return true;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const startFrom = parseInt(args[0]) || 0;
  const limit = parseInt(args[1]) || 1000;

  console.log('═'.repeat(60));
  console.log('🤖 Mejora de Preguntas Tramitación Procesal con IA');
  console.log('═'.repeat(60));

  if (startFrom > 0) {
    console.log(`\n⏭️  Empezando desde pregunta ${startFrom + 1}`);
  }

  // Verificar API key
  console.log('\n🔑 Verificando conexión OpenAI...');
  try {
    await getOpenAI();
    console.log('   ✅ Conexión OK');
  } catch (e) {
    console.error('   ❌ Error:', e.message);
    return;
  }

  // Obtener leyes
  console.log('\n📚 Cargando leyes disponibles...');
  const laws = await getLaws();
  console.log(`   ${laws.length} leyes encontradas`);

  // Obtener preguntas de Tramitación Procesal
  console.log('\n📝 Cargando preguntas de Tramitación Procesal...');
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
    .like('exam_source', '%Tramitación Procesal%')
    .eq('is_official_exam', true)
    .order('created_at')
    .range(startFrom, startFrom + limit - 1);

  if (error) {
    console.error('Error cargando preguntas:', error.message);
    return;
  }

  if (!questions || questions.length === 0) {
    console.log('   No hay preguntas para procesar');
    return;
  }

  console.log(`   ${questions.length} preguntas a procesar`);

  // Procesar una a una
  let success = 0;
  let failed = 0;

  for (let i = 0; i < questions.length; i++) {
    const ok = await processQuestion(questions[i], laws, startFrom + i, startFrom + questions.length);
    if (ok) success++;
    else failed++;

    // Pausa de 500ms para no saturar la API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Procesadas correctamente: ${success}`);
  console.log(`❌ Fallidas: ${failed}`);

  if (startFrom + questions.length < 96) {
    console.log(`\n💡 Para continuar: node scripts/improve-tramitacion-procesal.cjs ${startFrom + questions.length}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
