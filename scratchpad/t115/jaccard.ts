import { PREGUNTAS } from './preguntas.mjs'
const LEY = /la Ley Orgánica 3\/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales/g
const tok = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').match(/[a-z0-9]+/g) || [])
const J = (a: Set<string>, b: Set<string>) => {
  const i = [...a].filter(x => b.has(x)).length
  return i / (a.size + b.size - i)
}
const pares: Array<[number,number]> = [[3,5],[6,7],[6,11],[7,11],[9,10]]
console.log('par        enunciado  sin-nombre-ley  OPCIÓN CORRECTA (dedup §2.6 nivel 3)')
for (const [i,j] of pares) {
  const a: any = PREGUNTAS[i], b: any = PREGUNTAS[j]
  const con = J(tok(a.question_text), tok(b.question_text))
  const sin = J(tok(a.question_text.replace(LEY,' ')), tok(b.question_text.replace(LEY,' ')))
  const opt = J(tok(a.opciones[a.correct]), tok(b.opciones[b.correct]))
  console.log(`Q${i+1}–Q${j+1}`.padEnd(10), con.toFixed(2).padStart(6), sin.toFixed(2).padStart(14), opt.toFixed(2).padStart(20))
}
