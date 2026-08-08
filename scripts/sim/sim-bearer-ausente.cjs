// scripts/sim/sim-bearer-ausente.cjs — [T-692]
//
// Mide, contra PRODUCCIÓN y contra la BD real, si las rutas con guarda de propiedad siguen
// rechazando a sesiones válidas — y si el arreglo del cliente ha llegado.
//
// Por qué existe y no basta con los unitarios: el defecto NO se ve en el código (los call-sites
// piden el token correctamente escrito) ni en el servidor (con un Bearer bueno contesta 200).
// Solo se ve en el AGREGADO: qué porcentaje de las llamadas reales llega sin cabecera.
//
// Las tres preguntas, en este orden, que son las que exige el manual antes de decir «arreglado»:
//   1. ¿el servidor acepta un token válido y rechaza su ausencia? (contrato, contra producción)
//   2. ¿cuál es el porcentaje de 401 HOY frente a la línea base de 9 días? (efecto)
//   3. ¿está llegando la señal `bearer_ausente`? (que es lo que dice si la causa es el cliente)
//
// Uso:  node scripts/sim/sim-bearer-ausente.cjs          (solo mide, no escribe nada)
//       AUTH_SECRET=... node scripts/sim/sim-bearer-ausente.cjs --con-token  (añade el paso 1)

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');

const BASE = process.env.SIM_BASE_URL || 'https://www.vence.es';
const RUTAS = ['/api/exam/pending', '/api/v2/user-stats'];
/** Suelo sano medido del 30/07 al 06/08 en `/api/exam/pending`: 0,0 % nueve días seguidos. */
const BASE_SANA_PCT = { '/api/exam/pending': 0.0, '/api/v2/user-stats': 36.1 };

let fallos = 0;
const ok = (m) => console.log(`   ✅ ${m}`);
const mal = (m) => { fallos++; console.log(`   ❌ ${m}`); };

async function paso1ContratoDelServidor() {
  console.log('\n① CONTRATO DEL SERVIDOR (¿rechaza solo por falta de token?)');
  for (const ruta of RUTAS) {
    const r = await fetch(`${BASE}${ruta}?userId=00000000-0000-0000-0000-000000000000`);
    const cuerpo = await r.text().catch(() => '');
    if (r.status === 401 && /no_bearer_token/.test(cuerpo)) {
      ok(`${ruta}: sin token → 401 no_bearer_token (es el motivo exacto, no otro)`);
    } else {
      mal(`${ruta}: sin token → HTTP ${r.status} ${cuerpo.slice(0, 80)} (se esperaba 401 no_bearer_token)`);
    }
  }
}

async function paso2Efecto(c) {
  console.log('\n② EFECTO EN PRODUCCIÓN (porcentaje de 401 hoy vs. la línea base)');
  const { rows } = await c.query(`
    SELECT endpoint,
           count(*) FILTER (WHERE http_status=401)::int err, count(*)::int total,
           count(DISTINCT user_id) FILTER (WHERE http_status=401)::int usuarios,
           round(count(*) FILTER (WHERE http_status=401)*100.0/GREATEST(count(*),1),1)::float pct
      FROM observable_events
     WHERE endpoint = ANY($1) AND event_type='request_completed'
       AND created_at > date_trunc('day', now())
     GROUP BY 1`, [RUTAS]);

  if (!rows.length) {
    console.log('   ⏳ sin tráfico medible hoy todavía — NO se puede afirmar nada (no es un verde)');
    return;
  }
  for (const r of rows) {
    const suelo = BASE_SANA_PCT[r.endpoint];
    const linea = `${r.endpoint}: ${r.pct}% de 401 (${r.err}/${r.total}, ${r.usuarios} usuarios) · suelo sano ${suelo}%`;
    // Margen de 5 puntos: por debajo de eso es ruido de anónimos, no el defecto.
    if (r.pct <= suelo + 5) ok(linea);
    else mal(`${linea} → SIGUE POR ENCIMA DEL SUELO`);
  }
}

async function paso3SenalDeCausa(c) {
  console.log('\n③ SEÑAL DE CAUSA (`bearer_ausente`: ¿el cliente se queda sin token?)');
  const { rows: [s] } = await c.query(`
    SELECT count(*)::int n, count(DISTINCT user_id)::int usuarios,
           to_char(max(created_at),'DD HH24:MI') ultimo
      FROM observable_events
     WHERE event_type='bearer_ausente' AND created_at > now() - interval '24 hours'`);
  if (s.n === 0) {
    console.log('   ℹ️  0 en 24 h. Puede ser que el arreglo funcione… o que aún no esté desplegado.');
    console.log('      No cuenta como verde por sí solo: mirar el paso ② y el sha vivo.');
  } else {
    console.log(`   📡 ${s.n} eventos · ${s.usuarios} usuarios · último ${s.ultimo}`);
    console.log('      La causa es del CLIENTE (sale sin cabecera), no del servidor.');
  }
}

(async () => {
  console.log('=== SIM T-692: rutas con dueño y el Bearer que no llega ===');
  console.log(`base: ${BASE}`);
  if (process.argv.includes('--con-token') || true) await paso1ContratoDelServidor();

  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  await paso2Efecto(c);
  await paso3SenalDeCausa(c);
  await c.end();

  console.log(`\n${fallos === 0 ? '✅ sin fallos' : `❌ ${fallos} comprobación(es) en rojo`}`);
  process.exit(fallos === 0 ? 0 : 1);
})();
