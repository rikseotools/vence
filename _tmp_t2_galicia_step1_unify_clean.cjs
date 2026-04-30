// Step 1: Unify + clean + parseQuestion (extract hints)
const fs = require('fs');
const path = require('path');

const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/';
const FILES = [
  { lib: '67', dir: 'libro-67-test-interactivo-83-auxiliar-administrativo-c2-xunta-de-gali' },
  { lib: '72', dir: 'libro-72-test-interactivo-74-administrativo-c1-xunta-de-galicia-ed-20' },
];

const KEEP_PATTERNS = [
  /indica.*respuesta/i, /indica.*opci/i, /marca.*incorrecta/i, /marca.*correcta/i,
  /señala.*incorrecta/i, /señala.*correcta/i, /elige.*correcta/i, /elige.*incorrecta/i,
  /todas son/i, /ninguna es/i, /cuál es correcta/i, /cuál es incorrecta/i,
  /cuál no es/i, /cuál sí es/i, /es falsa/i, /es verdadera/i, /es incorrecta/i, /es correcta/i,
  /^#/, /fecha actual/i, /número total de/i,
];

function cleanQuestion(text) {
  if (!text) return text;
  const m = text.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return text.trim();
  const inside = m[2];
  if (KEEP_PATTERNS.some(p => p.test(inside))) return text.trim();
  return cleanQuestion(m[1].trim());
}

function parseQuestion(raw) {
  const m = raw.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { question: raw.trim(), lawHint: null, articleHint: null };
  const inside = m[2];
  if (KEEP_PATTERNS.some(p => p.test(inside))) return { question: raw.trim(), lawHint: null, articleHint: null };
  const isLaw = /ley|decreto|real decreto|orgánica|\d+\/\d{4}/i.test(inside);
  const isArt = /art[íi]culos?\s+\d+|^art\.?\s+\d+/i.test(inside);
  return {
    question: cleanQuestion(raw),
    lawHint: isLaw ? inside : null,
    articleHint: isArt ? inside : null,
  };
}

let all = [];
for (const { lib, dir } of FILES) {
  const folder = SRC + dir;
  const f = fs.readdirSync(folder).find(x => x.startsWith('Tema_2.'));
  const data = JSON.parse(fs.readFileSync(path.join(folder, f)));
  console.log(`libro-${lib}: ${data.questions.length} preguntas`);
  for (const q of data.questions) {
    const parsed = parseQuestion(q.question);
    all.push({
      original: q.question,
      cleaned: parsed.question,
      lawHint: parsed.lawHint,
      articleHint: parsed.articleHint,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      source_book: `libro-${lib}`,
    });
  }
}

console.log(`\nTotal unificado: ${all.length}`);

// Stats
const withHint = all.filter(q => q.lawHint || q.articleHint).length;
const cleaned = all.filter(q => q.original !== q.cleaned).length;
console.log(`Con lawHint/articleHint: ${withHint}`);
console.log(`Enunciados modificados por limpieza: ${cleaned}`);

fs.writeFileSync('t2_galicia_step1_unified.json', JSON.stringify(all, null, 2));
console.log('Escrito: t2_galicia_step1_unified.json');
