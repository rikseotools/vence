#!/usr/bin/env node
// Dossier estructurado de una impugnación (manual impugnaciones §2). Genera SIEMPRE el
// mismo análisis + los dos checks pre-rellenados con datos, para que Claude no se salte
// pasos. El JUICIO (¿válida?, ¿clave?, corrección) lo pone Claude; los DATOS y los checks
// mecánicos los pone este script.
//
// Uso: node scripts/impugnaciones/revisar-impugnacion.cjs <dispute_id> [--sid <id-sesión>]
//   Con --sid: COGE (claim) la impugnación para tu sesión y avisa si otra sesión ya la
//   está revisando (reparto entre 2-10 sesiones sin pisarse, ver cola.cjs). Sin --sid: solo dossier.
const fs = require('fs');
// Política de recompensa POR MOTIVO, importada del núcleo puro que usa también el runtime: el
// dossier enseña exactamente lo que el sistema va a pagar, no una copia que se desactualice.
const { disputeTypeIsRewardable } = require('../../lib/referrals/disputeRewardPolicy');
// `postgres` se carga PEREZOSAMENTE (igual que en `validar-explicacion.cjs`). Antes era un
// require de RUTA ABSOLUTA a la máquina de Manuel en el top-level: fuera de ella —CI, otro
// worktree, otro portátil— el módulo reventaba nada más importarlo, aunque solo quisieras las
// funciones puras. Lo destapó el test de `mapaExposicion`, que pasaba en local y moría en CI.
const getPg = () => {
  try { return require('postgres'); } catch { /* fuera del backend, se prueba su node_modules */ }
  return require(require('path').join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
};
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function recall(opt, art) { const O = words(opt), A = words(art); if (!O.size) return 0; let h = 0; O.forEach((w) => A.has(w) && h++); return h / O.size; }
const hasOptFormat = (e) => /\*\*A\)/i.test(e || '') && /\*\*B\)/i.test(e || '');

// ── Barajado de opciones (T-080 Fase 1): traducir lo que VIO el usuario ────────────────────────
//
// Con el barajado encendido, la letra que el usuario nombra en su impugnación NO es la de la BD:
// el serve permuta las opciones por exposición y guarda esa permutación en
// `test_questions.option_order` (option_order[i] = índice ORIGINAL mostrado en la posición i).
// Sin esto, alguien escribe «la opción C es errónea», nosotros abrimos la C de la BD —que es otra
// opción distinta— y diagnosticamos la pregunta equivocada, con toda la seguridad del mundo.
// El dato ya se guardaba; lo que faltaba era mirarlo.
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

/** Mapa posición MOSTRADA → letra ORIGINAL en BD. Puro: `order` es lo servido, sin BD de por medio. */
function mapaExposicion(order) {
  if (!Array.isArray(order) || !order.length) return null;
  return order.map((orig, pos) => ({ vio: LETRAS[pos], enBd: LETRAS[orig] }));
}

/** Reescribe las letras que el usuario menciona a las de la BD, para no diagnosticar la opción equivocada. */
function traducirLetrasDelUsuario(texto, order) {
  const mapa = mapaExposicion(order);
  if (!mapa || !texto) return null;
  const vistas = new Set();
  const re = /\b(?:opci[óo]n|respuesta|alternativa|letra)\s*([A-Ea-e])\b|\b([A-E])\)/g;
  let m;
  while ((m = re.exec(texto))) vistas.add((m[1] || m[2]).toUpperCase());
  if (!vistas.size) return null;
  return [...vistas].sort().map((L) => {
    const e = mapa.find((x) => x.vio === L);
    return { dijo: L, esEnBd: e ? e.enBd : '?' };
  });
}
// Enforcement de la Regla previa OBLIGATORIA (scope/epígrafe) — módulo compartido con revisar-feedback.cjs
const { scopeEnforcement } = require('./lib/scope-enforcement.cjs');

if (require.main !== module) {
  module.exports = { mapaExposicion, traducirLetrasDelUsuario };
} else
(async () => {
  const did = process.argv[2];
  if (!did) { console.error('Uso: revisar-impugnacion.cjs <dispute_id>'); process.exit(2); }
  const s = getPg()(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    let d, isPsy = false;
    [d] = await s`SELECT *, 'legislative' qtype FROM question_disputes WHERE id=${did}`;
    if (!d) { [d] = await s`SELECT *, 'psychometric' qtype FROM psychometric_question_disputes WHERE id=${did}`; isPsy = !!d; }
    if (!d) { console.error('Impugnación no encontrada:', did); process.exit(2); }

    // --- CLAIM (reparto entre sesiones, ver cola.cjs). Solo si pasas --sid. No fatal. ---
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

    if (sid && ['pending', 'appealed'].includes(d.status)) {
      const dtbl = isPsy ? 'psychometric_question_disputes' : 'question_disputes';
      try {
        // La reserva se decide DENTRO del UPDATE, no en JS (T-412). Antes se leía la fila, se
        // decidía aquí y se escribía con `WHERE id=…` sin condición: dos sesiones leían «libre»
        // a la vez y la segunda pisaba a la primera en silencio. Gemelo exacto del arreglo en
        // `revisar-feedback.cjs`, con el MISMO criterio importado (no reescrito).
        const { sqlReservaLibre } = require(require('path').join(__dirname, '..', '..', 'lib', 'impugnaciones', 'reserva.cjs'));
        const got = await s.unsafe(
          `UPDATE public.${dtbl} SET claimed_by=$1, claimed_at=now()
            WHERE id=$2 AND ${sqlReservaLibre('', '$1')} RETURNING claimed_by`, [sid, did]);
        if (got.length) {
          claimWarn = `🔒 Cogida por tu sesión (${String(sid).slice(0, 8)}).`;
        } else {
          const [ahora] = await s.unsafe(`SELECT claimed_by, claimed_at FROM public.${dtbl} WHERE id=$1`, [did]);
          const mins = ahora?.claimed_at ? Math.round((Date.now() - new Date(ahora.claimed_at).getTime()) / 60000) : '?';
          claimWarn = `⛔ NO ES TUYA: la tiene la sesión ${String(ahora?.claimed_by || '?').slice(0, 12)} (hace ${mins}m) y sigue viva.\n`
            + `   NO la trabajes ni resuelvas: coge otra con  node scripts/impugnaciones/cola.cjs next`;
        }
      } catch (e) { claimWarn = `(claim no aplicado: ${e.message})`; }
    }

    // --- PASO 0: ¿YA está respondida? Caza el desync status=pending PERO admin_response ya escrito
    //     (gotcha 504/partial-close: la respuesta se guardó/emailó pero el estado no se volteó).
    //     Trigger SOLO por admin_response (es por-dispute, fiable). NO por email_events: esa tabla no
    //     tiene dispute_id, así que un email 'impugnacion_respuesta' de OTRA dispute del mismo usuario
    //     daría falso positivo (visto 24/07 con Cristina: 3 disputes, cerrar una marcaba las otras). ---
    let alreadyWarn = '';
    if (['pending', 'appealed'].includes(d.status)) {
      const hasResp = d.admin_response && String(d.admin_response).trim().length > 0;
      if (hasResp) {
        alreadyWarn = '🛑 PASO 0 — YA RESPONDIDA (status=' + d.status + ' pero ya tiene admin_response'
          + (d.updated_at ? ' de ' + new Date(d.updated_at).toISOString().slice(0, 16) : '') + '):\n'
          + '   • ' + String(d.admin_response).replace(/\s+/g, ' ').trim().slice(0, 90) + '…\n'
          + '   → NO re-respondas (duplicarías el email). Solo falta CERRAR el estado (silent close):\n'
          + "     UPDATE status → 'resolved'/'rejected' preservando admin_response, SIN /resolve (reenviaría email).";
      }
    }

    const [p] = await s`SELECT full_name, email, target_oposicion, plan_type FROM user_profiles WHERE id=${d.user_id}`;

    // --- CONSECUENCIA ECONÓMICA de aceptar, calculada ANTES de decidir ---
    // Aceptar una impugnación mueve dinero real. Que eso se vea en el momento de decidir —y no se
    // confíe a que quien resuelve se acuerde de comprobarlo— es lo que evita los dos fallos
    // simétricos: pagar sin querer y no pagar debiendo (28/07: dos usuarias premium se quedaron sin
    // su euro porque la función se desplegó después de resolverles, y nadie lo vio hasta revisarlo
    // a mano). Se usa LA MISMA política que aplica el runtime, no una copia.
    let rewardWarn = '';
    try {
      const [ya] = await s`
        SELECT count(*)::int n FROM reward_submissions
         WHERE user_id = ${d.user_id} AND type = 'impugnacion'
           AND created_at >= date_trunc('month', now())`;
      const [pagada] = await s`
        SELECT amount, status FROM reward_submissions
         WHERE dispute_id = ${did} AND type = 'impugnacion' LIMIT 1`;
      const esPremium = p?.plan_type === 'premium';
      const tipoPaga = disputeTypeIsRewardable(d.dispute_type);
      const cap = Number(process.env.IMPUGNACION_MONTHLY_CAP || 10);
      if (pagada) {
        rewardWarn = `💶 Recompensa: YA concedida por esta impugnación (${pagada.amount} €, ${pagada.status}). Re-resolver NO duplica.`;
      } else if (!esPremium) {
        rewardWarn = `💶 Recompensa: no aplica — usuario ${p?.plan_type || 'sin plan'} (el programa es solo premium).`;
      } else if (!tipoPaga) {
        rewardWarn = `💶 Recompensa: NO se abona — motivo «${d.dispute_type}» es de valoración personal, no error verificable.\n`
          + `   → Si aun así la aportación es valiosa, se premia A MANO (no la concede sola).`;
      } else if (ya.n >= cap) {
        rewardWarn = `💶 Recompensa: NO se abona — el usuario ya lleva ${ya.n}/${cap} este mes (tope alcanzado).`;
      } else {
        rewardWarn = `💶 Recompensa: aceptarla concede 1 € automático (premium, motivo verificable). Lleva ${ya.n}/${cap} este mes.`;
      }
    } catch (e) {
      // Nunca romper el dossier por esto: sin la línea se sigue pudiendo resolver la impugnación.
      rewardWarn = `💶 Recompensa: no se pudo calcular (${e.message}).`;
    }
    const scopeWarn = await scopeEnforcement(s, {
      text: d.description, oposicion: p?.target_oposicion || null, force: d.dispute_type === 'tema_incorrecto',
    });
    const qtbl = isPsy ? 'psychometric_questions' : 'questions';
    const [q] = await s.unsafe(`SELECT * FROM ${qtbl} WHERE id='${d.question_id}'`);
    let art = null;
    if (!isPsy && q.primary_article_id) [art] = await s`SELECT a.article_number an, a.title, a.content, l.short_name ln FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.id=${q.primary_article_id}`;

    const co = q.correct_option;
    const opts = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    const correctText = opts['ABCD'[co]];

    console.log('══════════════════════════════════════════════════════════════');
    console.log(`DOSSIER IMPUGNACIÓN ${did.slice(0, 8)}  [${d.qtype}]`);
    console.log('══════════════════════════════════════════════════════════════');
    if (claimWarn) console.log(claimWarn);

    // --- 🔗 ¿ESTE CASO YA TIENE FICHA VIVA EN EL BACKLOG? (T-517) ---
    // Va ARRIBA a propósito: quien coge el caso tiene que ver el trabajo ya hecho ANTES de
    // ponerse a diagnosticar. Nace de que el feedback 8b788ee0 cambió de manos con su ficha
    // [T-507] ya resuelta y la sesión que lo cogió no podía saberlo. Sin BD: lee el markdown.
    try {
      const path = require('path');
      const { fichasQueCitan, lineasDossier } = require(path.join(__dirname, '..', '..', 'lib', 'backlog', 'fichasQueCitan.cjs'));
      const md = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'roadmap', 'tareas-pendientes.md'), 'utf8');
      const idCorto = String(d.id).slice(0, 8);
      const lineas = lineasDossier(fichasQueCitan(md, [String(d.id), idCorto]));
      if (lineas.length) console.log('\n' + lineas.join('\n'));
    } catch { /* el backlog no es imprescindible para el dossier: nunca lo tumba */ }
    if (alreadyWarn) console.log(alreadyWarn);
    console.log(`Usuario: ${p?.full_name || '?'} (${p?.email || '?'})`);
    console.log(`Tipo: ${d.dispute_type} | estado: ${d.status}`);
    console.log(`Descripción: ${d.description}`);
    if (rewardWarn) console.log(rewardWarn);
    if (scopeWarn) console.log(scopeWarn);
    console.log(`\nPregunta (oficial=${q.is_official_exam}, lifecycle=${q.lifecycle_state}):`);
    console.log(`  ${q.question_text}`);
    ['A', 'B', 'C', 'D'].forEach((L) => opts[L] != null && console.log(`  ${L}) ${opts[L]}`));
    console.log(`  CLAVE: ${'ABCD'[co]}) ${correctText}`);

    // ¿Vio el usuario las opciones BARAJADAS? Se busca su exposición más cercana a la impugnación.
    if (!isPsy) {
      try {
        const [exp] = await s`
          SELECT option_order, created_at FROM test_questions
           WHERE user_id = ${d.user_id} AND question_id = ${d.question_id}
             AND created_at <= ${d.created_at}::timestamptz + interval '1 hour'
           ORDER BY created_at DESC LIMIT 1`;
        const mapa = exp && mapaExposicion(exp.option_order);
        if (mapa) {
          console.log('\n🔀 EL USUARIO VIO LAS OPCIONES BARAJADAS — sus letras NO son las de la BD:');
          for (const e of mapa) {
            const t = opts[e.enBd] == null ? '(vacía)' : String(opts[e.enBd]).slice(0, 72);
            console.log(`   él vio ${e.vio}) = en BD es la ${e.enBd}) ${t}`);
          }
          const trad = traducirLetrasDelUsuario(d.description, exp.option_order);
          if (trad) {
            console.log('   ⚠️ En su texto menciona: ' + trad.map((t) => `«${t.dijo}» → es la ${t.esEnBd}) de la BD`).join(' · '));
            console.log('      Analiza ESA opción, no la de su letra. Y al responderle, usa SU letra.');
          }
        } else if (exp) {
          console.log('\n🔀 Orden natural: vio las opciones como están en la BD (sin barajar).');
        }
      } catch (e) {
        console.log(`\n(no se pudo reconstruir el orden que vio el usuario: ${e.message.slice(0, 70)})`);
      }
    }
    console.log(`\nExplicación actual:\n  ${(q.explanation || '(vacía)').replace(/\n/g, '\n  ')}`);
    if (art) {
      console.log(`\nArtículo vinculado: ${art.ln} art ${art.an} — ${art.title || ''}`);
      console.log(`  ${art.content.slice(0, 500).replace(/\n/g, '\n  ')}${art.content.length > 500 ? ' …' : ''}`);
    } else if (!isPsy) console.log('\n⚠️ Artículo vinculado: NINGUNO (primary_article_id null)');

    // ── ¿Es SISTÉMICO? Las HERMANAS del mismo artículo, con su clave ────────────────
    //
    // Regla de Manuel: «siempre, en las impugnaciones, hay que revisar si es un fallo
    // sistémico». Vivía SOLO en el manual (§7.5/§7.7) y por eso se olvidaba: el 02/08, en
    // la impugnación 4b2e527e, se miró si el término inventado estaba extendido pero NO si
    // el CONCEPTO lo estaba. Al mirarlo salieron dos preguntas hermanas del mismo artículo
    // que preguntaban lo mismo con otro recorte… y sus claves DEMOSTRABAN que la impugnada
    // estaba mal (2 informes + 1 dictamen = 3). El banco se contradecía consigo mismo.
    //
    // Por eso ya no es una línea de checklist que hay que acordarse de ejecutar: el dossier
    // las TRAE. Ver una clave que no cuadra con las vecinas cuesta un vistazo; buscarlas a
    // mano, acordarse primero.
    if (!isPsy && q.primary_article_id) {
      const hermanas = await s`
        SELECT id, question_text qt, correct_option co, option_a a, option_b b, option_c c, option_d d
          FROM questions
         WHERE primary_article_id = ${q.primary_article_id} AND is_active = true AND id <> ${q.id}
         ORDER BY created_at LIMIT 12`;
      console.log(`\n─── 🔬 ¿FALLO SISTÉMICO? ${hermanas.length} pregunta(s) activa(s) del MISMO artículo ───`);
      if (hermanas.length === 0) {
        console.log('   (ninguna: el defecto, si lo hay, es de esta pregunta sola)');
      } else {
        for (const h of hermanas) {
          const ops = [h.a, h.b, h.c, h.d];
          const letra = ['A', 'B', 'C', 'D'][h.co] ?? '?';
          console.log(`   ${String(h.id).slice(0, 8)} | ${String(h.qt).replace(/\s+/g, ' ').slice(0, 88)}`);
          console.log(`      clave ${letra}) ${String(ops[h.co] ?? '').replace(/\s+/g, ' ').slice(0, 70)}`);
        }
        console.log('   ⚠️ Si una hermana responde lo MISMO de otra forma, sus claves tienen que ser coherentes.');
        console.log('      Y si el defecto se repite, NO lo arregles solo aquí: mídelo y abre ficha.');
      }
    }

    console.log('\n─── CHECKS AUTOMÁTICOS (los verifica el código; el juicio lo pone Claude) ───');
    // Check (b): ¿el artículo vinculado responde? (recall de la opción correcta en el artículo)
    if (art) {
      const r = recall(correctText, art.content);
      const verdict = r >= 0.7 ? '🟢 alto (probablemente SÍ responde)' : r >= 0.4 ? '🟡 medio (revisar a mano)' : '🔴 bajo (probablemente NO responde → re-vincular)';
      console.log(`(b) ¿el artículo vinculado responde la pregunta? → recall opción correcta ↔ artículo = ${(r * 100).toFixed(0)}% ${verdict}`);
      console.log(`    ⚠️ recall alto ≠ garantía: verifica que el HECHO concreto esté literal, no solo las palabras.`);
    } else if (!isPsy) console.log('(b) ¿el artículo responde? → 🔴 NO hay artículo vinculado (o es art 0 estructural).');
    // Check (a): formato de la explicación
    console.log(`(a) ¿la explicación tiene formato §5.1 (por opción)? → ${hasOptFormat(q.explanation) ? '🟢 sí' : '🔴 NO (apelotonada / sin análisis por opción) → mejorable'}`);

    console.log('\─── CHECKLIST OBLIGATORIA (marcar cada una antes de proponer) ───'.replace('\\─','─'));
    console.log('  [ ] 1. ¿La CLAVE es correcta? (verificar contra el artículo/ley)');
    console.log('  [ ] 2. (b) ¿El artículo vinculado responde LITERALMENTE? (no solo solape de palabras)');
    console.log('  [ ] 3. ¿La pregunta está bien formulada? (¿doble solución? ¿opción D vacía legítima? ¿enunciado confuso?)');
    console.log('  [ ] 4. (a) ¿La explicación es mejorable? (formato §5.1 + exactitud) → SIEMPRE evaluar');
    console.log('  [ ] 4.bis ¿Es SISTÉMICO? Mirar las hermanas de arriba y medir el patrón en el banco (§7.5/§7.7)');
    console.log('  [ ] 5. Clasificar: informática / tema_incorrecto / supuesto huérfano / estructural / normal');
    console.log('  [ ] 6. ¿Oficial? (oficial=no se toca enunciado/opciones; no oficial=se mejora)');
    console.log('  [ ] 7. Antes de aplicar explicación nueva → pasar validar-explicacion.cjs');
    console.log('  [ ] 8. Borrador del mensaje (Hola <nombre real>, reconocer si tenía razón, Muchas gracias, Equipo de Vence) → ESPERAR OK');
    console.log('  [ ] 9. Cerrar vía /api/v2/dispute/resolve (nunca UPDATE directo del dispute)');
  } finally { await s.end(); }
})();
