(async () => {
  const url = 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672';

  console.log('Descargando BOE...');
  const response = await fetch(url);
  const html = await response.text();
  console.log('HTML length:', html.length);

  // Regex del código original
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="a[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi;

  let count = 0;
  let match;
  while ((match = articleBlockRegex.exec(html)) !== null) {
    count++;
    if (count <= 3) {
      // Mostrar primeros bloques para debug
      const blockPreview = match[1].substring(0, 200);
      console.log(`\nBloque ${count}:`, blockPreview);
    }
  }

  console.log('\nTotal bloques encontrados:', count);

  // Probar con regex más simple
  const simpleRegex = /<div[^>]*class="bloque"[^>]*id="a/gi;
  const simpleMatches = html.match(simpleRegex);
  console.log('Bloques con id="a...:', simpleMatches ? simpleMatches.length : 0);
})();
