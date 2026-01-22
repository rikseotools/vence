const fs = require('fs');

// Leer archivos
const inap = JSON.parse(fs.readFileSync('articulos_inap_tema1.json', 'utf8'));
const bd = JSON.parse(fs.readFileSync('bd_administrativo_c1.json', 'utf8'));

// Obtener tema 1 de la BD
const tema1BD = bd.temas.find(t => t.numero === 1);

console.log('📊 COMPARACIÓN DETALLADA - TEMA 1\n');
console.log('='.repeat(80));
console.log('\n🎯 Título:', tema1BD.titulo.substring(0, 70) + '...\n');

// Para cada ley del INAP, comparar con BD
inap.leyes.forEach(leyINAP => {
  console.log('\n' + '─'.repeat(80));
  console.log(`\n📚 ${leyINAP.nombre} - ${leyINAP.nombre_completo}\n`);

  // Buscar ley equivalente en BD
  const leyBD = tema1BD.leyes.find(l =>
    l.nombre === leyINAP.nombre ||
    l.nombre_completo.includes(leyINAP.nombre.replace('LO ', 'Ley Orgánica '))
  );

  if (!leyBD) {
    console.log('❌ ESTA LEY NO ESTÁ EN TU BASE DE DATOS\n');
    console.log(`   📋 INAP incluye: ${leyINAP.total_articulos} artículos`);
    console.log(`   📄 Artículos: ${leyINAP.articulos.slice(0, 20).join(', ')}${leyINAP.articulos.length > 20 ? '...' : ''}`);
    return;
  }

  console.log('✅ Esta ley SÍ está en tu BD\n');

  // Convertir artículos de BD a strings para comparar
  const articulosBD = leyBD.articulos.map(a => String(a));
  const articulosINAP = leyINAP.articulos.filter(a => !isNaN(parseInt(a))).map(a => String(a));

  // Comparar
  const enAmbos = articulosINAP.filter(a => articulosBD.includes(a));
  const soloINAP = articulosINAP.filter(a => !articulosBD.includes(a));
  const soloBD = articulosBD.filter(a => !articulosINAP.includes(a));

  console.log(`   📊 ESTADÍSTICAS:`);
  console.log(`      INAP: ${articulosINAP.length} artículos`);
  console.log(`      BD:   ${articulosBD.length} artículos`);
  console.log(`      ✅ En ambos: ${enAmbos.length} (${Math.round(enAmbos.length/articulosINAP.length*100)}%)`);
  console.log(`      ❌ Solo en INAP (FALTAN): ${soloINAP.length}`);
  console.log(`      ⚠️  Solo en BD (SOBRAN): ${soloBD.length}`);

  if (soloINAP.length > 0) {
    console.log(`\n   ❌ ARTÍCULOS QUE FALTAN EN TU BD:`);
    console.log(`      ${soloINAP.slice(0, 30).join(', ')}${soloINAP.length > 30 ? '...' : ''}`);
  }

  if (soloBD.length > 0) {
    console.log(`\n   ⚠️  ARTÍCULOS QUE SOBRAN EN TU BD (no están en INAP):`);
    console.log(`      ${soloBD.slice(0, 30).join(', ')}${soloBD.length > 30 ? '...' : ''}`);
  }

  if (soloINAP.length === 0 && soloBD.length === 0) {
    console.log(`\n   ✅ PERFECTO: Los artículos coinciden exactamente`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('\n📋 RESUMEN FINAL TEMA 1:\n');

let totalLeyesINAP = inap.leyes.length;
let totalLeyesBD = tema1BD.leyes.length;
let totalLeyesCoinciden = 0;

inap.leyes.forEach(leyINAP => {
  const leyBD = tema1BD.leyes.find(l =>
    l.nombre === leyINAP.nombre ||
    l.nombre_completo.includes(leyINAP.nombre.replace('LO ', 'Ley Orgánica '))
  );
  if (leyBD) totalLeyesCoinciden++;
});

console.log(`   Leyes principales en INAP: ${totalLeyesINAP}`);
console.log(`   Leyes en tu BD: ${totalLeyesBD}`);
console.log(`   ✅ Leyes que coinciden: ${totalLeyesCoinciden}/${totalLeyesINAP}`);
console.log(`   ❌ Leyes que faltan: ${totalLeyesINAP - totalLeyesCoinciden}`);
console.log(`   ⚠️  Leyes extra en BD: ${totalLeyesBD - totalLeyesCoinciden}`);

if (totalLeyesCoinciden === totalLeyesINAP && totalLeyesBD === totalLeyesINAP) {
  console.log('\n   🎉 EXCELENTE: El tema está completo y correcto');
} else if (totalLeyesCoinciden === totalLeyesINAP) {
  console.log('\n   🟡 BUENO: Todas las leyes del INAP están, pero hay leyes extra');
} else {
  console.log('\n   🔴 INCOMPLETO: Faltan leyes del INAP');
}

console.log('\n' + '='.repeat(80) + '\n');
