#!/usr/bin/env node
// Mueve la ficha de un id de «## Abiertas» a la primera «## Hechas», conservándola entera.
// El corte se hace por ENCABEZADO REAL (línea que empieza por «### [» o «## »), nunca por
// índice de texto — que es el gotcha de [T-515]: la frase «## Abiertas» sale DENTRO del cuerpo
// de varias fichas.
const fs = require('fs')
const F = 'docs/roadmap/tareas-pendientes.md'
const id = process.argv[2]
if (!id) { console.error('uso: mover-a-hechas.cjs T-nnn'); process.exit(2) }

const L = fs.readFileSync(F, 'utf8').split('\n')
const inicio = L.findIndex((l) => l.startsWith(`### [${id}]`))
if (inicio < 0) { console.error(`no encuentro la ficha ${id}`); process.exit(1) }
let fin = inicio + 1
while (fin < L.length && !L[fin].startsWith('### [') && !L[fin].startsWith('## ')) fin++

const ficha = L.slice(inicio, fin)
// quita líneas vacías del final para no acumularlas al reinsertar
while (ficha.length && !ficha[ficha.length - 1].trim()) ficha.pop()

const resto = [...L.slice(0, inicio), ...L.slice(fin)]
const hechas = resto.findIndex((l) => l.startsWith('## Hechas'))
if (hechas < 0) { console.error('no hay sección «## Hechas»'); process.exit(1) }

// justo después del encabezado, dejando una línea en blanco a cada lado
resto.splice(hechas + 1, 0, '', ...ficha)
fs.writeFileSync(F, resto.join('\n'))
console.log(`movida ${id}: ${ficha.length} líneas, de ${inicio + 1} a «## Hechas» (línea ${hechas + 1})`)
