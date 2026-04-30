#!/usr/bin/env node
/**
 * Re-import explanations from scraped JSON files with proper HTML→text conversion.
 * Preserves line breaks, converts lists, strips style attributes.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/<[^>]*>/g, '').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function contentHash(text) { return crypto.createHash('sha256').update(normalize(text)).digest('hex'); }

function htmlToMarkdown(html) {
  if (!html) return null;

  let text = html;

  // Convert <br> to newlines FIRST
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert lists to bullet points
  text = text.replace(/<\/li>\s*/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<\/?ul[^>]*>/gi, '\n');
  text = text.replace(/<\/?ol[^>]*>/gi, '\n');

  // Convert <p> to paragraphs
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Convert formatting to markdown
  text = text.replace(/<b>([^<]*)<\/b>/gi, '**$1**');
  text = text.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**');
  text = text.replace(/<i>([^<]*)<\/i>/gi, '*$1*');
  text = text.replace(/<em>([^<]*)<\/em>/gi, '*$1*');
  text = text.replace(/<u>([^<]*)<\/u>/gi, '$1');

  // Remove colored spans (ortografía: green=correct, red=incorrect)
  // Convert green to bold, red to strikethrough-like
  text = text.replace(/<span[^>]*color:\s*#00C951[^>]*>([^<]*)<\/span>/gi, '**$1** (correcta)');
  text = text.replace(/<span[^>]*color:\s*#F94646[^>]*>([^<]*)<\/span>/gi, '~~$1~~ (incorrecta)');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  // Clean up whitespace but PRESERVE newlines
  text = text.replace(/[ \t]+/g, ' ');          // collapse horizontal spaces
  text = text.replace(/ *\n */g, '\n');          // trim spaces around newlines
  text = text.replace(/\n{3,}/g, '\n\n');        // max 2 consecutive newlines
  text = text.trim();

  return text.length > 0 ? text : null;
}

async function main() {
  const DIRS = [
    'conocimientos',
    'examenes-oficiales',
    'ingles',
    'ortografia',
  ];

  let totalUpdated = 0, totalSkipped = 0, totalNotFound = 0;

  for (const dir of DIRS) {
    const dirPath = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-guardia-civil', dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    console.log('\n=== ' + dir.toUpperCase() + ' (' + files.length + ' files) ===');

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf-8'));
      let updated = 0;

      for (const q of data.questions) {
        if (!q.question || !q.explanation) continue;

        const hash = contentHash(q.question);
        const newExplanation = htmlToMarkdown(q.explanation);
        if (!newExplanation) continue;

        // Find question in BD by content_hash
        const { data: matches } = await s.from('questions')
          .select('id, explanation')
          .eq('content_hash', hash)
          .limit(1);

        if (!matches || matches.length === 0) { totalNotFound++; continue; }

        const existing = matches[0];

        // Only update if different
        if (existing.explanation === newExplanation) { totalSkipped++; continue; }

        await s.from('questions').update({ explanation: newExplanation }).eq('id', existing.id);
        updated++;
        totalUpdated++;
      }

      if (updated > 0) {
        process.stdout.write('[' + data.tema?.substring(0, 40) + '] updated ' + updated + '\n');
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Updated:', totalUpdated);
  console.log('Skipped (same):', totalSkipped);
  console.log('Not found in BD:', totalNotFound);

  // Show samples of fixed explanations
  console.log('\n=== SAMPLES AFTER FIX ===');
  const { data: samples } = await s.from('questions')
    .select('question_text, explanation')
    .contains('tags', ['InnoTest'])
    .ilike('explanation', '%\n%')
    .limit(3);
  samples?.forEach((q, i) => {
    console.log('\nQ' + (i+1) + ':', q.question_text.substring(0, 60));
    console.log('EXPL:\n' + q.explanation.substring(0, 300));
  });
}

main().catch(e => { console.error(e); process.exit(1); });
