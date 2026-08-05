#!/usr/bin/env node
/**
 * audit-temario-display-drift.cjs
 *
 * Detector mecánico de DRIFT entre el TÍTULO de un tema y sus campos de display
 * (`descripcion_corta`, `epigrafe`, `description`). Nace del fallo real del
 * 08/07/2026: al re-escopar la específica de Cantabria a Windows 11 / Office 365
 * se actualizaron title/epigrafe/description pero se olvidó `descripcion_corta`,
 * que además quedó DESALINEADA por el desplazamiento de temas (un tema de Excel
 * mostraba "Word 2016…" en el listado). En BD parecía correcto (las preguntas
 * servidas eran las buenas); solo se veía en la página LIVE. Este audit lo caza
 * de forma determinista, sin depender de mirar producción a mano.
 *
 * Se centra en temas de INFORMÁTICA (los que sufren versiones: Windows 10/11,
 * Office 2016/2019/2021/365, apps distintas). Detecta:
 *   🔴 APP_DRIFT        — el título es de una app (p.ej. Excel) pero `descripcion_corta`
 *                         encabeza con OTRA app (p.ej. Word). El caso exacto del fallo.
 *   🔴 WIN_VER_DRIFT    — título Windows 11 pero un campo dice Windows 10 (o viceversa).
 *   🔴 OFFICE_VER_DRIFT — título fija versión (p.ej. 365) pero un campo dice otra (2016…).
 *
 * Uso:
 *   node scripts/audit-temario-display-drift.cjs                 # todas las oposiciones
 *   node scripts/audit-temario-display-drift.cjs auxiliar_administrativo_cantabria
 *   node scripts/audit-temario-display-drift.cjs --selftest      # prueba la lógica con casos sintéticos
 *
 * Exit code 1 si hay algún 🔴 (apto como gate de CI).
 */
require('dotenv').config({ path: '.env.local' });

// --- Lógica PURA de detección ---
// Vive en `lib/temario/displayDrift.js` para que el ESCRITOR que puede introducir el
// drift (`verify:epigrafe apply`) use la MISMA definición que este detector. Ver la
// cabecera de ese módulo: dos definiciones del mismo concepto = regresión por la
// puerta que no vigila nadie.
const { detectDrift } = require('../lib/temario/displayDrift.js');

// --- Self-test (demuestra que caza el fallo real) ---
function selftest() {
  const cases = [
    { name: 'fallo real Cantabria (Excel con descripcion_corta de Word 2016)',
      topic: { title: 'Hoja de cálculo: Microsoft Excel (Microsoft 365)', descripcion_corta: 'Word 2016: tablas, plantillas, correspondencia.' },
      expect: ['APP_DRIFT', 'OFFICE_VER_DRIFT'] },
    { name: 'Windows 11 con descripcion_corta Windows 10',
      topic: { title: 'Sistema Operativo: Microsoft Windows 11', descripcion_corta: 'Windows 10: escritorio, ventanas.' },
      expect: ['WIN_VER_DRIFT'] },
    { name: 'Word 365 con epígrafe que dice 2016',
      topic: { title: 'Procesador de textos: Microsoft Word (Microsoft 365)', descripcion_corta: 'Word (Microsoft 365): edición.', epigrafe: 'Microsoft Word 2016. Funciones.' },
      expect: ['OFFICE_VER_DRIFT'] },
    { name: 'limpio (Teams coherente)',
      topic: { title: 'Microsoft Teams', descripcion_corta: 'Microsoft Teams: equipos, canales, chat.' },
      expect: [] },
    { name: 'limpio (tema legislativo, sin app)',
      topic: { title: 'La Constitución Española de 1978', descripcion_corta: 'CE completa: Títulos I-X.' },
      expect: [] },
  ];
  let ok = 0;
  for (const c of cases) {
    const got = detectDrift(c.topic).map((x) => x.type).sort();
    const exp = [...c.expect].sort();
    const pass = JSON.stringify(got) === JSON.stringify(exp);
    console.log(`  ${pass ? '✅' : '❌'} ${c.name}  got=[${got}] exp=[${exp}]`);
    if (pass) ok++;
  }
  console.log(`\n${ok}/${cases.length} casos de self-test OK`);
  process.exit(ok === cases.length ? 0 : 1);
}

// --- Main (BD) ---
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  const { urlLecturaNegocio } = require('../lib/db/negocioSoloLectura.cjs');
  let DB_URL;
  try {
    DB_URL = urlLecturaNegocio();
  } catch {
    console.error('❌ ni VENCE_LECTOR_URL ni DATABASE_URL configurados');
    process.exit(2);
  }
  const postgres = require('postgres');
  const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} });

  const positions = args.filter((a) => !a.startsWith('--'));
  const rows = positions.length
    ? await sql`SELECT position_type, topic_number, title, descripcion_corta, epigrafe, description FROM topics WHERE position_type = ANY(${positions}) ORDER BY position_type, topic_number`
    : await sql`SELECT position_type, topic_number, title, descripcion_corta, epigrafe, description FROM topics ORDER BY position_type, topic_number`;

  let redCount = 0;
  const byPos = {};
  for (const r of rows) {
    const findings = detectDrift(r);
    if (findings.length) {
      (byPos[r.position_type] = byPos[r.position_type] || []).push({ t: r.topic_number, title: r.title, findings });
      redCount += findings.length;
    }
  }
  for (const [pos, items] of Object.entries(byPos)) {
    console.log(`\n━━━ ${pos} ━━━`);
    for (const it of items) {
      console.log(`  T${it.t} — ${it.title}`);
      for (const f of it.findings) console.log(`      🔴 ${f.type}: ${f.detail}`);
    }
  }
  console.log(`\n=== ${redCount} 🔴 drift ${redCount === 0 ? '(sin incoherencias título↔display)' : ''} ===`);
  await sql.end();
  process.exit(redCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
