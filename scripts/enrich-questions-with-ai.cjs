// scripts/enrich-questions-with-ai.cjs
// Usa IA para encontrar el artículo correcto y generar explicación didáctica

const { createClient } = require('./lib/pg-agnostic-client.cjs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Obtener leyes disponibles
async function getLaws() {
  const { data } = await supabase
    .from('laws')
    .select('id, short_name, official_name')
    .order('short_name');
  return data || [];
}

// Buscar artículo en la BD
async function findArticle(lawShortName, articleNumber) {
  // Primero buscar la ley
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('short_name', lawShortName)
    .single();

  if (!law) return null;

  // Buscar el artículo
  const { data: article } = await supabase
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', law.id)
    .eq('article_number', articleNumber)
    .single();

  return article;
}

// Analizar pregunta con IA
async function analyzeQuestion(question, laws) {
  const lawList = laws.map(l => `- ${l.short_name}: ${l.official_name || ''}`).join('\n');

  const prompt = `Analiza esta pregunta de oposición de Auxilio Judicial y determina:
1. Qué ley y artículo específico se menciona o aplica
2. Una explicación didáctica de por qué la respuesta correcta es correcta

PREGUNTA:
${question.question_text}

OPCIONES:
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

RESPUESTA CORRECTA: ${['A', 'B', 'C', 'D'][question.correct_option]}

LEYES DISPONIBLES EN NUESTRA BASE DE DATOS:
${lawList}

Responde SOLO en este formato JSON exacto (sin markdown):
{
  "law_short_name": "nombre corto exacto de la ley de la lista anterior",
  "article_number": "número del artículo (solo el número, ej: 24, 56.1, etc)",
  "explanation": "Explicación didáctica de 2-3 frases explicando por qué la respuesta correcta es correcta, citando el artículo específico"
}

Si la pregunta no menciona una ley específica de la lista, usa la ley más relacionada con el tema.
Si no puedes determinar el artículo exacto, pon "1" como article_number.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
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
  console.log(`   📝 ${question.question_text.substring(0, 60)}...`);

  const analysis = await analyzeQuestion(question, laws);

  if (!analysis) {
    console.log('   ❌ Error en análisis IA');
    return false;
  }

  console.log(`   🔍 Ley: ${analysis.law_short_name}, Art. ${analysis.article_number}`);

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

    console.log(`   ✅ Vinculado a Art. ${article.article_number} - ${article.title?.substring(0, 30)}`);
    console.log(`   📖 ${analysis.explanation.substring(0, 60)}...`);
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

    console.log(`   ⚠️ Artículo no encontrado en BD, solo actualizada explicación`);
    return true;
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🤖 Enriquecimiento de Preguntas con IA');
  console.log('═'.repeat(60));

  // Obtener leyes
  console.log('\n📚 Cargando leyes disponibles...');
  const laws = await getLaws();
  console.log(`   ${laws.length} leyes encontradas`);

  // Obtener preguntas de Auxilio Judicial
  console.log('\n📝 Cargando preguntas de Auxilio Judicial...');
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
    .like('exam_source', '%Auxilio Judicial%')
    .order('created_at');

  if (!questions || questions.length === 0) {
    console.log('   No hay preguntas para procesar');
    return;
  }

  console.log(`   ${questions.length} preguntas a procesar`);

  // Procesar una a una
  let success = 0;
  let failed = 0;

  for (let i = 0; i < questions.length; i++) {
    const ok = await processQuestion(questions[i], laws, i, questions.length);
    if (ok) success++;
    else failed++;

    // Pequeña pausa para no saturar la API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Procesadas correctamente: ${success}`);
  console.log(`❌ Fallidas: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
