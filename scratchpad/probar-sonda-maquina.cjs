// Prueba la sonda REAL de medirMaquina contra flota-1, con el mismo citado que usa el supervisor.
const { execFileSync } = require('child_process');
const SALUD = require('../lib/flota/saludMaquina.cjs');

const citar = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

const orden = [
  "awk '/MemTotal|MemAvailable|SwapTotal/{printf \"%s %d\\n\", $1, $2}' /proc/meminfo",
  "awk '{print \"load1\", $1}' /proc/loadavg",
  "printf 'nucleos %s\\n' $(nproc)",
  "awk '/^cpu /{idle=$5; tot=0; for(i=2;i<=NF;i++) tot+=$i; printf \"idlepct %d\\n\", (idle*100)/tot}' /proc/stat",
  "ps -eo comm=,rss= | awk '$1==\"node\" && $2>512000 {n++} END{printf \"builds %d\\n\", n+0}'",
  "printf 'espera_io %s\\n' \"$(ps -eo stat --no-headers | grep -c '^D' || echo 0)\"",
].join('; ');

const salida = execFileSync('ssh', [
  '-i', '/home/manuel/.ssh/koigrid_runner', '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=15',
  'root@167.233.249.187', `sh -c ${citar(orden)}`,
], { encoding: 'utf8' });

console.log('── SALIDA DE LA SONDA ──');
console.log(salida.trim());

const num = (clave) => {
  const m = new RegExp(`${clave}[: ]+(\\d+)`).exec(salida);
  return m ? Number(m[1]) : null;
};
const kbAMb = (kb) => (kb == null ? null : Math.round(kb / 1024));
const load1Match = /load1 ([\d.]+)/.exec(salida);

const medida = {
  memTotalMb: kbAMb(num('MemTotal')),
  memDisponibleMb: kbAMb(num('MemAvailable')),
  swapTotalMb: kbAMb(num('SwapTotal')) ?? 0,
  load1: load1Match ? Number(load1Match[1]) : 0,
  nucleos: num('nucleos') || 1,
  cpuOciosaPct: num('idlepct') ?? 100,
  buildsNode: num('builds') ?? 0,
  turnosEnEsperaIo: num('espera_io') ?? null,
};

console.log('\n── PARSEADO ──');
console.log(JSON.stringify(medida, null, 2));

const faltan = Object.entries(medida).filter(([, v]) => v == null).map(([k]) => k);
if (faltan.length) { console.error('\n❌ campos sin leer:', faltan.join(', ')); process.exit(1); }

const v = SALUD.clasificarMaquina(medida);
console.log('\n── VEREDICTO ──');
console.log(`estado: ${v.estado}`);
v.motivos.forEach((m) => console.log('  ·', m));
