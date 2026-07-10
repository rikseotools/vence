#!/usr/bin/env node
// scripts/sim-familia-ingest.cjs
//
// SIMULACIÓN del ingest: dado un lote de convocatorias "crudas" (como las que trae el
// feed pag-empleo), muestra qué FAMILIA les asignaría el clasificador antes de tocar la
// BD. Determinista y sin red → sirve de demo reproducible y de regresión rápida de la
// clasificación (aserta los casos trampa). Exit != 0 si algún caso esperado falla.
//
// Uso:  node scripts/sim-familia-ingest.cjs

const loadFamiliaModule = require('./_load-familia.cjs')
const { classifyFamilia, familiaLabel } = loadFamiliaModule()

// Lote representativo del feed (incluye trampas: género /a, empleador embebido,
// facultativo ambiguo, multilingüe).
const LOTE = [
  { nombre: 'Auxiliar Administrativo Dip. Foral de Gipuzkoa', administracion: 'Diputación Foral de Gipuzkoa', esperado: 'administracion_general' },
  { nombre: 'Administrativo/a - Osakidetza - Servicio Vasco de Salud', administracion: 'Osakidetza', esperado: 'administracion_general' },
  { nombre: 'Enfermero/a - Servicio Navarro de Salud-Osasunbidea', administracion: 'Osasunbidea', esperado: 'sanidad' },
  { nombre: 'Fontanero/a - Servicio de Salud de Castilla-La Mancha (SESCAM)', administracion: 'SESCAM', esperado: 'oficios' },
  { nombre: "Cos facultatiu superior, escala d'enginyeria industrial", administracion: 'Generalitat de Catalunya', esperado: 'tecnica' },
  { nombre: 'Facultativo Especialista de Área en Pediatría', administracion: 'SESCAM', esperado: 'sanidad' },
  { nombre: 'Profesores de Enseñanza Secundaria - Matemáticas', administracion: 'Autonómica (Educación)', esperado: 'educacion' },
  { nombre: 'Trabajador/a Social - Gobierno de Navarra', administracion: 'Gobierno de Navarra', esperado: 'social' },
  { nombre: 'Bombero/a de Ceuta', administracion: 'Ciudad Autónoma de Ceuta', esperado: 'seguridad' },
  { nombre: 'Gestión Procesal y Administrativa', administracion: 'Ministerio de Justicia', esperado: 'justicia' },
  { nombre: 'Letrados Consistoriales', administracion: 'Ayuntamiento de Madrid', esperado: 'justicia' },
]

let fallos = 0
console.log('=== SIMULACIÓN ingest → familia ===')
for (const it of LOTE) {
  const got = classifyFamilia(it.nombre, it.administracion)
  const ok = got === it.esperado
  if (!ok) fallos++
  console.log(`${ok ? '✓' : '✗'} [${familiaLabel(got).padEnd(22)}] ${it.nombre}${ok ? '' : `   (esperado: ${it.esperado})`}`)
}
console.log(`\n${LOTE.length - fallos}/${LOTE.length} correctos`)
process.exit(fallos ? 1 : 0)
