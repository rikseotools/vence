#!/usr/bin/env npx tsx
/**
 * sim-explicacion-estructurada-gates.ts — SIMULACIÓN: ¿el texto que genera el render desde
 * `explanation_data` pasa los guardarraíles que el propio sistema exige? **No escribe nada.**
 *
 * ## Por qué existe
 *
 * Con la Fase 2 de T-080, las explicaciones NUEVAS se escriben estructuradas y el texto se
 * GENERA (`scripts/aplicar-explicacion.ts`). Si ese texto no pasara el gate de cabecera
 * (`lib/generacion/cabeceraExplicacion.js`) o el de impugnaciones, estaríamos produciendo
 * explicaciones que nuestros propios guardarraíles rechazan — y no se sabría hasta que alguien
 * intentara aplicar una.
 *
 * Recorre las preguntas ya transcritas, renderiza cada una con la correcta en TODAS las
 * posiciones posibles (que es lo que hará el barajado) y comprueba dos cosas:
 *   1) el texto pasa el gate que corresponde a SU estilo;
 *   2) no se pierde ninguna razón por el camino;
 *   3) el texto no se CONTRADICE: ninguna letra clavada en la narrativa (intro/outro) que diga
 *      una cosa mientras la cabecera, calculada por el render, dice otra (T-262).
 *
 * ⚠️ El gate depende del estilo y del marco, y confundirlos da falsos fallos (pasó al escribir
 * esta simulación: 119 "fallos" que eran 108 de estilo `impugnacion` —donde el gate §8.1 no
 * aplica— y 8 de preguntas «señale la incorrecta», cuya cabecera dice "es la incorrecta"):
 *   · estilo `boletin` + frame `select_correct`  → gate §8.1 (`analizarCabecera`)
 *   · estilo `boletin` + frame `select_incorrect`→ cabecera "es la incorrecta" (§8.1 no aplica)
 *   · estilo `impugnacion`                       → formato §5.1: "**X)**" por opción
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim-explicacion-estructurada-gates.ts [--limite 1500]
 */
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  renderStructuredExplanation,
  isStructuredExplanation,
  structuredNarrativeStaleLetters,
} from '@/lib/shuffle/structuredExplanation'
const { analizarCabecera } = require('@/lib/generacion/cabeceraExplicacion.js')

const argv = process.argv.slice(2)
const iLim = argv.indexOf('--limite')
const LIMITE = iLim >= 0 && argv[iLim + 1] ? parseInt(argv[iLim + 1], 10) : 1500

async function main() {
  const db = getDb()
  const filas: any = await db.execute(sql`
    SELECT id, correct_option, option_a, option_b, option_c, option_d, option_e, explanation_data
      FROM questions WHERE explanation_data IS NOT NULL ORDER BY id LIMIT ${LIMITE}`)

  let renders = 0, gateOk = 0, razonesOk = 0, claveFueraDeRango = 0
  const contradictorias = new Set<string>()
  const fallos: string[] = []

  for (const f of filas) {
    const n = [f.option_a, f.option_b, f.option_c, f.option_d, f.option_e].filter((v: any) => v).length
    if (!isStructuredExplanation(f.explanation_data, n)) continue
    const d: any = f.explanation_data
    for (let pos = 0; pos < n; pos++) {
      const order = Array.from({ length: n }, (_, i) => i)
      ;[order[0], order[pos]] = [order[pos], order[0]]
      const idx = order.indexOf(f.correct_option)
      // Clave que apunta a una opción inexistente: defecto de DATOS preexistente (el serve ya lo
      // detecta y sirve natural sin barajar). No es cosa de la explicación; se cuenta aparte.
      if (idx < 0) { claveFueraDeRango++; continue }
      const t = renderStructuredExplanation(d, { correctOption: f.correct_option, optionOrder: order, nOptions: n })
      renders++

      const letra = ['A', 'B', 'C', 'D', 'E'][idx]
      const ok =
        d.estilo === 'impugnacion'
          ? new RegExp(`\\*\\*${letra}\\)\\*\\*`).test(t)          // §5.1: un bloque por opción
          : d.frame === 'select_incorrect'
            ? new RegExp(`Por qué ${letra} es la incorrecta`).test(t)
            : analizarCabecera(t, idx).ok                          // §8.1 canónico
      if (ok) gateOk++
      else if (fallos.length < 5) fallos.push(`${f.id} [estilo=${d.estilo ?? 'boletin'} frame=${d.frame ?? 'select_correct'}] pos=${pos}`)

      if (Object.values(d.options as Record<string, string>).every((r) => t.includes(String(r).slice(0, 40)))) razonesOk++

      // 3) NO-CONTRADICCIÓN (T-262). Las dos comprobaciones de arriba miran que la cabecera
      //    EXISTA y que las razones sobrevivan; ninguna mira si el resto del texto dice OTRA
      //    letra. Ahí vivían 1.211 preguntas cuyo `intro` clavaba «La respuesta correcta es la
      //    **C**.» mientras la cabecera calculaba otra: la simulación las daba por buenas porque
      //    el arnés era correcto y la aserción incompleta.
      if (structuredNarrativeStaleLetters(d).length) contradictorias.add(f.id)
    }
  }

  console.log(`\nrenders simulados: ${renders} (${filas.length} preguntas × la correcta en cada posición)`)
  console.log(`  pasan el gate de SU formato : ${gateOk}/${renders} ${gateOk === renders ? '✅' : '❌'}`)
  console.log(`  conservan todas las razones : ${razonesOk}/${renders} ${razonesOk === renders ? '✅' : '❌'}`)
  console.log(`  sin letra clavada en intro/outro : ${filas.length - contradictorias.size}/${filas.length} ${contradictorias.size === 0 ? '✅' : '❌ (T-262: se contradicen al barajar → npm run shuffle:narrativa)'}`)
  if (claveFueraDeRango) {
    console.log(`  ⚠️  ${claveFueraDeRango} render(s) omitidos: correct_option apunta a una opción inexistente (defecto de datos previo)`)
  }
  for (const f of fallos) console.log(`  ✗ ${f}`)
  for (const id of [...contradictorias].slice(0, 5)) console.log(`  ✗ ${id}: letra clavada en la narrativa`)
  process.exit(gateOk === renders && razonesOk === renders && contradictorias.size === 0 ? 0 : 1)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
