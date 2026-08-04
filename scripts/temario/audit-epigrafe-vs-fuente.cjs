#!/usr/bin/env node
/**
 * audit-epigrafe-vs-fuente.cjs — ¿qué oposiciones sirven un temario que NO está en su fuente?
 *
 *   npm run audit:epigrafe-fuente                 # la cola entera, ordenada por distancia
 *   npm run audit:epigrafe-fuente -- --slug administrativo-asturias
 *   npm run audit:epigrafe-fuente -- --limite 20 --json /tmp/cola.json
 *
 * ## Qué contesta, y por qué no lo contestaba nada
 *
 * [T-528] midió el hueco: **2.295 temas (60%) sin contrastar nunca contra su fuente**, con el
 * `programa_url` disponible en las 126 activas. El documento estaba; lo que faltaba era mirar.
 * Y no se miraba porque parecía caro: el Paso 1 (`verify:epigrafe`) se corre oposición a
 * oposición y exige parsear el boletín, que falla en un tercio de los casos.
 *
 * Esto hace la pregunta barata —**¿el epígrafe de la BD aparece dentro del documento?**— que no
 * necesita parser ni alinear temas ni LLM. No decide nada: **ordena la cola** para que el Paso 1
 * empiece por donde más se miente, en vez de por orden alfabético.
 *
 * ## Lo que NO hace
 *
 * · No escribe. Solo lee la BD y descarga documentos.
 * · No sustituye al Paso 1: un «parafraseado» hay que abrirlo, leerlo y clonarlo a mano.
 * · No pinga badge. Un ratio bajo puede ser paráfrasis NUESTRA o un `programa_url` que apunta a
 *   otro ciclo (el caso Cantabria); son problemas distintos y los dos piden que alguien mire.
 *
 * Núcleo puro: `lib/temario/epigrafeEnFuente.cjs`. Calibrado el 04/08 contra
 * `administrativo_asturias`, cuyos 30 epígrafes se conocían antes y después de clonarlos:
 * **0/30 antes, 30/30 después**.
 */
const path = require('path')
const fs = require('fs')

const REPO = path.resolve(__dirname, '..', '..')
require('dotenv').config({ path: path.join(REPO, '.env.local') })

const { medirOposicion, ordenarCola } = require(path.join(REPO, 'lib/temario/epigrafeEnFuente.cjs'))
// El fetcher es el de `verify:epigrafe`, no uno nuevo: ahí viven resueltos el maxBuffer de
// 256 MB (los boletines gordos se declaraban ilegibles EN SILENCIO) y el timeout de 150 s.
const { fetchProgramaText } = require(path.join(REPO, 'scripts/verify-epigrafe-literality.cjs'))
const { pgConfig } = require(path.join(REPO, 'lib/db/pgSsl.cjs'))
const { Client } = require('pg')

const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d }
const SLUG = arg('--slug')
const LIMITE = Number(arg('--limite', '0')) || 0
const JSON_OUT = arg('--json')

const ICONO = { literal: '✅', parcial: '⚠️ ', parafraseado: '🔴', sin_fuente: '⏭️ ', fuente_no_es_temario: '🔗' }

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  try {
    const filas = (await c.query(`
      -- El nexo topics↔oposiciones es la CONVENCIÓN de nombre (guion bajo ↔ guion): no hay FK.
      -- Comprobado el 04/08: casan 132 de 138 position_type, y las activas con temas son 126,
      -- la misma cifra que midio T-528. Las que no casan se cantan aparte, no se pierden.
      SELECT o.slug, t.position_type, s.programa_url, count(*) AS temas
        FROM topics t
        JOIN oposiciones o ON o.slug = replace(t.position_type, '_', '-')
        JOIN oposiciones_ssot s ON s.slug = o.slug
       WHERE o.is_active AND t.is_active
         AND s.programa_url IS NOT NULL AND s.programa_url <> ''
         AND t.epigrafe IS NOT NULL AND t.epigrafe <> ''
         ${SLUG ? 'AND o.slug = $1' : ''}
       GROUP BY o.slug, t.position_type, s.programa_url
       ORDER BY o.slug`, SLUG ? [SLUG] : [])).rows

    // Lo que este barrido NO puede mirar se dice, no se calla: un límite silencioso se lee como
    // «cubierto todo» (la lección de `--deuda` en los huérfanos y del badge a cero).
    const huerfanas = (await c.query(`
      SELECT DISTINCT t.position_type FROM topics t
       WHERE t.is_active
         AND NOT EXISTS (SELECT 1 FROM oposiciones o WHERE o.slug = replace(t.position_type,'_','-'))
       ORDER BY 1`)).rows.map((r) => r.position_type)

    const objetivo = LIMITE ? filas.slice(0, LIMITE) : filas
    console.log(`\n🔎 EPÍGRAFE vs SU FUENTE — ${objetivo.length} oposición(es) activa(s) con programa_url\n`)

    const resultados = []
    for (const [i, f] of objetivo.entries()) {
      process.stdout.write(`  [${i + 1}/${objetivo.length}] ${f.slug}… `)
      const eps = (await c.query(
        `SELECT topic_number AS tema, epigrafe FROM topics
          WHERE position_type = $1 AND is_active AND epigrafe IS NOT NULL AND epigrafe <> ''`,
        [f.position_type])).rows

      const { text, how } = fetchProgramaText(f.programa_url)
      const r = medirOposicion({ epigrafes: eps, texto: text, motivoSinFuente: text ? null : how })
      resultados.push({ slug: f.slug, position_type: f.position_type, programa_url: f.programa_url, ...r })
      console.log(`${ICONO[r.veredicto]} ${r.veredicto} — ${r.motivo}`)
    }

    const cola = ordenarCola(resultados)
    const cuenta = (v) => cola.filter((x) => x.veredicto === v).length

    console.log('\n════════ RESUMEN ════════')
    console.log(`  ✅ literal      : ${cuenta('literal')}  (todos sus epígrafes están en el documento)`)
    console.log(`  ⚠️  parcial      : ${cuenta('parcial')}  (unos sí y otros no — mirar cuáles)`)
    console.log(`  🔴 parafraseado : ${cuenta('parafraseado')}  (NINGUNO está: el temario servido no es el oficial)`)
    console.log(`  🔗 enlace malo  : ${cuenta('fuente_no_es_temario')}  (el programa_url apunta a un documento SIN temas: deuda de ENLACE)`)
    console.log(`  ⏭️  sin fuente   : ${cuenta('sin_fuente')}  (no se pudo descargar/leer: tampoco dice nada del temario)`)

    const NO_ACCIONABLE = new Set(['sin_fuente', 'fuente_no_es_temario'])
    const accionables = cola.filter((x) => !NO_ACCIONABLE.has(x.veredicto) && x.ratio !== 1)
    if (accionables.length) {
      console.log('\n════════ COLA — por dónde empezar el Paso 1 ════════')
      console.log('  (ordenada por epígrafes que NO están en su fuente; es lo que más opositores lee mal)\n')
      for (const x of accionables.slice(0, 25)) {
        console.log(`  ${ICONO[x.veredicto]} ${x.slug.padEnd(46)} ${String(x.ausentes).padStart(3)} de ${x.medibles} fuera de su fuente`)
      }
      if (accionables.length > 25) console.log(`  … y ${accionables.length - 25} más (usa --json para la lista entera)`)
      console.log('\n  → Para atacar una:  docs/runbooks/verificar-epigrafes-scope.md (Paso 1)')
    }

    // Se listan APARTE, nunca dentro de la cola de temario: son un problema distinto (el enlace)
    // y mezclarlos pondría los enlaces rotos por delante de las paráfrasis reales.
    const enlaces = cola.filter((x) => NO_ACCIONABLE.has(x.veredicto))
    if (enlaces.length) {
      console.log('\n════════ DEUDA DE ENLACE — no es drift de temario ════════')
      console.log('  (el programa_url no sirve un temario: hasta arreglarlo no se puede medir nada)\n')
      for (const x of enlaces.slice(0, 15)) {
        console.log(`  ${ICONO[x.veredicto]} ${x.slug.padEnd(46)} ${x.motivo}`)
        console.log(`     ${x.programa_url}`)
      }
      if (enlaces.length > 15) console.log(`     … y ${enlaces.length - 15} más`)
      console.log('\n  → frase-gatillo: «revisa los enlaces de convocatoria» (salud-contenido.md)')
    }

    if (huerfanas.length) {
      console.log(`\n  ⚠️  ${huerfanas.length} position_type con temas NO casan con ningún slug de \`oposiciones\` y quedan FUERA de esta medida:`)
      console.log(`     ${huerfanas.join(', ')}`)
    }
    if (LIMITE && filas.length > LIMITE) {
      console.log(`\n  ⚠️  --limite ${LIMITE}: quedan ${filas.length - LIMITE} oposiciones SIN medir.`)
    }

    if (JSON_OUT) {
      fs.writeFileSync(JSON_OUT, JSON.stringify(cola, null, 1))
      console.log(`\n  → ${JSON_OUT}`)
    }
    console.log()
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
