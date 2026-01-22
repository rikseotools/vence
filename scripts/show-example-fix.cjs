const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai').default;
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function esTextoArticulo(exp) {
  if (!exp) return false;
  return (
    /^Ley \d+\/\d{4}.*\nArtículo \d+/i.test(exp) ||
    (/^Artículo \d+(\.\d+)? de la Ley/i.test(exp) && /[a-z]\) |^\d+\. /m.test(exp))
  );
}

(async () => {
  // Usar ID conocido de pregunta afectada
  const { data: q } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id')
    .eq('id', 'd62edf9f-b59f-4f2c-8a60-45cc7ae4a675')
    .single();

  if (!q) {
    console.log('No se encontró pregunta');
    return;
  }

  // Obtener artículo y ley
  const { data: art } = await supabase
    .from('articles')
    .select('article_number, content, law_id')
    .eq('id', q.primary_article_id)
    .single();

  const { data: law } = await supabase
    .from('laws')
    .select('short_name, name')
    .eq('id', art.law_id)
    .single();

  // Extraer nombre oficial con número
  let lawName = 'Ley';
  if (law?.name) {
    const match = law.name.match(/^(Ley Orgánica|Ley|Real Decreto|Orden|Resolución|Reglamento)[^\d]*(\d+\/\d{4})/i);
    if (match) {
      lawName = `${match[1]} ${match[2]}`;
    } else {
      lawName = law.name.split(',')[0];
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('📝 PREGUNTA:');
  console.log(q.question_text);
  console.log('');
  console.log('OPCIONES:');
  console.log('A)', q.option_a);
  console.log('B)', q.option_b);
  console.log('C)', q.option_c);
  console.log('D)', q.option_d);
  console.log('');
  console.log('✅ RESPUESTA CORRECTA:', ['A', 'B', 'C', 'D'][q.correct_option]);
  console.log('📖 ARTÍCULO VINCULADO:', lawName, 'Art.', art.article_number);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('❌ EXPLICACIÓN ACTUAL (texto de artículo):');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(q.explanation.substring(0, 600) + (q.explanation.length > 600 ? '...' : ''));
  console.log('');

  // Generar nueva explicación
  const { data: config } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single();

  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8');
  const openai = new OpenAI({ apiKey });

  const opciones = ['A', 'B', 'C', 'D'];
  const respCorrecta = opciones[q.correct_option];
  const textoRespuesta = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option];

  const prompt = `Genera una explicación didáctica breve (2-3 frases) para esta pregunta de oposiciones.

PREGUNTA: ${q.question_text}

OPCIONES:
A) ${q.option_a}
B) ${q.option_b}
C) ${q.option_c}
D) ${q.option_d}

RESPUESTA CORRECTA: ${respCorrecta}) ${textoRespuesta}

ARTÍCULO VINCULADO: ${lawName} artículo ${art.article_number}
CONTENIDO DEL ARTÍCULO: ${(art.content || '').substring(0, 600)}

INSTRUCCIONES ESTRICTAS:
- Empieza EXACTAMENTE con "La respuesta correcta es ${respCorrecta})."
- Cita el artículo así: "Según el artículo ${art.article_number} de la ${lawName}..." o "Conforme al artículo ${art.article_number} de la ${lawName}..."
- Usa párrafos separados si es necesario para que se lea bien
- Máximo 2-3 frases concisas
- NO copies el texto del artículo literalmente, explícalo con tus palabras
- Si es pregunta de "cuál es INCORRECTA", indica por qué esa opción es la incorrecta

Responde SOLO con la explicación, sin formato markdown ni viñetas.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 250,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }]
  });

  const nuevaExplicacion = response.choices[0].message.content.trim();

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('✅ NUEVA EXPLICACIÓN (generada por OpenAI):');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(nuevaExplicacion);
  console.log('═══════════════════════════════════════════════════════════════════');
})();
