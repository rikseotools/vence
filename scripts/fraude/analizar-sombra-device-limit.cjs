#!/usr/bin/env node
/**
 * scripts/fraude/analizar-sombra-device-limit.cjs — SOLO LEE. No bloquea, no escribe, no activa.
 *
 * Responde a la única pregunta que decide si el límite por dispositivo se enciende:
 * **¿a quién habríamos cortado el servicio, y se lo merecía?**
 *
 * Se ejecuta tras 1-2 días con `DEVICE_LIMIT_MODE=shadow` en producción. En sombra, el enforcement
 * evalúa y registra (`device_daily_limit_blocked` con `mode:'shadow'`) pero **nadie se bloquea**,
 * así que estos datos son el ensayo real sin coste para el usuario.
 *
 * Por qué hace falta mirarlo caso por caso y no solo el total: el ancla nueva (huella de hardware)
 * agrupa cuentas que antes no se agrupaban. Es lo que se busca, y también el riesgo — la huella v1
 * llegó a juntar 83 cuentas bajo un valor por un hash corto. Un número agregado no distingue "tres
 * cuentas del mismo nombre" de "dos personas con el mismo modelo de móvil".
 *
 * Uso:  node scripts/fraude/analizar-sombra-device-limit.cjs [--dias 2]
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const argv = process.argv.slice(2);
const i = argv.indexOf('--dias');
const DIAS = i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : 2;

(async () => {
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1, prepare: false, ssl: { rejectUnauthorized: false },
  });

  const eventos = await sql`
    SELECT user_id,
           count(*)::int AS veces,
           max((metadata->>'deviceTotal')::int) AS peor_total,
           (array_agg(DISTINCT metadata->>'anchor'))[1:3] AS anclas,
           bool_or(metadata->>'mode' = 'enforce') AS alguno_real,
           max(ts) AS ultima
      FROM observable_events
     WHERE event_type = 'device_daily_limit_blocked'
       AND ts >= NOW() - ${`${DIAS} days`}::interval
     GROUP BY user_id
     ORDER BY 2 DESC`;

  if (!eventos.length) {
    console.log(`\nSin ningún registro en ${DIAS} días.\n`);
    console.log('Eso NO significa que no haya farmeo: puede que la huella v2 aún no esté llegando.');
    console.log('Comprobar la cobertura antes de sacar conclusiones:');
    const cob = await sql`
      SELECT count(*) FILTER (WHERE hw_fingerprint LIKE 'fp2\\_%')::int AS v2,
             count(*)::int AS total FROM user_devices`;
    console.log(`   huellas v2 registradas: ${cob[0].v2} de ${cob[0].total} filas`);
    console.log('   si v2 es ~0, el cliente no la está mandando (revisar getFingerprintHeader).\n');
    await sql.end();
    return;
  }

  console.log(`\n=== A QUIÉN HABRÍAMOS CORTADO (${DIAS} días, modo sombra) ===\n`);
  console.log(`${eventos.length} usuarios distintos afectados\n`);

  // Para cada uno, el contexto que permite decidir si es granja o persona legítima.
  for (const e of eventos) {
    const [perfil] = await sql`
      SELECT email, plan_type, created_at::date AS alta FROM user_profiles WHERE id = ${e.user_id}`;
    const [act] = await sql`
      SELECT count(*)::int AS respuestas, count(DISTINCT (created_at AT TIME ZONE 'Europe/Madrid')::date)::int AS dias
        FROM test_questions WHERE user_id = ${e.user_id} AND created_at >= NOW() - INTERVAL '30 days'`;
    // Las OTRAS cuentas del mismo equipo: el dato que distingue una granja de una coincidencia.
    const vecinos = await sql`
      SELECT DISTINCT p.email
        FROM user_devices a
        JOIN user_devices b
          ON (b.hw_fingerprint = a.hw_fingerprint AND a.hw_fingerprint LIKE 'fp2\\_%')
          OR b.device_id = a.device_id
        JOIN user_profiles p ON p.id = b.user_id
       WHERE a.user_id = ${e.user_id} AND b.user_id <> ${e.user_id}
       LIMIT 8`;

    console.log(`· ${perfil?.email ?? e.user_id}  [${perfil?.plan_type ?? '?'}, alta ${perfil?.alta?.toISOString?.().slice(0, 10) ?? '?'}]`);
    console.log(`    ${e.veces} veces · peor día ${e.peor_total} preguntas en el equipo · ancla: ${(e.anclas || []).join(',')}`);
    console.log(`    su actividad real: ${act?.respuestas ?? 0} respuestas en ${act?.dias ?? 0} días distintos`);
    console.log(`    comparte equipo con: ${vecinos.length ? vecinos.map((v) => v.email).join(', ') : '(nadie — REVISAR: si está solo, no debería haberse bloqueado)'}`);
    console.log('');
  }

  console.log('=== CÓMO LEERLO ===');
  console.log('  · Correos que son variantes del mismo nombre + altas escalonadas → granja: activar.');
  console.log('  · Correos sin relación, con actividad repartida en muchos días → posible familia:');
  console.log('    NO activar sin mirar ese caso a fondo.');
  console.log('  · "comparte equipo con: (nadie)" → la huella está agrupando mal: NO activar.\n');
  console.log('Para activar (solo con los datos delante):  DEVICE_LIMIT_MODE=enforce  + redeploy');
  console.log('Para apagarlo del todo:                      DEVICE_LIMIT_MODE=off\n');

  await sql.end();
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
