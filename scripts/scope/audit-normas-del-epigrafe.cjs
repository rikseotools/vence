#!/usr/bin/env node
/**
 * audit-normas-del-epigrafe.cjs — normas que un programa NOMBRA y que su oposición no sirve. (T-055)
 *
 * **BAJO DEMANDA, y NO pinga el badge. La precisión no da para una bandeja automática, y está medida.**
 *
 * ## De dónde sale
 *
 * El Tema 1 de Guardia Civil enumeraba 14 normas en su epígrafe y escopaba 2: DUDH, CEDH, PIDESC,
 * PIDCP, Carta de DDFF de la UE y las dos de tortura existían con **859 preguntas activas** y se
 * servían solo a Policía Nacional. Al arreglarlo, ese tema pasó de 229 a **1.146** preguntas. Ningún
 * detector lo veía (los de huecos buscan leyes con scope CERO; esas tenían scope en otra oposición).
 *
 * ## Por qué NO está en `/admin/contenido`, con los números delante (30/07/2026)
 *
 * Se calibró antes de cablearlo, y por eso no se cableó. Sobre 609 leyes candidatas × 3.489 temas de
 * oposición activa: 891 hallazgos con el criterio inicial → 226 exigiendo 3 palabras significativas y
 * que la ignore la oposición ENTERA → **150** tras excluir las familias ya servidas. Pero al muestrear
 * los mayores, **la mayoría eran falsos positivos**, y por dos causas que un matcher léxico no puede
 * resolver:
 *   · **Equivalencia entre contenedores**: un tema que escopa `LPRL` sale acusado de no servir
 *     `LEY PREVENCIÓN DE RIESGOS LABORALES ENF` — es la misma materia con otro nombre. Igual con
 *     `Excel 2019` / `Excel 365`, donde además la versión **se averigua, no se deduce** ([T-311]).
 *   · **Epígrafes sucios**: los que arrastran un ANEXO del boletín pegado ([kind `epigrafe_ruido_boletin`])
 *     casan palabras que no son del programa.
 *
 * Un badge con esa precisión entrena a ignorar la categoría entera — la lección de [T-047]/[T-113]/
 * [T-179]. Así que esto vive aquí, se corre a mano y **lo adjudica una persona**, igual que
 * `sim-title-boundary` o el detector de vínculo al artículo vecino.
 *
 * Uso:  node scripts/scope/audit-normas-del-epigrafe.cjs [minPalabras=3]
 * Y para engancharla, tras verificarla contra el programa: `scripts/scope/escopar-ley-entera.cjs`.
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { epigrafeNombraLey, clasificar, mismaFamiliaYaServida } = require('../../lib/health/normaDelEpigrafeSinEscopar.cjs')
const MINP = Number(process.argv[2] || 3)
console.log('\n⚠️  BAJO DEMANDA: la precisión medida NO da para el badge (ver cabecera). Cada hallazgo se')
console.log('   verifica contra el programa oficial ANTES de tocar el scope. Falsos positivos conocidos:')
console.log('   contenedores equivalentes con otro nombre y epígrafes con anexos pegados.\n')
;(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const leyes = (await c.query(`
    SELECT l.id, l.short_name, l.name,
           (SELECT count(*)::int FROM questions q JOIN articles a ON a.id=q.primary_article_id WHERE a.law_id=l.id AND q.is_active) preguntas,
           EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id AND t.is_active WHERE ts.law_id=l.id) servida
      FROM laws l WHERE l.is_active`)).rows.filter(l => l.preguntas >= 20)
  const temas = (await c.query(`
    SELECT t.id, t.position_type, t.topic_number, t.epigrafe,
           array(SELECT ts.law_id FROM topic_scope ts JOIN topics t2 ON t2.id=ts.topic_id
                  WHERE t2.position_type = t.position_type AND t2.is_active) escopadas,
           array(SELECT DISTINCT l2.short_name FROM topic_scope ts JOIN topics t2 ON t2.id=ts.topic_id
                   JOIN laws l2 ON l2.id = ts.law_id
                  WHERE t2.position_type = t.position_type AND t2.is_active) nombres_escopados
      FROM topics t
      JOIN oposiciones o ON o.is_active AND replace(o.slug, '_', '-') = replace(t.position_type, '_', '-')
     WHERE t.is_active AND t.epigrafe IS NOT NULL AND length(t.epigrafe) > 40`)).rows
  console.log(`leyes candidatas (activas, >=20 preguntas): ${leyes.length} · temas de oposición ACTIVA con epígrafe: ${temas.length}`)
  const hall = []
  for (const t of temas) {
    const yaTiene = new Set(t.escopadas.map(String))
    for (const l of leyes) {
      if (yaTiene.has(String(l.id))) continue
      const m = epigrafeNombraLey(t.epigrafe, l.short_name, l.name, { minPalabras: MINP })
      if (!m.nombra) continue
      if (mismaFamiliaYaServida(l.short_name, t.nombres_escopados)) continue
      const sev = clasificar({ preguntasActivas: l.preguntas, servidaEnOtraOposicion: l.servida })
      if (sev) hall.push({ pt: t.position_type, tema: t.topic_number, ley: l.short_name, preguntas: l.preguntas, sev, por: m.por })
    }
  }
  const err = hall.filter(h => h.sev === 'error')
  console.log(`\nHALLAZGOS: ${hall.length}  (error ${err.length} · warn ${hall.length - err.length})`)
  const porTema = {}
  for (const h of hall) { const k = `${h.pt} T${h.tema}`; (porTema[k] ||= []).push(h) }
  const top = Object.entries(porTema).sort((a, b) => b[1].reduce((s, x) => s + x.preguntas, 0) - a[1].reduce((s, x) => s + x.preguntas, 0)).slice(0, 12)
  console.log(`temas afectados: ${Object.keys(porTema).length}\n\nTOP 12 por preguntas que el opositor NO practica:`)
  for (const [k, v] of top) console.log(`  ${String(v.reduce((s, x) => s + x.preguntas, 0)).padStart(5)} preg · ${k}: ${v.map(x => `${x.ley}(${x.preguntas})`).join(', ').slice(0, 150)}`)
  // AGREGADO POR OPOSICIÓN: es como se triaría de verdad (y como ya hace `scope_sin_verificar`).
  const porOpo = {}
  for (const h of hall) {
    const o = (porOpo[h.pt] ||= { normas: new Set(), preguntas: 0, temas: new Set() })
    if (!o.normas.has(h.ley)) { o.normas.add(h.ley); o.preguntas += h.preguntas }
    o.temas.add(h.tema)
  }
  const filas = Object.entries(porOpo).map(([pt, o]) => ({ pt, normas: o.normas.size, preguntas: o.preguntas, temas: o.temas.size }))
    .sort((a, b) => b.preguntas - a.preguntas)
  console.log(`\n\nAGREGADO POR OPOSICIÓN: ${filas.length} oposiciones`)
  console.log(`  con >=500 preguntas en juego: ${filas.filter(f => f.preguntas >= 500).length}`)
  console.log(`  con >=200: ${filas.filter(f => f.preguntas >= 200).length}   ·  con >=100: ${filas.filter(f => f.preguntas >= 100).length}`)
  console.log('\nTOP 15:')
  for (const f of filas.slice(0, 15)) console.log(`  ${String(f.preguntas).padStart(5)} preg · ${f.normas} norma(s) en ${f.temas} tema(s) · ${f.pt}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
