#!/usr/bin/env node
// scripts/sync-theme-names-from-bd.js
// Sincroniza los nombres de temas en oposiciones.ts con la tabla topics de BD.
// Ejecutar: node scripts/sync-theme-names-from-bd.js
// Se puede añadir como paso de pre-deploy o pre-commit.

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const CONFIG_PATH = path.join(__dirname, '..', 'lib', 'config', 'oposiciones.ts')

async function main() {
  // Soportar DATABASE_URL (local) y POSTGRES_URL (Vercel)
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  if (!dbUrl) {
    console.log('⏭️  Sin conexión a BD (ni DATABASE_URL ni POSTGRES_URL), saltando sync')
    process.exit(0)
  }
  // Usar la URL encontrada
  process.env.DATABASE_URL = dbUrl

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Obtener TODOS los topics activos agrupados por position_type
  const { rows: topics } = await client.query(`
    SELECT position_type, topic_number, title
    FROM topics
    WHERE is_active = true
    ORDER BY position_type, topic_number
  `)

  const byPositionType = {}
  for (const t of topics) {
    if (!byPositionType[t.position_type]) byPositionType[t.position_type] = {}
    byPositionType[t.position_type][t.topic_number] = t.title
  }

  // Leer config actual
  let config = fs.readFileSync(CONFIG_PATH, 'utf-8')
  let changes = 0

  // Para cada position_type con topics en BD, buscar y reemplazar nombres en config
  // Patrón: { id: N, name: 'X' } dentro de themes array
  const themePattern = /\{\s*id:\s*(\d+)\s*,\s*name:\s*'([^']+)'\s*\}/g

  // Necesitamos saber en qué oposición estamos para mapear position_type
  // Buscamos bloques de positionType: 'xxx' seguidos de themes
  const positionTypePattern = /positionType:\s*'([^']+)'/g

  // Approach: para cada positionType en BD, buscar el bloque en config y actualizar nombres
  for (const [posType, bdNames] of Object.entries(byPositionType)) {
    // Encontrar la posición en el config donde empieza esta oposición
    const posTypeIdx = config.indexOf(`positionType: '${posType}'`)
    if (posTypeIdx === -1) continue

    // Buscar el siguiente positionType (o fin de archivo) para delimitar el bloque
    const nextPosTypeIdx = config.indexOf("positionType: '", posTypeIdx + 1)
    const endIdx = nextPosTypeIdx === -1 ? config.length : nextPosTypeIdx

    // Extraer solo este bloque
    const block = config.substring(posTypeIdx, endIdx)

    // Reemplazar nombres dentro de este bloque
    let newBlock = block
    let match
    const localPattern = /\{\s*id:\s*(\d+)\s*,\s*name:\s*'([^']+)'\s*\}/g
    while ((match = localPattern.exec(block)) !== null) {
      const themeId = parseInt(match[1])
      const configName = match[2]
      const bdName = bdNames[themeId]

      if (bdName && bdName !== configName) {
        // Escapar comillas simples en el nombre BD
        const safeBdName = bdName.replace(/'/g, "\\'")
        const oldStr = match[0]
        const newStr = `{ id: ${themeId}, name: '${safeBdName}' }`
        newBlock = newBlock.replace(oldStr, newStr)
        console.log(`  ✏️  ${posType} T${themeId}: '${configName}' → '${bdName}'`)
        changes++
      }
    }

    config = config.substring(0, posTypeIdx) + newBlock + config.substring(endIdx)
  }

  if (changes > 0) {
    fs.writeFileSync(CONFIG_PATH, config)
    console.log(`\n✅ ${changes} nombre(s) de temas actualizados en oposiciones.ts`)
  } else {
    console.log('✅ Config ya sincronizado con BD — sin cambios')
  }

  await client.end()
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
