require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const PT = 'ayudante_instituciones_penitenciarias';

const BLOQUE_BASE = {
  'I. Organización del Estado. Derecho Administrativo General. Gestión de Personal y Gestión Financiera': { base: 0, b: 1 },
  'II. Derecho Penal': { base: 100, b: 2 },
  'III. Derecho Penitenciario': { base: 200, b: 3 },
  'IV. Conducta humana': { base: 300, b: 4 },
};
function norm(t){return (t||'').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();}
function cleanTitle(t){return (t||'').replace(/[​-‏‪-‮⁠﻿­]/g,'').trim();}
function hasArticle(q){ const t=cleanTitle(q.explanationTitle); return /^\*?\s*Art[íi]?\.?(?:culo)?\s*\d+/i.test(t); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1) BD: normalizados (para dedup) + activas por tema actual
  const dbNorm = new Set(); let last = '00000000-0000-0000-0000-000000000000';
  while (true) { const r = await c.query('SELECT id, question_text FROM questions WHERE id>$1 ORDER BY id LIMIT 10000', [last]); if (!r.rows.length) break; r.rows.forEach(x => dbNorm.add(norm(x.question_text))); last = r.rows[r.rows.length-1].id; if (r.rows.length < 10000) break; }
  const act = await c.query(`SELECT (SELECT t FROM unnest(tags) t WHERE t LIKE 'T%') tema, count(*) FROM questions WHERE tags @> ARRAY['${PT}'] AND is_active=true GROUP BY 1`);
  const activas = {}; act.rows.forEach(r => activas[r.tema] = Number(r.count));
  // títulos de temas
  const tp = await c.query(`SELECT topic_number, title FROM topics WHERE position_type='${PT}'`);
  const titulo = {}; tp.rows.forEach(r => titulo['T'+r.topic_number] = r.title);

  // 2) triar el banco de estudio NUEVO por tema
  const d = JSON.parse(fs.readFileSync('preguntas-para-subir/instituciones-penitenciarias/estudio-random/estudio_random.json','utf8'));
  const nuevasTema = {}, sinArtTema = {};
  const seen = new Set();
  for (const q of d.questions) {
    const k = norm(q.question); if (seen.has(k)) continue; seen.add(k);
    if (q.isAnnulled || q.isRepealed) continue;
    if (dbNorm.has(k)) continue; // ya en BD
    const cont = q.contents?.[0]; const bb = cont && BLOQUE_BASE[cont.name];
    if (!bb || !cont.child) continue;
    const tm = cont.child.match(/^Tema (\d+)/); if (!tm) continue;
    const tn = 'T' + (bb.base + Number(tm[1]));
    if (hasArticle(q)) nuevasTema[tn] = (nuevasTema[tn]||0)+1;
    else sinArtTema[tn] = (sinArtTema[tn]||0)+1;
  }

  // 3) imprimir tabla por tema (ordenado por nº de tema lógico)
  const allTemas = new Set([...Object.keys(activas), ...Object.keys(nuevasTema), ...Object.keys(sinArtTema)]);
  const ordKey = t => { const n = Number(t.slice(1)); return n>=300?3000+n:n>=200?2000+n:n>=100?1000+n:n; };
  const rows = [...allTemas].sort((a,b)=>ordKey(a)-ordKey(b));
  console.log('TEMA  ACTIVAS  +NUEVAS(art)  +sin-art   TÍTULO');
  let totN=0, totSA=0;
  for (const t of rows) {
    const a = activas[t]||0, n = nuevasTema[t]||0, sa = sinArtTema[t]||0;
    totN += n; totSA += sa;
    const flag = (a+n)===0 ? ' 🔴 VACÍO' : (a<10 && n>=10) ? ' ⬆️ refuerzo' : '';
    console.log(`${t.padEnd(5)} ${String(a).padStart(6)}  ${String(n).padStart(10)}  ${String(sa).padStart(8)}   ${(titulo[t]||'').slice(0,38)}${flag}`);
  }
  console.log(`\nTOTAL nuevas importables (con art): ${totN} | sin artículo (editorial/leyes-no-BD): ${totSA}`);
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
