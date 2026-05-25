// scripts/backfill-supabase-to-s3.ts
//
// Bloque 5 Fase A — copia idempotente de los 3 buckets en uso desde
// Supabase Storage al bucket único S3 `vence-uploads` (prefijos por bucket
// lógico). Pensado para correr antes del switch STORAGE_PROVIDER=s3 en
// producción.
//
// Idempotente: si el objeto ya existe en S3 con el mismo tamaño, se omite.
// Paginado: 100 objetos por página, sin riesgo de OOM con buckets grandes.
//
// Uso: npx tsx scripts/backfill-supabase-to-s3.ts [--dry-run]

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

const BUCKETS = ['feedback-images', 'user-avatars', 'support'] as const
const PAGE_SIZE = 100
const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION ?? 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const S3_BUCKET = process.env.AWS_S3_BUCKET ?? 'vence-uploads'

interface Stats {
  scanned: number
  copied: number
  skipped: number
  errors: number
}

async function listAllPaths(bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
    })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    if (!data || data.length === 0) break

    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) {
        // archivo (Supabase usa id null para "carpetas")
        out.push(fullPath)
      } else {
        // recursión para carpetas
        const nested = await listAllPaths(bucket, fullPath)
        out.push(...nested)
      }
    }

    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return out
}

async function objectExistsInS3(key: string, sourceSize: number): Promise<boolean> {
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    )
    return head.ContentLength === sourceSize
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'NotFound') {
      return false
    }
    throw err
  }
}

async function copyOne(bucket: string, path: string, stats: Stats): Promise<void> {
  const s3Key = `${bucket}/${path}`

  const { data: blob, error: dlErr } = await supabase.storage
    .from(bucket)
    .download(path)
  if (dlErr || !blob) {
    console.error(`  ❌ download fail ${bucket}/${path}: ${dlErr?.message}`)
    stats.errors++
    return
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const exists = await objectExistsInS3(s3Key, buffer.length)
  if (exists) {
    stats.skipped++
    return
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] would copy ${bucket}/${path} → s3://${S3_BUCKET}/${s3Key} (${buffer.length} bytes)`)
    stats.copied++
    return
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: blob.type || 'application/octet-stream',
      CacheControl: 'max-age=3600',
    }),
  )
  stats.copied++
}

async function backfillBucket(bucket: string): Promise<Stats> {
  console.log(`\n=== Bucket: ${bucket} ===`)
  const stats: Stats = { scanned: 0, copied: 0, skipped: 0, errors: 0 }

  const paths = await listAllPaths(bucket)
  console.log(`  📋 ${paths.length} objetos detectados`)

  for (const path of paths) {
    stats.scanned++
    if (stats.scanned % 25 === 0) {
      console.log(`  ... progreso ${stats.scanned}/${paths.length} (copied=${stats.copied} skipped=${stats.skipped} errors=${stats.errors})`)
    }
    await copyOne(bucket, path, stats)
  }

  console.log(`  ✅ Final ${bucket}: scanned=${stats.scanned} copied=${stats.copied} skipped=${stats.skipped} errors=${stats.errors}`)
  return stats
}

async function main(): Promise<void> {
  console.log('=== Backfill Supabase Storage → S3 vence-uploads ===')
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🚀 LIVE'}`)
  console.log(`Buckets: ${BUCKETS.join(', ')}`)

  const totals: Stats = { scanned: 0, copied: 0, skipped: 0, errors: 0 }
  for (const b of BUCKETS) {
    const s = await backfillBucket(b)
    totals.scanned += s.scanned
    totals.copied += s.copied
    totals.skipped += s.skipped
    totals.errors += s.errors
  }

  console.log('\n=== TOTAL ===')
  console.log(`  Scanned: ${totals.scanned}`)
  console.log(`  Copied:  ${totals.copied}`)
  console.log(`  Skipped: ${totals.skipped} (ya existían en S3)`)
  console.log(`  Errors:  ${totals.errors}`)
  if (totals.errors > 0) process.exit(1)
}

main().catch((e) => {
  console.error('❌ Backfill failed:', e)
  process.exit(1)
})
