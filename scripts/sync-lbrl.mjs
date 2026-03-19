import 'dotenv/config'
import { syncArticlesFromBoe } from '../lib/api/article-sync/queries'

async function main() {
  console.log('Iniciando sincronización de Ley 7/1985 (LBRL)...')
  try {
    const result = await syncArticlesFromBoe({
      lawId: '06784434-f549-4ea2-894f-e2e400881545',
      includeDisposiciones: true
    })
    console.log('Resultado:', JSON.stringify(result, null, 2))
  } catch (e) {
    console.log('Error:', e.message)
  }
}

main()
