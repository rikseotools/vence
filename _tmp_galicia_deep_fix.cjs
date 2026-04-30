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

// Muy amplio — detecta ANY mención de ley
function mentionsLaw(text) {
  const t = text;
  const patterns = [
    /ley\s*(?:org[aá]nica\s*)?(?:de\s+)?\d+\/\d{4}/i,
    /\bley\s+org[aá]nica\b/i,
    /real decreto(?:\s+legislativo)?/i,
    /\br\.?d\.?(?:l|leg)?\.?\s*\d+\/\d{4}/i,
    /decreto\s+legislativo/i,
    /constituci[oó]n/i,
    /\bc\.?\s*e\.?\b/i,
    /estatuto.*autonom/i,
    /\btfue\b|\btue\b/i,
    /\btratado\s+de\s+(la\s+uni[oó]n|funcionamiento|lisboa)/i,
    /\blpac(?:ap)?\b/i,
    /\blrjsp\b|r[eé]gimen\s+jur[íi]dico.*sector/i,
    /\blcsp\b|contratos\s+del\s+sector\s+p[uú]blico/i,
    /\blopd(?:gdd)?\b|protecci[oó]n\s+de\s+datos/i,
    /estatuto.*trabajadores|\blet\b|\btrlet\b|\bet\b/i,
    /empleo\s+p[uú]blico/i,
    /trebep|ebep/i,
    /seguridad\s+social|\blgss\b/i,
    /prevenci[oó]n\s+de\s+riesgos|\blprl\b/i,
    /ley.*galicia|xunta\s+de\s+galicia/i,
    /subvenciones\s+de\s+galicia/i,
    /patrimonio\s+documental/i,
    /archivos?\s+(?:p[uú]blicos?|de\s+galicia)/i,
    /administraci[oó]n\s+digital/i,
    /transparencia/i,
    /libreoffice|\bwriter\b|\bcalc\b|\bimpress\b/i,
    /windows/i,
    /intranet/i,
    /discapacidad.*inclusi[oó]n/i,
    /r[eé]gimen\s+financiero/i,
    /igualdad.*efectiva|igualdad\s+entre\s+mujeres/i,
  ];
  return patterns.some(r => r.test(t));
}

function citesArticle(text) {
  return /(?:seg[uú]n|de acuerdo con|conforme a|a tenor de|a efectos de)(?:\s+lo dispuesto en)?(?:\s+el)?\s+art[íi]culos?\s+\d+/i.test(text)
      || /^[Aa]rt[íi]culo\s+\d+/.test(text.trim());
}

function ensureLawContext(text, lawFullName) {
  if (mentionsLaw(text)) return text;
  // Inyectar después del primer "Según el artículo N(.N)?"
  const patterns = [
    /((?:Seg[uú]n|De acuerdo con|Conforme a|A tenor de|A efectos de)(?:\s+lo dispuesto en)?(?:\s+el)?\s+[Aa]rt[íi]culos?\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
    /^([Aa]rt[íi]culo\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const idx = m.index + m[0].length;
      const after = text.slice(idx, idx + 25);
      if (/^\s+(del|de la ley|de la constituci|de lo)/i.test(after)) continue;
      return text.slice(0, idx) + ' de ' + lawFullName + text.slice(idx);
    }
  }
  return `${lawFullName}. ${text}`;
}

const LAW_CONTEXT = {
  'CE': 'la Constitución Española de 1978',
  'LO 1/1981': 'la Ley Orgánica 1/1981, del Estatuto de autonomía para Galicia',
  'Ley 39/2015': 'la Ley 39/2015, del Procedimiento Administrativo Común',
  'Ley 40/2015': 'la Ley 40/2015, de Régimen Jurídico del Sector Público',
  'Ley 7/2023 Galicia': 'la Ley 7/2023, para la igualdad efectiva de mujeres y hombres de Galicia',
  'Ley 2/2015 Galicia': 'la Ley 2/2015, del empleo público de Galicia',
  'Ley 16/2010': 'la Ley 16/2010, de organización y funcionamiento de la Administración general de Galicia',
  'Ley 1/2016 Galicia': 'la Ley 1/2016, de transparencia y buen gobierno de Galicia',
  'Ley 7/2014 Galicia': 'la Ley 7/2014, de archivos y documentos de Galicia',
  'Ley 4/2019 Galicia': 'la Ley 4/2019, de administración digital de Galicia',
  'DL 1/1999': 'el Decreto legislativo 1/1999, del régimen financiero y presupuestario de Galicia',
  'Ley 9/2007 Galicia': 'la Ley 9/2007, de subvenciones de Galicia',
  'Ley 9/2017': 'la Ley 9/2017, de Contratos del Sector Público',
  'RDL 1/2013': 'el Real Decreto Legislativo 1/2013, de derechos de las personas con discapacidad',
  'RDL 2/2015': 'el Real Decreto Legislativo 2/2015, del Estatuto de los Trabajadores',
  'RDL 8/2015': 'el Real Decreto Legislativo 8/2015, de la Ley General de la Seguridad Social',
  'LPRL': 'la Ley 31/1995, de Prevención de Riesgos Laborales',
  'TFUE': 'el Tratado de Funcionamiento de la Unión Europea',
  'TUE': 'el Tratado de la Unión Europea',
};

(async () => {
  // Get all Galicia topics scope → questions
  const { data: topics } = await s.from('topics').select('id').in('position_type', ['auxiliar_administrativo_galicia','administrativo_galicia']);
  const topicIds = topics.map(t => t.id);
  const { data: scopes } = await s.from('topic_scope').select('law_id, article_numbers').in('topic_id', topicIds);
  const allArtIds = new Set();
  for (const sc of scopes) {
    const { data: arts } = await s.from('articles').select('id').eq('law_id', sc.law_id).in('article_number', sc.article_numbers);
    for (const a of arts) allArtIds.add(a.id);
  }
  let qs = [];
  const artIdsArr = [...allArtIds];
  for (let i = 0; i < artIdsArr.length; i += 200) {
    const chunk = artIdsArr.slice(i, i + 200);
    const { data } = await s.from('questions').select('id, question_text, option_a, option_b, option_c, option_d, articles(laws(short_name))').in('primary_article_id', chunk).eq('is_active', true);
    if (data) qs.push(...data);
  }
  const seen = new Set();
  const unique = [];
  for (const q of qs) { if (!seen.has(q.id)) { seen.add(q.id); unique.push(q); } }
  console.log('Preguntas Galicia activas:', unique.length);

  const ambiguous = [];
  for (const q of unique) {
    if (!citesArticle(q.question_text)) continue;
    if (mentionsLaw(q.question_text)) continue;
    ambiguous.push(q);
  }
  console.log('Ambigüas reales:', ambiguous.length);

  let fixed = 0, skipped = 0;
  for (const q of ambiguous) {
    const shortName = q.articles?.laws?.short_name;
    const ctx = LAW_CONTEXT[shortName];
    if (!ctx) { console.log('  ⚠️ sin ctx:', shortName, q.id.slice(0,8)); skipped++; continue; }
    const newText = ensureLawContext(q.question_text, ctx);
    if (newText === q.question_text) { skipped++; continue; }
    const newHash = contentHash(newText, q.option_a, q.option_b, q.option_c, q.option_d);
    const { error } = await s.from('questions').update({ question_text: newText, content_hash: newHash }).eq('id', q.id);
    if (error) { console.error('  ❌', q.id.slice(0,8), error.message); skipped++; continue; }
    fixed++;
  }
  console.log('\nReparadas:', fixed, '| Skipped:', skipped);
})();
