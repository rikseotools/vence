// Helpers de limpieza para import — basados en el manual
// docs/scraping/tutestdigital-api-manual.md

const crypto = require('crypto');

// === Paso 1: basura inline (sin paréntesis) ===
const INLINE_JUNK_PATTERNS = [
  /\s+TEST\s+(?:LEY|REAL DECRETO|LEY ORG[AÁ]NICA|ESTATUTO|DECRETO|RDL|TRATADO|DERECHO EUROPEO|DERECHO DE LA)\b[^\n]*$/i,
  /\s+TEST\s+\d+\s+[^\n]*$/i,
  /\s+TEMARIO\s+(?:OFICIAL|ADMINISTRATIVO|AUXILIAR)[^\n]*$/i,
  /\s+\(D\.V\.\)\s*$/i,
];
function stripInlineJunk(text) {
  let t = text;
  for (const p of INLINE_JUNK_PATTERNS) t = t.replace(p, '');
  return t.trim();
}

// === Paso 2: coletillas entre paréntesis ===
const KEEP_PATTERNS = [/indica.*respuesta/i,/indica.*opci/i,/marca.*incorrecta/i,/marca.*correcta/i,/señala.*incorrecta/i,/señala.*correcta/i,/elige.*correcta/i,/elige.*incorrecta/i,/todas son/i,/ninguna es/i,/cuál es correcta/i,/cuál es incorrecta/i,/cuál no es/i,/cuál sí es/i,/es falsa/i,/es verdadera/i,/es incorrecta/i,/es correcta/i,/^#/,/fecha actual/i,/número total de/i];

function cleanQuestion(text) {
  if (!text) return text;
  const m = text.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return text.trim();
  if (KEEP_PATTERNS.some(p => p.test(m[2]))) return text.trim();
  return cleanQuestion(m[1].trim());
}

function parseQuestion(raw) {
  const m = raw.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { question: raw.trim(), articleHint: null };
  const inside = m[2];
  if (KEEP_PATTERNS.some(p => p.test(inside))) return { question: raw.trim(), articleHint: null };
  const isArt = /art[íi]culos?\s+\d+|^art\.?\s+\d+/i.test(inside);
  return { question: cleanQuestion(raw), articleHint: isArt ? inside : null };
}

// === Paso 3: contextualización de ley ===
function ensureLawContext(text, lawFullName, alreadyMentionsRegex = null) {
  const mentionsLawRegex = alreadyMentionsRegex || new RegExp(lawFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (mentionsLawRegex.test(text)) return { text, needs_manual_rewrite: false };

  // Contracción: lawFullName puede empezar con "el", "la", "los", "las"
  let prep;
  if (lawFullName.startsWith('el ')) prep = 'del ' + lawFullName.slice(3);
  else if (lawFullName.startsWith('la ')) prep = 'de ' + lawFullName;
  else if (lawFullName.startsWith('los ')) prep = 'de ' + lawFullName;
  else if (lawFullName.startsWith('las ')) prep = 'de ' + lawFullName;
  else prep = 'de ' + lawFullName;

  // Buscar punto de inyección
  const patterns = [
    /((?:Seg[uú]n|De acuerdo con|Conforme a|A tenor de|A efectos de)(?:\s+lo dispuesto en)?(?:\s+el)?\s+[Aa]rt[íi]culos?\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
    /^([Aa]rt[íi]culo\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const idx = m.index + m[0].length;
      const after = text.slice(idx, idx + 25);
      if (/^\s+(del|de la|de los|de las|de lo)/i.test(after)) continue;
      return { text: text.slice(0, idx) + ' ' + prep + text.slice(idx), needs_manual_rewrite: false };
    }
  }
  return { text, needs_manual_rewrite: true };
}

// Reformular pregunta que necesita contexto con artículo conocido
function reformulateWithArticle(text, articleNumber, lawFullName) {
  let prep;
  if (lawFullName.startsWith('el ')) prep = 'del ' + lawFullName.slice(3);
  else if (lawFullName.startsWith('la ')) prep = 'de ' + lawFullName;
  else if (lawFullName.startsWith('los ')) prep = 'de ' + lawFullName;
  else if (lawFullName.startsWith('las ')) prep = 'de ' + lawFullName;
  else prep = 'de ' + lawFullName;
  return `Según el artículo ${articleNumber} ${prep}, ${text.charAt(0).toLowerCase() + text.slice(1)}`;
}

// === Utilidades ===
function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function shuffleKey(q, opts) { return normalize(q) + '###' + opts.map(o => normalize(o.text || '')).sort().join('|||'); }
function contentHash(q, a, b, c, d) { return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex'); }
function extractArt(text) { const m = (text || '').match(/art[íi]culos?\s+(\d+)/i); return m ? m[1] : null; }

// === Didactic check (manual §8.1) ===
function isDidactic(explanation) {
  if (!explanation) return false;
  const hasMarkdown    = /\*\*[^*]+\*\*/.test(explanation);
  const hasBlockquote  = /^>\s|\n>\s/.test(explanation);
  // Acepta ambos formatos: "Por qué B es correcta" y "Por qué B) es correcta"
  const hasPorQue      = /Por qué [A-D]\)?\s+es correcta/i.test(explanation);
  const hasDemas       = /Por qué las demás son incorrectas/i.test(explanation);
  return hasMarkdown && hasBlockquote && hasPorQue && hasDemas;
}

module.exports = {
  stripInlineJunk,
  cleanQuestion,
  parseQuestion,
  ensureLawContext,
  reformulateWithArticle,
  normalize,
  shuffleKey,
  contentHash,
  extractArt,
  isDidactic,
  KEEP_PATTERNS,
};
