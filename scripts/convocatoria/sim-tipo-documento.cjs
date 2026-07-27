#!/usr/bin/env node
// scripts/convocatoria/sim-tipo-documento.cjs
//
// SIMULACIÓN del reclasificador de tipos del hub de provenance (T-147). **No escribe NADA**
// sin `--apply`: corre el núcleo puro `lib/convocatoria/tipoDocumento.cjs` sobre los documentos
// que hoy están en `nota` y enseña qué tiparía, con qué confianza y con qué cabecera lo decidió.
//
// Por qué simular antes: el 96% del hub es `nota` y la tentación es tipar en masa. Pero un
// `convocatoria` FALSO es peor que el `nota` de hoy — el `nota` se ignora, el tipo se usa como
// fuente de verdad para comprobar lo que la landing afirma. Así que primero se mide la
// precisión leyendo muestras, y solo después se escribe.
//
// Uso:
//   node scripts/convocatoria/sim-tipo-documento.cjs                 # solo landings vivas (defecto)
//   node scripts/convocatoria/sim-tipo-documento.cjs --todo          # el hub entero
//   node scripts/convocatoria/sim-tipo-documento.cjs --ver <tipo>    # muestra a revisar de un tipo
//   node scripts/convocatoria/sim-tipo-documento.cjs --muestra 12    # tamaño de la muestra
//   node scripts/convocatoria/sim-tipo-documento.cjs --apply         # escribe (solo confianza alta+media)
//   node scripts/convocatoria/sim-tipo-documento.cjs --apply --solo-alta
//
// Relacionado: `docs/runbooks/provenance-convocatorias.md`, T-147, T-142 (el detector que esto
// desbloquea), `backend/scripts/clonar-documento.ts` (el clonador canónico, que sí tipa).

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')
const { clasificarTipoDocumento, cabecera } = require(
  path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'tipoDocumento.cjs'),
)

const argv = process.argv.slice(2)
const TODO = argv.includes('--todo')
const APPLY = argv.includes('--apply')
const SOLO_ALTA = argv.includes('--solo-alta')
const valor = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
const VER = valor('--ver')
const MUESTRA = parseInt(valor('--muestra') || '8', 10)

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL no configurado (RDS)'); process.exit(2) }
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
  try {
    const docs = TODO
      ? await sql`
          SELECT d.id, d.titulo, d.url, d.extracted_text AS texto, d.boletin, o.slug, o.is_active
            FROM convocatoria_documentos d
            LEFT JOIN convocatorias v ON v.id = d.convocatoria_id
            LEFT JOIN oposiciones o ON o.id = v.oposicion_id
           WHERE d.tipo = 'nota'`
      : await sql`
          SELECT d.id, d.titulo, d.url, d.extracted_text AS texto, d.boletin, o.slug, o.is_active
            FROM convocatoria_documentos d
            JOIN convocatorias v ON v.id = d.convocatoria_id AND v.is_current AND v.archived_at IS NULL
            JOIN oposiciones o ON o.id = v.oposicion_id AND o.is_active
           WHERE d.tipo = 'nota'`

    const res = docs.map((d) => ({ d, r: clasificarTipoDocumento(d) }))
    const tipados = res.filter((x) => x.r.tipo !== 'nota')

    console.log(`\n${'='.repeat(78)}`)
    console.log(`SIMULACIÓN de tipos — ${TODO ? 'HUB ENTERO' : 'landings vivas (convocatoria vigente + oposición activa)'}`)
    console.log('='.repeat(78))
    console.log(`  universo en 'nota' : ${docs.length}`)
    console.log(`  se tiparían        : ${tipados.length} (${((tipados.length / (docs.length || 1)) * 100).toFixed(1)}%)`)
    console.log(`  se quedan en 'nota': ${docs.length - tipados.length}  ← ninguna señal; NO se tocan`)

    const porTipo = {}
    for (const x of tipados) {
      porTipo[x.r.tipo] = porTipo[x.r.tipo] || { alta: 0, media: 0 }
      porTipo[x.r.tipo][x.r.confianza]++
    }
    console.log('\n  por tipo (confianza alta / media):')
    for (const [t, c] of Object.entries(porTipo).sort((a, b) => (b[1].alta + b[1].media) - (a[1].alta + a[1].media))) {
      console.log(`    ${t.padEnd(20)} ${String(c.alta + c.media).padStart(4)}   (alta ${c.alta} · media ${c.media})`)
    }

    if (VER) {
      const sel = tipados.filter((x) => x.r.tipo === VER).slice(0, MUESTRA)
      console.log(`\n── MUESTRA para revisar a mano — ${VER} (${sel.length} de ${(porTipo[VER] || { alta: 0, media: 0 }).alta + (porTipo[VER] || { alta: 0, media: 0 }).media}) ──`)
      for (const x of sel) {
        console.log(`\n  · [${x.r.confianza}] ${x.d.slug || '(sin oposición)'} — ${(x.d.titulo || '(sin título)').slice(0, 70)}`)
        console.log(`    ${(x.d.url || '').slice(0, 100)}`)
        console.log(`    cabecera: ${cabecera(x.d.texto).slice(0, 220)}…`)
      }
    } else if (tipados.length) {
      console.log('\n  → revisa una muestra antes de aplicar:  --ver <tipo> [--muestra N]')
    }

    // ── Duplicados: el índice `ux_convocatoria_documentos_conv_dockey` es UNIQUE sobre
    // (convocatoria_id, doc_key) WHERE tipo <> 'nota' — a propósito: las `nota` no deduplican,
    // los documentos tipados sí (uno por documento y convocatoria). Así que una `nota` cuyo
    // doc_key YA tiene una fila tipada en la misma convocatoria **no se re-tipa: es el mismo
    // documento clonado dos veces** y lo que toca es fusionarlo. Sin este filtro, el primer
    // --apply moría entero con un 23505 (pasó el 27/07).
    const claves = tipados.filter((x) => x.d.id).map((x) => x.d.id)
    const ocupados = claves.length
      ? await sql`
          SELECT d.id
            FROM convocatoria_documentos d
            JOIN convocatoria_documentos otro
              ON otro.convocatoria_id = d.convocatoria_id
             AND otro.doc_key = d.doc_key
             AND otro.tipo <> 'nota'
             AND otro.id <> d.id
           WHERE d.id = ANY(${claves}) AND d.doc_key IS NOT NULL`
      : []
    const dup = new Set(ocupados.map((r) => r.id))
    if (dup.size) {
      console.log(`\n  ⚠️  ${dup.size} son DUPLICADOS de un documento ya tipado en su convocatoria (mismo doc_key).`)
      console.log('     No se re-tipan: hay que fusionarlos → node scripts/provenance/merge-dup-docs.cjs --notas')
    }

    if (!APPLY) { console.log('\n(simulación — no se ha escrito nada; usa --apply cuando la muestra convenza)\n'); return }

    const aEscribir = tipados.filter((x) => (!SOLO_ALTA || x.r.confianza === 'alta') && !dup.has(x.d.id))
    console.log(`\n✍️  aplicando ${aEscribir.length}${SOLO_ALTA ? ' (solo confianza alta)' : ''}…`)
    let n = 0
    await sql.begin(async (tx) => {
      for (const x of aEscribir) {
        await tx`UPDATE convocatoria_documentos SET tipo = ${x.r.tipo}, updated_at = NOW() WHERE id = ${x.d.id} AND tipo = 'nota'`
        n++
      }
    })
    console.log(`✅ ${n} documento(s) tipados`)
    try {
      await sql`
        INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), NOW(), 'script:sim-tipo-documento', 'info', 'provenance_tipos_reclasificados',
                ${sql.json({ universo: docs.length, tipados: n, solo_alta: SOLO_ALTA, alcance: TODO ? 'hub' : 'landings_vivas', por_tipo: porTipo })}, NOW())`
    } catch (e) {
      console.error(`⚠️  no se pudo registrar el evento de observabilidad: ${e.message}`)
    }
    console.log('')
  } finally {
    await sql.end()
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
