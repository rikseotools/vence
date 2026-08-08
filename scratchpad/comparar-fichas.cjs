#!/usr/bin/env node
// Extrae las N apariciones de una ficha (### [T-xxx] … hasta el siguiente ###) y las compara.
const fs = require('fs')
const id = process.argv[2]
const L = fs.readFileSync('docs/roadmap/tareas-pendientes.md', 'utf8').split('\n')
const inicios = []
L.forEach((l, i) => { if (l.startsWith(`### [${id}]`)) inicios.push(i) })
const bloques = inicios.map((s) => {
  let e = s + 1
  while (e < L.length && !L[e].startsWith('### [')) e++
  return { start: s, end: e, texto: L.slice(s, e).join('\n') }
})
bloques.forEach((b, i) => console.log(`bloque ${i}: líneas ${b.start + 1}-${b.end}, ${b.end - b.start} líneas, ${b.texto.length} chars`))
if (bloques.length === 2) {
  console.log('\n¿idénticos?', bloques[0].texto === bloques[1].texto)
  if (bloques[0].texto !== bloques[1].texto) {
    const a = bloques[0].texto.split('\n'), b = bloques[1].texto.split('\n')
    const setB = new Set(b), setA = new Set(a)
    console.log('\n— solo en el PRIMERO:')
    a.filter((l) => l.trim() && !setB.has(l)).slice(0, 12).forEach((l) => console.log('  ' + l.slice(0, 170)))
    console.log('\n— solo en el SEGUNDO:')
    b.filter((l) => l.trim() && !setA.has(l)).slice(0, 12).forEach((l) => console.log('  ' + l.slice(0, 170)))
  }
}
