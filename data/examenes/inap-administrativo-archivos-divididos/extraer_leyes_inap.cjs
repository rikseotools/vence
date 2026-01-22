const fs = require('fs');

// Leer archivo completo
const contenido = fs.readFileSync('BOE-442-COMPLETO.txt', 'utf8');
const lineas = contenido.split('\n');

// Buscar el sumario (desde "SUMARIO" hasta "ÍNDICE SISTEMÁTICO")
let enSumario = false;
const leyesINAP = {
  metadata: {
    fuente: "Código BOE-442 - INAP",
    documento: "Normativa para ingreso en el Cuerpo General Administrativo de la Administración del Estado",
    fecha_actualizacion: "30/12/2025",
    total_leyes: 0
  },
  bloques: {
    "I. Organización del Estado y de la Administración pública": [],
    "II. Organización de oficinas públicas": [],
    "III. Derecho administrativo general": [],
    "IV. Gestión de personal": [],
    "V. Gestión financiera": [],
    "VI. Informática básica y ofimática": []
  },
  todas_las_leyes: []
};

let bloqueActual = null;

for (let i = 0; i < lineas.length; i++) {
  const linea = lineas[i];
  
  // Detectar inicio de sumario
  if (linea.includes('SUMARIO') && !enSumario) {
    enSumario = true;
    continue;
  }
  
  // Detectar fin de sumario
  if (linea.includes('ÍNDICE SISTEMÁTICO')) {
    break;
  }
  
  if (!enSumario) continue;
  
  // Detectar bloques
  if (linea.includes('II. ORGANIZACIÓN DEL ESTADO')) {
    bloqueActual = "I. Organización del Estado y de la Administración pública";
  } else if (linea.includes('III. ORGANIZACIÓN DE OFICINAS')) {
    bloqueActual = "II. Organización de oficinas públicas";
  } else if (linea.includes('IV. DERECHO ADMINISTRATIVO')) {
    bloqueActual = "III. Derecho administrativo general";
  } else if (linea.includes('V. GESTIÓN DE PERSONAL')) {
    bloqueActual = "IV. Gestión de personal";
  } else if (linea.includes('VI. GESTIÓN FINANCIERA')) {
    bloqueActual = "V. Gestión financiera";
  }
  
  // Detectar leyes (§ seguido de número)
  if (linea.match(/^§\s+\d+\.\s+/)) {
    let nombreLey = linea.replace(/^§\s+\d+\.\s+/, '').trim();
    
    // Limpiar puntos suspensivos
    nombreLey = nombreLey.replace(/\s*\.+\s*$/, '').trim();
    
    // Si la línea siguiente es continuación, añadirla
    if (i + 1 < lineas.length) {
      const siguienteLinea = lineas[i + 1].trim();
      if (siguienteLinea && !siguienteLinea.match(/^§/) && !siguienteLinea.match(/^\d+$/) && !siguienteLinea.includes('–')) {
        nombreLey += ' ' + siguienteLinea.replace(/\s*\.+\s*$/, '').trim();
      }
    }
    
    const ley = {
      nombre_completo: nombreLey,
      bloque: bloqueActual
    };
    
    leyesINAP.todas_las_leyes.push(ley);
    
    if (bloqueActual && leyesINAP.bloques[bloqueActual]) {
      leyesINAP.bloques[bloqueActual].push(nombreLey);
    }
  }
}

leyesINAP.metadata.total_leyes = leyesINAP.todas_las_leyes.length;

// Guardar
fs.writeFileSync('leyes_inap_administrativo_c1.json', JSON.stringify(leyesINAP, null, 2), 'utf8');

console.log('✅ Archivo leyes_inap_administrativo_c1.json creado');
console.log('📊 Total leyes en INAP:', leyesINAP.metadata.total_leyes);
console.log('');
console.log('📋 Distribución por bloque:');
Object.keys(leyesINAP.bloques).forEach(bloque => {
  const count = leyesINAP.bloques[bloque].length;
  if (count > 0) {
    console.log(`  ${bloque}: ${count} leyes`);
  }
});
