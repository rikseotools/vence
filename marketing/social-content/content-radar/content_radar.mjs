// Radar de contenido: refresco semanal.
// Vía Meta Business Discovery baja los posts recientes de los competidores
// (competitors.instagram) y hace upsert de los TOP por engagement en
// content_radar_posts. Idempotente (ON CONFLICT permalink). Preserva `seen`.
// Ejecutado como tarea Fargate cada 2-3 días (L/X/V, EventBridge). Runbook:
// docs/runbooks/radar-contenido-social.md
import postgres from 'postgres'

const IG = process.env.META_IG_USER_ID
const TOKEN = process.env.META_ADS_ACCESS_TOKEN
const SINCE = Date.now() - 14 * 864e5 // últimos 14 días
const TOP_ABS = 20
const TOP_RATE = 12

async function bd(handle) {
  const f = `business_discovery.username(${handle}){followers_count,media.limit(15){caption,like_count,comments_count,media_type,timestamp,permalink}}`
  const url = `https://graph.facebook.com/v21.0/${IG}?fields=${encodeURIComponent(f)}&access_token=${TOKEN}`
  try {
    const j = await (await fetch(url)).json()
    return j.business_discovery || null
  } catch {
    return null
  }
}

async function main() {
  if (!IG || !TOKEN) throw new Error('Falta META_IG_USER_ID / META_ADS_ACCESS_TOKEN')
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } })
  try {
    const comps = await sql`SELECT name, instagram FROM competitors WHERE instagram IS NOT NULL ORDER BY name`
    const posts = []
    for (const c of comps) {
      const b = await bd(c.instagram)
      if (!b) continue
      const fol = b.followers_count || 1
      for (const m of b.media?.data || []) {
        if (new Date(m.timestamp).getTime() < SINCE) continue
        const eng = (m.like_count || 0) + (m.comments_count || 0)
        posts.push({ comp: c.name, handle: c.instagram, fol, like: m.like_count || 0, com: m.comments_count || 0, eng, rate: eng / fol, type: m.media_type, when: m.timestamp, cap: m.caption || '', url: m.permalink })
      }
    }
    const byAbs = [...posts].sort((a, b) => b.eng - a.eng).slice(0, TOP_ABS).map((p) => ({ ...p, kind: 'absolute' }))
    const byRate = [...posts].filter((p) => p.fol > 300).sort((a, b) => b.rate - a.rate).slice(0, TOP_RATE).map((p) => ({ ...p, kind: 'rate' }))
    const seen = new Set()
    const picks = []
    for (const p of [...byAbs, ...byRate]) {
      if (seen.has(p.url)) continue
      seen.add(p.url)
      picks.push(p)
    }
    let n = 0
    for (const p of picks) {
      await sql`INSERT INTO content_radar_posts (permalink,competitor_name,handle,followers_count,caption,media_type,like_count,comments_count,engagement,engagement_rate,posted_at,rank_kind)
        VALUES (${p.url},${p.comp},${p.handle},${p.fol},${p.cap},${p.type},${p.like},${p.com},${p.eng},${p.rate},${p.when},${p.kind})
        ON CONFLICT (permalink) DO UPDATE SET like_count=EXCLUDED.like_count,comments_count=EXCLUDED.comments_count,engagement=EXCLUDED.engagement,engagement_rate=EXCLUDED.engagement_rate,fetched_at=now()`
      n++
    }
    console.log(`✅ radar refrescado: ${n} posts (de ${posts.length} recogidos / ${comps.length} competidores)`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('❌ content-radar:', e.message)
  process.exit(1)
})
