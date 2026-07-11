#!/usr/bin/env node
/**
 * create-oposicion.cjs — Scaffolder spec→artefactos para crear una oposición (FASE 2 + FASE 3 del manual).
 *
 * Convierte UN `spec.json` validado en todos los artefactos MECÁNICOS de forma determinista,
 * transaccional e idempotente: fila `oposiciones` (is_active=false), `oposicion_bloques`,
 * `topics` (con su epígrafe literal), `convocatorias` (SSOT is_current), `convocatoria_hitos`,
 * y opcionalmente `topic_scope` (reutilizando rangos de otra oposición o explícito).
 *
 * NO automatiza el JUICIO (FASE 1 leer el boletín, FASE 3 decidir el mapeo de scope): eso vive en el spec.
 * Codifica los fallos aprendidos como validación dura (schema JSONB {numero,texto,color} y {pregunta,respuesta},
 * descripcion_corta NOT NULL, convocatoria SSOT, coherencia bloques↔topics) → aborta antes de tocar BD.
 * A prueba de schema-drift: introspecciona las columnas reales y solo escribe las que existen (y exige las NOT NULL).
 *
 * Uso:  node scripts/create-oposicion.cjs <spec.json> [--dry-run] [--force]
 *   --dry-run : valida + hace todo en una transacción y ROLLBACK (no persiste). Reporta qué haría.
 *   --force   : si el slug ya existe, aborta igualmente (por seguridad NO borra; usar SQL manual para recrear).
 *
 * Gate posterior OBLIGATORIO (no lo hace este script): npm run audit:oposicion <slug> && audit:served && audit:epigrafe.
 */
'use strict';
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

// ────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN (función pura, testeable sin BD) — codifica las lecciones aprendidas
// ────────────────────────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PT_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

/** Devuelve array de errores (vacío = válido). No toca BD. */
function validateSpec(spec) {
  const e = [];
  const req = (obj, path, keys) => keys.forEach(k => {
    const v = obj == null ? undefined : obj[k];
    if (v === undefined || v === null || v === '') e.push(`${path}.${k} es obligatorio`);
  });
  if (!spec || typeof spec !== 'object') return ['spec vacío o no es un objeto'];

  const id = spec.identity || {};
  req(id, 'identity', ['nombre', 'short_name', 'slug', 'position_type', 'grupo', 'subgrupo', 'categoria', 'tipo_acceso', 'administracion', 'titulo_requerido']);
  if (id.slug && !SLUG_RE.test(id.slug)) e.push(`identity.slug "${id.slug}" debe ser kebab-case (guiones)`);
  if (id.position_type && !PT_RE.test(id.position_type)) e.push(`identity.position_type "${id.position_type}" debe ser snake_case (underscores)`);
  if (id.slug && id.position_type && id.slug.replace(/-/g, '_') !== id.position_type)
    e.push(`identity.slug y position_type deben coincidir (slug con guiones == position_type con underscores)`);
  if (id.coverage_level && !['catalogada', 'con_landing', 'con_tests', 'full'].includes(id.coverage_level))
    e.push(`identity.coverage_level "${id.coverage_level}" inválido`);

  // examScoring (OBLIGATORIO, lección examPenaltyCoherence)
  const es = spec.examScoring;
  if (!es || typeof es !== 'object') e.push('examScoring es obligatorio {penaltyDivisor, source}');
  else {
    if (!(es.penaltyDivisor === null || (typeof es.penaltyDivisor === 'number' && es.penaltyDivisor > 0)))
      e.push('examScoring.penaltyDivisor debe ser null o un número positivo');
    if (!es.source) e.push('examScoring.source es obligatorio (citar boletín)');
  }

  // landing.estadisticas: schema EXACTO {numero,texto,color} (incidente 500 SSR 18/05)
  const est = (spec.landing && spec.landing.estadisticas) || [];
  if (!Array.isArray(est)) e.push('landing.estadisticas debe ser un array');
  else est.forEach((s, i) => {
    ['numero', 'texto', 'color'].forEach(k => { if (s == null || s[k] === undefined || s[k] === null || s[k] === '') e.push(`landing.estadisticas[${i}].${k} obligatorio (claves EXACTAS numero/texto/color)`); });
  });
  // landing.faqs: {pregunta,respuesta}
  const faqs = (spec.landing && spec.landing.faqs) || [];
  if (!Array.isArray(faqs)) e.push('landing.faqs debe ser un array');
  else faqs.forEach((f, i) => ['pregunta', 'respuesta'].forEach(k => { if (f == null || !f[k]) e.push(`landing.faqs[${i}].${k} obligatorio`); }));

  // bloques
  const bloques = spec.bloques || [];
  if (!Array.isArray(bloques) || bloques.length === 0) e.push('bloques[] es obligatorio (≥1)');
  const bloqueNums = new Set();
  bloques.forEach((b, i) => {
    if (b == null || typeof b.numero !== 'number') e.push(`bloques[${i}].numero debe ser número`);
    else { if (bloqueNums.has(b.numero)) e.push(`bloques[${i}].numero ${b.numero} duplicado`); bloqueNums.add(b.numero); }
    if (!b || !b.titulo) e.push(`bloques[${i}].titulo obligatorio`);
  });

  // temario
  const temario = spec.temario || [];
  if (!Array.isArray(temario) || temario.length === 0) e.push('temario[] es obligatorio (≥1 tema)');
  const topicNums = new Set();
  temario.forEach((t, i) => {
    if (t == null) { e.push(`temario[${i}] nulo`); return; }
    if (typeof t.topic_number !== 'number') e.push(`temario[${i}].topic_number debe ser número (único en la oposición)`);
    else { if (topicNums.has(t.topic_number)) e.push(`temario[${i}].topic_number ${t.topic_number} duplicado`); topicNums.add(t.topic_number); }
    if (typeof t.bloque !== 'number' || !bloqueNums.has(t.bloque)) e.push(`temario[${i}].bloque ${t.bloque} no referencia un bloque existente`);
    if (!t.titulo) e.push(`temario[${i}].titulo obligatorio`);
    if (!t.epigrafe) e.push(`temario[${i}].epigrafe obligatorio (texto literal del boletín)`);
  });
  const totalTopics = temario.length;

  // convocatoria (SSOT — sin ella la tarjeta del catálogo sale en blanco)
  const conv = spec.convocatoria || {};
  req(conv, 'convocatoria', ['año', 'estado_proceso', 'diario_oficial']);
  if (conv.año !== undefined && (typeof conv.año !== 'number' || conv.año < 2000)) e.push('convocatoria.año inválido');

  // coherencia contadores
  if (id.bloques_count !== undefined && id.bloques_count !== bloques.length) e.push(`identity.bloques_count (${id.bloques_count}) ≠ nº bloques (${bloques.length})`);
  if (id.temas_count !== undefined && id.temas_count !== totalTopics) e.push(`identity.temas_count (${id.temas_count}) ≠ nº temas (${totalTopics})`);

  return e;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers de BD
// ────────────────────────────────────────────────────────────────────────────
async function tableColumns(c, table) {
  const r = await c.query(
    `select column_name, is_nullable, column_default from information_schema.columns where table_name=$1 and table_schema='public'`,
    [table]);
  const cols = {}; r.rows.forEach(x => { cols[x.column_name] = { nullable: x.is_nullable === 'YES', hasDefault: x.column_default != null }; });
  return cols;
}

/** Construye INSERT usando SOLO columnas que existen; avisa de claves desconocidas; exige NOT NULL sin default. */
function buildInsert(table, cols, obj, { skipUnknown = true } = {}) {
  const names = [], vals = [], params = [];
  const unknown = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (!cols[k]) { unknown.push(k); if (skipUnknown) continue; }
    names.push(`"${k}"`); params.push(v); vals.push(`$${params.length}`);
  }
  // guard: NOT NULL sin default que NO estamos escribiendo
  const missing = Object.entries(cols)
    .filter(([name, meta]) => !meta.nullable && !meta.hasDefault && !obj.hasOwnProperty(name))
    .map(([name]) => name);
  return { text: `insert into ${table} (${names.join(', ')}) values (${vals.join(', ')}) returning id`, params, unknown, missing };
}

const J = v => (v == null ? null : JSON.stringify(v));

// ────────────────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const specPath = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  if (!specPath) { console.error('Uso: node scripts/create-oposicion.cjs <spec.json> [--dry-run] [--force]'); process.exit(2); }

  let spec;
  try { spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); }
  catch (e) { console.error('❌ spec ilegible:', e.message); process.exit(2); }

  const errors = validateSpec(spec);
  if (errors.length) { console.error(`❌ Spec inválido (${errors.length}):`); errors.forEach(x => console.error('  -', x)); process.exit(1); }
  console.log('✅ Spec válido.');

  const id = spec.identity, conv = spec.convocatoria, landing = spec.landing || {};
  const PT = id.position_type, SLUG = id.slug;
  const temario = spec.temario, bloques = spec.bloques;

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await c.connect();
  try {
    if ((await c.query('select 1 from oposiciones where slug=$1', [SLUG])).rowCount) {
      console.error(`⚠️ oposiciones "${SLUG}" ya existe → aborto (idempotente). ${force ? '(--force no borra por seguridad)' : ''}`);
      process.exit(0);
    }

    const [oCols, bCols, tCols, cCols, hCols] = await Promise.all(
      ['oposiciones', 'oposicion_bloques', 'topics', 'convocatorias', 'convocatoria_hitos'].map(t => tableColumns(c, t)));

    await c.query('BEGIN');

    // ── oposiciones (is_active=false) ──
    const oObj = {
      nombre: id.nombre, tipo_acceso: id.tipo_acceso, administracion: id.administracion, categoria: id.categoria,
      slug: SLUG, short_name: id.short_name, grupo: id.grupo, subgrupo: id.subgrupo,
      is_active: false, is_convocatoria_activa: !!conv.is_convocatoria_activa,
      temas_count: temario.length, bloques_count: bloques.length, titulo_requerido: id.titulo_requerido,
      coverage_level: id.coverage_level || 'con_tests', fetcher_type: id.fetcher_type || 'http',
      headless_required: id.headless_required ?? false, familia: id.familia || null,
      color_primario: id.color_primario || 'blue', sistema_selectivo: id.sistema_selectivo || null,
      diario_oficial: conv.diario_oficial, diario_referencia: conv.diario_referencia || null,
      programa_url: conv.programa_url || null, seguimiento_url: conv.seguimiento_url || null,
      estado_proceso: conv.estado_proceso, oep_decreto: conv.oep_decreto || null, oep_fecha: conv.oep_fecha || null,
      convocatoria_numero: conv.numero || null, convocatoria_fecha: conv.fecha || null, convocatoria_dogv: conv.diario || null,
      plazas_libres: conv.plazas_libres ?? null, plazas_promocion_interna: conv.plazas_promocion_interna ?? null,
      plazas_discapacidad: conv.plazas_discapacidad ?? null,
      inscription_start: conv.inscription_start || null, inscription_deadline: conv.inscription_deadline || null,
      exam_date: conv.exam_date || null, boe_publication_date: conv.boe_publication_date || null, boe_reference: conv.boe_reference || null,
      examen_config: J(spec.examen_config), landing_faqs: J(landing.faqs || []), landing_estadisticas: J(landing.estadisticas || []),
      landing_description: landing.description || null, seo_title: landing.seo_title || null, seo_description: landing.seo_description || null,
    };
    const oIns = buildInsert('oposiciones', oCols, oObj);
    if (oIns.missing.length) throw new Error(`schema-drift: columnas NOT NULL sin default no cubiertas en oposiciones: ${oIns.missing.join(', ')}`);
    if (oIns.unknown.length) console.warn('  ⚠️ oposiciones: claves ignoradas (no existen):', oIns.unknown.join(', '));
    const oid = (await c.query(oIns.text, oIns.params)).rows[0].id;

    // ── bloques ──
    for (const b of bloques) {
      const bIns = buildInsert('oposicion_bloques', bCols, {
        position_type: PT, bloque_number: b.numero, titulo: b.titulo, icon: b.icon || null, sort_order: b.sort_order ?? b.numero,
      });
      if (bIns.missing.length) throw new Error(`schema-drift oposicion_bloques: ${bIns.missing.join(', ')}`);
      await c.query(bIns.text, bIns.params);
    }

    // ── topics ──
    for (const t of temario) {
      const title = t.titulo;
      const tIns = buildInsert('topics', tCols, {
        position_type: PT, topic_number: t.topic_number, display_number: t.numero ?? t.topic_number, bloque_number: t.bloque,
        title, descripcion_corta: t.descripcion_corta || title, epigrafe: t.epigrafe,
        difficulty: t.difficulty || 'medium', estimated_hours: t.estimated_hours ?? 12,
        // is_active = el tema es parte REAL del temario (default true; spec puede ponerlo false si el tema está pendiente de editor).
        // disponible = tiene banco para servir tests; lo decide FASE 3 (scope+preguntas), por eso arranca en false salvo que el spec lo fuerce.
        is_active: t.is_active !== false, disponible: t.disponible === true,
      });
      if (tIns.missing.length) throw new Error(`schema-drift topics: ${tIns.missing.join(', ')}`);
      await c.query(tIns.text, tIns.params);
    }

    // ── convocatoria SSOT (is_current) ──
    await c.query('update convocatorias set is_current=false where oposicion_id=$1 and is_current=true', [oid]);
    const cvObj = {
      oposicion_id: oid, 'año': conv.año, is_current: true,
      convocatoria_numero: conv.numero || null, convocatoria_fecha: conv.fecha || null, convocatoria_dogv: conv.diario || null,
      estado_proceso: conv.estado_proceso, oep_decreto: conv.oep_decreto || null, oep_fecha: conv.oep_fecha || null,
      plazas_libres: conv.plazas_libres ?? null, plazas_promocion_interna: conv.plazas_promocion_interna ?? null, plazas_discapacidad: conv.plazas_discapacidad ?? null,
      inscription_start: conv.inscription_start || null, inscription_deadline: conv.inscription_deadline || null,
      exam_date: conv.exam_date || null, boe_publication_date: conv.boe_publication_date || null, boe_reference: conv.boe_reference || null,
      programa_url: conv.programa_url || null, examen_config: J(spec.examen_config), landing_faqs: J(landing.faqs || []),
      landing_estadisticas: J(landing.estadisticas || []), landing_description: landing.description || null,
    };
    const cvIns = buildInsert('convocatorias', cCols, cvObj);
    if (cvIns.missing.length) throw new Error(`schema-drift convocatorias: ${cvIns.missing.join(', ')}`);
    await c.query(cvIns.text, cvIns.params);

    // ── hitos (opcional) ──
    const cvId = (await c.query('select id from convocatorias where oposicion_id=$1 and is_current=true', [oid])).rows[0].id;
    for (const h of (spec.hitos || [])) {
      const hIns = buildInsert('convocatoria_hitos', hCols, {
        oposicion_id: oid, convocatoria_id: cvId, fecha: h.fecha, titulo: h.titulo, descripcion: h.descripcion || null,
        status: h.status || 'upcoming', order_index: h.order_index ?? 1, severity: h.severity || 'important', notify_status: 'pending', url: h.url || null,
      });
      if (hIns.missing.length) throw new Error(`schema-drift convocatoria_hitos: ${hIns.missing.join(', ')}`);
      await c.query(hIns.text, hIns.params);
    }

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🧪 --dry-run: todo OK, ROLLBACK (no persistido).'); }
    else await c.query('COMMIT');

    const nT = (await c.query('select count(*)::int n from topics where position_type=$1', [PT]).catch(() => ({ rows: [{ n: dryRun ? temario.length : 0 }] }))).rows[0].n;
    console.log(`\n✅ FASE 2 ${dryRun ? '(simulada)' : 'aplicada'} — oposición ${SLUG}`);
    console.log(`   oposiciones id ${oid} (is_active=false) · ${bloques.length} bloques · ${temario.length} topics · convocatoria SSOT · ${(spec.hitos || []).length} hitos`);
    console.log(`   SIGUIENTE: FASE 3 topic_scope (aplicar mapeo) + gates: npm run audit:oposicion ${SLUG} && audit:served && audit:epigrafe`);
    process.exit(0);
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('❌ ERROR (rollback):', err.message);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { validateSpec, buildInsert };
