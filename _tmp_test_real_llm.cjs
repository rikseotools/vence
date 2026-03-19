const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Alfabeto español 27 letras
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
    if (!p3) return null;
    const np = p3 + diffs[i];
    const nl = posToLetter(np);
    result += nl;
    steps.push(`${w3[i]}(${p3}) + ${diffs[i]} = ${np} → ${nl}`);
  }
  const vals = [options.a, options.b, options.c, options.d];
  const idx = vals.findIndex(o => o?.toUpperCase().trim() === result);
  return {
    validated: true,
    confirmsDbAnswer: idx === correctOption,
    computedAnswer: idx >= 0 ? ['A','B','C','D'][idx] : null,
    computedValue: result,
    pattern: `Transformación ${diffs.map(d => (d>=0?'+':'')+d).join(',')}`,
    steps,
  };
}

function validateNumericSequence(text, options, correctOption) {
  const seriesPart = text.split('?')[0] || text;
  const usesHyphen = /\d\s*-\s*\d/.test(seriesPart) && !/\d\s*,\s*\d/.test(seriesPart);
  let numbers;
  if (usesHyphen) {
    numbers = seriesPart.split(/[-–]/).map(p => p.trim()).filter(p => /\d/.test(p))
      .map(p => { const m = p.match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',','.')) : NaN; })
      .filter(n => !isNaN(n));
  } else {
    const m = text.match(/-?\d+(?:[.,]\d+)?/g);
    numbers = m ? m.map(x => parseFloat(x.replace(',','.'))).filter(n => !isNaN(n)) : [];
  }
  if (numbers.length < 3) return null;

  // Diferencia constante
  const diffs = [];
  for (let i = 1; i < numbers.length; i++) diffs.push(numbers[i] - numbers[i-1]);
  if (diffs.length >= 2 && diffs.every(d => Math.abs(d - diffs[0]) < 0.001)) {
    const next = numbers[numbers.length-1] + diffs[0];
    const vals = [options.a, options.b, options.c, options.d];
    const idx = vals.findIndex(o => o && Math.abs(parseFloat(o.replace(',','.').trim()) - next) < 0.001);
    return {
      validated: true,
      confirmsDbAnswer: idx === correctOption,
      computedAnswer: idx >= 0 ? ['A','B','C','D'][idx] : null,
      computedValue: String(next),
      pattern: `Diferencia constante: ${diffs[0]}`,
      steps: [`Serie: ${numbers.join(', ')}`, `Diferencias: ${diffs.join(', ')}`, `Siguiente: ${next}`],
    };
  }
  return null;
}

// Minimal prompt builder
function buildPrompt(qc, validation) {
  const BASE = `Eres un tutor experto en psicotécnicos para oposiciones españolas.
Tu objetivo es explicar cada ejercicio de forma clara, didáctica y paso a paso.

📝 IMPORTANTE PARA SERIES:
- Para series alfabéticas: convierte CADA letra a su posición numérica y muestra el cálculo
- Verifica cada operación aritmética individualmente (no asumas, calcula)
- Si el resultado no coincide con ninguna opción, indica "⚠️ POSIBLE ERROR EN LA PREGUNTA"
`;

  const opts = { a: qc.option_a, b: qc.option_b, c: qc.option_c, d: qc.option_d };
  const correctLetter = ['A','B','C','D'][qc.correct_option];
  const correctText = opts[correctLetter.toLowerCase()] || '';

  let prompt = BASE + `
PREGUNTA DE PSICOTÉCNICO:
Tipo: ${qc.question_subtype}

Pregunta: ${qc.question_text}

Opciones:
A) ${opts.a}
B) ${opts.b}
C) ${opts.c}
D) ${opts.d}
`;

  if (validation?.validated && !validation.confirmsDbAnswer) {
    prompt += `
⚠️ NOTA: La verificación matemática calculó "${validation.computedValue}" (${validation.pattern}).
Pasos:
${validation.steps.map(s => `  • ${s}`).join('\n')}

Esto NO coincide con la respuesta de la BD. Resuelve TÚ MISMO paso a paso.
Si tampoco coincide con ninguna opción, indica "⚠️ POSIBLE ERROR EN LA PREGUNTA".
FORMATO: **🎯 Respuesta: X**
`;
  } else if (validation?.validated && validation.confirmsDbAnswer) {
    prompt += `
⭐ RESPUESTA CORRECTA (verificada matemáticamente): ${correctLetter}) ${correctText}

✅ La verificación matemática confirma esta respuesta.
Explica el razonamiento paso a paso de forma clara y pedagógica.
Indica claramente: **🎯 Respuesta: ${correctLetter}**
`;
  } else {
    prompt += `
⭐ RESPUESTA CORRECTA: ${correctLetter}) ${correctText}

Resuelve paso a paso. Si tu cálculo coincide con ${correctLetter}, explícalo.
Si no coincide, revisa la explicación guardada antes de declarar error.
FORMATO: **🎯 Respuesta: X**
`;
  }
  return prompt;
}

async function main() {
  // Get OpenAI key
  const { data: config } = await s.from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single();

  if (!config) { console.log('No OpenAI config found'); return; }
  const apiKey = Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8');
  const OpenAI = require('openai');
  const openai = new OpenAI.default({ apiKey });

  // ========================
  // TEST 1: Serie numérica (validación CONFIRMA)
  // ========================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Serie numérica con validación que confirma BD');
  console.log('='.repeat(80));

  const { data: numQs } = await s.from('psychometric_questions')
    .select('*')
    .eq('question_subtype', 'sequence_numeric')
    .eq('is_active', true)
    .limit(10);

  let testQ1 = null, v1 = null;
  for (const q of (numQs || [])) {
    const opts = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
    const v = validateNumericSequence(q.question_text || '', opts, q.correct_option);
    if (v?.validated && v.confirmsDbAnswer) { testQ1 = q; v1 = v; break; }
  }

  if (testQ1) {
    const prompt = buildPrompt(testQ1, v1);
    console.log('Q:', testQ1.question_text);
    console.log('Correct:', ['A','B','C','D'][testQ1.correct_option]);
    console.log('Validation: CONFIRMS, computed:', v1.computedValue);
    console.log('\n--- GPT-4o ---\n');

    const r1 = await openai.chat.completions.create({
      model: 'gpt-4o', messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Explícame paso a paso cómo resolver esta pregunta' },
      ], temperature: 0.7, max_tokens: 1500,
    });
    console.log('RESPONSE:\n', r1.choices[0].message.content);
    console.log('\nTokens:', r1.usage?.total_tokens);
  } else {
    console.log('No se encontró pregunta numérica validable');
  }

  // ========================
  // TEST 2: Serie de letras (analogía CASA→AYQY)
  // ========================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Serie de letras (analogía)');
  console.log('='.repeat(80));

  const { data: letterQ } = await s.from('psychometric_questions')
    .select('*')
    .eq('question_subtype', 'sequence_letter')
    .eq('is_active', true)
    .ilike('question_text', '%es a%como%es a%')
    .limit(20);

  let testQ2 = null, v2 = null;
  for (const q of (letterQ || [])) {
    const m = (q.question_text || '').match(/([A-ZÑÁÉÍÓÚ]{2,})\s+es\s+a\s+([A-ZÑÁÉÍÓÚ]{2,})\s+como\s+([A-ZÑÁÉÍÓÚ]{2,})\s+es\s+a/i);
    if (m) {
      const opts = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
      const val = validateLetterAnalogy(m[1].toUpperCase(), m[2].toUpperCase(), m[3].toUpperCase(), opts, q.correct_option);
      if (val?.validated) { testQ2 = q; v2 = val; break; }
    }
  }

  if (testQ2) {
    const prompt = buildPrompt(testQ2, v2);
    console.log('Q:', testQ2.question_text);
    console.log('Correct:', ['A','B','C','D'][testQ2.correct_option]);
    console.log('Validation:', v2.confirmsDbAnswer ? 'CONFIRMS' : 'CONTRADICTS', '→ computed:', v2.computedValue);
    console.log('\n--- GPT-4o ---\n');

    const r2 = await openai.chat.completions.create({
      model: 'gpt-4o', messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Explícame esta pregunta paso a paso' },
      ], temperature: 0.7, max_tokens: 1500,
    });
    console.log('RESPONSE:\n', r2.choices[0].message.content);
    console.log('\nTokens:', r2.usage?.total_tokens);
  } else {
    console.log('No se encontró pregunta de analogía de letras');
  }

  // ========================
  // TEST 3: Detección de errores (sin validación matemática)
  // ========================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Detección de errores (sin validación)');
  console.log('='.repeat(80));

  const { data: errQ } = await s.from('psychometric_questions')
    .select('*')
    .eq('question_subtype', 'error_detection')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (errQ) {
    // Inject original_text into question_text if available
    if (errQ.content_data?.original_text) {
      errQ.question_text = (errQ.question_text || '') + '\n"' + errQ.content_data.original_text + '"';
    }
    const prompt = buildPrompt(errQ, null);
    console.log('Q:', errQ.question_text);
    console.log('Correct:', ['A','B','C','D'][errQ.correct_option]);
    console.log('\n--- GPT-4o ---\n');

    const r3 = await openai.chat.completions.create({
      model: 'gpt-4o', messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Analiza esta frase y dime cuántos errores hay' },
      ], temperature: 0.7, max_tokens: 1500,
    });
    console.log('RESPONSE:\n', r3.choices[0].message.content);
    console.log('\nTokens:', r3.usage?.total_tokens);
  }
}

main().catch(e => console.error(e));
