// scripts/google-ads/campaign.ts
//
// CLI de gestión de campañas sobre la capa de servicio. SEGURIDAD: dry-run por
// defecto; solo aplica cambios reales con el flag explícito `--apply`.
//
//   npm run ads:campaign -- pause  <campaignId>           # prueba (valida, no aplica)
//   npm run ads:campaign -- pause  <campaignId> --apply   # APLICA
//   npm run ads:campaign -- enable  <campaignId> [--apply]
//   npm run ads:campaign -- budget  <campaignId> <eur> [--apply]
//   npm run ads:campaign -- ceiling <campaignId> <eur> [--apply]   # techo CPC (Maximizar clics)

import {
  pauseCampaign,
  enableCampaign,
  setCampaignDailyBudget,
  setCampaignCpcCeiling,
  GoogleAdsError,
  type MutationResult,
} from '@/lib/services/googleAds'

function usage(msg?: string): never {
  if (msg) console.error(`❌ ${msg}\n`)
  console.error(
    'Uso:\n' +
      '  ads:campaign -- pause  <campaignId> [--apply]\n' +
      '  ads:campaign -- enable <campaignId> [--apply]\n' +
      '  ads:campaign -- budget  <campaignId> <eur> [--apply]\n' +
      '  ads:campaign -- ceiling <campaignId> <eur> [--apply]\n\n' +
      'Sin --apply hace una PRUEBA (valida contra Google, no cambia nada).'
  )
  process.exit(1)
}

function report(result: MutationResult): void {
  if (result.applied) {
    console.log(`\n✅ APLICADO: ${result.change}\n   ${result.resourceName}\n`)
  } else {
    console.log(
      `\n🔍 PRUEBA OK (validado por Google, NO aplicado): ${result.change}\n` +
        `   Para ejecutarlo de verdad, repite el comando con --apply\n`
    )
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const positional = args.filter((a) => !a.startsWith('--'))
  const [command, campaignId, maybeAmount] = positional

  if (!command || !campaignId) usage()
  const dryRun = !apply

  switch (command) {
    case 'pause':
      report(await pauseCampaign(campaignId, { dryRun }))
      break
    case 'enable':
      report(await enableCampaign(campaignId, { dryRun }))
      break
    case 'budget': {
      const eur = Number(maybeAmount)
      if (!Number.isFinite(eur) || eur <= 0) usage('El presupuesto debe ser un número de euros > 0')
      report(await setCampaignDailyBudget(campaignId, eur, { dryRun }))
      break
    }
    case 'ceiling': {
      const eur = Number(maybeAmount)
      if (!Number.isFinite(eur) || eur <= 0) usage('El techo de CPC debe ser un número de euros > 0')
      report(await setCampaignCpcCeiling(campaignId, eur, { dryRun }))
      break
    }
    default:
      usage(`Comando desconocido: ${command}`)
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
