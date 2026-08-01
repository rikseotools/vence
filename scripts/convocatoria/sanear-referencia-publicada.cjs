#!/usr/bin/env node
'use strict'
/**
 * Saca las NOTAS INTERNAS de los campos que la landing publica, sin perder la nota. [T-435]
 *
 * ## Qué problema resuelve
 *
 * `boe_reference` (y sus hermanos) se estaban usando como bloc de notas de auditoría, y ese campo
 * se PINTA en el hero de la landing y bajo el botón «Ver convocatoria en …». El 31/07/2026 había
 * **7 oposiciones publicadas** sirviéndolo, la peor: *«⚠️ SIN VERIFICAR: la fila afirma 688 plazas…»*
 * en `celador-sermas-madrid`, o sea, diciéndole al opositor que no nos fiamos de nuestro dato.
 *
 * ## La regla que lo hace seguro: NO SE TIRA NADA Y NO SE INVENTA NADA
 *
 *  · Lo que va DELANTE del marcador (la cita del boletín) se conserva tal cual: ya estaba escrito
 *    para el usuario.
 *  · Lo que va DETRÁS se **muda** a `convocatoria_verification` (`source_snippet` + `findings`),
 *    que es la tabla donde ya vive la verificación de convocatorias. La duda no desaparece: deja
 *    de publicarse y pasa a ser un ESTADO consultable, que es lo que tenía que haber sido.
 *  · Si el valor **empieza** por el marcador no queda nada publicable, y entonces la referencia
 *    hay que pasarla con `--referencia "…"` tras abrir el boletín. Sin eso, ese caso NO se toca:
 *    adivinar un localizador oficial es indefendible — de hecho la primera versión del núcleo lo
 *    intentaba y proponía `BOCM-20250704-16`, que es justo el documento que la nota descartaba.
 *
 * ## Uso
 *
 *   node scripts/convocatoria/sanear-referencia-publicada.cjs                  # SIMULA todo
 *   node scripts/convocatoria/sanear-referencia-publicada.cjs --apply          # aplica los seguros
 *   node scripts/convocatoria/sanear-referencia-publicada.cjs --slug celador-sermas-madrid \
 *        --referencia "BOCM nº 158, de 4 de julio de 2025" --apply
 *
 * Dry-run por defecto. Dual-write: escribe en `convocatorias` (que es de donde lee la vista SSOT)
 * y en `oposiciones` si esa fila también lo trae, para que no queden dos verdades.
 */
const fs = require('fs')
const path = require('path')
const postgres = require('postgres')
const { clasificarLote } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'notaInternaPublicada.cjs'))

const APPLY = process.argv.includes('--apply')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i < 0 || !v || v.startsWith('--') ? null : v }
const SOLO = arg('--slug')
const REFERENCIA = arg('--referencia')
// «He abierto el boletín y las cifras cuadran». Exige --referencia porque la referencia sólo se
// puede escribir habiéndola leído; sin eso, la duda de la nota sigue viva en la tabla.
const VERIFICADO = process.argv.includes('--verificado')
// La cita LITERAL del documento en la que se apoya la verificación. Se comprueba contra el texto
// del documento CLONADO EN EL HUB (`convocatoria_documentos`), no contra una descarga privada:
// una verificación cuya prueba solo existió en la terminal de quien la hizo no es provenance.
const CITA = arg('--cita')
if (VERIFICADO && (!REFERENCIA || !CITA)) {
  console.error('❌ --verificado exige --referencia "<la del boletín>" y --cita "<literal del documento>"')
  console.error('   La cita se contrasta contra el documento clonado en convocatoria_documentos.')
  process.exit(2)
}

/** Aplana para comparar: el texto extraído de un PDF trae saltos y espacios donde le apetece. */
const aplanar = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase()

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  return fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8')
    .match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

;(async () => {
  const s = postgres(url(), { max: 2 })
  let saneadas = 0, aMano = 0
  try {
    const filas = await s`
      SELECT slug, is_active, boe_reference, diario_referencia, convocatoria_numero, oep_decreto
        FROM oposiciones_ssot ${SOLO ? s`WHERE slug = ${SOLO}` : s``}`
    const { publicadas, catalogadas } = clasificarLote(filas.map((f) => ({
      slug: f.slug,
      isActive: f.is_active,
      campos: {
        boe_reference: f.boe_reference, diario_referencia: f.diario_referencia,
        convocatoria_numero: f.convocatoria_numero, oep_decreto: f.oep_decreto,
      },
    })))

    console.log(`${APPLY ? '✍️  APLICANDO' : '🔎 SIMULACIÓN (usa --apply para escribir)'}`)
    console.log(`   publicadas con nota: ${publicadas.length} · catalogadas: ${catalogadas.length}\n`)

    for (const h of publicadas) {
      // La referencia limpia sale del propio texto (lo de delante del marcador) o la pone una
      // persona con --referencia. Nunca de una heurística.
      const nueva = h.limpio || (SOLO === h.slug ? REFERENCIA : null)
      if (!nueva) {
        aMano++
        console.log(`  ⏭️  ${h.slug} · ${h.campo} [${h.tipo}] — NO se toca: no hay parte publicable.`)
        console.log(`      Abre el boletín y pásala:  --slug ${h.slug} --referencia "<referencia oficial>" --apply`)
        continue
      }
      console.log(`  ✅ ${h.slug} · ${h.campo} [${h.tipo}]`)
      console.log(`      publica → ${nueva.slice(0, 120)}${nueva.length > 120 ? '…' : ''}`)
      console.log(`      muda    → convocatoria_verification (${(h.nota || '').length} chars)`)
      if (!APPLY) { saneadas++; continue }

      await s.begin(async (tx) => {
        // 1) La nota se MUDA a la tabla de verificación, atada a la convocatoria vigente. El estado
        //    conserva la duda: si la nota decía «sin verificar», sigue sin estar verificada — solo
        //    deja de leerlo el opositor.
        const [conv] = await tx`
          SELECT c.id FROM convocatorias c
            JOIN oposiciones o ON o.id = c.oposicion_id
           WHERE o.slug = ${h.slug} AND c.is_current = true LIMIT 1`
        if (conv) {
          // `needs_human` por defecto: mudar la nota NO resuelve la duda, solo deja de publicarla.
          // Solo se marca verificada si quien ejecuta aporta la referencia Y la cita literal, y la
          // cita se CONTRASTA contra el documento clonado en el hub.
          //
          // Por qué contra el hub y no contra una descarga: el sistema ya clona los documentos
          // oficiales (`convocatoria_documentos`, con `content_hash` y `extracted_text`), y una
          // verificación cuya prueba solo existió en la terminal de quien la hizo no es provenance
          // — nadie puede volver a comprobarla. Caso real (T-435): el documento correcto del
          // Celador YA estaba clonado, y la nota de auditoría afirmaba lo contrario.
          let doc = null
          if (VERIFICADO) {
            // Se busca la cita entre TODOS los documentos de la convocatoria, no en «el primero».
            // Medido el 01/08: `auxiliar-administrativo-clm` tiene 20 documentos clonados y el
            // primero por tipo/fecha era un PDF de temarios — la guarda rechazó una cita que SÍ
            // estaba en el decreto. Coger el que contiene la prueba es además más útil: la fila de
            // verificación acaba apuntando al documento que de verdad la respalda.
            const docs = await tx`
              SELECT id, url, content_hash, extracted_text
                FROM convocatoria_documentos
               WHERE convocatoria_id = ${conv.id} AND extracted_text IS NOT NULL
               ORDER BY (tipo = 'convocatoria') DESC, created_at DESC`
            const d = docs.find((x) => aplanar(x.extracted_text).includes(aplanar(CITA))) || docs[0]
            if (!d) {
              throw new Error(
                `--verificado: ${h.slug} no tiene documento en el hub de provenance.\n` +
                '   Clónalo con la herramienta CANÓNICA (esta no clona, a propósito — un segundo\n' +
                '   camino de escritura al hub es justo lo que `ensure_convocatoria_documento`\n' +
                '   existe para impedir):\n' +
                '      npx tsx backend/scripts/clonar-documento.ts <convocatoria_id> <url>')
            }
            if (!aplanar(d.extracted_text).includes(aplanar(CITA))) {
              throw new Error(
                `--verificado: la cita no aparece en NINGUNO de los ${docs.length} documento(s) ` +
                `clonados de ${h.slug}. O está mal transcrita, o el documento que la respalda aún ` +
                'no está en el hub (clónalo con backend/scripts/clonar-documento.ts).')
            }
            doc = d
          }
          const estado = VERIFICADO ? 'verified_correct' : 'needs_human'
          const verdict = VERIFICADO ? 'correct' : 'needs_human'
          await tx`
            INSERT INTO convocatoria_verification
              (convocatoria_id, state, source_snippet, source_url, verified_source_hash,
               verdict, findings, verified_by, verified_at, created_at, updated_at)
            VALUES (${conv.id}, ${estado},
                    ${doc ? String(CITA).slice(0, 4000) : String(h.nota).slice(0, 4000)},
                    ${doc ? doc.url : null}, ${doc ? doc.content_hash : null}, ${verdict},
                    ${tx.json({ origen: 'T-435', campo: h.campo, tipo: h.tipo, nota_retirada: h.nota,
                                documento_hub: doc ? doc.url : null })},
                    'sanear-referencia-publicada', ${VERIFICADO ? new Date() : null}, now(), now())
            ON CONFLICT (convocatoria_id) DO UPDATE
               SET source_snippet = EXCLUDED.source_snippet,
                   source_url = COALESCE(EXCLUDED.source_url, convocatoria_verification.source_url),
                   verified_source_hash = COALESCE(EXCLUDED.verified_source_hash, convocatoria_verification.verified_source_hash),
                   state = EXCLUDED.state,
                   verdict = EXCLUDED.verdict,
                   verified_at = EXCLUDED.verified_at,
                   findings = COALESCE(convocatoria_verification.findings, '{}'::jsonb) || EXCLUDED.findings,
                   updated_at = now()`
          await tx.unsafe(
            `UPDATE convocatorias SET "${h.campo}" = $1, updated_at = now() WHERE id = $2`, [nueva, conv.id])
        }
        // 2) Dual-write: la fila de `oposiciones` guarda una copia legacy del mismo campo.
        await tx.unsafe(
          `UPDATE oposiciones SET "${h.campo}" = $1 WHERE slug = $2 AND "${h.campo}" IS NOT NULL`, [nueva, h.slug])
      })
      saneadas++
    }

    // ── ENLAZAR LA PRUEBA en una fila YA saneada ────────────────────────────────────────────
    // Sin esto hacía falta un script suelto para el caso «el campo ya está limpio pero la
    // verificación no apunta a ningún documento», y un one-off fuera del camino canónico es
    // precisamente lo que deja provenance sin rastro. Misma guarda: la cita se contrasta.
    if (SOLO && VERIFICADO && !publicadas.length) {
      const [conv] = await s`
        SELECT c.id FROM convocatorias c JOIN oposiciones o ON o.id = c.oposicion_id
         WHERE o.slug = ${SOLO} AND c.is_current = true LIMIT 1`
      if (!conv) throw new Error(`no hay convocatoria vigente para ${SOLO}`)
      const docs = await s`
        SELECT url, content_hash, extracted_text FROM convocatoria_documentos
         WHERE convocatoria_id = ${conv.id} AND extracted_text IS NOT NULL
         ORDER BY (tipo = 'convocatoria') DESC, created_at DESC`
      if (!docs.length) throw new Error(`${SOLO} no tiene documento en el hub — clónalo con backend/scripts/clonar-documento.ts`)
      const d = docs.find((x) => aplanar(x.extracted_text).includes(aplanar(CITA)))
      if (!d) {
        throw new Error(`la cita no aparece en ninguno de los ${docs.length} documentos clonados de ${SOLO} — no se enlaza una prueba falsa`)
      }
      console.log(`  🔗 ${SOLO}: cita contrastada contra el hub → ${d.url}`)
      if (APPLY) {
        await s`
          UPDATE convocatoria_verification
             SET source_url = ${d.url}, verified_source_hash = ${d.content_hash},
                 source_snippet = ${CITA}, state = 'verified_correct', verdict = 'correct',
                 verified_at = now(), verified_by = 'sanear-referencia-publicada', updated_at = now()
           WHERE convocatoria_id = ${conv.id}`
        console.log('     prueba enlazada en convocatoria_verification.')
      }
    }

    console.log(`\n${APPLY ? 'Saneadas' : 'Se sanearían'}: ${saneadas} · requieren abrir el boletín: ${aMano}`)
    if (APPLY && saneadas) {
      console.log('\n⚠️  La landing va por ISR/caché: invalida con  POST /api/admin/revalidate  (per-instancia: repetir).')
    }
  } finally {
    await s.end()
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
