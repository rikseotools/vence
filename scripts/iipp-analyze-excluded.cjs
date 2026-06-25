require('dotenv').config({ path: '.env.local' });
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

const DIR = 'preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores';

// limpia caracteres invisibles (zero-width, etc.) que rompían el parseo
function cleanTitle(t) {
  return (t || '').replace(/[​-‏‪-‮⁠﻿­]/g, '').trim();
}
// regex mejorado: captura primer artículo, tolera bis/ter, ordinales (4º/6ª), decimales múltiples
function parseArt(title) {
  const t = cleanTitle(title);
  // *Art. 149.1.6ª CE | *Art. 20.4º CP | *Art. 272.1 RP 1996 | *Art. 11 CP | Art. 270.1, 90.3 y 6.2 RD...
  const m = t.match(/^\*?\s*Art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(bis|ter|quater|quinquies)?/i);
  if (!m) return null;
  const art = m[1] + (m[2] ? ' ' + m[2].toLowerCase() : '');
  // la ley = lo que va tras el número y sus decimales/ordinales
  const rest = t.replace(/^\*?\s*Art[íi]?c?u?l?o?s?\.?\s*[\d.,ºª\sbistrqueany]+/i, '').trim();
  return { art, base: m[1], rest };
}
function isStructural(title) {
  return /^\*?\s*(t[íi]tulo|cap[íi]tulo|libro|secci[óo]n)\s+[ivxl\d]/i.test(cleanTitle(title));
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // RESOLVER de leyes: patrón de short_name/name → law_id (todas las que cita IIPP)
  const lawPatterns = [
    ['RP 1996|RP 96|^RP$|RP de 1996', ['%190/1996%', '%Reglamento Penitenciario%']],
    ['^CP|Código Penal|10/1995', ['%10/1995%']],
    ['^CE\\b|Constitución', ['CE']],
    ['LOGP|1/1979', ['LOGP']],
    ['LECR?IM|Enjuiciamiento Criminal', ['LECrim']],
    ['LOPJ|6/1985', ['LO 6/1985']],
    ['TREBEP|5/2015', ['RDL 5/2015']],
    ['Ley 39/2015', ['Ley 39/2015']], ['Ley 40/2015', ['Ley 40/2015']],
    ['Ley 19/2013', ['%19/2013%']], ['Ley 9/2017|LCSP', ['Ley 9/2017']],
    ['Ley 45/2015|Voluntariado', ['Ley 45/2015']], ['Ley 23/2014', ['%23/2014%']],
    ['RD 782/2001|782/2001', ['RD 782/2001']], ['RD 840/2011|840/2011', ['RD 840/2011']],
    ['LO 6/1984|Habeas', ['%6/1984%']], ['RD 122/2015|122/2015', ['RD 122/2015']],
    ['TFUE', ['TFUE']], ['^TUE', ['TUE']],
    ['Ley 47/2003|^LGP|General Presupuestaria', ['%47/2003%', '%General Presupuestaria%']],
    ['Ley 50/1997|Ley del Gobierno', ['%50/1997%']],
    ['LO 3/1981|Defensor del Pueblo', ['%3/1981%']],
    ['LO 3/2007|igualdad efectiva', ['%3/2007%']],
    ['LO 1/2004|Violencia de Género', ['%1/2004%']],
    ['Ley 53/1984|incompatibilidades', ['%53/1984%']],
    ['Ley 39/2006|dependencia', ['%39/2006%']],
    ['LOTC|2/1979', ['%2/1979%', 'LOTC']],
    ['RP 1981|RP 81|1201/1981', ['%1201/1981%']],
    ['RD 207/2024', ['%207/2024%']], ['RD 364/1995', ['%364/1995%']],
    ['RD 365/1995', ['%365/1995%']], ['RD 617/1997', ['%617/1997%']],
    ['RD 462/2002', ['%462/2002%']], ['RD 33/1986', ['%33/1986%']],
    ['EOMF|Estatuto.*Ministerio Fiscal|50/1981', ['%50/1981%', '%Ministerio Fiscal%']],
    ['^LEC\\b|Enjuiciamiento Civil|1/2000', ['%1/2000%', '%Enjuiciamiento Civil%']],
    ['^CC\\b|Código Civil', ['%Código Civil%']],
    ['LBRL|7/1985|Bases.*Régimen Local', ['%7/1985%', '%Bases del Régimen Local%']],
    ['Ley 39/1970', ['%39/1970%']], ['Ley 36/1977', ['%36/1977%']],
    ['RDL 6/2023', ['%6/2023%']],
  ];
  // resolver cada patrón a un law_id real
  const resolved = {};
  for (const [pat, terms] of lawPatterns) {
    let id = null;
    for (const t of terms) {
      const r = await c.query('SELECT id FROM laws WHERE short_name ILIKE $1 OR name ILIKE $1 ORDER BY (SELECT count(*) FROM articles a WHERE a.law_id=laws.id) DESC LIMIT 1', [t]);
      if (r.rows[0]) { id = r.rows[0].id; break; }
    }
    resolved[pat] = id;
  }
  // artículos por ley (para validar existencia)
  const artSets = {};
  for (const [pat, id] of Object.entries(resolved)) {
    if (!id) continue;
    if (!artSets[id]) {
      const r = await c.query('SELECT article_number FROM articles WHERE law_id=$1', [id]);
      artSets[id] = new Set(r.rows.map(x => String(x.article_number)));
    }
  }
  function resolveLaw(rest) {
    for (const [pat] of lawPatterns) {
      const re = new RegExp(pat, 'i');
      if (re.test(rest)) return resolved[pat];
    }
    return null;
  }

  // ¿qué question ids ya están importadas? (para saber cuáles faltan)
  const imp = await c.query("SELECT question_text FROM questions WHERE tags @> ARRAY['ayudante_instituciones_penitenciarias']");
  const impSet = new Set(imp.rows.map(r => r.question_text.replace(/\s+/g, ' ').trim()));

  // analizar todas las scrapeadas no importadas
  const cat = { ya_importada: 0, derogada: 0, anulada: 0, editorial_sin_art: 0,
    RECUPERABLE_ley_en_bd: 0, recup_estructural: 0, ley_no_en_bd: 0, sin_articulo_en_bd: 0 };
  const recupByLaw = {};
  const leyNoBd = {};
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f)));
    for (const q of d.questions) {
      const qt = (q.question || '').replace(/\s+/g, ' ').trim();
      if (impSet.has(qt)) { cat.ya_importada++; continue; }
      if (q.isAnnulled) { cat.anulada++; continue; }
      if (q.isRepealed) { cat.derogada++; continue; }
      const title = cleanTitle(q.explanationTitle);
      if (/pregunta derogada/i.test(title)) { cat.derogada++; continue; }
      if (isStructural(title)) { cat.recup_estructural++; continue; }
      const p = parseArt(title);
      if (!p) { cat.editorial_sin_art++; continue; }
      const lawId = resolveLaw(p.rest);
      if (!lawId) { cat.ley_no_en_bd++; leyNoBd[p.rest.slice(0,30)] = (leyNoBd[p.rest.slice(0,30)]||0)+1; continue; }
      const set = artSets[lawId] || new Set();
      if (set.has(p.art) || set.has(p.base)) {
        cat.RECUPERABLE_ley_en_bd++;
        recupByLaw[p.rest.slice(0,28)] = (recupByLaw[p.rest.slice(0,28)]||0)+1;
      } else { cat.sin_articulo_en_bd++; leyNoBd['ART_FALTA:'+p.rest.slice(0,22)] = (leyNoBd['ART_FALTA:'+p.rest.slice(0,22)]||0)+1; }
    }
  }
  console.log('=== ANÁLISIS DE NO IMPORTADAS ===');
  console.log(JSON.stringify(cat, null, 2));
  console.log('\n=== 🟢 RECUPERABLES por ley (ley+art en BD) ===');
  Object.entries(recupByLaw).sort((a,b)=>b[1]-a[1]).forEach(([l,n])=>console.log('  '+String(n).padStart(3),l));
  console.log('\n=== 🔴 NO recuperables (ley no en BD / art falta) ===');
  Object.entries(leyNoBd).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([l,n])=>console.log('  '+String(n).padStart(3),l));
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
