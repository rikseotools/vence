// ¿El «cambio» del RGPD es real? Se descarga AHORA con el MISMO camino que el cron y el CLI
// (fetchSourceText + hashFuente) y se compara con la línea base y con lo que midió el cron.
const { fetchSourceText } = require('../../lib/laws/fetchSourceText.cjs')
const { hashFuente, normalizarParaHash } = require('../../lib/laws/sourceWatch.cjs')
const URL = 'https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807'
;(async () => {
  const texto = await fetchSourceText(URL)
  if (!texto) { console.log('❌ descarga vacía'); process.exit(1) }
  const h = hashFuente(texto)
  console.log('chars descargados :', texto.length)
  console.log('hash AHORA        :', h)
  console.log('hash del cron 08:30: 04f04f0609417eec… (prefijo guardado)')
  console.log('línea base 31/07   : c57542c444619452… (prefijo guardado)')
  console.log('¿coincide con el del cron?', h.startsWith('04f04f0609417eec') ? 'SÍ' : 'NO')
  console.log('¿coincide con la base?    ', h.startsWith('c57542c444619452') ? 'SÍ' : 'NO')
  require('fs').writeFileSync('scratchpad/t380/rgpd-ahora.txt', normalizarParaHash(texto))
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
