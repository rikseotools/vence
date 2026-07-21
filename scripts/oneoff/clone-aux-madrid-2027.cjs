#!/usr/bin/env node
/**
 * Split "Auxiliar Administrativo Comunidad de Madrid" en dos oposiciones por convocatoria.
 *
 *  ANTIGUA (existe, NO se toca su contenido ni sus 1.328 usuarios):
 *    slug=auxiliar-administrativo-madrid  ·  Orden 264/2026  ·  examen octubre 2026  ·  Windows 10
 *  NUEVA (se crea, clon):
 *    slug=auxiliar-administrativo-madrid-2027  ·  Orden 1628/2026  ·  examen junio 2027  ·  Windows 11
 *
 * El banco de preguntas se comparte (cuelga del artículo). Solo el T16 (Windows) difiere.
 *
 * Uso:
 *   node scripts/oneoff/clone-aux-madrid-2027.cjs            # DRY-RUN (no escribe) + backup
 *   node scripts/oneoff/clone-aux-madrid-2027.cjs --apply    # ejecuta en transacción
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const APPLY = process.argv.includes('--apply');

const OLD_SLUG = 'auxiliar-administrativo-madrid';
const OLD_PT   = 'auxiliar_administrativo_madrid';
const NEW_SLUG = 'auxiliar-administrativo-madrid-2027';
const NEW_PT   = 'auxiliar_administrativo_madrid_2027';
const NEW_NOMBRE = 'Auxiliar Administrativo Comunidad de Madrid — Convocatoria 2026 (examen junio 2027)';
const OLD_NOMBRE = 'Auxiliar Administrativo Comunidad de Madrid (examen octubre 2026)';

// Leyes virtuales de Windows 11 (ya existen; NULL article_numbers = ley entera → sirve todas las preguntas)
const WIN11_EXPLORER = '9c0b25a4-c819-478c-972f-ee462d724a40'; // Explorador Windows 11 (95 preg)
const WIN11_SO       = '932efcfb-5dce-4bcc-9c6c-55eab19752b0'; // Windows 11 SO (226 preg)

// Convocatoria a mover a la ficha nueva (examen junio 2027)
const ORDEN_1628_NUM = 'Orden 1628/2026';
// Convocatoria que se queda en la ficha antigua (examen octubre 2026)
const ORDEN_264_NUM  = 'Orden 264/2026';
const EXAM_1628 = '2027-06-01'; // BOCM dice "junio de 2027" sin día → aproximado
const EXAM_264  = '2026-10-14';

function log(...a){ console.log(...a); }

(async () => {
  let url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]+/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // ---- Lookups + validaciones previas ----
  const opoOld = (await c.query('select * from oposiciones where slug=$1', [OLD_SLUG])).rows[0];
  if (!opoOld) throw new Error('No existe la oposición antigua ' + OLD_SLUG);
  const opoNewExists = (await c.query('select id from oposiciones where slug=$1', [NEW_SLUG])).rows[0];
  if (opoNewExists) throw new Error('Ya existe una oposición con slug ' + NEW_SLUG + ' → aborta');
  const ptNewTopics = (await c.query('select count(*) n from topics where position_type=$1', [NEW_PT])).rows[0].n;
  if (Number(ptNewTopics) > 0) throw new Error('Ya hay topics con position_type ' + NEW_PT + ' → aborta');

  const convs = (await c.query(
    'select id, convocatoria_numero, is_current, plazas_libres, exam_date from convocatorias where oposicion_id=$1',
    [opoOld.id])).rows;
  const c1628 = convs.find(r => r.convocatoria_numero === ORDEN_1628_NUM);
  const c264  = convs.find(r => r.convocatoria_numero === ORDEN_264_NUM);
  if (!c1628) throw new Error('No encuentro ' + ORDEN_1628_NUM + ' en la oposición antigua');
  if (!c264)  throw new Error('No encuentro ' + ORDEN_264_NUM + ' en la oposición antigua');

  const topics = (await c.query('select * from topics where position_type=$1 order by topic_number', [OLD_PT])).rows;
  const bloques = (await c.query('select * from oposicion_bloques where position_type=$1 order by bloque_number', [OLD_PT])).rows;
  const scopeCount = (await c.query(
    'select count(*) n from topic_scope ts join topics t on t.id=ts.topic_id where t.position_type=$1', [OLD_PT])).rows[0].n;

  // ---- Backup de las filas que se MODIFICAN (no las nuevas) ----
  const backup = {
    when: new Date().toISOString?.() || 'n/a',
    oposicion_old: opoOld,
    convocatorias: convs,
  };
  const backupPath = path.join(__dirname, 'backup-aux-madrid-split.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  // ---- Resumen ----
  log('════════════════════════════════════════════════════════════');
  log(APPLY ? '⚙️  MODO APPLY (escribe en transacción)' : '🔍 DRY-RUN (no escribe nada)');
  log('════════════════════════════════════════════════════════════');
  log('Backup de filas a modificar →', backupPath);
  log('');
  log('OPOSICIÓN ANTIGUA (se mantiene, sin tocar contenido):');
  log('  id:', opoOld.id, '| slug:', OLD_SLUG);
  log('  nombre:', opoOld.nombre, '→', OLD_NOMBRE);
  log('  convocatoria vigente pasa a:', ORDEN_264_NUM, '(examen', EXAM_264 + ')');
  log('');
  log('OPOSICIÓN NUEVA (clon):');
  log('  slug:', NEW_SLUG, '| position_type:', NEW_PT);
  log('  nombre:', NEW_NOMBRE);
  log('  is_active: false (se activa tras gates)');
  log('  convocatoria:', ORDEN_1628_NUM, '(examen', EXAM_1628, 'aprox) — plazas', c1628.plazas_libres);
  log('  temas a clonar:', topics.length, '| bloques:', bloques.length, '| topic_scope:', scopeCount);
  log('  T16 → Explorador Windows 11 (NULL=95 preg) + Windows 11 (NULL=226 preg)');
  log('');

  if (!APPLY) {
    log('DRY-RUN: nada escrito. Revisa el resumen y el backup. Ejecuta con --apply para aplicar.');
    await c.end();
    return;
  }

  // ---- APPLY (transacción) ----
  try {
    await c.query('BEGIN');

    // 1) Nueva oposiciones (clon vía temp table, override identidad + temporales desde Orden 1628)
    await c.query('CREATE TEMP TABLE _newopo ON COMMIT DROP AS SELECT * FROM oposiciones WHERE slug=$1', [OLD_SLUG]);
    await c.query(`UPDATE _newopo SET
        id = gen_random_uuid(),
        slug = $1,
        nombre = $2,
        is_active = false,
        is_convocatoria_activa = true,
        estado_proceso = 'inscripcion_abierta',
        exam_date = $3::date,
        exam_date_approximate = true,
        inscription_start = '2026-07-14'::date,
        inscription_deadline = '2026-08-10'::date,
        plazas_libres = $4,
        seo_title = 'Tests Auxiliar Administrativo Comunidad de Madrid 2027 (examen junio 2027) | Vence',
        seo_description = 'Prepara la convocatoria 2026 (Orden 1628, examen junio 2027) del Auxiliar Administrativo de la Comunidad de Madrid. 21 temas, ofimática Windows 11 y Microsoft 365.',
        created_at = now()
      `, [NEW_SLUG, NEW_NOMBRE, EXAM_1628, c1628.plazas_libres]);
    const newIdRow = (await c.query('INSERT INTO oposiciones SELECT * FROM _newopo RETURNING id')).rows[0];
    const NEW_ID = newIdRow.id;
    log('✔ oposiciones nueva:', NEW_ID);

    // 2) Renombrar + repuntar la antigua a Orden 264 (examen octubre 2026)
    await c.query(`UPDATE oposiciones SET
        nombre = $2,
        estado_proceso = 'lista_admitidos',
        exam_date = $3::date, exam_date_approximate = false,
        inscription_start = '2026-02-19'::date, inscription_deadline = '2026-03-19'::date,
        plazas_libres = $4
      WHERE slug=$1`, [OLD_SLUG, OLD_NOMBRE, EXAM_264, c264.plazas_libres]);
    log('✔ oposiciones antigua renombrada + repuntada a Orden 264');

    // 3) Bloques
    await c.query(`INSERT INTO oposicion_bloques (position_type, bloque_number, titulo, icon, sort_order, created_at, updated_at)
      SELECT $1, bloque_number, titulo, icon, sort_order, now(), now()
      FROM oposicion_bloques WHERE position_type=$2`, [NEW_PT, OLD_PT]);
    log('✔ bloques clonados:', bloques.length);

    // 4) Topics
    await c.query(`INSERT INTO topics
        (position_type, topic_number, title, description, difficulty, estimated_hours, is_active, created_at, updated_at, epigrafe, bloque_number, display_number, disponible, descripcion_corta)
      SELECT $1, topic_number, title, description, difficulty, estimated_hours, is_active, now(), now(), epigrafe, bloque_number, display_number, disponible, descripcion_corta
      FROM topics WHERE position_type=$2`, [NEW_PT, OLD_PT]);
    log('✔ topics clonados:', topics.length);

    // 5) topic_scope — todos salvo T16 (copia por topic_number)
    const sc = await c.query(`INSERT INTO topic_scope
        (topic_id, law_id, article_numbers, title_numbers, chapter_numbers, include_full_title, include_full_chapter, weight, created_at)
      SELECT nt.id, ts.law_id, ts.article_numbers, ts.title_numbers, ts.chapter_numbers, ts.include_full_title, ts.include_full_chapter, ts.weight, now()
      FROM topic_scope ts
      JOIN topics ot ON ot.id=ts.topic_id AND ot.position_type=$1
      JOIN topics nt ON nt.position_type=$2 AND nt.topic_number=ot.topic_number
      WHERE ot.topic_number <> 16`, [OLD_PT, NEW_PT]);
    log('✔ topic_scope clonado (T1-15,17-21):', sc.rowCount, 'filas');

    // 6) T16 → Windows 11 (NULL = ley entera)
    const t16 = (await c.query('select id from topics where position_type=$1 and topic_number=16', [NEW_PT])).rows[0];
    await c.query(`INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight, created_at)
      VALUES ($1,$2,NULL,1,now()), ($1,$3,NULL,1,now())`, [t16.id, WIN11_EXPLORER, WIN11_SO]);
    log('✔ T16 nuevo → Explorador Win11 + Windows 11 (2 filas, ley entera)');

    // 7) Reasignar convocatorias (orden importa: mover 1628 ANTES de poner 264 vigente en la antigua)
    await c.query(`UPDATE convocatorias SET oposicion_id=$1, is_current=true,
        exam_date=$2::date, exam_date_approximate=true, updated_at=now() WHERE id=$3`,
      [NEW_ID, EXAM_1628, c1628.id]);
    await c.query('UPDATE convocatorias SET is_current=true, updated_at=now() WHERE id=$1', [c264.id]);
    log('✔ convocatorias reasignadas: 1628→nueva (vigente), 264→antigua (vigente)');

    await c.query('COMMIT');
    log('\n✅ COMMIT OK. NEW_ID =', NEW_ID);

    // ---- Verificación post ----
    const chk = await c.query(`select o.slug, o.nombre, o.is_active,
        (select count(*) from topics where position_type=$2) topics,
        (select count(*) from topic_scope ts join topics t on t.id=ts.topic_id where t.position_type=$2) scope,
        (select convocatoria_numero from convocatorias where oposicion_id=o.id and is_current) conv
      from oposiciones o where o.slug=$1`, [NEW_SLUG, NEW_PT]);
    console.table(chk.rows);
  } catch (e) {
    await c.query('ROLLBACK');
    log('❌ ROLLBACK —', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
