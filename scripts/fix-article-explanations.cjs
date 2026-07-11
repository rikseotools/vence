#!/usr/bin/env node
/**
 * fix-article-explanations.cjs
 *
 * Corrige explicaciones que contienen texto de artículo íntegro
 * en lugar de explicaciones didácticas.
 *
 * Uso:
 *   node scripts/fix-article-explanations.cjs [--limit N] [--dry-run]
 */

const { createClient } = require('./lib/pg-agnostic-client.cjs');
const OpenAI = require('openai').default;
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let openai = null;

async function getOpenAIClient() {
  if (openai) return openai;

  // Obtener API key de ai_api_config
  const { data: config } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single();

  if (!config?.api_key_encrypted) {
    throw new Error('No se encontró API key de OpenAI en ai_api_config');
  }

  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8');
  openai = new OpenAI({ apiKey });
  return openai;
}

// Parse args
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(name);

const LIMIT = parseInt(getArg('--limit') || '0'); // 0 = sin límite
const DRY_RUN = hasFlag('--dry-run');

// Detectar si una explicación es texto de artículo
function esTextoArticulo(exp) {
  if (!exp) return false;
  return (
    /^Ley \d+\/\d{4}.*\nArtículo \d+/i.test(exp) ||
    (/^Artículo \d+(\.\d+)? de la Ley/i.test(exp) && /[a-z]\) |^\d+\. /m.test(exp))
  );
}

// Generar explicación didáctica con OpenAI
async function generarExplicacion(pregunta, articulo, ley) {
  const opciones = ['A', 'B', 'C', 'D'];
  const respCorrecta = opciones[pregunta.correct_option];
  const textoRespuesta = [
    pregunta.option_a,
    pregunta.option_b,
    pregunta.option_c,
    pregunta.option_d
  ][pregunta.correct_option];

  const prompt = `Genera una explicación didáctica breve (2-3 frases) para esta pregunta de oposiciones.

PREGUNTA: ${pregunta.question_text}

OPCIONES:
A) ${pregunta.option_a}
B) ${pregunta.option_b}
C) ${pregunta.option_c}
D) ${pregunta.option_d}

RESPUESTA CORRECTA: ${respCorrecta}) ${textoRespuesta}

ARTÍCULO VINCULADO: ${ley} artículo ${articulo.article_number}
CONTENIDO DEL ARTÍCULO: ${(articulo.content || '').substring(0, 600)}

INSTRUCCIONES ESTRICTAS:
- Empieza EXACTAMENTE con "La respuesta correcta es ${respCorrecta})."
- Cita el artículo así: "Según el artículo ${articulo.article_number} de la ${ley}..." o "Conforme al artículo ${articulo.article_number} de la ${ley}..."
- Usa párrafos separados si es necesario para que se lea bien
- Máximo 2-3 frases concisas
- NO copies el texto del artículo literalmente, explícalo con tus palabras
- Si es pregunta de "cuál es INCORRECTA", indica por qué esa opción es la incorrecta

Responde SOLO con la explicación, sin formato markdown ni viñetas.`;

  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 250,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.choices[0].message.content.trim();
}

async function obtenerPreguntasAfectadas() {
  const afectadas = [];
  let offset = 0;
  const pageSize = 1000;

  console.log('📥 Buscando preguntas con texto de artículo...');

  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, explanation')
      .is('is_active', true)
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;

    for (const q of data) {
      if (esTextoArticulo(q.explanation)) {
        afectadas.push(q.id);
      }
    }

    offset += pageSize;
    process.stdout.write(`\r   Revisadas: ${offset} preguntas...`);
    if (data.length < pageSize) break;
  }

  console.log(`\n   Encontradas: ${afectadas.length} preguntas afectadas`);
  return afectadas;
}

async function procesarPregunta(id) {
  // Obtener pregunta con artículo
  const { data: q } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, primary_article_id
    `)
    .eq('id', id)
    .single();

  if (!q || !q.primary_article_id) {
    return { success: false, error: 'Sin artículo vinculado' };
  }

  // Obtener artículo y ley
  const { data: art } = await supabase
    .from('articles')
    .select('article_number, content, law_id')
    .eq('id', q.primary_article_id)
    .single();

  if (!art) {
    return { success: false, error: 'Artículo no encontrado' };
  }

  const { data: law } = await supabase
    .from('laws')
    .select('short_name, name')
    .eq('id', art.law_id)
    .single();

  // Extraer nombre oficial con número (ej: "Ley 7/1985", "Ley Orgánica 3/2018", "Real Decreto 2568/1986")
  let lawName = 'Ley';
  if (law?.name) {
    // Extraer patrón: "Ley X/YYYY" o "Ley Orgánica X/YYYY" o "Real Decreto X/YYYY" etc.
    const match = law.name.match(/^(Ley Orgánica|Ley|Real Decreto|Orden|Resolución|Reglamento)[^\d]*(\d+\/\d{4})/i);
    if (match) {
      lawName = `${match[1]} ${match[2]}`;
    } else {
      // Si no tiene número, usar el nombre completo hasta la coma
      lawName = law.name.split(',')[0];
    }
  }

  try {
    // Generar nueva explicación
    const nuevaExplicacion = await generarExplicacion(q, art, lawName);

    if (!DRY_RUN) {
      // Actualizar en BD
      const { error } = await supabase
        .from('questions')
        .update({
          explanation: nuevaExplicacion,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true, explicacion: nuevaExplicacion };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🔧 Corrector de Explicaciones con OpenAI');
  console.log('========================================');
  if (DRY_RUN) console.log('⚠️  MODO DRY-RUN - No se guardarán cambios\n');

  // Verificar conexión API
  console.log('🔑 Verificando conexión OpenAI...');
  try {
    await getOpenAIClient();
    console.log('   ✅ Conexión OK\n');
  } catch (e) {
    console.error('   ❌ Error:', e.message);
    return;
  }

  // Obtener preguntas afectadas
  const ids = await obtenerPreguntasAfectadas();

  if (ids.length === 0) {
    console.log('✅ No hay preguntas que corregir');
    return;
  }

  const total = LIMIT > 0 ? Math.min(LIMIT, ids.length) : ids.length;
  console.log(`\n📊 Procesando ${total} preguntas...`);
  console.log(`   Tiempo estimado: ~${Math.ceil(total * 1 / 60)} minutos\n`);

  let success = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const id = ids[i];

    // Mostrar progreso
    const elapsed = Date.now() - startTime;
    const avgTime = i > 0 ? elapsed / i : 1000;
    const remaining = (total - i) * avgTime;
    const eta = new Date(Date.now() + remaining).toLocaleTimeString();

    process.stdout.write(`\r[${i + 1}/${total}] ETA: ${eta} | ✅ ${success} | ❌ ${errors}   `);

    const result = await procesarPregunta(id);

    if (result.success) {
      success++;
    } else {
      errors++;
    }

    // Pausa para no saturar la API (100ms)
    await new Promise(r => setTimeout(r, 100));
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n\n📊 RESUMEN`);
  console.log(`   Procesadas: ${total}`);
  console.log(`   ✅ Éxitos: ${success}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   ⏱️  Tiempo: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN - Ejecuta sin --dry-run para guardar cambios');
  }
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
