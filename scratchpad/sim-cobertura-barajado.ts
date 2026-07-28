/**
 * ¿Qué pasaría HOY si se enciende FEATURE_SHUFFLE_OPTIONS? Simulación con el gate REAL de serve
 * (`isShuffleServeEligible`, sin copia) sobre TODAS las preguntas activas.
 */
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { isShuffleServeEligible } from '@/lib/shuffle/classifyShuffleMode'
import { isStructuredExplanation } from '@/lib/shuffle/structuredExplanation'

;(async () => {
  const db = getDb()
  const LOTE = 20000
  let off = 0
  const tot = { n: 0, baraja: 0, porEstructura: 0, porSafe: 0, quieta: 0 }
  const motivo: Record<string, number> = {}
  for (;;) {
    const filas: any[] = (await db.execute(sql`
      SELECT id, explanation, explanation_data, shuffle_mode, shuffle_safety,
             option_a, option_b, option_c, option_d, option_e
        FROM questions WHERE is_active ORDER BY id LIMIT ${LOTE} OFFSET ${off}`)) as any
    if (!filas.length) break
    for (const f of filas) {
      const ops = [f.option_a, f.option_b, f.option_c, f.option_d, f.option_e].filter((v) => v != null && v !== '')
      const estr = isStructuredExplanation(f.explanation_data, ops.length)
      const ok = isShuffleServeEligible({
        shuffle_mode: f.shuffle_mode, explanation: f.explanation, shuffle_safety: f.shuffle_safety,
        has_structured_explanation: estr, options: ops,
      })
      tot.n++
      if (ok) { tot.baraja++; estr ? tot.porEstructura++ : tot.porSafe++ }
      else {
        tot.quieta++
        const m = f.shuffle_mode !== 'full' ? `modo=${f.shuffle_mode}`
          : f.shuffle_safety !== 'safe' ? `safety=${f.shuffle_safety}` : 'opciones_cruzadas'
        motivo[m] = (motivo[m] || 0) + 1
      }
    }
    off += LOTE
    process.stderr.write(`  …${tot.n}\r`)
  }
  const pct = (x: number) => ((x / tot.n) * 100).toFixed(1) + '%'
  console.log(`\n\n══ activas: ${tot.n} ══`)
  console.log(`  SE BARAJARÍAN : ${tot.baraja} (${pct(tot.baraja)})`)
  console.log(`     · por explicación estructurada : ${tot.porEstructura}`)
  console.log(`     · por clasificación 'safe'     : ${tot.porSafe}`)
  console.log(`  se quedan quietas: ${tot.quieta} (${pct(tot.quieta)})`)
  for (const [m, n] of Object.entries(motivo).sort((a, b) => b[1] - a[1])) console.log(`     · ${m.padEnd(22)} ${n}`)
  process.exit(0)
})()
