const fs = require('fs');

// Comparar leyes con y sin "[Inclusión parcial]"

console.log('🔍 INVESTIGANDO "[Inclusión parcial]"\n');
console.log('='.repeat(80));

// Casos a investigar:
const casos = [
  {
    nombre: 'Constitución Española (Bloque I)',
    mencion: 'SIN [Inclusión parcial]',
    inicio: 4219,
    fin: 6175,
    articulos_reales_ley: 169  // La CE tiene 169 artículos
  },
  {
    nombre: 'LO 2/1979 - Tribunal Constitucional',
    mencion: 'SIN [Inclusión parcial]',
    inicio: 6176,
    fin: 7662,
    articulos_reales_ley: 106  // LOTC tiene ~106 artículos
  },
  {
    nombre: 'Ley 40/2015 - Régimen Jurídico (Bloque I)',
    mencion: 'CON [Inclusión parcial]',
    inicio: 25045,
    fin: 51000,  // aproximado, buscaré el fin real
    articulos_reales_ley: 180  // La ley completa tiene ~180 artículos
  }
];

const contenido = fs.readFileSync('BOE-442-COMPLETO.txt', 'utf8');
const lineas = contenido.split('\n');

casos.forEach(caso => {
  console.log(`\n📚 ${caso.nombre}`);
  console.log(`   ${caso.mencion}`);
  console.log(`   Artículos totales en la ley original: ${caso.articulos_reales_ley}`);
  
  // Contar artículos en INAP
  const seccion = lineas.slice(caso.inicio, caso.fin).join('\n');
  const articulos = seccion.match(/^Artículo/gm);
  const countArticulos = articulos ? articulos.length : 0;
  
  console.log(`   Artículos incluidos en INAP: ${countArticulos}`);
  
  const porcentaje = Math.round((countArticulos / caso.articulos_reales_ley) * 100);
  console.log(`   Porcentaje incluido: ${porcentaje}%`);
  
  if (porcentaje === 100) {
    console.log('   ✅ Incluye la LEY COMPLETA');
  } else {
    console.log(`   ⚠️  Solo incluye PARTE de la ley (${porcentaje}%)`);
  }
  
  console.log('   ' + '─'.repeat(70));
});

console.log('\n' + '='.repeat(80));
console.log('\n💡 HIPÓTESIS:\n');
console.log('[Inclusión parcial] significa que el INAP NO incluye la ley completa,');
console.log('sino solo los títulos/capítulos/artículos relevantes para la oposición.\n');
console.log('Las leyes SIN [Inclusión parcial] están COMPLETAS en el código.');
