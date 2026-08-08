#!/usr/bin/env npx tsx
// Construye el borrador del batch T-331 desde la estructura (§8.2) y RENDERIZA el texto §8.1 con
// el mismo módulo que usa el serve. Así las dos columnas nacen coherentes por construcción.
import { writeFileSync, mkdirSync } from 'fs'
import { renderStructuredExplanation, type StructuredExplanation } from '@/lib/shuffle/structuredExplanation'
import { PREGUNTAS } from './preguntas.mjs'

const OUT = 'scratchpad/t115c'
mkdirSync(`${OUT}/estructuradas`, { recursive: true })

const borrador: any[] = []
const dist = [0, 0, 0, 0]
const problemas: string[] = []

PREGUNTAS.forEach((p: any, i: number) => {
  const data: StructuredExplanation = {
    v: 1,
    cita: p.cita,
    options: Object.fromEntries(p.razones.map((r: string, j: number) => [String(j), r])),
    frame: 'select_correct',
  }
  const explanation = renderStructuredExplanation(data, {
    correctOption: p.correct,
    nOptions: p.opciones.length,
  })
  dist[p.correct]++

  // §2.2-bis: la correcta no puede destacar por tamaño, ni por larga ni por corta.
  const L = p.opciones.map((o: string) => o.length)
  const Lc = L[p.correct]
  const otros = L.filter((_: number, j: number) => j !== p.correct)
  const max = Math.max(...otros)
  const min = Math.min(...otros)
  if (Lc >= 1.3 * max) problemas.push(`Q${i + 1}: correcta ${Lc} ≥ 1,3× la mayor de las demás (${max})`)
  if (Lc < min && min > 1.3 * Lc) problemas.push(`Q${i + 1}: correcta ${Lc} es la más corta y la menor de las demás (${min}) la supera >30%`)

  borrador.push({
    primary_article_number: p.art,
    law_slug: 'ley-9-2017',
    question_text: p.question_text,
    options: p.opciones,
    correct_option: p.correct,
    explanation,
  })
  writeFileSync(`${OUT}/estructuradas/q${String(i + 1).padStart(2, '0')}.json`, JSON.stringify(data, null, 2))
})

writeFileSync(`${OUT}/borrador.json`, JSON.stringify(borrador, null, 2))

const n = PREGUNTAS.length
console.log(`preguntas: ${n}`)
console.log(`distribución A/B/C/D: ${dist.join('/')} → ${dist.map((d) => Math.round((d / n) * 100) + '%').join(' ')}`)
console.log(`secuencia: ${PREGUNTAS.map((p: any) => 'ABCD'[p.correct]).join('')}`)
console.log(problemas.length ? '⚠️ ' + problemas.join('\n⚠️ ') : '✅ longitudes equilibradas')
console.log('\n--- muestra (Q1) ---\n' + borrador[0].explanation)
