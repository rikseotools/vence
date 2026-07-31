#!/usr/bin/env node
/**
 * scripts/vigia.cjs — avisa de lo que ENTRA, en vez de mirar cada rato a ver si hay algo.
 *
 * ## Por qué existe (29/07/2026)
 *
 * Revisar la cola "cada 20 minutos" son 72 comprobaciones al día para ~7 feedbacks: el 90 %
 * en vacío, y aun así hasta 20 minutos de retraso. Lo que hace falta no es mirar más veces,
 * es que te avisen cuando cambia algo.
 *
 * Y sobre todo: **el caso que se pierde no es el feedback nuevo, es la RÉPLICA.** Alguien
 * escribe, le respondemos, el hilo se cierra como resuelto… y la persona contesta. Ese
 * mensaje deja de aparecer en cualquier lista de "pendientes" y solo se descubre entrando a
 * mano en su ficha. Pasó el mismo 29/07 con Rocío: contestó a las 14:11 diciendo que no
 * podía acceder a la oferta y siguió esperando; se vio a las 17:40 y de casualidad.
 *
 * ## Uso
 *
 *   node scripts/vigia.cjs feedback        # una pasada: imprime novedades y sale
 *   node scripts/vigia.cjs impugnaciones
 *   node scripts/vigia.cjs feedback --loop [--cada 600]   # bucle: para un Monitor
 *
 * Cada novedad sale en UNA línea: `CLASE|id|tipo|email|plan|texto`. `NUEVO` es algo sin
 * responder; `REPLICA` es que te han contestado. Se distinguen porque no se atienden igual:
 * una réplica exige responder a lo ÚLTIMO que dijo, no repetir lo anterior.
 *
 * En modo `--loop` recuerda lo ya avisado, así que un asunto abierto no repite.
 */
const path = require('path');
const REPO = path.resolve(__dirname, '..');
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') });
const pgMod = require(path.join(REPO, 'node_modules', 'postgres'));
const postgres = pgMod.default || pgMod;

// El ORDEN de atención (bug → pre-venta → premium → baja) vive en un núcleo puro con
// tests, no aquí: un orden que solo está escrito en el manual se aplica «casi siempre».
const { ordenarCola, ETIQUETA } = require(path.join(REPO, 'lib', 'feedback', 'prioridadCola.js'));
// Quién sigue PENDIENTE (cerrar en silencio también es atender): núcleo puro con tests.
const { filtrarPendientes } = require(path.join(REPO, 'lib', 'feedback', 'pendientes.js'));

const db = () => postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

/**
 * Feedbacks: nuevos sin responder + réplicas posteriores a nuestra última respuesta.
 *
 * La consulta trae CANDIDATOS con sus fechas; quién sigue pendiente lo decide el núcleo puro
 * `lib/feedback/pendientes.js`, que está testeado. Antes el criterio vivía aquí, en SQL, y
 * tenía un agujero: una réplica atendida con **cierre en silencio** (sin escribir, que es lo
 * que se hace cuando alguien contesta «gracias») no dejaba mensaje nuestro, así que el aviso
 * reaparecía en cada pasada durante 24 h. Cerrar también es atender.
 */
async function feedback(sql) {
  const filas = await sql`
    WITH ult AS (
      SELECT c.feedback_id,
             max(m.created_at) FILTER (WHERE NOT m.is_admin) AS ult_user,
             max(m.created_at) FILTER (WHERE m.is_admin)     AS ult_admin
        FROM feedback_messages m JOIN feedback_conversations c ON c.id = m.conversation_id
       GROUP BY c.feedback_id)
    SELECT f.id, f.type, f.status, f.created_at, f.resolved_at,
           u.ult_user, u.ult_admin,
           coalesce(p.email, f.email, '?') AS email,
           coalesce(p.plan_type, '?') AS plan,
           left(replace(coalesce(
             (SELECT m2.message FROM feedback_messages m2
                JOIN feedback_conversations c2 ON c2.id = m2.conversation_id
               WHERE c2.feedback_id = f.id AND NOT m2.is_admin
               ORDER BY m2.created_at DESC LIMIT 1), f.message), chr(10), ' '), 95) AS texto
      FROM user_feedback f
      LEFT JOIN user_profiles p ON p.id = f.user_id
      LEFT JOIN ult u ON u.feedback_id = f.id
     WHERE f.created_at > NOW() - INTERVAL '60 days'
       -- Las bajas YA NO se excluyen: se atienden al final (la prioridad las manda al fondo),
       -- pero ocultarlas hacía que no existieran. Una baja sin procesar también es trabajo.
     ORDER BY f.created_at`;
  return filtrarPendientes(filas);
}

/**
 * Impugnaciones: pendientes sin resolver + APELACIONES.
 *
 * La apelación es aquí lo que la réplica en feedback: el usuario no acepta la resolución y
 * vuelve a escribir. Si nadie la mira, la impugnación figura "resuelta" y la persona sigue
 * esperando — el mismo agujero, en la otra cola.
 */
async function impugnaciones(sql) {
  return sql`
    SELECT d.id, coalesce(d.dispute_type, 'impugnacion') AS type,
           coalesce(p.email, '?') AS email, coalesce(p.plan_type, '?') AS plan,
           CASE WHEN d.appeal_submitted_at IS NOT NULL
                     AND (d.resolved_at IS NULL OR d.appeal_submitted_at > d.resolved_at)
                THEN 'REPLICA' ELSE 'NUEVO' END AS clase,
           left(replace(coalesce(d.appeal_text, d.description, ''), chr(10), ' '), 95) AS texto
      FROM question_disputes d
      LEFT JOIN user_profiles p ON p.id = d.user_id
     WHERE (d.status = 'pending' AND d.created_at > NOW() - INTERVAL '24 hours')
        OR (d.appeal_submitted_at IS NOT NULL
            AND (d.resolved_at IS NULL OR d.appeal_submitted_at > d.resolved_at)
            AND d.appeal_submitted_at > NOW() - INTERVAL '48 hours'
            -- «Usuario de acuerdo con la respuesta del administrador» lo escribe el propio
            -- sistema cuando la persona ACEPTA la resolución: es conformidad, no apelación.
            -- Sin esta guarda, el vigía avisa de gente contenta y se vuelve ruido.
            AND coalesce(d.appeal_text, '') NOT ILIKE 'Usuario de acuerdo%')
     ORDER BY d.created_at`;
}

const FUENTES = { feedback, impugnaciones };

async function pasada(nombre, vistos, sql) {
  const filas = await FUENTES[nombre](sql);
  // En feedback se atiende por PRIORIDAD, no por antigüedad: un free preguntando antes de
  // comprar va por delante de un premium (está midiendo si somos de fiar y cuánto tardamos).
  // Las réplicas conservan su prioridad de grupo; lo urgente no cambia por ser respuesta.
  const ordenadas = nombre === 'feedback'
    ? ordenarCola(filas.map((r) => ({ ...r, message: r.texto })))
    : filas.map((r) => ({ ...r, grupo: null }));
  const nuevas = [];
  for (const r of ordenadas) {
    const clave = `${r.clase}:${String(r.id).slice(0, 8)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const icono = r.clase === 'REPLICA' ? '↩️  TE HAN CONTESTADO' : '📬 NUEVO';
    const etq = r.grupo ? ` ${ETIQUETA[r.grupo]}` : '';
    nuevas.push(`${icono}${etq} ${r.clase}|${String(r.id).slice(0, 8)}|${r.type}|${r.email}|${r.plan}|${r.texto}`);
  }
  return nuevas;
}

(async () => {
  const [, , fuente, ...resto] = process.argv;
  if (!FUENTES[fuente]) {
    console.error('Uso: node scripts/vigia.cjs <feedback|impugnaciones> [--loop] [--cada <segundos>]');
    process.exit(2);
  }
  const loop = resto.includes('--loop');
  const i = resto.indexOf('--cada');
  const cada = (i >= 0 ? Number(resto[i + 1]) : 600) * 1000;

  // ── MORIR CON LA SESIÓN QUE LO LANZÓ (T-432) ──────────────────────────────────────────────
  //
  // El vigía escribe sus avisos en la SALIDA de la sesión que lo arrancó. Si esa sesión se
  // cierra, el proceso NO muere —Linux se lo entrega a init— y sigue consultando la BD,
  // detectando novedades y **contándoselas a nadie**. Medido el 31/07: dos vigías llevaban
  // 33 HORAS así, y uno de ellos duplicado.
  //
  // Peor que desperdiciar: en `--loop` recuerda lo ya avisado, así que un huérfano puede marcar
  // como visto algo **que nadie llegó a ver nunca**. La vigilancia no falla, finge funcionar.
  //
  // Se detecta sin depender de señales (varios se lanzaron con `nohup`, que las ignora a
  // propósito): si el proceso padre muere, el sistema reasigna este proceso a otro —init o el
  // reaper del usuario—, así que **el ppid CAMBIA**. Comparar contra el del arranque es exacto
  // y cuesta cero.
  const padreAlArrancar = process.ppid;
  const huerfano = () => loop && process.ppid !== padreAlArrancar;

  const sql = db();
  const vistos = new Set();
  try {
    do {
      const nuevas = await pasada(fuente, vistos, sql);
      nuevas.forEach((l) => console.log(l));
      if (huerfano()) {
        console.error(`vigia: la sesión que me lanzó (pid ${padreAlArrancar}) ya no está — salgo en vez de vigilar para nadie.`);
        break;
      }
      if (loop) await new Promise((r) => setTimeout(r, cada));
      if (huerfano()) {
        console.error(`vigia: la sesión que me lanzó (pid ${padreAlArrancar}) ya no está — salgo en vez de vigilar para nadie.`);
        break;
      }
    } while (loop);
  } finally {
    await sql.end().catch(() => {});
  }
})().catch((e) => { console.error('vigia:', e.message); process.exit(1); });
