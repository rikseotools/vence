// Importa las preguntas usables del examen oficial C1 2022 como DRAFT.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const SP = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/ab7731c9-92e7-4083-8aed-4aaceef7d2cb/scratchpad';

const EXAM_DATE = '2022-11-06';
const EXAM_POS = 'administrativo_extremadura';
const EXAM_ENTITY = 'Junta de Extremadura';
const SOURCE_BASE = 'Examen Cuerpo Administrativo Junta de Extremadura 2022 (OEP 2018-2020)';

(async () => {
  const news = JSON.parse(fs.readFileSync(`${SP}/news_idx.json`, 'utf8'));
  const byIdx = {}; news.forEach(q => byIdx[q.idx] = q);
  // consolidar resultados
  const files = ['res_0_12','res_13_25','res_26_38','res_39_51','res_52_64','res_65_77'];
  let res = [];
  for (const f of files) {
    if (!fs.existsSync(`${SP}/${f}.json`)) { console.error('FALTA', f); process.exit(1); }
    res = res.concat(JSON.parse(fs.readFileSync(`${SP}/${f}.json`, 'utf8')));
  }
  const usable = res.filter(r => r.usable && r.article_id && r.correct_index != null);
  console.log(`Resultados: ${res.length} | usables: ${usable.length}`);

  if (process.argv[2] !== '--apply') { console.log('DRY-RUN (pasa --apply para insertar)');
    // dump map for the verification step
    const out = usable.map(r => ({ idx:r.idx, n:byIdx[r.idx].n, part:byIdx[r.idx].part, law_key:r.law_key, article_number:r.article_number, article_id:r.article_id, correct_index:r.correct_index, confidence:r.confidence }));
    fs.writeFileSync(`${SP}/usable_map.json`, JSON.stringify(out));
    console.log('usable_map.json escrito'); return;
  }

  let ins = 0, err = 0;
  const inserted = [];
  for (const r of usable) {
    const q = byIdx[r.idx];
    const part = q.part === 'reserva' ? 'Primera parte (Reserva)' : 'Primera parte';
    const examSource = `${SOURCE_BASE} - ${part}`;
    const row = {
      question_text: q.text,
      option_a: q.a, option_b: q.b, option_c: q.c, option_d: q.d,
      correct_option: r.correct_index,
      explanation: r.explanation,
      primary_article_id: r.article_id,
      lifecycle_state: 'draft',
      is_official_exam: true,
      exam_source: examSource,
      exam_date: EXAM_DATE,
      exam_entity: EXAM_ENTITY,
      exam_position: EXAM_POS,
      difficulty: 'medium',
    };
    const { data, error } = await s.from('questions').insert(row).select('id').single();
    if (error) { console.error('❌ idx'+r.idx, error.message); err++; continue; }
    ins++;
    inserted.push({ idx:r.idx, qid:data.id, n:q.n, part:q.part, examSource, correct_index:r.correct_index, article_id:r.article_id, law_key:r.law_key, article_number:r.article_number });
  }
  fs.writeFileSync(`${SP}/inserted.json`, JSON.stringify(inserted));
  console.log(`✅ Insertadas DRAFT: ${ins} | errores: ${err} | inserted.json escrito`);
})();
