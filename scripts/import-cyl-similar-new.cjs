/**
 * Importar las preguntas "LIKELY_NEW" del review de similares
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-cyl');
const LETTER_TO_NUM = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function generateContentHash(text) {
  const normalized = (text || '').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

(async () => {
  const newIds = new Set(JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'similar-new-ids.json'), 'utf-8')));
  console.log(`📋 Preguntas rescatadas a importar: ${newIds.size}`);

  // Load scraped
  const scrapedMap = new Map();
  const dirs = fs.readdirSync(OUTPUT_DIR).filter(d => d.startsWith('Tema_'));
  for (const dir of dirs) {
    const tema = parseInt(dir.split('_')[1]);
    const files = fs.readdirSync(path.join(OUTPUT_DIR, dir)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, dir, f), 'utf-8'));
      for (const q of data.questions) {
        if (newIds.has(q.id)) scrapedMap.set(q.id, { ...q, tema });
      }
    }
  }
  console.log(`📥 Encontradas: ${scrapedMap.size}`);

  const questions = [...scrapedMap.values()];
  let inserted = 0, hashDups = 0, errors = 0;

  for (let i = 0; i < questions.length; i += 50) {
    const batch = questions.slice(i, i + 50);
    const rows = batch.map(q => ({
      question_text: q.question,
      option_a: q.options[0]?.text || '',
      option_b: q.options[1]?.text || '',
      option_c: q.options[2]?.text || '',
      option_d: q.options[3]?.text || '',
      correct_option: LETTER_TO_NUM[q.correctAnswer],
      explanation: q.explanation || '',
      primary_article_id: '2536184c-73ed-4568-9ac7-0bbf1da24dcb',
      difficulty: 'medium',
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      is_official_exam: false,
      content_hash: generateContentHash(q.question),
      tags: [`Tema ${q.tema}`, q.tema <= 19 ? 'Grupo I' : 'Grupo II', 'CyL'],
    })).filter(r => r.correct_option !== undefined);

    const { data, error } = await sb.from('questions').insert(rows).select('id');
    if (error) {
      if (error.message?.includes('content_hash')) {
        for (const row of rows) {
          const { error: e } = await sb.from('questions').insert(row).select('id');
          if (e?.message?.includes('content_hash')) hashDups++;
          else if (e) errors++;
          else inserted++;
        }
      } else { console.error('❌', error.message?.substring(0, 200)); errors += rows.length; }
    } else { inserted += data.length; }
  }

  console.log(`\n✅ Insertadas: ${inserted} | Hash dups: ${hashDups} | Errores: ${errors}`);
})();
