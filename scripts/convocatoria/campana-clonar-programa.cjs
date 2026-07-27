#!/usr/bin/env node
// scripts/convocatoria/campana-clonar-programa.cjs
//
// CAMPAÑA: clonar al hub de provenance el documento del botón oficial (`programa_url`) de las
// landings activas que aún no lo tienen. **Dry-run por defecto.**
//
// ## Por qué (T-147, 27/07/2026)
//
// Al enseñar al detector de cifras a sumar quedó claro que lo que queda ya NO es ruido: es que
// **falta el papel**. `administrativo-madrid` afirma "47 temas del programa" y sus 3 documentos
// clonados no contienen ni un «Tema N» — el Anexo III con el temario no está en el hub. Y hay un
// hueco sistémico detrás: `programa_url` es el documento MÁS oficial de la landing (el botón "Ver
// convocatoria en …") y **nadie lo clona nunca**: el cron `detect-notas` clona lo que cuelga de
// la página de seguimiento, no esto. Medido: **44 de 122 landings activas** con `programa_url`
// fuera del hub, 7 de ellas sin ningún documento tipado.
//
// ## Cómo, sin duplicar nada
//
// Este script DECIDE (qué falta, si el documento sirve, de qué tipo es) y delega el ESCRIBIR en
// la herramienta canónica del backend, `backend/scripts/clonar-documento.ts`, que ya sabe leer
// PDF y HTML, rechazar paredes de portal, marcar `curado` y escribir por
// `ensure_convocatoria_documento` con `boletin_doc_key`. Los tres núcleos que usa para decidir
// son los compartidos: `documentoFuente.cjs`, `tipoDocumento.cjs` y `canonicalizeBoletinUrl.cjs`.
//
// **No clona a ciegas:** si el documento no se puede leer, si es una pared del portal o si el
// clasificador no reconoce QUÉ es, se salta y se reporta para revisión humana. Un documento
// tipado a lo bruto se usaría luego como fuente de verdad.
//
// Uso:
//   node scripts/convocatoria/campana-clonar-programa.cjs            # qué haría (no escribe)
//   node scripts/convocatoria/campana-clonar-programa.cjs --limite 5 # lote corto
//   node scripts/convocatoria/campana-clonar-programa.cjs --slug X   # una sola
//   node scripts/convocatoria/campana-clonar-programa.cjs --apply
//
// Relacionado: `docs/runbooks/provenance-convocatorias.md` §2.2, T-147, T-142.

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { execFileSync } = require('child_process')
const postgres = require('postgres')
const { verificar, pareceBoletinCompleto } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'documentoFuente.cjs'))
const { clasificarTipoDocumento } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'tipoDocumento.cjs'))
const { boletinDeUrl } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'canonicalizeBoletinUrl.cjs'))

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const valor = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
const LIMITE = parseInt(valor('--limite') || '0', 10)
const SLUG = valor('--slug')
const RAIZ = path.join(__dirname, '..', '..')

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL no configurado (RDS)'); process.exit(2) }
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
  const resumen = { candidatas: 0, clonadas: 0, saltadas: [], fallidas: [] }
  try {
    const pendientes = await sql`
      SELECT o.slug, o.nombre, v.programa_url, v.id AS conv_id,
             (SELECT count(*) FROM convocatoria_documentos d
               WHERE d.convocatoria_id = v.id AND d.tipo <> 'nota')::int AS tipados
        FROM oposiciones o
        JOIN convocatorias v ON v.oposicion_id = o.id AND v.is_current AND v.archived_at IS NULL
       WHERE o.is_active
         AND v.programa_url IS NOT NULL
         AND ${SLUG ? sql`o.slug = ${SLUG}` : sql`true`}
         AND NOT EXISTS (
           SELECT 1 FROM convocatoria_documentos d
            WHERE d.convocatoria_id = v.id
              AND (d.url = v.programa_url OR d.doc_key = boletin_doc_key(v.programa_url)))
       ORDER BY (SELECT count(*) FROM convocatoria_documentos d2
                  WHERE d2.convocatoria_id = v.id AND d2.tipo <> 'nota') ASC, o.slug`
    const lote = LIMITE > 0 ? pendientes.slice(0, LIMITE) : pendientes
    resumen.candidatas = lote.length

    console.log(`\n${'='.repeat(78)}`)
    console.log(`CAMPAÑA de clonado del documento oficial — ${lote.length} landing(s)${LIMITE ? ` (de ${pendientes.length})` : ''}`)
    console.log('='.repeat(78))
    console.log('  Se prioriza a las que hoy no tienen NINGÚN documento tipado.\n')

    for (const p of lote) {
      const { boletin } = boletinDeUrl(p.programa_url)
      process.stdout.write(`· ${p.slug} (tipados=${p.tipados}) … `)

      const v = await verificar(p.programa_url, [])
      if (!v.ok) {
        console.log(`⏭️  ${v.motivo}`)
        resumen.saltadas.push({ slug: p.slug, motivo: v.motivo })
        continue
      }
      // El boletín entero NO se clona: respaldaría cualquier cifra (ver `pareceBoletinCompleto`).
      const recopilatorio = pareceBoletinCompleto(v.texto)
      if (recopilatorio) {
        console.log(`⏭️  ${recopilatorio} — el programa_url apunta al boletín, no al anuncio`)
        resumen.saltadas.push({ slug: p.slug, motivo: recopilatorio })
        continue
      }
      const cl = clasificarTipoDocumento({ titulo: p.slug, url: p.programa_url, texto: v.texto })
      if (cl.tipo === 'nota') {
        // Dos cosas MUY distintas se esconden bajo "no reconocido", y mezclarlas deja al
        // siguiente sin saber qué hacer. Medido en la primera pasada (17 casos): la mayoría no
        // son documentos, son la FICHA WEB del proceso en la sede ("Detalle del trámite |
        // Sede electrónica", "JavaScript está deshabilitado", el aviso de cookies del DOGC).
        // Para esas, el arreglo NO es clonar mejor: es repuntar `programa_url` al documento
        // (`repuntar-enlace-convocatoria.cjs`) — familia del detector `convocatoria_enlace_no_boletin`.
        const esPortal = /sede electr[óo]nica|detalle del tr[áa]mite|pasar al contenido|javascript est[áa] deshabilitado|pol[íi]tica de cookies|men[uú] principal/i
          .test(v.texto.slice(0, 3000))
        const motivo = esPortal
          ? 'NO es un documento: es la ficha web del proceso → repuntar programa_url'
          : 'documento real que el clasificador no reconoce → calibrar regla o tipar a mano'
        console.log(`⏭️  ${motivo} (${v.chars} chars)`)
        resumen.saltadas.push({ slug: p.slug, motivo })
        continue
      }
      console.log(`${cl.tipo} [${cl.confianza}] · ${v.chars} chars${boletin ? ` · ${boletin}` : ''}`)
      if (!APPLY) continue

      // Escribir NO es cosa de este script: lo hace la herramienta canónica del backend.
      try {
        const args = [
          'tsx', 'scripts/clonar-documento.ts',
          `--slug=${p.slug}`, `--url=${p.programa_url}`, `--tipo=${cl.tipo}`,
          `--titulo=${cl.tipo} oficial de ${p.nombre} (documento del botón de convocatoria)`,
        ]
        if (boletin) args.push(`--boletin=${boletin}`)
        execFileSync('npx', args, {
          cwd: path.join(RAIZ, 'backend'),
          env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
          encoding: 'utf8',
          timeout: 120000,
        })
        resumen.clonadas++
        console.log('   ✅ clonado y curado')
      } catch (e) {
        const msg = String(e.stdout || e.message).split('\n').filter(Boolean).pop() || e.message
        console.log(`   ❌ ${msg.slice(0, 120)}`)
        resumen.fallidas.push({ slug: p.slug, error: msg.slice(0, 200) })
      }
    }

    console.log(`\n── RESUMEN: ${resumen.clonadas} clonadas · ${resumen.saltadas.length} saltadas · ${resumen.fallidas.length} fallidas`)
    if (resumen.saltadas.length) {
      console.log('   saltadas (necesitan ojo humano):')
      for (const s of resumen.saltadas) console.log(`     · ${s.slug}: ${s.motivo}`)
    }
    if (!APPLY) { console.log('\n(dry-run — repite con --apply)\n'); return }

    try {
      await sql`
        INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), NOW(), 'script:campana-clonar-programa', 'info', 'provenance_programa_clonado',
                ${sql.json(resumen)}, NOW())`
    } catch (e) {
      console.error(`⚠️  no se pudo registrar el evento de observabilidad: ${e.message}`)
    }
    console.log('')
  } finally {
    await sql.end()
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
