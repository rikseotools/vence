const fs = require('fs');

// Leer archivo completo
const contenido = fs.readFileSync('BOE-442-COMPLETO.txt', 'utf8');
const lineas = contenido.split('\n');

// Buscar los títulos de las leyes y extraer sus artículos
const leyes = [
  {
    nombre: "CE",
    nombre_completo: "Constitución Española",
    inicio_buscar: "^Constitución Española$",
    fin_buscar: "^Ley Orgánica 2/1979"
  },
  {
    nombre: "LO 2/1979",
    nombre_completo: "Ley Orgánica 2/1979 - Tribunal Constitucional",
    inicio_buscar: "^Ley Orgánica 2/1979",
    fin_buscar: "^Ley Orgánica 3/1981"
  },
  {
    nombre: "LO 3/1981",
    nombre_completo: "Ley Orgánica 3/1981 - Defensor del Pueblo",
    inicio_buscar: "^Ley Orgánica 3/1981",
    fin_buscar: "^Ley Orgánica 6/1985"
  }
];

const resultado = {
  metadata: {
    fuente: "Código BOE-442 - INAP",
    fecha: "2026-01-20",
    descripcion: "Artículos específicos incluidos en el INAP para Administrativo C1"
  },
  leyes: []
};

// Función para convertir número escrito a número
function textoANumero(texto) {
  const mapa = {
    'primero': '1', 'segundo': '2', 'tercero': '3', 'cuarto': '4', 'quinto': '5',
    'sexto': '6', 'séptimo': '7', 'octavo': '8', 'noveno': '9', 'décimo': '10',
    'undécimo': '11', 'duodécimo': '12', 'decimotercero': '13', 'decimocuarto': '14',
    'decimoquinto': '15', 'decimosexto': '16', 'decimoséptimo': '17',
    'decimoctavo': '18', 'decimonoveno': '19', 'vigésimo': '20',
    'veintiuno': '21', 'veintidós': '22', 'veintitrés': '23', 'veinticuatro': '24',
    'veinticinco': '25', 'veintiséis': '26', 'veintisiete': '27', 'veintiocho': '28',
    'veintinueve': '29', 'treinta': '30', 'treinta y uno': '31', 'treinta y dos': '32',
    'treinta y tres': '33', 'treinta y cuatro': '34', 'treinta y cinco': '35',
    'treinta y seis': '36', 'treinta y siete': '37', 'treinta y ocho': '38',
    'treinta y nueve': '39', 'cuarenta': '40', 'cuarenta y uno': '41',
    'cuarenta y dos': '42', 'cuarenta y tres': '43', 'cuarenta y cuatro': '44',
    'cuarenta y cinco': '45', 'cuarenta y seis': '46', 'cuarenta y siete': '47',
    'cuarenta y ocho': '48', 'cuarenta y nueve': '49', 'cincuenta': '50'
  };

  const textoLower = texto.toLowerCase().trim().replace(/\.$/, '');
  return mapa[textoLower] || texto;
}

// Para cada ley, encontrar su sección y extraer artículos
for (const ley of leyes) {
  console.log(`\n🔍 Buscando ${ley.nombre}...`);

  let inicio = -1;
  let fin = lineas.length;

  // Buscar inicio
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].match(new RegExp(ley.inicio_buscar))) {
      // Asegurar que no es del sumario (líneas bajas)
      if (i > 1000) {
        inicio = i;
        break;
      }
    }
  }

  // Buscar fin
  if (inicio > 0) {
    for (let i = inicio + 10; i < lineas.length; i++) {
      if (lineas[i].match(new RegExp(ley.fin_buscar))) {
        // Asegurar que no es del sumario
        if (i > inicio + 100) {
          fin = i;
          break;
        }
      }
    }
  }

  if (inicio === -1) {
    console.log(`  ❌ No encontrada`);
    continue;
  }

  console.log(`  ✅ Encontrada en líneas ${inicio}-${fin}`);

  // Extraer artículos
  const articulos = [];
  const seccion = lineas.slice(inicio, fin).join('\n');

  // Buscar artículos en formato "Artículo X"
  const regexArticulo = /^Artículo\s+(.+?)\.$/gm;
  let match;

  while ((match = regexArticulo.exec(seccion)) !== null) {
    const numeroTexto = match[1];
    const numero = textoANumero(numeroTexto);

    if (!articulos.includes(numero)) {
      articulos.push(numero);
    }
  }

  console.log(`  📄 Artículos encontrados: ${articulos.length}`);
  console.log(`  📋 Primeros 10: ${articulos.slice(0, 10).join(', ')}`);

  resultado.leyes.push({
    nombre: ley.nombre,
    nombre_completo: ley.nombre_completo,
    total_articulos: articulos.length,
    articulos: articulos.sort((a, b) => {
      // Intentar ordenar numéricamente
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    })
  });
}

// Guardar resultado
fs.writeFileSync('articulos_inap_tema1.json', JSON.stringify(resultado, null, 2), 'utf8');

console.log('\n✅ Archivo articulos_inap_tema1.json creado');
console.log('\n📊 RESUMEN:');
resultado.leyes.forEach(ley => {
  console.log(`  ${ley.nombre}: ${ley.total_articulos} artículos`);
});
