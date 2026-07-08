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

// --- Lógica PURA de detección (testeable sin BD) ---

const APPS = [
  { key: 'windows', re: /\bwindows\b/i },
  { key: 'word', re: /\bword\b/i },
  { key: 'excel', re: /\bexcel\b/i },
  { key: 'outlook', re: /\boutlook\b/i },
  { key: 'teams', re: /\bteams\b/i },
  { key: 'access', re: /\baccess\b/i },
  { key: 'powerpoint', re: /\bpower\s?point\b/i },
  { key: 'internet', re: /\b(?:red\s+)?internet\b/i },
];

function firstApp(text) {
  if (!text) return null;
  let best = null;
  let pos = Infinity;
  for (const a of APPS) {
    const m = a.re.exec(text);
    if (m && m.index < pos) { pos = m.index; best = a.key; }
  }
  return best;
}
function winVers(text) {
  const s = new Set();
  const re = /windows\s*(10|11)/gi;
  let m;
  while ((m = re.exec(text || '')) !== null) s.add(m[1]);
  return s;
}
function officeVers(text) {
  const s = new Set();
  const re = /\b(2016|2019|2021|365)\b/g;
  let m;
  while ((m = re.exec(text || '')) !== null) s.add(m[1]);
  return s;
}

/** Devuelve un array de hallazgos {type, detail} para un tema. PURA. */
function detectDrift({ title, descripcion_corta, epigrafe, description }) {
  const out = [];
  const tApp = firstApp(title);
  if (!tApp) return out; // no es tema de informática por título → no aplica

  // 1) APP_DRIFT: la descripcion_corta encabeza con otra app distinta a la del título.
  const dcApp = firstApp(descripcion_corta);
  if (dcApp && dcApp !== tApp) {
    out.push({ type: 'APP_DRIFT', detail: `título es '${tApp}' pero descripcion_corta encabeza con '${dcApp}'` });
  }

  const fields = [
    ['descripcion_corta', descripcion_corta],
    ['epigrafe', epigrafe],
    ['description', description],
  ];

  // 2) WIN_VER_DRIFT: alguna versión de Windows del campo que NO esté entre las del título.
  //    (un título "Windows 10/11" cubre ambas → no es drift que un campo diga una de ellas.)
  const tWin = winVers(title);
  if (tWin.size) {
    for (const [f, txt] of fields) {
      for (const v of winVers(txt)) {
        if (!tWin.has(v)) { out.push({ type: 'WIN_VER_DRIFT', detail: `título Windows [${[...tWin]}] pero ${f} dice Windows ${v}` }); break; }
      }
    }
  }

  // 3) OFFICE_VER_DRIFT: alguna versión Office del campo que NO esté entre las del título.
  const tOff = officeVers(title);
  if (tOff.size && ['word', 'excel', 'outlook', 'access', 'powerpoint'].includes(tApp)) {
    for (const [f, txt] of fields) {
      for (const v of officeVers(txt)) {
        if (!tOff.has(v)) { out.push({ type: 'OFFICE_VER_DRIFT', detail: `título ${tApp} [${[...tOff]}] pero ${f} dice ${v}` }); break; }
      }
    }
  }
  return out;
}

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

  const DB_URL = process.env.DATABASE_URL;
  if (!DB_URL) { console.error('❌ DATABASE_URL no configurado'); process.exit(2); }
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
