#!/usr/bin/env node
// Dossier estructurado de un FEEDBACK (manual gestionar-feedback-bug.md, Paso 0 + Paso 3).
// GEMELO de revisar-impugnacion.cjs, pero para la cola de feedback.
//
// POR QUÉ EXISTE (incidente 21/07): al analizar un feedback a mano, es fácil leer solo el
// PRIMER mensaje y NO ver que el usuario ya respondió (o que ya se le contestó) → se
// re-envía una respuesta y se DUPLICA el mensaje al usuario (le pasó a Lú). La causa raíz:
// consultar `feedback_messages` con una columna que no existe (`feedback_id`) y tragarse el
// error con un `.catch(()=>[])` → falso "sin mensajes". Este script CIERRA ese hueco:
// vuelca SIEMPRE la CONVERSACIÓN ENTERA (por `conversation_id`, el link fiable) + un
// veredicto de Paso 0 explícito. Si una query peta, PETA (no se traga el error).
//
// Uso: node scripts/impugnaciones/revisar-feedback.cjs <feedback_id> [--sid <id-sesión>]
//   Con --sid: COGE (claim) el feedback (user_feedback.claimed_by), avisa si otra sesión lo
//   tiene fresco (<2h). Sin --sid: solo dossier.

const fs = require('fs');
const pg = require('postgres');
// Enforcement de la Regla previa OBLIGATORIA (scope/epígrafe) — módulo compartido con revisar-impugnacion.cjs
const { scopeEnforcement } = require('./lib/scope-enforcement.cjs');
// Regla «cada hilo se responde en SU hilo» (30/07, caso Chema): núcleo puro y testeado.
const { analizarHilos } = require('../lib/hilos-abiertos.cjs');
const { sidCorto } = require(require('path').join(__dirname, '..', '..', 'lib', 'sessions', 'sid.cjs'));

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

const ago = (d) => {
  if (!d) return '-';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 60 ? m + 'm' : m < 1440 ? (m / 60).toFixed(1) + 'h' : (m / 1440).toFixed(1) + 'd';
};

(async () => {
  const fid = process.argv[2];
  if (!fid) { console.error('Uso: revisar-feedback.cjs <feedback_id> [--sid <id>]'); process.exit(2); }
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const [fb] = await s`SELECT * FROM user_feedback WHERE id=${fid}`;
    if (!fb) { console.error('Feedback no encontrado:', fid); process.exit(2); }

    // --- CLAIM (reparto entre sesiones). Solo con --sid. No fatal. ---
    let claimWarn = '';
    // T-407: antes esto IGNORABA el fichero `.session-id` y solo miraba la variable de entorno,
    // así que en un worktree creado con el tooling no coincidía con el id que usa `cola.cjs` para
    // reclamar → el dossier avisaba de «otra sesión» siendo la misma. Ahora ambos preguntan al
    // mismo módulo.
    const { resolverSid } = require(require('path').join(__dirname, '..', '..', 'lib', 'sessions', 'sid.cjs'));
    const sid = resolverSid({ repo: require('path').join(__dirname, '..', '..') }).sid;
// Latir al abrir un caso (T-412): trabajar ES la señal de vida. Sin esto, una revisión larga
    // —media hora leyendo y redactando, sin ejecutar nada— se parecería a una sesión muerta y otra
    // sesión podría llevarse la reserva con toda la razón. Fire-and-forget: no puede estorbar.
    try {
      require('child_process').spawn(process.execPath,
        [require('path').join(__dirname, '..', 'sessions', 'latir.cjs'), '--cmd', 'revisar'],
        { detached: true, stdio: 'ignore' }).unref();
    } catch { /* la telemetría nunca bloquea la revisión */ }

    // ── LA RESERVA SE DECIDE EN EL `UPDATE`, NO EN JS (T-412) ────────────────────────────────
    // Antes esto leía la fila, decidía en JavaScript si estaba libre y luego escribía con
    // `WHERE id=…` **a secas, sin condición**. Dos sesiones a la vez leían «libre», las dos
    // escribían, y la segunda le pisaba la reserva a la primera sin que nada lo dijera. Es lo
    // que pasó el 31/07: dos sesiones acabaron trabajando el mismo feedback de un usuario.
    //
    // Ahora la condición viaja DENTRO del UPDATE, así que la base de datos arbitra: si devuelve
    // fila, es tuya; si no la devuelve, es de otra. Mismo criterio que `cola.cjs` —importado del
    // mismo módulo, no reescrito—, que además ya no es solo el reloj: una sesión que sigue
    // LATIENDO conserva su reserva por larga que sea la revisión, y una que se apagó la suelta.
    if (sid && fb.status === 'pending') {
      const { sqlReservaLibre } = require(require('path').join(__dirname, '..', '..', 'lib', 'impugnaciones', 'reserva.cjs'));
      const got = await s.unsafe(
        `UPDATE public.user_feedback SET claimed_by=$1, claimed_at=now()
          WHERE id=$2 AND ${sqlReservaLibre('', '$1')} RETURNING claimed_by`, [sid, fid]);
      if (got.length) {
        claimWarn = `🔒 Cogido por tu sesión (${sidCorto(sid)}).`;
      } else {
        const [ahora] = await s`SELECT claimed_by, claimed_at FROM user_feedback WHERE id=${fid}`;
        claimWarn = `⛔ NO ES TUYO: lo tiene la sesión ${sidCorto(ahora?.claimed_by)} (desde hace ${ahora?.claimed_at ? ago(ahora.claimed_at) : '?'}) y sigue viva.\n`
          + `   NO lo trabajes ni respondas: coge otro con  node scripts/impugnaciones/cola.cjs next`;
      }
    }

    console.log('═'.repeat(70));
    console.log(`DOSSIER FEEDBACK ${String(fb.id).slice(0, 8)}  [${fb.type}]`);
    console.log('═'.repeat(70));
    if (claimWarn) console.log(claimWarn);

    // --- 🔗 ¿ESTE CASO YA TIENE FICHA VIVA EN EL BACKLOG? (T-517) ---
    // Va ARRIBA a propósito: quien coge el caso tiene que ver el trabajo ya hecho ANTES de
    // ponerse a diagnosticar. Nace de que el feedback 8b788ee0 cambió de manos con su ficha
    // [T-507] ya resuelta y la sesión que lo cogió no podía saberlo. Sin BD: lee el markdown.
    try {
      const path = require('path');
      const { fichasQueCitan, lineasDossier } = require(path.join(__dirname, '..', '..', 'lib', 'backlog', 'fichasQueCitan.cjs'));
      const md = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'roadmap', 'tareas-pendientes.md'), 'utf8');
      const idCorto = String(fb.id).slice(0, 8);
      const lineas = lineasDossier(fichasQueCitan(md, [String(fb.id), idCorto]));
      if (lineas.length) console.log('\n' + lineas.join('\n'));
    } catch { /* el backlog no es imprescindible para el dossier: nunca lo tumba */ }

    // --- Usuario ---
    const [p] = await s`SELECT full_name, email, plan_type, target_oposicion, ciudad, created_at FROM user_profiles WHERE id=${fb.user_id}`;
    console.log(`Usuario: ${p ? p.full_name : '(contacto externo)'}${p ? ` (${p.email})` : ''}`);
    if (p) console.log(`  plan: ${p.plan_type} | oposición: ${p.target_oposicion} | ciudad: ${p.ciudad || '?'} | alta hace ${ago(p.created_at)}`);
    console.log(`Estado: ${fb.status} | creado hace ${ago(fb.created_at)}${fb.question_id ? ` | question_id: ${String(fb.question_id).slice(0, 8)}` : ''}`);

    // --- Mensaje original del feedback ---
    console.log('\nMensaje original del feedback:');
    console.log('  ' + (fb.message || '(vacío)').replace(/\n/g, '\n  '));

    // --- PASO 0: LA CONVERSACIÓN ENTERA (link fiable = conversation_id) ---
    // NO se filtra por `feedback_id` (esa columna NO existe en feedback_messages).
    const convs = await s`SELECT id, status, last_message_at FROM feedback_conversations WHERE feedback_id=${fb.id} ORDER BY created_at`;
    console.log('\n─── PASO 0: CONVERSACIÓN COMPLETA (¿ya respondido? ¿el usuario contestó?) ───');
    let allMsgs = [];
    if (!convs.length) {
      console.log('  (sin conversación en feedback_conversations)');
    }
    for (const c of convs) {
      const msgs = await s`SELECT is_admin, message, created_at FROM feedback_messages WHERE conversation_id=${c.id} ORDER BY created_at`;
      allMsgs = allMsgs.concat(msgs);
      console.log(`  conversación ${String(c.id).slice(0, 8)} (status=${c.status}) — ${msgs.length} mensaje(s):`);
      msgs.forEach((m) => console.log(`    [${ago(m.created_at)}] ${m.is_admin ? 'ADMIN' : 'USER '}: ${(m.message || '').replace(/\n/g, ' ').slice(0, 200)}`));
    }
    // admin_response legacy (a veces la respuesta se quedó SOLO aquí y no llegó al hilo)
    if (fb.admin_response) {
      const inThread = allMsgs.some((m) => m.is_admin && (m.message || '').trim().slice(0, 40) === (fb.admin_response || '').trim().slice(0, 40));
      console.log(`\n  admin_response (legacy): PRESENTE${inThread ? ' (y también en el hilo ✓)' : ' ⚠️ pero NO está en el hilo (¿entrega fallida?)'}`);
    }

    // --- VEREDICTO Paso 0 (mecánico; el juicio lo pone Claude) ---
    const adminN = allMsgs.filter((m) => m.is_admin).length;
    const userN = allMsgs.filter((m) => !m.is_admin).length;
    const last = allMsgs[allMsgs.length - 1];
    // duplicado = 2+ admin seguidos sin user en medio
    let dupWarn = false;
    for (let i = 1; i < allMsgs.length; i++) if (allMsgs[i].is_admin && allMsgs[i - 1].is_admin) dupWarn = true;
    console.log('\n  ▶ VEREDICTO:');
    console.log(`    mensajes: ${adminN} ADMIN, ${userN} USER`);
    if (!allMsgs.length && !fb.admin_response) {
      console.log('    → SIN RESPONDER. Redacta borrador (con OK antes de enviar).');
    } else if (last && !last.is_admin && adminN > 0) {
      console.log(`    → ⚠️ EL ÚLTIMO MENSAJE ES DEL USUARIO (hace ${ago(last.created_at)}) tras haberle respondido.`);
      console.log('       Ya se le contestó y ha RE-ESCRITO: NO re-envíes lo anterior. Responde a su ÚLTIMO mensaje.');
    } else if (last && !last.is_admin) {
      console.log('    → Último mensaje del usuario, sin respuesta admin aún. Redacta borrador.');
    } else if (last && last.is_admin) {
      console.log(`    → YA RESPONDIDO (último mensaje ADMIN hace ${ago(last.created_at)}).`);
      console.log('       Si el usuario no ha vuelto a escribir → NO envíes otra respuesta; cierra silencioso (finalStatus:resolved sin message).');
    } else if (fb.admin_response && !allMsgs.length) {
      console.log('    → Respuesta SOLO en admin_response (legacy), NO en el hilo → entrega fallida real: re-entregar vía /api/v2/feedback/respond.');
    }
    if (dupWarn) console.log('    → 🔴 POSIBLE DUPLICADO YA EN EL HILO (2+ ADMIN seguidos). Revisar antes de tocar nada.');

    // --- 🩺 RASTRO DE ERRORES DEL USUARIO (T-649) ---
    // Va ANTES del journey a propósito: los clics dicen por dónde pasó, y los errores dicen qué
    // se le rompió. Con solo los clics delante, la causa se elige por parecido con la avería que
    // uno tiene abierta ese día — que es exactamente lo que pasó con Lourdes (`e790c7bf`): se le
    // atribuyó el cuelgue a [T-623] usando dos 494 que eran POSTERIORES a su mensaje, mientras el
    // error del momento que ella describía (`answerSaveQueue`) llevaba 40 minutos en su rastro.
    // NO se envuelve en try/catch: tragarse el error aquí devolvería un «sin rastro» falso, que
    // es el mismo modo de fallo que documenta la cabecera de este fichero.
    const { ventanaRastro, agruparRastro, lineasRastro } =
      require(require('path').join(__dirname, '..', '..', 'lib', 'impugnaciones', 'rastroDeErrores.cjs'));
    const { desde, hasta } = ventanaRastro(fb.created_at);
    const eventos = await s`
      SELECT created_at, event_type, severity, endpoint, http_status, metadata
        FROM observable_events
       WHERE user_id=${fb.user_id}
         AND severity IN ('error','warn')
         AND created_at BETWEEN ${desde} AND ${hasta}
       ORDER BY created_at LIMIT 500`;
    console.log(lineasRastro(agruparRastro(eventos, fb.created_at), { creado: fb.created_at }).join('\n'));

    // --- ENFORCEMENT scope/epígrafe (Regla previa OBLIGATORIA): si el feedback va de temario ---
    // Mira el mensaje original + TODOS los mensajes del usuario (la duda de scope puede venir en un follow-up).
    const userText = [fb.message, ...allMsgs.filter((m) => !m.is_admin).map((m) => m.message)].join(' ');
    const scopeWarn = await scopeEnforcement(s, { text: userText, oposicion: p?.target_oposicion || null });
    if (scopeWarn) console.log(scopeWarn);

    // --- Paso 3: journey ---
    console.log('\n─── Paso 3: JOURNEY (últimas interacciones) ───');
    const j = await s`SELECT event_type, page_url, element_text, created_at FROM user_interactions WHERE user_id=${fb.user_id} ORDER BY created_at DESC LIMIT 12`;
    j.reverse().forEach((x) => console.log(`  ${ago(x.created_at).padStart(6)} ${x.event_type}${x.page_url ? ' ' + x.page_url.replace('https://www.vence.es', '') : ''}${x.element_text ? ' «' + x.element_text.slice(0, 28) + '»' : ''}`));

    // --- Historial de feedbacks + impugnaciones del usuario ---
    const hist = await s`SELECT type, status, left(message, 45) m, created_at FROM user_feedback WHERE user_id=${fb.user_id} ORDER BY created_at DESC`;
    console.log('\nHistorial feedbacks:', hist.map((h) => `[${h.status} ${ago(h.created_at)}] ${h.m}`).join(' | '));

    // --- OTROS HILOS de esta persona (regla: cada hilo se responde en SU hilo) ---
    // El historial de arriba ya los volcaba, pero en una línea plana y sin ids: con Chema
    // (30/07) estaban delante y no se vieron, y sus dos hilos de Policía Municipal
    // llevaban un día esperando mientras se le contestaba eso mismo en otro hilo.
    // `convStatus` en vez de «¿hay mensajes nuestros?» (T-512): un hilo CERRADO no espera
    // respuesta aunque no tengamos un solo mensaje dentro, que es lo que pasa cuando alguien
    // pregunta lo mismo en tres hilos y se le contesta en uno. `waiting_admin` es la misma
    // señal que cuenta el panel de admin. Si alguna conversación del feedback está esperando,
    // manda esa; si no, vale la última (para distinguir «cerrada» de «sin conversación»).
    const todos = await s`
      SELECT f.id, f.type, f.status, f.message, f.created_at,
             COALESCE(
               (SELECT 'waiting_admin' FROM feedback_conversations c
                 WHERE c.feedback_id = f.id AND c.status = 'waiting_admin' LIMIT 1),
               (SELECT c.status FROM feedback_conversations c
                 WHERE c.feedback_id = f.id ORDER BY c.created_at DESC LIMIT 1)
             ) AS "convStatus"
        FROM user_feedback f WHERE f.user_id=${fb.user_id} ORDER BY f.created_at`;
    const hilos = analizarHilos(todos, String(fb.id));
    if (hilos.aviso) {
      console.log('\n─── 🧵 OTROS HILOS DE ESTA PERSONA ───');
      console.log(hilos.aviso);
    }
    const disp = await s`SELECT dispute_type, status, created_at FROM question_disputes WHERE user_id=${fb.user_id} ORDER BY created_at DESC LIMIT 5`;
    console.log('Impugnaciones:', disp.length ? disp.map((d) => `${d.dispute_type}/${d.status}`).join(' | ') : 'ninguna');

    console.log('\n─── CHECKLIST antes de responder ───');
    console.log('  [ ] 1. He LEÍDO la conversación entera (arriba), no solo el 1er mensaje.');
    console.log('  [ ] 2. Si el último mensaje es del USUARIO, respondo a ESE (no re-envío lo anterior).');
    console.log('  [ ] 3. Journey/historial mirados (la intención real ≠ texto literal).');
    console.log('  [ ] 3.bis NO nombro una causa que no salga en su RASTRO **antes** del mensaje,');
    console.log('        y NO le cuento lo que él hizo («si deseleccionas lo que traías…») sin medirlo.');
    console.log('  [ ] 4. Si tiene MÁS hilos abiertos, un borrador por hilo (no junto asuntos).');
    console.log('  [ ] 5. Borrador con OK de Manuel ANTES de enviar (nunca envío directo).');
    console.log('  [ ] 6. Cierro vía /api/v2/feedback/respond (message = responder; sin message = cierre silencioso).');
    // Lo que NO se puede decir se COMPRUEBA, no se recuerda ([T-678], 07/08/2026): en un mismo
    // borrador se colaron dos reglas ya escritas (mención a la recompensa y «tienes razón»).
    // El manual pasa de 2.000 líneas y no se relee antes de cada mensaje.
    console.log('\n─── LO QUE NO SE PUEDE DECIR (compruébalo, no lo recuerdes) ───');
    for (const r of require(require('path').join(__dirname, '..', '..', 'lib', 'feedback', 'validarMensaje.cjs')).PROHIBIDO) {
      console.log(`  ✗ ${r.id.padEnd(24)} → ${r.enVezDe}`);
    }
    console.log('  Pásale tu borrador antes de enviarlo:');
    console.log('    node -e "const{validarMensajeAUsuario,explicar}=require(\'./lib/feedback/validarMensaje.cjs\');' +
      'const v=validarMensajeAUsuario(require(\'fs\').readFileSync(process.argv[1],\'utf8\'));' +
      'console.log(v.ok?\'✅ se puede enviar\':explicar(v.incumple))" <fichero-borrador.md>');
  } finally {
    await s.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
