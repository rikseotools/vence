const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ALPHA = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
function letterPos(l) { return ALPHA.indexOf(l.toUpperCase()) + 1; }
function posToLetter(p) { const len = ALPHA.length; return ALPHA[((p-1) % len + len) % len]; }

function validateLetterAnalogy(w1, w2, w3, options, correctOption) {
  if (w1.length !== w2.length || w1.length !== w3.length) return null;
  const diffs = [];
  for (let i = 0; i < w1.length; i++) {
    const p1 = letterPos(w1[i]), p2 = letterPos(w2[i]);
    if (!p1 || !p2) return null;
    diffs.push(p2 - p1);
  }
  let result = '';
  const steps = [`Patrón ${w1}→${w2}: ${diffs.map((d,i) => `${w1[i]}(${letterPos(w1[i])})→${w2[i]}(${letterPos(w2[i])})=${d>=0?'+':''}${d}`).join(', ')}`];
  for (let i = 0; i < w3.length; i++) {
    const p3 = letterPos(w3[i]);
    result += posToLetter(p3 + diffs[i]);
    steps.push(`${w3[i]}(${p3}) + ${diffs[i]} = ${p3+diffs[i]} → ${posToLetter(p3+diffs[i])}`);
  }
  const vals = [options.a, options.b, options.c, options.d];
  const idx = vals.findIndex(o => o?.toUpperCase().trim() === result);
  return { validated: true, confirmsDbAnswer: idx === correctOption, computedAnswer: idx >= 0 ? ['A','B','C','D'][idx] : null, computedValue: result, pattern: `Transformación ${diffs.map(d=>(d>=0?'+':'')+d).join(',')}`, steps };
}

const BASE_PROMPT = `Eres un tutor experto en psicotécnicos para oposiciones españolas.
Tu objetivo es explicar cada ejercicio de forma clara, didáctica y paso a paso.
SIEMPRE usa el alfabeto español de 27 letras (con ñ): ABCDEFGHIJKLMNÑOPQRSTUVWXYZ.`;

function buildNewPrompt(q, validation) {
  const opts = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
  const correctLetter = ['A','B','C','D'][q.correct_option];
  const correctText = opts[correctLetter.toLowerCase()];
  
  let extra = '';
  if (q.question_subtype === 'error_detection' || q.question_subtype === 'word_analysis') {
    extra = '\n📝 IMPORTANTE: Para detección de errores, revisa acentuación, ortografía, concordancia, puntuación. Aplica reglas RAE.\n';
    if (q.content_data?.original_text) extra += `\nTexto a analizar: "${q.content_data.original_text}"\n`;
  } else if (q.question_subtype?.startsWith('sequence_')) {
    extra = '\n📝 IMPORTANTE: Convierte CADA letra a su posición numérica y muestra el cálculo. SIEMPRE usa alfabeto español (27 letras con ñ).\n';
  }

  let prompt = BASE_PROMPT + extra + `
PREGUNTA: ${q.question_text}
Opciones: A) ${opts.a} | B) ${opts.b} | C) ${opts.c} | D) ${opts.d}
`;

  if (validation?.validated && !validation.confirmsDbAnswer) {
    prompt += `
⚠️ NOTA DEL SISTEMA: La verificación matemática calculó "${validation.computedValue}" (${validation.pattern}).
Pasos: ${validation.steps.map(s => '\n  • ' + s).join('')}

Esto NO coincide con la respuesta de la BD. Resuelve TÚ MISMO paso a paso.
Si tampoco coincide con ninguna opción, indica "⚠️ POSIBLE ERROR EN LA PREGUNTA".
NO fuerces los cálculos. FORMATO: **🎯 Respuesta: X**`;
  } else if (validation?.validated && validation.confirmsDbAnswer) {
    prompt += `
⭐ RESPUESTA CORRECTA (verificada matemáticamente): ${correctLetter}) ${correctText}
✅ Verificación confirma. Explica paso a paso. **🎯 Respuesta: ${correctLetter}**`;
  } else {
    prompt += `
⭐ RESPUESTA CORRECTA: ${correctLetter}) ${correctText}
Resuelve paso a paso. Verifica con tu análisis. FORMATO: **🎯 Respuesta: X**`;
  }
  return prompt;
}

async function main() {
  const { data: config } = await s.from('ai_api_config').select('api_key_encrypted').eq('provider','openai').eq('is_active',true).single();
  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8');
  const OpenAI = require('openai');
  const openai = new OpenAI.default({ apiKey });

  const IDS = [
    '82be4318-7308-45ce-9c51-f76a833284ca', // AMOR→CNQT (broken, anti-anchoring)
    '2d23989c-d8ea-40f1-9a10-1079f15cad81', // error_detection (güijarros)
    'cbb7647e-6000-4c3f-be93-60409c1ad5cb', // word_analysis (ll/y)
  ];

  for (const qid of IDS) {
    const { data: q } = await s.from('psychometric_questions').select('*').eq('id', qid).single();
    if (!q) continue;

    const opts = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
    let validation = null;
    if (q.question_subtype === 'sequence_letter') {
      const m = (q.question_text||'').match(/([A-ZÑÁÉÍÓÚ]{2,})\s+es\s+a\s+([A-ZÑÁÉÍÓÚ]{2,})\s+como\s+([A-ZÑÁÉÍÓÚ]{2,})\s+es\s+a/i);
      if (m) validation = validateLetterAnalogy(m[1].toUpperCase(), m[2].toUpperCase(), m[3].toUpperCase(), opts, q.correct_option);
    }

    const prompt = buildNewPrompt(q, validation);

    console.log('\n' + '='.repeat(80));
    console.log(`Q: ${q.question_text}`);
    if (q.content_data?.original_text) console.log(`Text: "${q.content_data.original_text}"`);
    console.log(`DB: ${['A','B','C','D'][q.correct_option]}`);
    console.log(`Validation: ${validation ? (validation.confirmsDbAnswer ? 'CONFIRMS' : 'CONTRADICTS → '+validation.computedValue) : 'NONE'}`);
    console.log('--- GPT-4o (NEW SYSTEM) ---\n');

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Explícame paso a paso cómo resolver esta pregunta' },
      ],
      temperature: 0.7, max_tokens: 1500,
    });
    console.log(resp.choices[0].message.content);
    console.log(`\nTokens: ${resp.usage?.total_tokens}`);
  }
}
main().catch(console.error);
