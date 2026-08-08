#!/usr/bin/env node
// Resuelve conflictos de merge en un fichero quedándose con un lado por bloque.
// uso: node resolver-conflicto.cjs <fichero> <ours|theirs|both>[,por bloque separado por comas]
const fs = require('fs')
const [, , file, modoArg] = process.argv
const modos = String(modoArg || 'both').split(',')
const lineas = fs.readFileSync(file, 'utf8').split('\n')
const out = []
let i = 0
let bloque = 0
while (i < lineas.length) {
  if (lineas[i].startsWith('<<<<<<<')) {
    const modo = modos[bloque] || modos[modos.length - 1]
    bloque++
    i++
    const ours = []
    while (i < lineas.length && !lineas[i].startsWith('=======')) ours.push(lineas[i++])
    i++ // =======
    const theirs = []
    while (i < lineas.length && !lineas[i].startsWith('>>>>>>>')) theirs.push(lineas[i++])
    i++ // >>>>>>>
    if (modo === 'ours') out.push(...ours)
    else if (modo === 'theirs') out.push(...theirs)
    else if (modo === 'both-inv') out.push(...theirs, ...ours)
    else out.push(...ours, ...theirs)
    continue
  }
  out.push(lineas[i++])
}
fs.writeFileSync(file, out.join('\n'))
console.log(`${file}: ${bloque} bloque(s) resueltos con [${modos.join(', ')}]`)
