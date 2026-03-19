import 'dotenv/config'
import { syncArticlesFromBoe } from '../lib/api/article-sync/queries.js'

async function main() {
  console.log('Sincronizando CE con Disposiciones...')

  const result = await syncArticlesFromBoe({
    lawId: '6ad91a6c-41ec-431f-9c80-5f5566834941', // CE
    includeDisposiciones: true
  })

  console.log('Resultado:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
