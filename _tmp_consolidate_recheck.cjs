const fs = require('fs');
const path = require('path');

const dir = 'galicia_t1_recheck_results';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

let all = [];
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (Array.isArray(data)) all.push(...data);
  } catch (e) {
    console.error('Error', f, e.message);
  }
}

console.log('Total archivos:', files.length);
console.log('Total resultados:', all.length);

const byStatus = {};
for (const r of all) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log('\nDistribución:');
Object.entries(byStatus).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => console.log(`  ${s}: ${c}`));

const errorStates = ['bad_answer','bad_explanation','bad_answer_and_explanation','wrong_article','wrong_article_bad_explanation','wrong_article_bad_answer','all_wrong','needs_image'];
const errors = all.filter(r => errorStates.includes(r.status));
console.log(`\nErrores: ${errors.length}`);
errors.forEach(e => {
  console.log(`\n  ${e.id} → ${e.status}`);
  console.log(`  ${e.analysis}`);
});

// Comparar con la primera pasada
const first = JSON.parse(fs.readFileSync('galicia_t1_consolidated.json', 'utf8'));
const firstById = Object.fromEntries(first.map(r => [r.id, r]));

// En la primera pasada las 17 fallaron. Ahora verificar cuáles siguen fallando
const firstErrorIds = first.filter(r => r.status !== 'perfect').map(r => r.id);
console.log(`\nPrimera pasada: ${firstErrorIds.length} errores`);
const stillErrorIds = errors.map(e => e.id);
const overlap = firstErrorIds.filter(id => stillErrorIds.includes(id));
console.log(`Persistentes (fallaron en ambas): ${overlap.length}`);
overlap.forEach(id => console.log(`  ${id}`));
const newErrors = stillErrorIds.filter(id => !firstErrorIds.includes(id));
console.log(`\nErrores nuevos (no detectados en primera pasada): ${newErrors.length}`);
newErrors.forEach(id => console.log(`  ${id}`));

fs.writeFileSync('galicia_t1_recheck_consolidated.json', JSON.stringify(all, null, 2));
fs.writeFileSync('galicia_t1_recheck_errors.json', JSON.stringify(errors, null, 2));
