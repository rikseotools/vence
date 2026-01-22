// Script para verificar y corregir preguntas de Excel con OpenAI (ChatGPT)
// - Verifica si la respuesta marcada es correcta
// - Mejora la explicación con fuente oficial de Microsoft
// - Guarda progreso para poder continuar
// - Si la pregunta está bien, solo mejora la explicación

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai').default;
const fs = require('fs');
const path = require('path');

// Configuración
const EXCEL_LAW_ID = 'c7475712-5ae4-4bec-9bd5-ff646c378e33';
const PROGRESS_FILE = '/tmp/excel-fix-progress.json';
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const DELAY_MS = 600; // 600ms entre llamadas para evitar rate limits

// Fuentes oficiales de Microsoft
const MICROSOFT_SOURCES = {
  shortcuts: 'Fuente: Microsoft Support - Métodos abreviados de teclado en Excel (https://support.microsoft.com/es-es/office/métodos-abreviados-de-teclado-en-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f)',
  functions: 'Fuente: Microsoft Support - Funciones de Excel por categoría (https://support.microsoft.com/es-es/office/funciones-de-excel-por-categoría-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb)',
  general: 'Fuente: Microsoft Support - Excel (https://support.microsoft.com/es-es/excel)'
};

// Parsear argumentos
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) ||
              parseInt(args[args.indexOf('--limit') + 1]) || 0;
const SKIP_PROGRESS = args.includes('--restart');
const SAFE_MODE = args.includes('--safe');  // Solo mejorar explicaciones, no corregir respuestas
const CORRECTIONS_FILE = '/tmp/excel-corrections-to-review.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let openai = null;

async function initOpenAI() {
  // Obtener API key de OpenAI desde la base de datos
  const { data: config, error } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single();

  if (error || !config) {
    throw new Error('No se pudo obtener la API key de OpenAI desde la BD: ' + (error?.message || 'No encontrada'));
  }

  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8');
  openai = new OpenAI({ apiKey });
  console.log('✅ API key de OpenAI cargada desde BD');
}

function loadProgress() {
  if (SKIP_PROGRESS) return { processed: [], stats: { verified: 0, corrected: 0, errors: 0 } };
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.log('⚠️ No se pudo cargar progreso anterior, empezando de nuevo');
  }
  return { processed: [], stats: { verified: 0, corrected: 0, errors: 0 } };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function getExcelQuestions(processedIds) {
  let query = supabase
    .from('questions')
    .select(`
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      articles!inner(law_id)
    `)
    .eq('articles.law_id', EXCEL_LAW_ID)
    .eq('is_active', true)
    .order('created_at');

  if (processedIds.length > 0) {
    // Filtrar los ya procesados
    query = query.not('id', 'in', `(${processedIds.join(',')})`);
  }

  if (LIMIT > 0) {
    query = query.limit(LIMIT);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function detectQuestionType(questionText) {
  const text = questionText.toLowerCase();
  if (text.includes('ctrl') || text.includes('atajo') || text.includes('tecla') || text.includes('abreviado')) {
    return 'shortcuts';
  }
  if (text.includes('función') || text.includes('fórmula') || text.includes('=') ||
      text.includes('suma') || text.includes('promedio') || text.includes('si(')) {
    return 'functions';
  }
  return 'general';
}

async function verifyAndImproveWithOpenAI(question) {
  const correctLetter = OPTION_LETTERS[question.correct_option];
  const questionType = detectQuestionType(question.question_text);
  const microsoftSource = MICROSOFT_SOURCES[questionType];

  const systemPrompt = `Eres un experto en Microsoft Excel 365 para oposiciones españolas.
Tu tarea es verificar preguntas de examen y generar explicaciones didácticas.
SIEMPRE responde en formato JSON válido, sin markdown ni bloques de código.`;

  const userPrompt = `Verifica y mejora esta pregunta de Excel:

PREGUNTA: ${question.question_text}

OPCIONES:
A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

RESPUESTA ACTUALMENTE MARCADA COMO CORRECTA: ${correctLetter}

EXPLICACIÓN ACTUAL: ${question.explanation || '(sin explicación)'}

TAREAS:
1. VERIFICA si la respuesta marcada (${correctLetter}) es REALMENTE correcta según la documentación oficial de Microsoft Excel 365
2. Si es INCORRECTA, indica cuál debería ser la correcta y por qué
3. GENERA una explicación didáctica mejorada que:
   - Explique claramente por qué la respuesta correcta es correcta
   - Mencione brevemente por qué las otras opciones son incorrectas
   - Sea concisa pero completa (3-5 frases)
   - Termine SIEMPRE con la fuente oficial

IMPORTANTE - Atajos de teclado oficiales:
- Ctrl+D = Rellenar hacia ABAJO (Down)
- Ctrl+R = Rellenar hacia la DERECHA (Right)
- Ctrl+A = Abrir archivo (en Excel español)
- Ctrl+E = Seleccionar todo
- Verifica siempre contra la documentación oficial de Microsoft

RESPONDE ÚNICAMENTE con este JSON:
{
  "answer_is_correct": true,
  "correct_answer": "${correctLetter}",
  "reason_if_wrong": null,
  "improved_explanation": "Tu explicación didáctica...\\n\\n${microsoftSource}"
}

Si la respuesta está MAL, cambia answer_is_correct a false e indica la correcta.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const responseText = response.choices[0].message.content.trim();

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Error parseando respuesta:', responseText);
    throw new Error('No se pudo parsear la respuesta de OpenAI');
  }
}

async function updateQuestion(id, updates) {
  if (DRY_RUN) {
    console.log('   🔍 [DRY-RUN] Se actualizaría:', JSON.stringify(updates, null, 2).substring(0, 200));
    return;
  }

  const { error } = await supabase
    .from('questions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🔧 CORRECTOR DE PREGUNTAS DE EXCEL CON OPENAI (GPT-4o-mini)');
  console.log('═'.repeat(70));
  console.log(`📋 Modo: ${DRY_RUN ? 'DRY-RUN (sin cambios reales)' : 'EJECUCIÓN REAL'}`);
  if (SAFE_MODE) console.log(`🔒 Modo SEGURO: Solo mejora explicaciones, guarda correcciones para revisar`);
  if (LIMIT > 0) console.log(`📊 Límite: ${LIMIT} preguntas`);
  console.log('');

  // Inicializar OpenAI con API key de BD
  await initOpenAI();

  const progress = loadProgress();
  console.log(`📁 Progreso cargado: ${progress.processed.length} preguntas ya procesadas`);

  const questions = await getExcelQuestions(progress.processed);
  const total = questions.length;

  if (total === 0) {
    console.log('✅ No hay más preguntas pendientes de procesar');
    console.log(`\n📊 Estadísticas totales:`);
    console.log(`   ✅ Verificadas OK: ${progress.stats.verified}`);
    console.log(`   🔄 Corregidas: ${progress.stats.corrected}`);
    console.log(`   ❌ Errores: ${progress.stats.errors}`);
    return;
  }

  console.log(`📊 Preguntas a procesar: ${total}\n`);
  console.log('─'.repeat(70));

  let current = 0;
  const corrections = [];
  const pendingCorrections = [];

  for (const q of questions) {
    current++;
    const currentLetter = OPTION_LETTERS[q.correct_option];

    console.log(`\n📝 [${current}/${total}] Procesando...`);
    console.log(`   Pregunta: ${q.question_text.substring(0, 70)}...`);
    console.log(`   Respuesta marcada: ${currentLetter}`);

    try {
      const result = await verifyAndImproveWithOpenAI(q);

      if (!result.answer_is_correct) {
        // La respuesta estaba mal
        const newCorrectOption = OPTION_LETTERS.indexOf(result.correct_answer);
        console.log(`   ⚠️ RESPUESTA POSIBLEMENTE INCORRECTA!`);
        console.log(`   📌 Sugerencia: ${result.correct_answer}`);
        console.log(`   📖 Razón: ${result.reason_if_wrong}`);

        const correctionInfo = {
          id: q.id,
          question: q.question_text,
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d
          },
          currentAnswer: currentLetter,
          suggestedAnswer: result.correct_answer,
          reason: result.reason_if_wrong,
          improvedExplanation: result.improved_explanation
        };

        if (SAFE_MODE) {
          // En modo seguro, solo guardar para revisar y mejorar explicación
          pendingCorrections.push(correctionInfo);
          // Aún así mejoramos la explicación (sin cambiar la respuesta)
          await updateQuestion(q.id, {
            explanation: result.improved_explanation
          });
          progress.stats.verified++;
          console.log(`   🔒 [SAFE] Guardada para revisar, explicación mejorada`);
        } else {
          // Modo normal: corregir respuesta
          corrections.push({
            id: q.id,
            question: q.question_text.substring(0, 60),
            was: currentLetter,
            shouldBe: result.correct_answer,
            reason: result.reason_if_wrong
          });

          await updateQuestion(q.id, {
            correct_option: newCorrectOption,
            explanation: result.improved_explanation
          });

          progress.stats.corrected++;
          console.log(`   ✅ ${DRY_RUN ? '[DRY-RUN] Se corregiría' : 'Corregida'}`);
        }
      } else {
        // La respuesta estaba bien, solo mejorar explicación
        await updateQuestion(q.id, {
          explanation: result.improved_explanation
        });

        progress.stats.verified++;
        console.log(`   ✅ Respuesta correcta, explicación mejorada`);
      }

      // Guardar progreso
      progress.processed.push(q.id);
      saveProgress(progress);

      // Pausa entre llamadas
      await sleep(DELAY_MS);

    } catch (error) {
      progress.stats.errors++;
      console.error(`   ❌ Error: ${error.message}`);

      // Guardar progreso incluso con error
      progress.processed.push(q.id);
      saveProgress(progress);

      // Pausa más larga en caso de error
      await sleep(2000);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 PROCESO COMPLETADO');
  console.log('═'.repeat(70));
  console.log(`\n📊 Estadísticas de esta ejecución:`);
  console.log(`   ✅ Verificadas OK: ${progress.stats.verified}`);
  console.log(`   🔄 Corregidas: ${progress.stats.corrected}`);
  console.log(`   ❌ Errores: ${progress.stats.errors}`);
  console.log(`   📁 Total procesadas: ${progress.processed.length}`);

  if (corrections.length > 0) {
    console.log(`\n⚠️ CORRECCIONES APLICADAS (${corrections.length}):`);
    corrections.forEach((c, i) => {
      console.log(`   ${i + 1}. "${c.question}..."`);
      console.log(`      ${c.was} → ${c.shouldBe}: ${c.reason}`);
    });
  }

  // Guardar correcciones pendientes para revisión
  if (pendingCorrections.length > 0) {
    // Cargar correcciones previas si existen
    let allPending = [];
    try {
      if (fs.existsSync(CORRECTIONS_FILE)) {
        allPending = JSON.parse(fs.readFileSync(CORRECTIONS_FILE, 'utf-8'));
      }
    } catch (e) {}

    allPending = [...allPending, ...pendingCorrections];
    fs.writeFileSync(CORRECTIONS_FILE, JSON.stringify(allPending, null, 2));

    console.log(`\n📋 CORRECCIONES PENDIENTES DE REVISAR: ${pendingCorrections.length} nuevas`);
    console.log(`   Total acumuladas: ${allPending.length}`);
    console.log(`   Archivo: ${CORRECTIONS_FILE}`);
    console.log(`\n   Para aplicar correcciones revisadas, ejecuta:`);
    console.log(`   node scripts/apply-excel-corrections.cjs`);
  }

  if (DRY_RUN) {
    console.log('\n🔍 Esto fue una ejecución DRY-RUN. Ejecuta sin --dry-run para aplicar cambios.');
  }

  if (SAFE_MODE && !DRY_RUN) {
    console.log('\n🔒 Modo SEGURO completado:');
    console.log('   - Explicaciones mejoradas con fuentes de Microsoft');
    console.log('   - Correcciones de respuestas guardadas para tu revisión');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
