#!/usr/bin/env node
// Guardarraíl determinista para explicaciones de preguntas (manual impugnaciones §5.1).
// Verifica MECÁNICAMENTE lo que Claude tiende a saltarse: formato por opción + saltos de
// línea (no apelotonado) + que la CITA en blockquote existe LITERAL en el artículo vinculado
// (caza citas inventadas). Exit 0 = OK; exit 1 = hay problemas (los lista).
//
// Uso: node scripts/impugnaciones/validar-explicacion.cjs <question_id> <fichero_explicacion>
//   (o pasar la explicación por stdin si no se da fichero)
const fs = require('fs');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

function validateFormat(expl, opts, correctLetter) {
  const problems = [];
  const t = expl.trim();
  // 1. arranca afirmando la clave
  if (!/^la respuesta correcta es/i.test(t)) problems.push('No empieza con "La respuesta correcta es …".');
  // 2. análisis por opción: cada opción existente debe aparecer como "**A)" … según nº de opciones
  const letters = ['A', 'B', 'C', 'D'].filter((L) => opts[L] != null && opts[L] !== '');
  const missing = letters.filter((L) => !new RegExp(`\\*\\*${L}\\)`, 'i').test(t));
  if (missing.length) problems.push(`Falta el análisis por opción de: ${missing.join(', ')} (formato "**${missing[0]}) …").`);
  // 3. no apelotonado: al menos 3 bloques separados por línea en blanco
  const blocks = t.split(/\n\s*\n/).filter((b) => b.trim());
  if (blocks.length < 3) problems.push(`Apelotonado: solo ${blocks.length} párrafo(s). Separa cada sección/opción con línea en blanco.`);
  // 4. sin secciones Truco/Consejo/Tip. "truco"/"tip" no salen en texto legal legítimo → se
  //    marcan en cualquier posición. Pero "consejo" es también un ÓRGANO omnipresente en Derecho
  //    (Consejo de Gobierno / de Ministros / de Estado / General del Poder Judicial…), así que solo
  //    se marca cuando es ETIQUETA de sección ("Consejo:" al inicio de línea), no como parte de un
  //    nombre de órgano — si no, false-positiveaba casi toda explicación legal (caso Jesse, 16/07).
  if (/\b(truco|tip)\b/i.test(t) || /(^|\n)\s*[>\-*#]*\s*\**\s*consejos?\s*:/i.test(t)) problems.push('Contiene "Truco/Consejo/Tip" (prohibido §5.1).');
  // 5. COHERENCIA clave↔explicación: la opción marcada "CORRECTA" debe ser EXACTAMENTE la clave real.
  //    Caza el error grave de una explicación que da por buena una opción distinta de correct_option.
  const marked = letters.filter((L) => new RegExp(`\\*\\*${L}\\)\\s*(?:\\*\\*)?\\s*CORRECTA`, 'i').test(t));
  if (marked.length === 0) problems.push('Ninguna opción marcada como "CORRECTA" en el análisis por opción.');
  else if (marked.length > 1) problems.push(`Varias opciones marcadas CORRECTA (${marked.join(', ')}) — solo puede haber una.`);
  else if (correctLetter && marked[0] !== correctLetter) problems.push(`La explicación marca CORRECTA la ${marked[0]}, pero la clave real (correct_option) es la ${correctLetter}. Incoherencia grave.`);
  return problems;
}

function validateQuotes(expl, articleContent) {
  const problems = [];
  const quoteLines = expl.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('>')).map((l) => l.replace(/^>+\s?/, ''));
  const quote = quoteLines.join(' ').trim();
  if (!quote) return problems; // sin cita literal → nada que verificar
  const nq = norm(quote), nc = norm(articleContent || '');
  // La cita completa (o su tramo significativo) debe existir literal en el artículo.
  const chunk = nq.length > 80 ? nq.slice(0, 80) : nq;
  if (!nc.includes(chunk)) {
    problems.push(`La cita en blockquote NO aparece literal en el artículo vinculado (posible cita inventada o de otro artículo).\n     cita: "${quote.slice(0, 90)}…"`);
  }
  return problems;
}

(async () => {
  const [qid, file] = process.argv.slice(2);
  if (!qid) { console.error('Uso: validar-explicacion.cjs <question_id> <fichero>'); process.exit(2); }
  const expl = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const [q] = await s`SELECT option_a, option_b, option_c, option_d, correct_option, a.content acontent
      FROM questions q LEFT JOIN articles a ON a.id = q.primary_article_id WHERE q.id = ${qid}`;
    if (!q) { console.error('Pregunta no encontrada:', qid); process.exit(2); }
    const opts = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option];
    const problems = [...validateFormat(expl, opts, correctLetter), ...validateQuotes(expl, q.acontent)];
    if (problems.length === 0) {
      console.log('✅ Explicación VÁLIDA (formato §5.1 + cita literal verificada).');
      process.exit(0);
    }
    console.log('❌ Explicación con PROBLEMAS:');
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    process.exit(1);
  } finally { await s.end(); }
})();
