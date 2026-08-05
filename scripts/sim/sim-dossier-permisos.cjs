#!/usr/bin/env node
/**
 * T-578 — ¿puede un trabajador de la flota saber de qué oposición es quien impugna,
 * SIN que se le abra `user_profiles`?
 *
 * Aplica la migración DENTRO de una transacción, la prueba con los roles reales
 * (`SET ROLE`) y hace ROLLBACK siempre. No deja nada escrito: sirve para decidir
 * ANTES de aplicar en producción, y para volver a comprobarlo después.
 *
 * Cada permiso concedido se empareja con su CONTRASTE: no basta con ver que el rol
 * puede leer lo que necesita, hay que ver que sigue sin poder leer lo que no debe.
 */
const R = '/home/manuel/Documentos/github/vence/';
require(R + 'node_modules/dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require(R + 'node_modules/pg');
const { pgConfig } = require(R + 'lib/db/pgSsl.cjs');

const MIGRACION = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260805_flota_contexto_impugnacion.sql');
const ROLES = ['vence_lector', 'vence_coordinacion'];
const APLICAR = process.argv.includes('--aplicar');

let ok = 0, fallos = 0;
/** Un error de permiso ABORTA la transacción entera, así que toda consulta que pueda
 *  fallar va envuelta en su propio SAVEPOINT: si cae, se deshace solo ese trozo. */
const intento = async (c, sqlText) => {
  await c.query('SAVEPOINT sp');
  try { const r = await c.query(sqlText); await c.query('RELEASE SAVEPOINT sp'); return { rows: r.rows }; }
  catch (e) { await c.query('ROLLBACK TO SAVEPOINT sp'); return { code: e.code, message: e.message }; }
};
const check = (nombre, cumple, detalle) => {
  console.log(`   ${cumple ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  cumple ? ok++ : fallos++;
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const sql = fs.readFileSync(MIGRACION, 'utf8');

  console.log(`\n=== T-578 · ${APLICAR ? 'APLICANDO DE VERDAD' : 'simulación (ROLLBACK al final)'} ===\n`);

  await c.query('BEGIN');
  try {
    console.log('ANTES de la migración:');
    for (const rol of ROLES) {
      await c.query(`SET LOCAL ROLE ${rol}`);
      const antes = await intento(c, 'SELECT reporter_oposicion FROM public.flota_dispute_contexto LIMIT 1');
      await c.query('RESET ROLE');
      // Idempotente a propósito: una vez aplicada, la vista EXISTE y esto deja de ser un
      // fallo — el script tiene que seguir sirviendo para RE-verificar en cualquier momento,
      // no solo la primera vez. Si aún no existe, se registra que el defecto era real.
      if (antes.code === '42P01') check(`${rol}: la vista aún no existía (defecto reproducido)`, true, 'código 42P01');
      else if (antes.code === '42501') check(`${rol}: la vista existe pero este rol no la lee`, false, 'falta el GRANT');
      else console.log(`   ℹ️  ${rol}: la vista ya está aplicada — se comprueba que sigue bien`);
    }

    await c.query(sql);
    console.log('\nDESPUÉS de la migración:');

    for (const rol of ROLES) {
      await c.query(`SET LOCAL ROLE ${rol}`);
      // 1) lo que SÍ tiene que poder: la oposición de quien impugna.
      const res = await intento(c, `SELECT dispute_id, reporter_oposicion, reporter_plan FROM public.flota_dispute_contexto WHERE reporter_oposicion IS NOT NULL LIMIT 3`);
      const filas = res.rows;
      check(`${rol}: lee la vista y ve la oposición de quien reclama`, !!filas && filas.length > 0, res.message || (filas ? `${filas.length} filas, p.ej. ${filas[0]?.reporter_oposicion}` : ''));

      // 2) los CONTRASTES: lo que debe seguir cerrado.
      const em = await intento(c, 'SELECT email FROM public.user_profiles LIMIT 1');
      check(`${rol}: sigue SIN poder leer user_profiles (email incluido)`, em.code === '42501', em.code ? `código ${em.code}` : '¡PUEDE LEERLA! la migración abre de más');

      const cols = await c.query(`SELECT string_agg(column_name, ',' ORDER BY ordinal_position) c FROM information_schema.columns WHERE table_name='flota_dispute_contexto'`);
      const expuestas = cols.rows[0].c || '';
      check(`${rol}: la vista no expone email, nombre ni telefono`, !/email|name|phone|telefono|dni/i.test(expuestas), expuestas);
      // Contraste 3: la vista ANTIGUA sigue siendo ilegible — no se ha tocado su blindaje.
      const vieja = await intento(c, 'SELECT reporter_name FROM public.admin_disputes_dashboard LIMIT 1');
      check(`${rol}: admin_disputes_dashboard sigue blindada (security_invoker intacto)`, vieja.code === '42501', vieja.code ? `código ${vieja.code}` : '¡la lee! se ha tocado lo que no se debía');
      // El caso REAL que falló: la impugnación f34b88ad. Un trabajador no pudo leer la
      // oposición de quien la escribió, la dedujo de los tags y se equivocó (T-582). Esta es
      // la MISMA consulta que hace ahora el fallback del dossier: si devuelve la oposición
      // correcta, ese error concreto ya no puede repetirse.
      const caso = await intento(c, `SELECT reporter_oposicion FROM public.flota_dispute_contexto WHERE dispute_id = 'f34b88ad-1519-46fe-aea4-460dcf60845b'`);
      const acierta = caso.rows && caso.rows[0]?.reporter_oposicion === 'auxiliar_administrativo_diputacion_cordoba';
      check(`${rol}: en el caso f34b88ad (T-582) SÍ habría acertado la oposición`, acierta, caso.rows?.[0]?.reporter_oposicion || caso.message);
      await c.query('RESET ROLE');
    }

    if (APLICAR) { await c.query('COMMIT'); console.log('\n💾 COMMIT — aplicado en producción.'); }
    else { await c.query('ROLLBACK'); console.log('\n↩️  ROLLBACK — la BD queda como estaba.'); }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\n❌ error, ROLLBACK:', e.message);
    fallos++;
  }
  await c.end();
  console.log(`\n${fallos === 0 ? '✅' : '❌'} ${ok} comprobaciones OK, ${fallos} fallo(s)\n`);
  process.exit(fallos === 0 ? 0 : 1);
})();
