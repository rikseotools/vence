// ¿Queda algún fetch de CLIENTE a un endpoint que exige sesión y que va sin Bearer? ([T-671])
// Busca la llamada y mira si en las ~6 líneas siguientes aparece `getAuthHeaders`.
const { execSync } = require('child_process');

// Los endpoints que [T-565] pasó a exigir identidad del token (commit fea6e9cb5).
const PROTEGIDOS = [
  '/api/exam/answer', '/api/exam/discard', '/api/exam/resume', '/api/exam/validate',
  '/api/exam/pending',
  '/api/psychometric/complete', '/api/psychometric/completed-sessions',
  '/api/psychometric/create', '/api/psychometric/discard', '/api/psychometric/pending',
  '/api/psychometric/resume', '/api/psychometric/review',
  '/api/random-test/user-stats', '/api/v2/official-exams/user-stats', '/api/v2/user-stats',
  '/api/tests/',
];

const salida = execSync(
  `grep -rn --include=*.tsx --include=*.ts -E "fetch\\(\\\`?['\\\`]?/api/" components app hooks contexts utils lib 2>/dev/null || true`,
  { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 },
).split('\n').filter(Boolean);

const rotos = [];
for (const linea of salida) {
  const m = linea.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  const [, fichero, num, texto] = m;
  if (fichero.includes('/api/') && fichero.endsWith('route.ts')) continue; // el servidor no se llama a sí mismo
  const endpoint = PROTEGIDOS.find((p) => texto.includes(p));
  if (!endpoint) continue;

  // ¿Hay getAuthHeaders cerca de la llamada? (mismo bloque: 8 líneas arriba/abajo)
  const desde = Math.max(1, Number(num) - 8);
  const hasta = Number(num) + 8;
  const ctx = execSync(`sed -n '${desde},${hasta}p' ${JSON.stringify(fichero)}`, { encoding: 'utf8' });
  if (!/getAuthHeaders/.test(ctx)) rotos.push({ fichero, linea: num, endpoint, codigo: texto.trim().slice(0, 70) });
}

if (!rotos.length) {
  console.log('✅ ningún fetch de cliente a endpoint protegido va sin cabeceras');
} else {
  console.log(`🔴 ${rotos.length} llamada(s) SIN Bearer a endpoints que exigen sesión:\n`);
  console.table(rotos);
}
process.exit(rotos.length ? 1 : 0);
