// ¿Dónde vive el trabajo de cada tarea revisada, y qué falta por traer a main?
// Para cada id: busca commits que la DECLAREN (asunto) en cualquier rama remota, y separa los que
// ya están en main de los que no.
const { execSync } = require('child_process');

const IDS = process.argv.slice(2);
const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();

const ramas = sh('git branch -r --format="%(refname:short)"')
  .split('\n')
  .filter((r) => r && !r.includes('->') && r !== 'origin/main');

for (const id of IDS) {
  // Commits que DECLARAN la tarea (la citan en el asunto), en cualquier rama.
  const lineas = sh(`git log --all --format='%H|%h|%s' --grep='${id}' || true`)
    .split('\n').filter(Boolean)
    .map((l) => { const [sha, corto, asunto] = l.split('|'); return { sha, corto, asunto }; })
    // Solo los que la declaran de verdad: el id en el asunto, no citada de pasada en el cuerpo.
    .filter((c) => new RegExp(`\\b${id}\\b`).test(c.asunto));

  const fuera = lineas.filter((c) => {
    try { sh(`git merge-base --is-ancestor ${c.sha} origin/main`); return false; } catch { return true; }
  });

  console.log(`\n══ ${id} — ${lineas.length} commit(s) que la declaran, ${fuera.length} FUERA de main`);
  for (const c of fuera) {
    const dónde = ramas.filter((r) => {
      try { sh(`git merge-base --is-ancestor ${c.sha} ${r}`); return true; } catch { return false; }
    });
    const stat = sh(`git show --stat --format='' ${c.sha} | tail -1`);
    console.log(`   · ${c.corto} ${c.asunto.slice(0, 68)}`);
    console.log(`     ramas: ${dónde.slice(0, 3).join(', ') || '(ninguna remota)'}`);
    console.log(`     ${stat}`);
  }
  if (!fuera.length && lineas.length) console.log('   ✅ todo su trabajo YA está en main — solo falta cerrarla');
  if (!lineas.length) console.log('   ⚠️ ningún commit la declara en el asunto');
}
