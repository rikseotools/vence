require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function contentHash(q, a, b, c, d) {
  return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex');
}

// Ensure law context: inject "de la <lawFullName>" after first article reference
function ensureLawContext(text, lawFullName) {
  const lawWordsRegex = new RegExp(lawFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (lawWordsRegex.test(text)) return text; // ya la menciona

  // Detectar primera "Según/De acuerdo con/Conforme a/A tenor de... artículo N(.N)?" SIN "de la X"
  const patterns = [
    /((?:Seg[uú]n|De acuerdo con|Conforme a|A tenor de|A efectos de)(?:\s+lo dispuesto en)?(?:\s+el)?\s+[Aa]rt[íi]culos?\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
    /(Art[íi]culo\s+\d+(?:\.\d+)?)/, // "Artículo N" al principio
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const idx = m.index + m[0].length;
      // No insertar si lo siguiente ya es "del título" o "de la"
      const after = text.slice(idx, idx + 25);
      if (/^\s+(del|de la ley|de la constituci|de lo)/i.test(after)) continue;
      return text.slice(0, idx) + ' de la ' + lawFullName + text.slice(idx);
    }
  }
  // Fallback: prepend
  return `${lawFullName}. ${text}`;
}

// Mapeo short_name → texto a inyectar
const LAW_CONTEXT = {
  'LO 1/1981': 'Ley Orgánica 1/1981, del Estatuto de autonomía para Galicia',
  'Ley 7/2023 Galicia': 'Ley 7/2023, para la igualdad efectiva de mujeres y hombres de Galicia',
  'Ley 2/2015 Galicia': 'Ley 2/2015, del empleo público de Galicia',
  'Ley 16/2010': 'Ley 16/2010, de organización y funcionamiento de la Administración general de Galicia',
  'Ley 1/2016 Galicia': 'Ley 1/2016, de transparencia y buen gobierno de Galicia',
  'Ley 7/2014 Galicia': 'Ley 7/2014, de archivos y documentos de Galicia',
  'Ley 4/2019 Galicia': 'Ley 4/2019, de administración digital de Galicia',
  'DL 1/1999': 'Decreto legislativo 1/1999, del régimen financiero y presupuestario de Galicia',
  'Ley 9/2007 Galicia': 'Ley 9/2007, de subvenciones de Galicia',
};

(async () => {
  const audit = JSON.parse(fs.readFileSync('/tmp/galicia_cleanup_audit.json'));
  const ambiguous = audit.ambiguous;
  console.log('Ambigüas a reparar:', ambiguous.length);

  // Fetch full records for all
  const ids = ambiguous.map(a => a.id);
  const { data: qs } = await s.from('questions').select('id, question_text, option_a, option_b, option_c, option_d, articles(laws(short_name))').in('id', ids);
  const qMap = new Map(qs.map(q => [q.id, q]));

  let fixed = 0;
  let skipped = 0;
  for (const a of ambiguous) {
    const q = qMap.get(a.id);
    if (!q) { skipped++; continue; }
    const shortName = q.articles?.laws?.short_name;
    const lawFull = LAW_CONTEXT[shortName];
    if (!lawFull) {
      console.log('  ⚠️ sin contexto para ley:', shortName, '| id:', a.id.slice(0,8));
      skipped++;
      continue;
    }
    const newText = ensureLawContext(q.question_text, lawFull);
    if (newText === q.question_text) {
      console.log('  ⏭️ no modifica:', a.id.slice(0,8), '|', q.question_text.slice(0, 80));
      skipped++;
      continue;
    }
    const newHash = contentHash(newText, q.option_a, q.option_b, q.option_c, q.option_d);
    const { error } = await s.from('questions').update({
      question_text: newText,
      content_hash: newHash,
    }).eq('id', a.id);
    if (error) {
      console.error('  ❌', a.id.slice(0,8), error.message);
      skipped++;
    } else {
      fixed++;
      if (fixed <= 3) console.log('  ✅', a.id.slice(0,8), '→', newText.slice(0, 150));
    }
  }
  console.log('\nReparadas:', fixed, '| Skipped:', skipped);

  // Sanity: recount
  const { data: after } = await s.from('questions').select('id, question_text').in('id', ids);
  const citesArt = /(?:seg[uú]n|de acuerdo con|conforme a)(?:\s+lo dispuesto en)?(?:\s+el)?\s+art[íi]culos?\s+\d+/i;
  const lawMarker = /ley\s*\d+\/\d{4}|ley\s*org[aá]nica|decreto legislativo|constituci|libreoffice|windows|intranet/i;
  const stillAmbig = after.filter(q => citesArt.test(q.question_text) && !lawMarker.test(q.question_text));
  console.log('Aún ambiguas:', stillAmbig.length);
  for (const q of stillAmbig.slice(0, 5)) console.log('  ', q.id.slice(0,8), '|', q.question_text.slice(0, 130));
})();
