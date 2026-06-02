// scripts/google-ads/tracking.ts
//
// Ver y configurar el tracking de atribución (final_url_suffix por campaña).
// La clave de JOIN coste↔ingreso por campaña depende de esto.
//
//   npm run ads:tracking                      # estado actual
//   npm run ads:tracking -- set               # PRUEBA aplicar el suffix recomendado a todas
//   npm run ads:tracking -- set --apply       # APLICA a todas las campañas
//   npm run ads:tracking -- set "utm_campaign={campaignid}" --apply  # suffix a medida

import {
  getCustomerInfo,
  applyTrackingSuffixToAllCampaigns,
  RECOMMENDED_FINAL_URL_SUFFIX,
  GoogleAdsError,
} from '@/lib/services/googleAds'

async function show() {
  const info = await getCustomerInfo()
  console.log(`\n🏷️  Tracking de la cuenta ${info.descriptiveName} (${info.id})\n`)
  console.log(`  Auto-tagging (gclid): ${info.autoTaggingEnabled ? '✅ activo' : '❌ INACTIVO'}`)
  if (!info.autoTaggingEnabled) {
    console.log('     ⚠️ Sin auto-tagging no llega gclid. Actívalo en Ads → Configuración.')
  }
  console.log(
    `\n  💡 Suffix recomendado (clave de JOIN robusta):\n     ${RECOMMENDED_FINAL_URL_SUFFIX}\n` +
      `     Prueba:  npm run ads:tracking -- set\n` +
      `     Aplica:  npm run ads:tracking -- set --apply\n`
  )
}

async function main() {
  const args = process.argv.slice(2)
  const positionals = args.filter((a) => !a.startsWith('--'))
  const command = positionals[0]
  const apply = args.includes('--apply')

  if (command !== 'set') {
    await show()
    return
  }

  const suffix = positionals[1] || RECOMMENDED_FINAL_URL_SUFFIX
  const result = await applyTrackingSuffixToAllCampaigns(suffix, { dryRun: !apply })

  console.log(`\n🏷️  Suffix: ${result.suffix}`)
  console.log(`   Campañas afectadas (no REMOVED): ${result.campaigns.length}`)
  for (const c of result.campaigns) {
    const prev = c.previousSuffix ? `(antes: ${c.previousSuffix})` : '(sin suffix previo)'
    console.log(`   • ${c.name} [${c.id}] ${prev}`)
  }

  if (result.applied) {
    console.log(`\n✅ APLICADO a ${result.campaigns.length} campañas.`)
    console.log('   Google tarda unos minutos en propagar. Verifica con: npm run ads:tracking\n')
  } else {
    console.log(
      `\n🔍 PRUEBA OK (validado por Google, NO aplicado).\n` +
        `   Para aplicarlo de verdad: npm run ads:tracking -- set --apply\n`
    )
  }
}

main().catch((e) => {
  if (e instanceof GoogleAdsError) {
    console.error('❌ Google Ads:', e.message)
    if (e.requestId) console.error('   request_id:', e.requestId)
  } else {
    console.error('❌', (e as Error).message)
  }
  process.exit(1)
})
