const fs = require('fs');

// Leer BD
const bd = JSON.parse(fs.readFileSync('data/examenes/inap-administrativo-archivos-divididos/topic_scope_auxiliar_admin.json', 'utf8'));

// Programa INAP oficial
const programaINAP = {
  1: { titulo: 'La Constitución Española de 1978', leyes: ['CE'] },
  2: { titulo: 'Tribunal Constitucional y la Corona', leyes: ['CE', 'LO 2/1979'] },
  3: { titulo: 'Las Cortes Generales y Defensor del Pueblo', leyes: ['CE', 'LO 3/1981'] },
  4: { titulo: 'El Poder Judicial', leyes: ['CE', 'LO 6/1985'] },
  5: { titulo: 'El Gobierno y la Administración', leyes: ['CE', 'Ley 50/1997'] },
  6: { titulo: 'El Gobierno Abierto y Agenda 2030', leyes: ['Ley 19/2013', 'Ley 40/2015'] },
  7: { titulo: 'Ley 19/2013 de Transparencia', leyes: ['Ley 19/2013'] },
  8: { titulo: 'Administración General del Estado', leyes: ['Ley 40/2015'] },
  9: { titulo: 'Organización territorial del Estado', leyes: ['CE', 'Ley 7/1985'] },
  10: { titulo: 'Unión Europea', leyes: ['TUE', 'TFUE'] },
  11: { titulo: 'Procedimiento Administrativo', leyes: ['Ley 39/2015', 'Ley 40/2015'] },
  12: { titulo: 'Protección de datos personales', leyes: ['LO 3/2018', 'Reglamento UE 2016/679'] },
  13: { titulo: 'Personal funcionario', leyes: ['RDL 5/2015'] },
  14: { titulo: 'Derechos funcionarios', leyes: ['RDL 5/2015', 'RDL 8/2015'] },
  15: { titulo: 'Presupuesto del Estado', leyes: ['Ley 47/2003'] },
  16: { titulo: 'Políticas igualdad', leyes: ['LO 1/2004', 'LO 3/2007', 'Ley 4/2023'] }
};

console.log('📊 COMPARACIÓN DETALLADA: INAP vs BD VENCE\n');
console.log('='.repeat(80));

let totalProblemas = 0;

// Comparar temas 1-16
for (let i = 1; i <= 16; i++) {
  const temaBD = bd.find(t => t.topic_number === i);
  const temaINAP = programaINAP[i];

  console.log(`\n🔹 TEMA ${i}: ${temaINAP.titulo}`);
  console.log(`   BD: ${temaBD.title.substring(0, 60)}`);

  const leyesBD = temaBD.leyes.map(l => l.nombre);
  const leyesINAP = temaINAP.leyes;

  console.log(`\n   📘 INAP oficial requiere: ${leyesINAP.join(', ')}`);
  console.log(`   💾 BD tiene: ${leyesBD.length > 0 ? leyesBD.join(', ') : 'NINGUNA'}`);

  // Verificar leyes faltantes
  const faltantes = leyesINAP.filter(ley => !leyesBD.some(bdLey => bdLey.includes(ley.replace(/\//g, '_'))));
  if (faltantes.length > 0) {
    console.log(`\n   ❌ FALTAN en BD: ${faltantes.join(', ')}`);
    totalProblemas++;
  }

  // Verificar leyes extra
  const extras = leyesBD.filter(bdLey => !leyesINAP.some(ley => bdLey.includes(ley.replace(/\//g, '_'))));
  if (extras.length > 0) {
    console.log(`\n   ➕ EXTRAS en BD (no en INAP oficial): ${extras.join(', ')}`);
  }

  if (faltantes.length === 0 && extras.length === 0) {
    console.log('\n   ✅ PERFECTO - Leyes coinciden exactamente');
  } else if (faltantes.length === 0) {
    console.log('\n   ⚠️  OK pero con leyes extra');
  }
}

console.log('\n\n' + '='.repeat(80));
console.log(`\n🎯 RESUMEN: ${totalProblemas} temas con leyes faltantes\n`);
