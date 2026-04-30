const fs = require('fs');
const path = require('path');

const dir = 'galicia_t1_results';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

let all = [];
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (Array.isArray(data)) all.push(...data);
    else console.error('No es array:', f);
  } catch (e) {
    console.error('Error parseando', f, e.message);
  }
}

console.log('Total resultados consolidados:', all.length);

const byStatus = {};
for (const r of all) {
  byStatus[r.status] = (byStatus[r.status] || 0) + 1;
}
console.log('\nDistribución por status:');
Object.entries(byStatus).sort((a,b) => b[1]-a[1]).forEach(([s, c]) => {
  console.log(`  ${s}: ${c}`);
});

const errorStates = ['bad_answer','bad_explanation','bad_answer_and_explanation','wrong_article','wrong_article_bad_explanation','wrong_article_bad_answer','all_wrong','needs_image'];
const errors = all.filter(r => errorStates.includes(r.status));
console.log(`\nTotal con errores: ${errors.length}`);

fs.writeFileSync('galicia_t1_consolidated.json', JSON.stringify(all, null, 2));
fs.writeFileSync('galicia_t1_errors_only.json', JSON.stringify(errors, null, 2));

console.log('\nDetalle de errores:');
errors.forEach((e, i) => {
  console.log(`\n[${i+1}] id=${e.id}`);
  console.log(`    status: ${e.status}`);
  console.log(`    analysis: ${e.analysis}`);
  if (e.correct_option_should_be) console.log(`    → respuesta correcta: ${e.correct_option_should_be}`);
  if (e.correct_article_suggestion) console.log(`    → artículo correcto: ${e.correct_article_suggestion}`);
  if (e.explanation_fix) console.log(`    → explanation_fix: ${String(e.explanation_fix).slice(0, 150)}...`);
});
