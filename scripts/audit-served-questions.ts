// scripts/audit-served-questions.ts
//
// TEST DE INTEGRACIÓN de cobertura por tema contra la FUENTE ÚNICA DE VERDAD:
// el fetcher de producción `getTopicFullData()` (lib/api/topic-data/queries.ts),
// el mismo que sirve /[oposicion]/temario/tema-N y los tests por tema.
//
// Motivación (incidente 19/06/2026): las auditorías previas (audit:epigrafe,
// audit:oposicion) REIMPLEMENTABAN la resolución de scope (null/[]/[vals]) y
// DERIVABAN de producción → un tema podía aparecer "0 preguntas" en una auditoría
// y servir cientos en producción (o al revés). Este script NO reimplementa nada:
// pregunta a producción "¿cuántas preguntas sirves para este tema?" y verifica.
//
//   npx tsx --env-file=.env.local scripts/audit-served-questions.ts <slug>   # 1 oposición (gate de build)
//   npx tsx --env-file=.env.local scripts/audit-served-questions.ts          # TODAS las activas (lento, full audit)
//
// Exit 1 si algún topic disponible=true sirve 0 preguntas → apto como gate de CI.

import { createClient } from '@supabase/supabase-js'
import { getTopicFullData } from '@/lib/api/topic-data/queries'

const LOW = 10 // umbral 🟡 (alineado con LOW_COVERAGE de audit:epigrafe)

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const slugArg = process.argv[2]

let fails = 0
let warns = 0

async function activeSlugs(): Promise<string[]> {
  if (slugArg) return [slugArg]
  const { data } = await s.from('oposiciones').select('slug').eq('is_active', true).order('slug')
  return (data || []).map((o: any) => o.slug)
}

async function auditOposicion(slug: string): Promise<void> {
  const { data: topics } = await s
    .from('topics')
    .select('topic_number, title, disponible, position_type')
    .eq('position_type', slug.replace(/-/g, '_'))
    .eq('is_active', true)
    .order('topic_number')

  if (!topics || !topics.length) {
    console.log(`\n━━━ ${slug} ━━━`)
    console.log(`  🟡 sin topics activos (¿position_type = '${slug.replace(/-/g, '_')}'?)`)
    warns++
    return
  }

  const findings: string[] = []
  for (const t of topics) {
    let served = 0
    try {
      const res = await getTopicFullData(t.topic_number, slug)
      served = res?.success ? res.totalQuestions ?? 0 : 0
      if (!res?.success) {
        findings.push(`  ❌ T${t.topic_number}: getTopicFullData success=false — ${(res as any)?.error || '?'}`)
        fails++
        continue
      }
    } catch (e: any) {
      findings.push(`  ❌ T${t.topic_number}: getTopicFullData THREW — ${e?.message || e}`)
      fails++
      continue
    }

    if (served === 0 && t.disponible) {
      findings.push(`  ❌ T${t.topic_number} (disponible=true) sirve 0 preguntas — ${String(t.title).slice(0, 50)}`)
      fails++
    } else if (served === 0) {
      findings.push(`  🟡 T${t.topic_number} sirve 0 (disponible=false) — ${String(t.title).slice(0, 50)}`)
      warns++
    } else if (served < LOW) {
      findings.push(`  🟡 T${t.topic_number} solo ${served}q servidas — ${String(t.title).slice(0, 50)}`)
      warns++
    }
  }

  if (!findings.length) {
    console.log(`✅ ${slug}: ${topics.length} topics, todos con cobertura ≥${LOW}q`)
  } else {
    console.log(`\n━━━ ${slug} (${topics.length} topics) ━━━`)
    findings.forEach((f) => console.log(f))
  }
}

;(async () => {
  const slugs = await activeSlugs()
  for (const slug of slugs) await auditOposicion(slug)
  console.log(`\n=== ${fails} ❌  /  ${warns} 🟡 ===`)
  process.exit(fails > 0 ? 1 : 0)
})()
