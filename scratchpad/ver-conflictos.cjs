#!/usr/bin/env node
// Resumen compacto de cada bloque de conflicto: tamaño y primeras líneas de cada lado.
const fs = require('fs')
const file = process.argv[2]
const n = Number(process.argv[3] || 3)
const L = fs.readFileSync(file, 'utf8').split('\n')
let i = 0, b = 0
while (i < L.length) {
  if (L[i].startsWith('<<<<<<<')) {
    b++
    const start = i + 1
    i++
    const ours = []
    while (i < L.length && !L[i].startsWith('=======')) ours.push(L[i++])
    i++
    const theirs = []
    while (i < L.length && !L[i].startsWith('>>>>>>>')) theirs.push(L[i++])
    i++
    console.log(`\n──── bloque ${b} (línea ${start}) · ours=${ours.length}l · theirs=${theirs.length}l`)
    console.log('  OURS  : ' + ours.slice(0, n).map((s) => s.slice(0, 150)).join('\n          '))
    console.log('  THEIRS: ' + theirs.slice(0, n).map((s) => s.slice(0, 150)).join('\n          '))
    continue
  }
  i++
}
