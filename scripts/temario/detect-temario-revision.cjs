#!/usr/bin/env node
'use strict';
//
// detect-temario-revision.cjs — FASE 2: cola de REVISIÓN de temario. Lista las oposiciones
// activas cuya convocatoria vigente tiene un temario NO verificado del todo contra su fuente
// oficial (o cuya fuente cambió) → toca revisar el temario con el pipeline T-107 (verify:epigrafe
// /scope) y aplicar los diffs al temario vivo. NO copia nada; es solo detección (el humano revisa).
//
// Mismo criterio que el detector `temario_revision_pendiente` del health-sweep. Prioriza por usuarios.
// Uso: node scripts/temario/detect-temario-revision.cjs

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

// Query pura compartida con el health-sweep (mantener en sync).
const QUERY = `
  WITH tv AS (
    SELECT t.position_type,
           count(*)::int temas,
           count(*) FILTER (WHERE ev.state='verified_literal')::int verificados
    FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id=t.id
    WHERE t.is_active GROUP BY 1),
  users AS (SELECT target_oposicion pt, count(*)::int n FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1)
  SELECT replace(o.slug,'-','_') AS position_type, o.slug, COALESCE(u.n,0)::int usuarios, tv.temas, tv.verificados,
    -- comunicados de temario (señal fuerte, espejo de lib/temario/temarioRefiningDoc.js): OBLIGA a
    -- verificar contra ellos, no solo el programa_url (caso CARM ofimática).
    (SELECT count(*)::int FROM convocatoria_documentos cd
       WHERE cd.convocatoria_id=cv.id AND cd.extracted_text IS NOT NULL
    -- OJO con el patrón: la barra-ese NO vale aquí. Medido el 30/07/2026 sobre 6.779 documentos
    -- reales: 'tema\s+[0-9]+' detectaba **1** documento y 'tema[[:space:]]+[0-9]+' detecta **306**. El
    -- literal SQL se lleva la barra por delante y el motor acaba buscando "temas+", que no casa ni
    -- con "TEMA 1". La señal de ">=5 Tema N" llevaba desde el principio sin disparar: lo único que
    -- funcionaba era la rama de ofimática (5 docs), que es justo la que cazó el caso CARM y por eso
    -- el detector parecía sano. Usar SIEMPRE la clase POSIX, que no depende del escapado.
         AND ((SELECT count(*) FROM regexp_matches(cd.extracted_text, 'tema[[:space:]]+[0-9]+', 'gi'))>=5
              OR (cd.extracted_text ~* 'powerpoint' AND cd.extracted_text ~* 'excel'))) AS comunicados_temario
  FROM tv
  JOIN oposiciones o ON o.is_active AND replace(o.slug,'-','_')=tv.position_type
  JOIN convocatorias cv ON cv.oposicion_id=o.id AND cv.is_current
  LEFT JOIN users u ON u.pt=tv.position_type
  WHERE tv.verificados < tv.temas
  ORDER BY usuarios DESC`;

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    const rows = (await c.query(QUERY)).rows;
    const usuarios = rows.reduce((a, r) => a + r.usuarios, 0);
    console.log(`Cola de revisión de temario: ${rows.length} oposiciones · ${usuarios} usuarios afectados`);
    console.log('(convocatoria vigente + temario no verificado del todo → revisar con verify:epigrafe/scope y aplicar al temario vivo)\n');
    const conCom = rows.filter(r => r.comunicados_temario > 0).length;
    if (conCom) console.log(`⚠️  ${conCom} de ellas tienen COMUNICADOS de temario en el hub → verifica contra ellos, no solo el programa_url (caso CARM ofimática).\n`);
    for (const r of rows) console.log(`  ${r.slug} | ${r.usuarios} usuarios | ${r.verificados}/${r.temas} verificados${r.comunicados_temario > 0 ? ` | 🧩 ${r.comunicados_temario} comunicado(s) de temario` : ''}`);
  } finally { await c.end(); }
}

module.exports = { QUERY };
if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
