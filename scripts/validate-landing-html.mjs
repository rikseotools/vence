#!/usr/bin/env node
// scripts/validate-landing-html.mjs
// Valida que las páginas estáticas generadas no tienen variables {sin_resolver}.
// Ejecutar después de `npm run build`:
//   node scripts/validate-landing-html.mjs

import fs from 'fs'
import path from 'path'

const BUILD_DIR = path.join(process.cwd(), '.next/server/app')
const PATTERN = /\{[a-zA-Z]{3,30}\}/g // {variable} con 3-30 letras
const IGNORE = ['{children}', '{params}', '{searchParams}'] // Variables React legítimas

let errors = 0

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const matches = content.match(PATTERN)
  if (!matches) return

  const unresolved = matches.filter(m => !IGNORE.includes(m))
  if (unresolved.length === 0) return

  // Deduplicar
  const unique = [...new Set(unresolved)]
  const relPath = path.relative(process.cwd(), filePath)
  console.error(`❌ ${relPath}: ${unique.join(', ')}`)
  errors++
}

// Buscar archivos .html y .rsc de landings
const slugDirs = fs.readdirSync(BUILD_DIR).filter(d => {
  const stat = fs.statSync(path.join(BUILD_DIR, d))
  return stat.isDirectory() && d.startsWith('auxiliar-') || d.startsWith('administrativo-') || d.startsWith('tramitacion-') || d.startsWith('auxilio-')
})

for (const dir of slugDirs) {
  const htmlPath = path.join(BUILD_DIR, dir + '.html')
  const rscPath = path.join(BUILD_DIR, dir + '.rsc')
  if (fs.existsSync(htmlPath)) checkFile(htmlPath)
  if (fs.existsSync(rscPath)) checkFile(rscPath)
}

if (errors > 0) {
  console.error(`\n⚠️ ${errors} landing(s) con variables sin resolver`)
  process.exit(1)
} else {
  console.log('✅ Todas las landings limpias (sin variables sin resolver)')
}
