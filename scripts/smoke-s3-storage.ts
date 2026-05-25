// Smoke test del S3StorageAdapter — Bloque 5 Fase A.
// Uso: npx tsx scripts/smoke-s3-storage.ts
//
// No subir a CI. Solo para validación manual local.

import { config } from 'dotenv'
config({ path: '.env.local' })
import { S3StorageAdapter } from '../lib/storage/s3-adapter'

async function main() {
  const adapter = new S3StorageAdapter()
  const testPath = `smoke-test-${Date.now()}.txt`
  const testData = Buffer.from(`hello s3 from vence — ${new Date().toISOString()}`)

  console.log('=== 1. Upload ===')
  const up = await adapter.upload({
    bucket: 'feedback-images',
    path: testPath,
    data: testData,
    contentType: 'text/plain',
  })
  console.log('  Result:', JSON.stringify(up, null, 2))
  if (!up.success) process.exit(1)

  console.log('\n=== 2. Fetch publicUrl via HTTP ===')
  const res = await fetch(up.publicUrl)
  const text = await res.text()
  console.log(`  HTTP ${res.status}`)
  console.log(`  Body: "${text}"`)
  const ok = res.status === 200 && text === testData.toString('utf-8')
  console.log(`  ${ok ? '✅ Contenido idéntico' : '❌ Mismatch'}`)
  if (!ok) process.exit(1)

  console.log('\n=== 3. Delete ===')
  const del = await adapter.remove({ bucket: 'feedback-images', paths: [testPath] })
  console.log('  Result:', JSON.stringify(del, null, 2))
  if (!del.success) process.exit(1)

  console.log('\n=== 4. Verificar delete ===')
  const res2 = await fetch(up.publicUrl)
  console.log(
    `  HTTP ${res2.status} ${res2.status === 403 || res2.status === 404 ? '✅ borrado' : '❌ aún accesible'}`,
  )

  console.log('\n✅ SMOKE PASSED')
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
