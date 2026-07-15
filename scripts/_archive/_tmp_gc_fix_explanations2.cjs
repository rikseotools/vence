#!/usr/bin/env node
/**
 * Fix explanations: Load all InnoTest questions from BD,
 * match to JSON by normalized question_text, update explanation with proper markdown.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeForMatch(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/<[^>]*>/g, '').replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function htmlToMarkdown(html) {
  if (!html) return null;
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/li>\s*/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<\/?ul[^>]*>/gi, '\n');
  text = text.replace(/<\/?ol[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<b>([^<]*)<\/b>/gi, '**$1**');
  text = text.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**');
  text = text.replace(/<i>([^<]*)<\/i>/gi, '*$1*');
  text = text.replace(/<em>([^<]*)<\/em>/gi, '*$1*');
  text = text.replace(/<u>([^<]*)<\/u>/gi, '$1');
  text = text.replace(/<span[^>]*color:\s*#00C951[^>]*>([^<]*)<\/span>/gi, '**$1** (correcta)');
  text = text.replace(/<span[^>]*color:\s*#F94646[^>]*>([^<]*)<\/span>/gi, '~~$1~~ (incorrecta)');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/ *\n */g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  return text.length > 0 ? text : null;
}

async function main() {
  // Step 1: Load ALL InnoTest questions from BD into a map by normalized text
  console.log('Loading BD questions...');
  const bdMap = new Map(); // normalized_text → { id, explanation }
  let page = 0;
  while (true) {
    const { data } = await s.from('questions')
      .select('id, question_text, explanation')
      .contains('tags', ['InnoTest'])
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const q of data) {
      const norm = normalizeForMatch(q.question_text);
      bdMap.set(norm, { id: q.id, explanation: q.explanation });
    }
    page++;
    if (data.length < 1000) break;
  }
  console.log('Loaded', bdMap.size, 'BD questions');

  // Step 2: Process all JSON files
  const DIRS = ['conocimientos', 'examenes-oficiales', 'ingles', 'ortografia'];
  let totalUpdated = 0, totalSame = 0, totalNotFound = 0, totalNoExpl = 0;

  for (const dir of DIRS) {
    const dirPath = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-guardia-civil', dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    let dirUpdated = 0;

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'));

      for (const q of data.questions) {
        if (!q.question) continue;
        if (!q.explanation) { totalNoExpl++; continue; }

        const norm = normalizeForMatch(q.question);
        const bdQ = bdMap.get(norm);
        if (!bdQ) { totalNotFound++; continue; }

        const newExpl = htmlToMarkdown(q.explanation);
        if (!newExpl) { totalNoExpl++; continue; }

        // Only update if actually different
        if (bdQ.explanation === newExpl) { totalSame++; continue; }

        await s.from('questions').update({ explanation: newExpl }).eq('id', bdQ.id);
        totalUpdated++;
        dirUpdated++;
      }
    }

    console.log(dir + ': ' + dirUpdated + ' updated');
  }

  console.log('\n' + '='.repeat(50));
  console.log('Updated:', totalUpdated);
  console.log('Same (no change):', totalSame);
  console.log('Not found in BD:', totalNotFound);
  console.log('No explanation in JSON:', totalNoExpl);

  // Step 3: Verify with samples
  console.log('\n=== VERIFICATION SAMPLES ===\n');

  // Conocimientos sample with newlines
  const { data: s1 } = await s.from('questions')
    .select('question_text, explanation')
    .contains('tags', ['InnoTest'])
    .contains('tags', ['Derecho Constitucional'])
    .not('explanation', 'is', null)
    .limit(2);
  s1?.forEach((q, i) => {
    console.log('--- Conocimientos Q' + (i+1) + ' ---');
    console.log('Q:', q.question_text.substring(0, 80));
    console.log('Expl:\n' + q.explanation.substring(0, 250));
    console.log();
  });

  // Ortografía sample
  const { data: s2 } = await s.from('questions')
    .select('question_text, explanation')
    .contains('tags', ['InnoTest'])
    .ilike('question_text', '%**%')
    .not('explanation', 'is', null)
    .limit(1);
  s2?.forEach((q, i) => {
    console.log('--- Ortografía Q ---');
    console.log('Q:', q.question_text.substring(0, 80));
    console.log('Expl:\n' + q.explanation.substring(0, 300));
    console.log();
  });

  // Inglés sample
  const { data: s3 } = await s.from('questions')
    .select('question_text, explanation')
    .contains('tags', ['InnoTest'])
    .ilike('question_text', '%____%')
    .not('explanation', 'is', null)
    .limit(1);
  s3?.forEach((q, i) => {
    console.log('--- Inglés Q ---');
    console.log('Q:', q.question_text.substring(0, 80));
    console.log('Expl:\n' + q.explanation.substring(0, 300));
  });
}

main().catch(e => { console.error(e); process.exit(1); });
