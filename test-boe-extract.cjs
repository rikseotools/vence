const { execSync } = require('child_process');

const html = execSync('curl -s "https://www.boe.es/buscar/act.php?id=BOE-A-1986-18101"').toString();

// Mismo regex del código actualizado
const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a|art)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi;

let matches = [];
let match;
while ((match = articleBlockRegex.exec(html)) !== null) {
  const blockContent = match[1];

  // Buscar h5 con class="articulo"
  const h5Match = blockContent.match(/<h5[^>]*class="articulo"[^>]*>([^<]*)<\/h5>/i);
  if (h5Match) {
    matches.push(h5Match[1].trim());
  } else {
    matches.push('[NO H5 ENCONTRADO]');
  }
}

console.log('Bloques con id="a..." o id="art..." encontrados:', matches.length);
console.log('\nContenido de h5:');
matches.forEach((m, i) => console.log(`${i+1}. ${m}`));

// Probar el regex numérico específico
console.log('\n\n=== PROBANDO REGEX NUMÉRICO ===');
const numericRegex = /<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([^<]*)<\/h5>/gi;

let numMatches = [];
while ((match = numericRegex.exec(html)) !== null) {
  numMatches.push({ num: match[1], title: match[2] });
}
console.log('Artículos numéricos encontrados:', numMatches.length);
numMatches.slice(0, 15).forEach((m, i) => console.log(`${i+1}. Art. ${m.num} - "${m.title}"`));
