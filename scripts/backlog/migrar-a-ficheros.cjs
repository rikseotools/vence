#!/usr/bin/env node
// scripts/backlog/migrar-a-ficheros.cjs — migración «una ficha = un fichero». [T-532]
//
// Parte `docs/roadmap/tareas-pendientes.md` en `docs/roadmap/tareas/T-nnn.md` (uno por ficha) +
// `_preambulo.md` + `_sueltos.md`, y deja el monolito como ÍNDICE GENERADO.
//
// Re-ejecutable: es la forma de aplicar esto contra un `main` que se haya movido desde que se
// escribió (el fichero lo edita todo el mundo a la vez) — se puede volver a correr sobre el
// `tareas-pendientes.md` que haya en ese momento y produce el mismo resultado.
//
// Uso:
//   node scripts/backlog/migrar-a-ficheros.cjs            # simula, no escribe nada
//   node scripts/backlog/migrar-a-ficheros.cjs --apply     # escribe los ficheros + el índice
//
// Verificación ANTES de escribir (todas tienen que pasar o no se toca el disco):
//   1. La división es reversible: reconstruir(bloques) === original, byte a byte.
//   2. Los ids son únicos (si no, aborta: no decide por su cuenta cuál es la buena).
//   3. El índice regenerado, tras escribir, contiene — para cada id — EXACTAMENTE el mismo
//      texto que tenía en el original (comparando por bloque, no por posición: la posición ya
//      no es la fuente de verdad).
//   4. El preámbulo y los sueltos sobreviven verbatim.

const fs = require('fs')
const path = require('path')
const { dividirEnBloques, reconstruir, idsFicha } = require('../../lib/backlog/dividirFichas.cjs')
const FD = require('../../lib/backlog/fichasDir.cjs')

const REPO = path.join(__dirname, '..', '..')
const ORIGEN = path.join(REPO, 'docs', 'roadmap', 'tareas-pendientes.md')
const APLICAR = process.argv.includes('--apply')

function main() {
  const original = fs.readFileSync(ORIGEN, 'utf8')
  const bloques = dividirEnBloques(original)

  // ── Verificación 1: la división es reversible ──
  const reconstruido = reconstruir(bloques)
  if (reconstruido !== original) {
    console.error('❌ ABORTADO: dividirEnBloques() no reconstruye el original byte a byte.')
    console.error(`   longitud original=${original.length} reconstruido=${reconstruido.length}`)
    process.exit(2)
  }
  console.log(`✅ división reversible: ${original.length} caracteres, ${bloques.length} bloques`)

  // ── Verificación 2: ids únicos (lanza si no) ──
  let ids
  try {
    ids = idsFicha(bloques)
  } catch (e) {
    console.error(`❌ ABORTADO: ${e.message}`)
    process.exit(2)
  }

  const fichas = bloques.filter((b) => b.tipo === 'ficha')
  const sueltos = bloques.filter((b) => b.tipo === 'suelto')
  const preambulo = bloques.filter((b) => b.tipo === 'preambulo').map((b) => b.texto).join('')
  const marcadores = bloques.filter((b) => b.tipo === 'marcador_seccion')

  console.log(`   · ${fichas.length} fichas (ids únicos, verificado)`)
  console.log(`   · ${sueltos.length} bloque(s) suelto(s) sin id — van a _sueltos.md`)
  console.log(`   · ${marcadores.length} marcador(es) de sección — se descartan (la sección ya no es posición)`)
  console.log(`   · preámbulo: ${preambulo.length} caracteres`)

  if (!APLICAR) {
    console.log('\n🔍 SIMULACIÓN (usa --apply para escribir). Nada tocado en disco.')
    return
  }

  // ── Escribir ──
  if (fs.existsSync(FD.DIR_FICHAS)) {
    // Limpiar SOLO ficheros T-nnn.md previos (por si se re-ejecuta y alguna ficha vieja debe
    // dejar de existir tras un cambio en origen) — nunca toca nada que no sea T-nnn.md.
    for (const f of fs.readdirSync(FD.DIR_FICHAS)) {
      if (/^T-\d+\.md$/.test(f)) fs.unlinkSync(path.join(FD.DIR_FICHAS, f))
    }
  }
  FD.escribirPreambulo(preambulo)
  FD.escribirSueltos(sueltos.map((b) => b.texto).join(''))
  for (const f of fichas) FD.escribirFicha(f.id, f.texto)
  FD.regenerarIndice()

  // ── Verificación 3+4: cada ficha, el preámbulo y los sueltos sobreviven VERBATIM ──
  const problemas = []
  for (const f of fichas) {
    const enDisco = FD.leerFicha(f.id)
    if (enDisco !== f.texto) problemas.push(`ficha ${f.id}: el fichero en disco NO coincide con el bloque original`)
  }
  if (FD.leerPreambulo() !== preambulo) problemas.push('el preámbulo en disco no coincide')
  const sueltosTexto = sueltos.map((b) => b.texto).join('')
  if (FD.leerSueltos() !== sueltosTexto) problemas.push('los sueltos en disco no coinciden')

  // El índice regenerado tiene que contener, para cada ficha, su bloque completo tal cual
  // (aunque en otro ORDEN — el orden ya no es la fuente de verdad, el contenido sí).
  const indice = FD.generarIndice()
  for (const f of fichas) {
    if (!indice.includes(f.texto)) problemas.push(`ficha ${f.id}: su bloque no aparece verbatim en el índice regenerado`)
  }

  if (problemas.length) {
    console.error('\n❌ VERIFICACIÓN POST-ESCRITURA FALLÓ (nada se revierte solo — mira el disco a mano):')
    problemas.forEach((p) => console.error(`   · ${p}`))
    process.exit(2)
  }

  console.log(`\n✅ migrado: ${fichas.length} ficheros en ${path.relative(REPO, FD.DIR_FICHAS)}/`)
  console.log(`   índice regenerado en ${path.relative(REPO, FD.FICHERO_INDICE)}`)
  console.log('   Verificado: cada ficha, el preámbulo y los sueltos sobreviven byte a byte.')
  if (sueltos.length) {
    console.log(`\n⚠️  ${sueltos.length} bloque(s) sin id quedaron en _sueltos.md — necesitan triage humano:`)
    for (const b of sueltos) console.log(`   · ${b.texto.split('\n')[0]}`)
  }
}

main()
