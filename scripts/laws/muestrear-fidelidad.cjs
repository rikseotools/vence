#!/usr/bin/env node
/**
 * Muestrea artículos de una ley (o de varias) y compara su TEXTO contra la fuente oficial —
 * el punto ciego de `audit-law-completeness.cjs`, que solo cuenta filas (T-240).
 *
 * Uso:
 *   node scripts/laws/muestrear-fidelidad.cjs <law_slug> [--n 5]
 *   node scripts/laws/muestrear-fidelidad.cjs [--limite 15] [--n 5]        # barrido priorizado
 *   node scripts/laws/muestrear-fidelidad.cjs <law_slug> --json
 *   node scripts/laws/muestrear-fidelidad.cjs <law_slug> --aplicar          # deja rastro en observable_events
 *
 * POR QUÉ EXISTE (T-240, documentado en docs/runbooks/completitud-leyes.md §"COMPLETO ≠ FIEL").
 * `classifyLawCompleteness` responde «¿están todos los artículos?» contando filas. El RGPD
 * contestaba que sí — 99/99, is_ok: true — con 72 de esos 99 artículos reescritos en paráfrasis.
 * Auditar las 126 leyes activas artículo por artículo sería carísimo (miles de fetches al
 * BOE/EUR-Lex) y no hace falta para DETECTAR el patrón: basta MUESTREAR unos pocos por ley.
 *
 * QUÉ NO HACE, a propósito:
 *  · No reescribe nada. Es un DETECTOR — el remedio (reimportar) es `actualizar-articulo-oficial.cjs`,
 *    que ya existe y tiene su propia política de qué reescribir sin supervisión.
 *  · No inventa fuente: usa `resolverFuente` (lib/laws/fidelidadMuestra.js), que reconoce BOE
 *    consolidado y EUR-Lex CONSOLIDADO (CELEX que empieza por 0) y se NIEGA a comparar contra el
 *    espejo del BOE de una norma UE (reproduce erratas) o contra un CELEX no consolidado.
 *  · No barre TODO el banco por diseño: `--limite` (por defecto 15) prioriza por impacto
 *    (preguntas activas), igual que `audit-law-completeness.cjs`.
 *  · Reutiliza `compararArticuloOficial` (14 tests) para el veredicto por artículo — la
 *    distinción `identico`/`erratas`/`reordenado`/`incompleto`/`contaminado`/`sin_oficial` no se
 *    reescribe aquí.
 *
 * Salida: por ley, veredicto `fiel`/`revisar_muestra`/`auditoria_completa`/`inconcluso`
 * (lib/laws/fidelidadMuestra.js → clasificarFidelidadLey). `auditoria_completa` es la señal para
 * "revisa la completitud de las leyes" §"COMPLETO ≠ FIEL": esa ley entera pide una pasada con
 * `actualizar-articulo-oficial.cjs` o inserción manual verbatim.
 */
require('dotenv').config({ path: '.env.local' })
const path = require('path')
const pg = require('postgres')
const { urlLecturaNegocioConFuente } = require(path.join(__dirname, '..', '..', 'lib', 'db', 'negocioSoloLectura.cjs'))
const { elegirMuestra, resolverFuente, clasificarFidelidadLey } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'fidelidadMuestra.js'))
const { compararArticuloOficial } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'compararArticuloOficial.js'))
const { abrirFuenteBoe } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'fuenteOficialBoe.cjs'))
const { descargarDocumentoOficial } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'descargarEurlex.cjs'))
const { parrafosDeEurLex } = require(path.join(__dirname, '..', '..', 'lib', 'laws', 'eurlexConsolidado.js'))

const argv = process.argv.slice(2)
const APLICAR = argv.includes('--aplicar')
const JSON_OUT = argv.includes('--json')
const FLAGS_CON_VALOR = new Set(['--n', '--limite', '--umbral'])
const valor = (f, def) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def
}
const N = parseInt(valor('--n', '5'), 10)
const LIMITE = parseInt(valor('--limite', '15'), 10)
const UMBRAL = parseFloat(valor('--umbral', '0.6'))
// Posicional = lo que no es una bandera ni el valor consumido por una bandera con valor.
const posicionales = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    if (FLAGS_CON_VALOR.has(argv[i])) i++ // salta el valor que consume
    continue
  }
  posicionales.push(argv[i])
}
const SLUG = posicionales[0] || null

/** Abre un lector `.articulo(n, title) → {texto}|null` para el `tipo`/`id` que resolvió `resolverFuente`. */
async function abrirLector(fuente, log) {
  if (fuente.tipo === 'boe') return abrirFuenteBoe(fuente.id, { log })
  const { html } = await descargarDocumentoOficial(fuente.id, { log })
  return {
    tipo: 'eurlex',
    async articulo(numero, title) {
      const p = parrafosDeEurLex(html, numero, title)
      return p ? { texto: p.texto } : null
    },
  }
}

async function main() {
  const cred = urlLecturaNegocioConFuente()
  if (!cred) {
    console.error('❌ ni VENCE_LECTOR_URL ni DATABASE_URL configurados')
    process.exit(2)
  }
  const sql = pg(cred.url, { ssl: { rejectUnauthorized: false }, max: 4, connect_timeout: 30 })

  try {
    const leyes = await sql`
      SELECT l.id, l.short_name, l.slug, l.boe_url,
             (SELECT count(*)::int FROM questions q JOIN articles a ON a.id = q.primary_article_id
               WHERE a.law_id = l.id AND q.is_active) AS preg
        FROM laws l
       WHERE l.is_active AND NOT COALESCE(l.is_virtual, false)
         AND l.boe_url IS NOT NULL AND l.boe_url <> ''
         AND (${SLUG}::text IS NULL OR l.slug = ${SLUG})
       ORDER BY preg DESC`

    if (!leyes.length) {
      console.error(SLUG ? `❌ no existe (o no tiene boe_url) la ley "${SLUG}"` : '❌ ninguna ley activa con boe_url')
      await sql.end()
      process.exit(2)
    }

    const lote = SLUG ? leyes : leyes.slice(0, LIMITE)
    console.log(`\n═══ MUESTREO DE FIDELIDAD (fuente: ${cred.fuente}) ═══`)
    console.log(`  candidatas con boe_url: ${leyes.length}${SLUG ? '' : ` · se muestrean ${lote.length} (--limite ${LIMITE}, por impacto)`} · n=${N} por ley\n`)

    const resultados = []
    for (const ley of lote) {
      const fuente = resolverFuente(ley.boe_url)
      if (!fuente.tipo) {
        resultados.push({ ...ley, omitida: fuente.motivo })
        console.log(`  ⏭️  ${ley.short_name} — omitida (${fuente.motivo}${fuente.detalle ? `: ${fuente.detalle}` : ''})`)
        continue
      }

      // Solo "Artículo N[ bis…]" con N≥1: el índice del BOE (mapaBloquesPorArticulo) únicamente
      // mapea rúbricas que empiezan por "Artículo" — el preámbulo, las disposiciones y la fila
      // estructural `article_number='0'` (preguntas de estructura de la norma, ver
      // reanclarGuardas.js) nunca resuelven bloque y saldrían `sin_oficial` siempre, gastando
      // muestra en algo que no se puede medir. Medido en vivo (CE, 170 artículos numéricos): sin
      // excluir '0' explícitamente, 1 de 5 muestreados seguía siendo la fila estructural.
      const arts = await sql`
        SELECT article_number AS n, content, title
          FROM articles
         WHERE law_id = ${ley.id} AND is_active AND article_number ~ '^[0-9]' AND article_number <> '0'
         ORDER BY NULLIF(regexp_replace(article_number, '\\D', '', 'g'), '')::int NULLS LAST, article_number`
      if (!arts.length) {
        console.log(`  ⏭️  ${ley.short_name} — sin artículos activos`)
        continue
      }

      const muestra = elegirMuestra(arts, N)
      let lector
      try {
        lector = await abrirLector(fuente, () => {})
      } catch (e) {
        resultados.push({ ...ley, omitida: `fuente inaccesible: ${e.message.slice(0, 80)}` })
        console.log(`  ⚠️  ${ley.short_name} — no se pudo abrir la fuente (${e.message.slice(0, 80)})`)
        continue
      }

      const clases = []
      const detalle = []
      for (const a of muestra) {
        let oficial = null
        try {
          oficial = await lector.articulo(a.n, a.title)
        } catch {
          oficial = null
        }
        const cmp = compararArticuloOficial(a.content, oficial ? oficial.texto : '')
        clases.push(cmp.clase)
        detalle.push({ n: a.n, clase: cmp.clase, resumen: cmp.resumen })
      }

      const veredicto = clasificarFidelidadLey(clases, { umbral: UMBRAL })
      resultados.push({ ...ley, fuente: `${fuente.tipo}:${fuente.id}`, ...veredicto, detalle })

      const etiqueta = {
        fiel: '✅ fiel',
        revisar_muestra: '🟡 revisar_muestra',
        auditoria_completa: '🔴 AUDITORIA_COMPLETA',
        inconcluso: '⚠️  inconcluso (fuente no legible)',
      }[veredicto.veredicto]
      console.log(`  ${etiqueta.padEnd(28)} ${String(ley.preg).padStart(4)}p  ${ley.short_name}  [${clases.join(', ')}]`)
      if (veredicto.veredicto !== 'fiel') {
        for (const d of detalle.filter((x) => x.clase !== 'identico')) console.log(`      art. ${d.n}: ${d.clase} — ${d.resumen}`)
      }
    }

    const auditoria = resultados.filter((r) => r.veredicto === 'auditoria_completa')
    const revisar = resultados.filter((r) => r.veredicto === 'revisar_muestra')
    console.log(`\n  🔴 auditoría completa: ${auditoria.length} · 🟡 revisar muestra: ${revisar.length} · ⏭️  omitidas: ${resultados.filter((r) => r.omitida).length}`)
    if (auditoria.length) {
      console.log(`\n  Revisar contra la fuente y reimportar (docs/runbooks/completitud-leyes.md §3, o \`actualizar-articulo-oficial.cjs\`):`)
      auditoria.forEach((r) => console.log(`     · ${r.short_name} (${r.preg}p) — ${r.noFieles}/${r.medibles} de la muestra no son el texto oficial`))
    }

    if (APLICAR) {
      for (const r of resultados) {
        if (!r.veredicto) continue // omitida: nada que registrar como muestreo
        await sql`
          INSERT INTO observable_events (source, severity, event_type, endpoint, error_message, metadata)
          VALUES ('script',
                  ${r.veredicto === 'auditoria_completa' ? 'error' : r.veredicto === 'revisar_muestra' ? 'warn' : 'info'},
                  'law_fidelity_sampled', 'muestrear-fidelidad', null,
                  ${sql.json({ law_id: r.id, short_name: r.short_name, fuente: r.fuente, ...r, detalle: undefined })})`
          .catch((e) => console.log(`     (evento no escrito para ${r.short_name}: ${e.message.slice(0, 60)})`))
      }
      console.log('\n  📡 rastro dejado en observable_events (event_type=law_fidelity_sampled).')
    } else if (!JSON_OUT) {
      console.log('\n  (simulación — añade --aplicar para dejar rastro en observable_events)')
    }

    if (JSON_OUT) console.log(JSON.stringify({ total: resultados.length, auditoria: auditoria.length, revisar: revisar.length, resultados }))

    await sql.end()
    process.exitCode = auditoria.length ? 1 : 0
  } catch (e) {
    console.error('❌', e.message)
    await sql.end()
    process.exit(1)
  }
}

main()
