#!/usr/bin/env node
/**
 * audit-oposiciones-coherencia.cjs — CAPA 2 de detección (linter determinista).
 *
 * POR QUÉ EXISTE: los gates existentes (audit:oposicion/served/epigrafe) validan
 * estructura, cobertura y scope, pero NO comprueban que los NÚMEROS que muestra la
 * landing (FAQs, tarjetas de estadística, plazas) cuadren entre sí y con la BD. Un
 * dato hardcodeado que se queda stale (p.ej. la FAQ dice "46 plazas" pero la
 * convocatoria se actualiza a otra cifra) pasa TODOS los gates y llega al usuario.
 * Este linter caza ese DRIFT ENTRE CAMPOS, sin red y sin fuente externa.
 *
 * NO sustituye a la verificación dato-vs-boletín (CAPA 3, FASE final de
 * crear-nueva-oposicion.md): esta es coherencia INTERNA; aquella es correctitud
 * contra el BOE. Complementa a audit:oposicion (que es por-slug e incluye config).
 *
 * Comprueba, por cada oposición is_active:
 *   ❌ temas_count(oposiciones) ≠ nº real de topics(position_type)
 *   ❌ TARJETA de estadística de "temas" con número HARDCODEADO ≠ nº real de topics
 *      (los placeholders {temasCount} se auto-resuelven al render → se ignoran)
 *   ❌ TARJETA de estadística de "plazas" con número que no cuadra con NINGUNA
 *      combinación de la convocatoria vigente (libres / +discapacidad / +promoción)
 *   ❌ inscripción abierta sin ningún hito (convocatoria_hitos = 0)
 *   🟡 dual-write de convocatorias incompleto (is_current sin boe_reference/
 *      programa_url/examen_config/landing_*) — la vista SSOT hace fallback a oposiciones,
 *      no rompe la landing, pero conviene completarlo.
 *   🟡 dual-write DIVERGENTE: legacy oposiciones y convocatoria is_current discrepan
 *      en un campo SSOT (estado_proceso/plazas/fechas, ambos no-null) — los lectores
 *      legacy ven un valor distinto del front. Bidireccional → adjudicar contra
 *      boletín, NUNCA copiar en bloque. (scripts/lib/dual-write-divergence.cjs)
 *   🟡 landing_faqs < 3  |  landing_estadisticas vacío
 *
 * DELIBERADAMENTE NO escanea la PROSA de las FAQs en busca de números: contiene
 * conteos por bloque ("Bloque I: 12 temas") y cifras históricas/por-turno que no
 * son "el total" → generarían falsos positivos. La correctitud de la prosa vs el
 * boletín oficial es trabajo de la CAPA 3 (verificación dato-vs-BOE, FASE final de
 * crear-nueva-oposicion.md), no de este linter determinista.
 *
 * Uso:
 *   node scripts/audit-oposiciones-coherencia.cjs                 # todas las is_active
 *   node scripts/audit-oposiciones-coherencia.cjs escala-administrativa-universidad-de-granada
 *
 * Exit code 1 si hay algún ❌ (apto como gate de CI / pre-go-live).
 */
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const { dualWriteDivergences } = require('./lib/dual-write-divergence.cjs');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase). Ver db/client.ts'); process.exit(2); }
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} });

// Parsea el `numero` de una tarjeta de estadística a entero, o null si no es numérico
// (p.ej. "Bachiller/FP", "A2") o es un placeholder de render ({temasCount}).
function cardInt(numero) {
  if (numero == null) return null;
  const s = String(numero).trim();
  if (/\{\w+\}/.test(s)) return null;            // placeholder auto-resuelto
  if (!/^[0-9][0-9.\s]*$/.test(s)) return null;  // no es una cifra pura
  const n = parseInt(s.replace(/[.\s]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
// Devuelve las tarjetas (landing_estadisticas) cuyo `texto` menciona `palabra`.
function cardsAbout(estadisticas, palabra) {
  if (!Array.isArray(estadisticas)) return [];
  const re = new RegExp(palabra, 'i');
  return estadisticas.filter(c => c && re.test(String(c.texto || '')));
}

async function main() {
  const argSlugs = process.argv.slice(2);
  const opos = argSlugs.length
    ? await sql`SELECT * FROM oposiciones WHERE slug = ANY(${argSlugs}::text[]) ORDER BY slug`
    : await sql`SELECT * FROM oposiciones WHERE is_active = true ORDER BY slug`;

  if (!opos.length) { console.log('No hay oposiciones que auditar.'); await sql.end(); process.exit(0); }

  console.log(`\n━━━ Coherencia interna de landing (${opos.length} oposición/es) ━━━\n`);
  let fails = 0, warns = 0;

  for (const o of opos) {
    const pt = o.slug.replace(/-/g, '_');
    const local = [];
    const bad = (m) => { local.push('  ❌ ' + m); fails++; };
    const warn = (m) => { local.push('  🟡 ' + m); warns++; };

    // nº real de temas
    const nTopics = Number((await sql`SELECT COUNT(*)::int AS c FROM topics WHERE position_type = ${pt}`)[0]?.c || 0);

    // temas_count declarado
    if (o.temas_count != null && Number(o.temas_count) !== nTopics)
      bad(`temas_count=${o.temas_count} ≠ nº real de topics (${nTopics})`);

    // tarjetas de estadística de "temas" con número hardcodeado
    for (const card of cardsAbout(o.landing_estadisticas, 'tema')) {
      const n = cardInt(card.numero);
      if (n != null && n !== nTopics)
        bad(`tarjeta "${card.texto}" muestra ${n} pero hay ${nTopics} topics reales (usa {temasCount} para que se auto-resuelva)`);
    }

    // convocatoria vigente
    const conv = (await sql`SELECT plazas_libres, plazas_discapacidad, plazas_promocion_interna, estado_proceso, inscription_start, inscription_deadline, exam_date, boe_reference, programa_url, examen_config, landing_faqs, landing_estadisticas, landing_description
                            FROM convocatorias WHERE oposicion_id = ${o.id} AND is_current = true LIMIT 1`)[0];
    if (conv) {
      const L = Number(conv.plazas_libres || 0), D = Number(conv.plazas_discapacidad || 0), P = Number(conv.plazas_promocion_interna || 0);
      // combinaciones legítimas que una tarjeta puede mostrar: turno libre (L), reserva
      // discapacidad sola (D), promoción interna sola (P), o cualquier suma hasta el total.
      const validos = new Set([L, D, P, L + D, L + P, D + P, L + D + P].filter(x => x > 0));
      for (const card of cardsAbout(o.landing_estadisticas, 'plaza')) {
        const n = cardInt(card.numero);
        if (n != null && !validos.has(n))
          bad(`tarjeta "${card.texto}" muestra ${n} plazas, pero la convocatoria da libres=${L}, discapacidad=${D}, promoción=${P} (combinaciones válidas: ${[...validos].join('/')})`);
      }

      // dual-write completo (🟡: la vista SSOT hace fallback a oposiciones, no rompe)
      const faltan = ['boe_reference', 'programa_url', 'examen_config', 'landing_faqs', 'landing_estadisticas', 'landing_description']
        .filter(k => conv[k] == null);
      if (faltan.length) warn(`dual-write de convocatoria incompleto (NULL): ${faltan.join(', ')}`);

      // dual-write DIVERGENTE (🟡): legacy y convocatoria discrepan en un campo SSOT
      // (ambos no-null) → los lectores legacy (advance-estado/auditores) ven un valor
      // distinto del que la vista sirve al front. NO auto-copiar: es bidireccional
      // (a veces adelanta la convocatoria, a veces la legacy) → adjudicar contra
      // fuente oficial. Runbook: "revisa el dual-write de convocatorias".
      for (const dv of dualWriteDivergences(o, conv))
        warn(`dual-write DIVERGENTE en ${dv.field}: legacy=${dv.legacy} ≠ convocatoria=${dv.convocatoria} (adjudicar contra boletín, NO copiar en bloque)`);

      // hitos si inscripción abierta
      if (conv.estado_proceso === 'inscripcion_abierta') {
        const nHitos = Number((await sql`SELECT COUNT(*)::int AS c FROM convocatoria_hitos WHERE oposicion_id = ${o.id}`)[0]?.c || 0);
        if (nHitos === 0) bad('inscripción ABIERTA pero 0 hitos en convocatoria_hitos (timeline vacío)');
      }
    } else {
      warn('sin fila convocatorias is_current (no se pudo cruzar plazas/dual-write)');
    }

    // señales blandas
    const nFaqs = Array.isArray(o.landing_faqs) ? o.landing_faqs.length : 0;
    if (nFaqs < 3) warn(`landing_faqs=${nFaqs} (recomendado ≥3 para SEO/FAQPage)`);
    const nEst = Array.isArray(o.landing_estadisticas) ? o.landing_estadisticas.length : 0;
    if (nEst === 0) warn('landing_estadisticas vacío (sin tarjetas hero)');

    if (local.length) { console.log(`${o.slug}`); local.forEach(l => console.log(l)); console.log(''); }
    else console.log(`✅ ${o.slug} — coherente`);
  }

  console.log(`\n━━━ ${fails} ❌  /  ${warns} 🟡 ━━━`);
  await sql.end();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(e => { console.error(e?.message || e); process.exit(2); });
