/**
 * Script para mejorar las explicaciones de preguntas de Auxilio Judicial
 * Procesa 205 preguntas generando explicaciones didácticas con OpenAI
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('./lib/pg-agnostic-client.cjs');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 10;
const LETTERS = ['A', 'B', 'C', 'D'];

let openai = null;

async function getOpenAIKey() {
  const { data, error } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data?.api_key_encrypted) {
    throw new Error('No se pudo obtener la API key de OpenAI');
  }

  return Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8');
}

async function initOpenAI() {
  const apiKey = await getOpenAIKey();
  openai = new OpenAI({ apiKey });
  console.log('✅ OpenAI inicializado correctamente\n');
}

async function fetchQuestions() {
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, primary_article_id,
      articles!inner(id, article_number, title, content, laws!inner(id, name, short_name))
    `)
    .like('exam_source', '%Auxilio Judicial%')
    .eq('is_active', true)
    .order('id');

  if (error) throw error;
  return data;
}

async function generateExplanation(question) {
  const article = question.articles;
  const law = article.laws;
  const correctLetter = LETTERS[question.correct_option];
  const correctText = question[`option_${correctLetter.toLowerCase()}`];

  const options = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d
  };

  const prompt = `Genera una explicación DIDÁCTICA para esta pregunta de oposiciones de Auxilio Judicial.

PREGUNTA: ${question.question_text}

OPCIONES:
A) ${options.A}
B) ${options.B}
C) ${options.C}
D) ${options.D}

RESPUESTA CORRECTA: ${correctLetter}) ${correctText}

ARTÍCULO ${article.article_number} de ${law.name}:
${article.content || 'Contenido no disponible'}

INSTRUCCIONES ESTRICTAS:
1. EMPIEZA SIEMPRE con: "La respuesta correcta es ${correctLetter}) [texto de la opción correcta]."
2. Continúa con: "Conforme al artículo ${article.article_number} de ${law.short_name || law.name},"
3. Explica claramente POR QUÉ es correcta basándote en el contenido del artículo
4. Si es relevante, menciona brevemente por qué alguna otra opción es incorrecta
5. Usa un tono educativo, claro y directo
6. MÁXIMO 2-4 frases en total

FORMATO ESPERADO:
"La respuesta correcta es ${correctLetter}) [texto]. Conforme al artículo ${article.article_number} de [ley], [explicación clara basada en el contenido del artículo]."

Genera SOLO la explicación, sin comentarios adicionales ni markdown:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`❌ Error generando explicación para ${question.id}:`, error.message);
    return null;
  }
}

async function updateExplanation(questionId, explanation) {
  const { error } = await supabase
    .from('questions')
    .update({
      explanation,
      updated_at: new Date().toISOString()
    })
    .eq('id', questionId);

  if (error) throw error;
}

async function processQuestions() {
  console.log('📚 Iniciando mejora de explicaciones de Auxilio Judicial...\n');

  // Inicializar OpenAI
  await initOpenAI();

  const questions = await fetchQuestions();
  console.log(`📊 Total preguntas a procesar: ${questions.length}\n`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    // Procesar lote en paralelo
    const results = await Promise.all(
      batch.map(async (question) => {
        try {
          const explanation = await generateExplanation(question);
          if (explanation) {
            await updateExplanation(question.id, explanation);
            return { success: true, id: question.id };
          }
          return { success: false, id: question.id, error: 'No explanation generated' };
        } catch (error) {
          return { success: false, id: question.id, error: error.message };
        }
      })
    );

    results.forEach(r => {
      processed++;
      if (r.success) {
        updated++;
      } else {
        errors++;
        console.error(`  ❌ Error en ${r.id}: ${r.error}`);
      }
    });

    // Mostrar progreso cada 20 preguntas
    if (processed % 20 === 0 || processed === questions.length) {
      const pct = ((processed / questions.length) * 100).toFixed(1);
      console.log(`📈 Progreso: ${processed}/${questions.length} (${pct}%) - Actualizadas: ${updated}, Errores: ${errors}`);
    }

    // Pequeña pausa entre lotes para evitar rate limits
    if (i + BATCH_SIZE < questions.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n✅ Proceso completado!');
  console.log(`   📊 Total procesadas: ${processed}`);
  console.log(`   ✅ Actualizadas: ${updated}`);
  console.log(`   ❌ Errores: ${errors}`);
}

processQuestions().catch(console.error);
