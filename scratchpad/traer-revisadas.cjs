// Trae a main el trabajo YA REVISADO EN VERDE, commit a commit (los que leyó el revisor).
//
// Cherry-pick y no merge de la rama entera: las ramas de trabajador arrastran historia ajena sin
// revisar (T-206 y T-232 tienen 4-6 commits con merges de «recuperar…» que duplican el mismo fix).
// Lo revisado es UN diff concreto; es eso lo que se trae.
//
// Los choques en `docs/roadmap/tareas-pendientes.md` se resuelven conservando LOS DOS lados, que es
// la regla de la casa (ese fichero lo tocan todas las sesiones y quedarse con un lado borra trabajo
// ajeno en silencio). Cualquier otro choque PARA la ejecución: un conflicto de código lo mira una
// persona.
const { execSync } = require('child_process');

const PLAN = [
  ['T-214', ['d530c82a0']],
  ['T-298', ['2e06cb2e7']],
  ['T-161', ['b87441fca', '1eae81b56']],
  ['T-163', ['4d0723fcd']],
  ['T-206', ['85a241f98']],
  ['T-223', ['fe764d247']],
  ['T-237', ['37ebb9ac9']],
  ['T-208', ['be5de6c70']],
  ['T-232', ['d9693bcbb']],
];

// maxBuffer generoso a propósito: cada cherry-pick dispara el hook de pre-commit, que corre tests
// y escupe ~1 MB. Con el buffer por defecto el script moría ANTES de aplicar nada — y el fallo
// parecía un choque de git. No se desactivan los hooks: las validaciones se quedan.
const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
const BACKLOG = 'docs/roadmap/tareas-pendientes.md';

function conflictos() {
  return sh('git diff --name-only --diff-filter=U || true').split('\n').filter(Boolean);
}

/** Quita las tres líneas marcadoras y deja los dos lados. */
function resolverBacklog() {
  const fs = require('fs');
  const ls = fs.readFileSync(BACKLOG, 'utf8').split('\n');
  const fuera = ls.map((l, i) => (/^(<{7}|={7}|>{7})/.test(l) ? i : -1)).filter((i) => i >= 0);
  fs.writeFileSync(BACKLOG, ls.filter((_, i) => !fuera.includes(i)).join('\n'));
  return fuera.length;
}

const hechas = [];
for (const [id, shas] of PLAN) {
  for (const sha of shas) {
    try {
      sh(`git cherry-pick -x ${sha}`);
      console.log(`✅ ${id} ${sha} traído`);
    } catch {
      const ch = conflictos();
      const soloBacklog = ch.length > 0 && ch.every((f) => f === BACKLOG);
      if (!soloBacklog) {
        console.log(`\n🛑 ${id} ${sha}: choque en CÓDIGO — ${ch.join(', ') || '(sin ficheros en conflicto: mira el estado)'}`);
        console.log('   Se para aquí a propósito. Resolver a mano y continuar:');
        console.log('     git cherry-pick --continue   (o --abort)');
        process.exit(2);
      }
      const n = resolverBacklog();
      sh(`git add ${BACKLOG}`);
      sh("git -c core.editor=true cherry-pick --continue");
      console.log(`✅ ${id} ${sha} traído (choque de backlog resuelto conservando los dos lados, ${n} marcadores)`);
    }
  }
  hechas.push(id);
}
console.log(`\n${hechas.length}/9 tareas traídas: ${hechas.join(', ')}`);
