require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const RESULTS_DIR = '/home/manuel/Documentos/github/vence/t12_galicia_results';
const files = fs.readdirSync(RESULTS_DIR).filter(f => /^batch_\d+_result\.json$/.test(f)).sort();

const consolidated = [];
const byStatus = {};
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(`${RESULTS_DIR}/${f}`));
  for (const r of arr) {
    consolidated.push(r);
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }
}

fs.writeFileSync('/home/manuel/Documentos/github/vence/t12_galicia_consolidated.json', JSON.stringify(consolidated, null, 2));

console.log('Consolidadas:', consolidated.length, 'preguntas de', files.length, 'batches');
console.log('Por status:', byStatus);

const importedIds = JSON.parse(fs.readFileSync('/home/manuel/Documentos/github/vence/t12_galicia_imported_ids.json'));
console.log('Total importadas:', importedIds.length);
const resultIds = new Set(consolidated.map(r => r.id));
const missing = importedIds.filter(id => !resultIds.has(id));
console.log('Importadas sin verificar:', missing.length);
if (missing.length && missing.length <= 20) console.log(missing);
