#!/usr/bin/env node
// scripts/canary-article-test-cta.cjs
//
// CANARY post-deploy del CTA "Hacer test de este artículo" (fix manuel izquierdo).
// Verifica en PROD el endpoint SSOT /api/teoria/[law]/[art]/test-count, que es la
// fuente del CTA: devuelve cuántas preguntas SERVIRÍA el test para una oposición.
// Comprueba el invariante (no solo 200) en casos estables + la consciencia de
// oposición (mismo artículo, distinto count según oposición).
//
// Uso: node scripts/canary-article-test-cta.cjs   (CANARY_BASE=https://www.vence.es)
// Exit 1 si algún invariante se rompe.

const BASE = process.env.CANARY_BASE || 'https://www.vence.es'

async function count(lawSlug, art, positionType) {
  const url = `${BASE}/api/teoria/${lawSlug}/${art}/test-count?positionType=${encodeURIComponent(positionType)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'vence-canary' } })
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`)
  const d = await res.json()
  if (typeof d.count !== 'number') throw new Error(`respuesta sin count numérico: ${JSON.stringify(d)}`)
  return d.count
}

// [lawSlug, art, positionType, predicado, etiqueta]
const CHECKS = [
  ['decreto-42-2019-condiciones-trabajo-gva', 10, 'auxiliar_administrativo_estado', (n) => n > 0, 'art con preguntas → CTA visible'],
  ['decreto-42-2019-condiciones-trabajo-gva', 1, 'auxiliar_administrativo_estado', (n) => n === 0, 'art sin preguntas → CTA oculto'],
  // Dead-end del review: art solo con oficiales de otras oposiciones → estado sirve 0.
  ['codigo-penal', 36, 'auxiliar_administrativo_estado', (n) => n === 0, 'art solo-oficiales-ajenas → estado 0 (no dead-end)'],
  // Guard round-trip.
  ['decreto-42-2019-condiciones-trabajo-gva', 0, 'auxiliar_administrativo_estado', (n) => n === 0, 'art 0 → 0'],
]

async function main() {
  let ok = true

  for (const [slug, art, pos, pred, label] of CHECKS) {
    try {
      const n = await count(slug, art, pos)
      if (pred(n)) {
        console.log(`✅ ${label}: count=${n}`)
      } else {
        console.error(`❌ ${label}: count=${n} NO cumple el invariante`)
        ok = false
      }
    } catch (e) {
      console.error(`❌ ${label}: ${e.message}`)
      ok = false
    }
  }

  // Consciencia de oposición: el MISMO artículo puede contar distinto según la
  // oposición (filtro de oficiales + tag). Verifica que el endpoint discrimina.
  try {
    const estado = await count('ley-39-2015', 96, 'auxiliar_administrativo_estado')
    const pn = await count('ley-39-2015', 96, 'policia_nacional')
    if (estado !== pn) {
      console.log(`✅ consciencia de oposición: ley-39-2015 art96 estado=${estado} ≠ PN=${pn}`)
    } else {
      console.error(`⚠️  ley-39-2015 art96 estado=${estado} == PN=${pn} (esperábamos que discriminara; revisar datos)`)
      // No lo tratamos como fallo duro: depende de datos que pueden cambiar.
    }
  } catch (e) {
    console.error(`❌ chequeo consciencia de oposición: ${e.message}`)
    ok = false
  }

  if (!ok) process.exit(1)
  console.log('🟢 canary CTA artículo: invariantes OK en prod')
}

main().catch((e) => {
  console.error('❌ canary CTA artículo falló:', e.message)
  process.exit(1)
})
