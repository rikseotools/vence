const fs = require('fs');

// Leer archivos
const leyesINAP = JSON.parse(fs.readFileSync('leyes_inap_administrativo_c1.json', 'utf8'));
const bd = JSON.parse(fs.readFileSync('bd_administrativo_c1.json', 'utf8'));

// Función para extraer identificador de ley (ej: "Ley 39/2015", "RD 208/1996")
function extraerIdentificador(nombreCompleto) {
  // Buscar patrones comunes
  const patterns = [
    /Ley Orgánica\s+(\d+\/\d+)/i,
    /Ley\s+(\d+\/\d+)/i,
    /Real Decreto Legislativo\s+(\d+\/\d+)/i,
    /Real Decreto-ley\s+(\d+\/\d+)/i,
    /Real Decreto\s+(\d+\/\d+)/i,
    /Orden\s+([A-Z]+\/\d+\/\d+)/i,
    /Resolución.*?(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /Constitución Española/i
  ];
  
  for (const pattern of patterns) {
    const match = nombreCompleto.match(pattern);
    if (match) {
      if (nombreCompleto.includes('Constitución')) return 'CE';
      if (nombreCompleto.includes('Orgánica')) return 'LO ' + match[1];
      if (nombreCompleto.includes('Legislativo')) return 'RDL ' + match[1];
      if (nombreCompleto.includes('Decreto-ley')) return 'RDL ' + match[1];
      if (nombreCompleto.includes('Real Decreto')) return 'RD ' + match[1];
      if (nombreCompleto.includes('Orden')) return 'Orden ' + match[1];
      return 'Ley ' + match[1];
    }
  }
  
  return nombreCompleto.substring(0, 50);
}

// Extraer identificadores de INAP
const leyesINAPSet = new Set();
const leyesINAPMap = {};
leyesINAP.todas_las_leyes.forEach(ley => {
  const id = extraerIdentificador(ley.nombre_completo);
  leyesINAPSet.add(id);
  leyesINAPMap[id] = ley.nombre_completo;
});

// Extraer identificadores de BD
const leyesBDSet = new Set();
const leyesBDMap = {};
bd.temas.forEach(tema => {
  tema.leyes.forEach(ley => {
    const id = extraerIdentificador(ley.nombre_completo);
    leyesBDSet.add(id);
    if (!leyesBDMap[id]) {
      leyesBDMap[id] = {
        nombre_bd: ley.nombre,
        nombre_completo: ley.nombre_completo,
        temas: []
      };
    }
    leyesBDMap[id].temas.push(tema.numero);
  });
});

// Comparar
const enINAPyBD = [];
const soloEnINAP = [];
const soloEnBD = [];

// Leyes en ambos
leyesINAPSet.forEach(id => {
  if (leyesBDSet.has(id)) {
    enINAPyBD.push({
      identificador: id,
      nombre_inap: leyesINAPMap[id],
      nombre_bd: leyesBDMap[id].nombre_bd,
      temas_bd: leyesBDMap[id].temas
    });
  } else {
    soloEnINAP.push({
      identificador: id,
      nombre_completo: leyesINAPMap[id]
    });
  }
});

// Leyes solo en BD
leyesBDSet.forEach(id => {
  if (!leyesINAPSet.has(id)) {
    soloEnBD.push({
      identificador: id,
      nombre_bd: leyesBDMap[id].nombre_bd,
      nombre_completo: leyesBDMap[id].nombre_completo,
      temas_bd: leyesBDMap[id].temas
    });
  }
});

// Crear resultado
const comparacion = {
  metadata: {
    fecha: '2026-01-20',
    total_leyes_inap: leyesINAPSet.size,
    total_leyes_bd: leyesBDSet.size,
    leyes_coinciden: enINAPyBD.length,
    leyes_solo_inap: soloEnINAP.length,
    leyes_solo_bd: soloEnBD.length
  },
  leyes_en_ambos: enINAPyBD,
  leyes_faltan_en_bd: soloEnINAP,
  leyes_sobran_en_bd: soloEnBD
};

fs.writeFileSync('comparacion_inap_vs_bd_c1.json', JSON.stringify(comparacion, null, 2), 'utf8');

console.log('✅ Comparación completada');
console.log('');
console.log('📊 RESULTADOS:');
console.log('Total leyes INAP:', comparacion.metadata.total_leyes_inap);
console.log('Total leyes BD:', comparacion.metadata.total_leyes_bd);
console.log('');
console.log('✅ Leyes en AMBOS (INAP y BD):', comparacion.metadata.leyes_coinciden);
console.log('❌ Leyes en INAP pero NO en BD (FALTAN):', comparacion.metadata.leyes_solo_inap);
console.log('⚠️  Leyes en BD pero NO en INAP (SOBRAN):', comparacion.metadata.leyes_solo_bd);

if (soloEnINAP.length > 0) {
  console.log('');
  console.log('❌ LEYES QUE FALTAN EN LA BD:');
  soloEnINAP.forEach(ley => {
    console.log('  -', ley.identificador);
  });
}

if (soloEnBD.length > 0) {
  console.log('');
  console.log('⚠️  LEYES QUE SOBRAN EN LA BD (no están en INAP):');
  soloEnBD.slice(0, 20).forEach(ley => {
    console.log('  -', ley.identificador, '(' + ley.nombre_bd + ')');
  });
  if (soloEnBD.length > 20) {
    console.log('  ... y', soloEnBD.length - 20, 'más');
  }
}
