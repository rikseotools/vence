require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

function norm(t){return (t||'').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();}
// clave opciones barajadas: opciones normalizadas y ORDENADAS (mismo set de opciones en cualquier orden)
function optKey(opts){ return opts.map(o=>norm(o)).filter(Boolean).sort().join('|'); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Cargar BD con opciones → claves: exacto y barajado(pregunta+opciones ordenadas)
  console.error('Cargando BD con opciones...');
  const dbExact = new Set();      // norm(question)
  const dbShuffle = new Set();    // norm(question) + '#' + optKey
  let last = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const r = await c.query('SELECT id, question_text, option_a, option_b, option_c, option_d FROM questions WHERE id>$1 ORDER BY id LIMIT 8000', [last]);
    if (!r.rows.length) break;
    for (const q of r.rows) {
      const nq = norm(q.question_text);
      dbExact.add(nq);
      dbShuffle.add(nq + '#' + optKey([q.option_a,q.option_b,q.option_c,q.option_d]));
    }
    last = r.rows[r.rows.length-1].id;
    if (r.rows.length < 8000) break;
  }
  console.error('  BD claves:', dbExact.size, 'exactas');

  // Banco de estudio
  const d = JSON.parse(fs.readFileSync('preguntas-para-subir/instituciones-penitenciarias/estudio-random/estudio_random.json','utf8'));
  const stats = { total: d.questions.length, derog: 0, dupExactaDB: 0, dupBarajadaDB: 0, dupInternaBanco: 0, unicas: 0 };
  const seenExact = new Set(), seenShuffle = new Set();
  const unicas = [];
  for (const q of d.questions) {
    if (q.isAnnulled || q.isRepealed) { stats.derog++; continue; }
    const nq = norm(q.question);
    const opts = q.options.map(o=>o.text);
    const sk = nq + '#' + optKey(opts);
    // dup exacta contra BD
    if (dbExact.has(nq)) { stats.dupExactaDB++; continue; }
    // dup barajada contra BD (misma pregunta + mismas opciones en otro orden)
    if (dbShuffle.has(sk)) { stats.dupBarajadaDB++; continue; }
    // dup interna del banco (exacta o barajada)
    if (seenExact.has(nq) || seenShuffle.has(sk)) { stats.dupInternaBanco++; continue; }
    seenExact.add(nq); seenShuffle.add(sk);
    stats.unicas++; unicas.push(q);
  }
  console.log('=== DEDUP NIVEL 0+1 (exacto + opciones barajadas) ===');
  console.log(JSON.stringify(stats, null, 1));

  // Nivel 2: Jaccard alto contra OTRAS únicas del banco (casi-repetidas internas reformuladas)
  // (contra toda la BD por Jaccard es O(n*m) inviable; hacemos intra-banco que es donde más se repite el random)
  function jac(a,b){ const wa=new Set(a.split(' ').filter(w=>w.length>3)); const wb=new Set(b.split(' ').filter(w=>w.length>3)); let i=0; for(const w of wa) if(wb.has(w)) i++; const u=new Set([...wa,...wb]).size; return u?i/u:0; }
  // bucket por primeras 4 palabras para no comparar todas con todas
  const buckets = {};
  let casiRep = 0;
  for (const q of unicas) {
    const nq = norm(q.question);
    const bk = nq.split(' ').slice(0,4).join(' ');
    if (!buckets[bk]) buckets[bk] = [];
    let dup = false;
    for (const prev of buckets[bk]) { if (jac(nq, prev) >= 0.85) { dup = true; break; } }
    if (dup) casiRep++; else buckets[bk].push(nq);
  }
  console.log(`\nNivel 2 (Jaccard>=0.85 intra-banco, casi-repetidas reformuladas): ~${casiRep} adicionales`);
  console.log(`\n→ ÚNICAS REALES estimadas: ${stats.unicas - casiRep} (de ${d.questions.length} capturadas)`);
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
