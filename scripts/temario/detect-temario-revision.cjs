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
//
// ── comunicados_curados vs comunicados_sin_curar (T-181, 07/08) ────────────────────────────
// La señal ">=5 Tema N / ofimática" es fuerte para decir "esto PARECE un temario", pero no dice
// NADA de si el documento es del CUERPO correcto. `detect-notas-convocatoria` clona TODO enlace
// que encuentra en la página de seguimiento (`notas-extract.ts` → `extractDocLinks`), sin
// comprobar de qué proceso es — y esas páginas listan varios procesos a la vez. Medido hoy contra
// el hub real: `tecnico-informatica`, `administrativo-estado`, `auxiliar-administrativo-estado` y
// `mecanico-conductor-estado` (cuatro cuerpos DISTINTOS, tres de ellos ni siquiera comparten
// dominio de seguimiento) tenían clonada la Orden TDF/568/2025 — la convocatoria de la Subescala
// de Intervención-Tesorería de la Administración Local, un cuerpo que no tiene nada que ver con
// ninguno de los cuatro. `celador-sas` tenía guías clínicas de salud mental (prevención del
// suicidio, esquizofrenia) coladas desde el mismo portal del SAS. Ninguno de estos documentos
// menciona el cuerpo — la lección de `corpusAjeno.cjs` (T-655) ya midió que comparar contra nuestro
// `nombre` comercial da 56% de falsos positivos, así que NO se repite ese enfoque aquí.
//
// La distinción que SÍ existe y no hace falta inventar: `curado`. Solo lo pone `true` quien
// atribuye un documento a propósito (`clonar-documento.ts`, con criterio humano/de sesión) — el
// crawler automático de `detect-notas` SIEMPRE deja `curado=false`. Filtrar por eso no descarta
// nada (`docs:bandeja` sigue siendo la cola donde se decide qué es cada documento sin curar; uno
// de los "sin curar" de celador-sas, `boja151_nuev_prog_mat_varias_cat`, bien podría ser un
// programa legítimo — no se sabe SIN mirarlo), solo dice qué comunicados son ya prueba firme de
// que el programa cambió (curados) y cuáles son solo candidatos que alguien tiene que mirar
// primero (sin curar). Medido contra la cola real (07/08): de 27 oposiciones con "comunicados" por
// la regla vieja, 10 lo eran SOLO por documentos sin curar — puro ruido que hacía perder la señal.
const QUERY = `
  WITH tv AS (
    SELECT t.position_type,
           count(*)::int temas,
           count(*) FILTER (WHERE ev.state='verified_literal')::int verificados
    FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id=t.id
    WHERE t.is_active GROUP BY 1),
  users AS (SELECT target_oposicion pt, count(*)::int n FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1),
  docs_temario AS (
    SELECT cd.convocatoria_id,
           count(*) FILTER (WHERE cd.curado)::int comunicados_curados,
           count(*) FILTER (WHERE NOT cd.curado)::int comunicados_sin_curar
      FROM convocatoria_documentos cd
     WHERE cd.extracted_text IS NOT NULL
    -- OJO con el patrón: la barra-ese NO vale aquí. Medido el 30/07/2026 sobre 6.779 documentos
    -- reales: 'tema\s+[0-9]+' detectaba **1** documento y 'tema[[:space:]]+[0-9]+' detecta **306**. El
    -- literal SQL se lleva la barra por delante y el motor acaba buscando "temas+", que no casa ni
    -- con "TEMA 1". La señal de ">=5 Tema N" llevaba desde el principio sin disparar: lo único que
    -- funcionaba era la rama de ofimática (5 docs), que es justo la que cazó el caso CARM y por eso
    -- el detector parecía sano. Usar SIEMPRE la clase POSIX, que no depende del escapado.
       AND ((SELECT count(*) FROM regexp_matches(cd.extracted_text, 'tema[[:space:]]+[0-9]+', 'gi'))>=5
            OR (cd.extracted_text ~* 'powerpoint' AND cd.extracted_text ~* 'excel'))
     GROUP BY 1)
  SELECT replace(o.slug,'-','_') AS position_type, o.slug, COALESCE(u.n,0)::int usuarios, tv.temas, tv.verificados,
    -- comunicados de temario (señal fuerte, espejo de lib/temario/temarioRefiningDoc.js): los
    -- CURADOS obligan a verificar contra ellos, no solo el programa_url (caso CARM ofimática); los
    -- SIN CURAR son candidatos sin comprobar — pueden ser del cuerpo equivocado.
    COALESCE(dt.comunicados_curados, 0)::int AS comunicados_curados,
    COALESCE(dt.comunicados_sin_curar, 0)::int AS comunicados_sin_curar
  FROM tv
  JOIN oposiciones o ON o.is_active AND replace(o.slug,'-','_')=tv.position_type
  JOIN convocatorias cv ON cv.oposicion_id=o.id AND cv.is_current
  LEFT JOIN users u ON u.pt=tv.position_type
  LEFT JOIN docs_temario dt ON dt.convocatoria_id=cv.id
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
    const conCom = rows.filter(r => r.comunicados_curados > 0).length;
    const conSinCurar = rows.filter(r => r.comunicados_sin_curar > 0).length;
    if (conCom) console.log(`⚠️  ${conCom} de ellas tienen COMUNICADOS de temario CURADOS en el hub → verifica contra ellos, no solo el programa_url (caso CARM ofimática).`);
    if (conSinCurar) console.log(`🔍 ${conSinCurar} de ellas tienen documento(s) candidatos SIN CURAR — el crawler los encontró en la página de seguimiento sin comprobar el cuerpo. NO son prueba de nada por sí solos: triaje con \`npm run docs:bandeja\` antes de fiarte (caso real: Orden TDF/568/2025 de OTRO cuerpo, colada en 4 oposiciones distintas).`);
    if (conCom || conSinCurar) console.log('');
    for (const r of rows) {
      const marcas = [
        r.comunicados_curados > 0 ? `🧩 ${r.comunicados_curados} comunicado(s)` : '',
        r.comunicados_sin_curar > 0 ? `🔍 ${r.comunicados_sin_curar} sin curar` : '',
      ].filter(Boolean).join(' | ');
      console.log(`  ${r.slug} | ${r.usuarios} usuarios | ${r.verificados}/${r.temas} verificados${marcas ? ` | ${marcas}` : ''}`);
    }
  } finally { await c.end(); }
}

module.exports = { QUERY };
if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
