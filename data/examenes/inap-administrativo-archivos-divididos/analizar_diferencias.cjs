const fs = require('fs');

// Leer archivos
const oficial = JSON.parse(fs.readFileSync('oficial.json', 'utf8'));
const inap = JSON.parse(fs.readFileSync('inap.json', 'utf8'));

// Crear análisis de diferencias
const analisis = {
  metadata: {
    fecha: '2026-01-20',
    descripcion: 'Análisis de diferencias entre programa oficial BOE y topic scope en BD',
    total_temas_oficial: oficial.temas.length,
    total_temas_bd: inap.temas.length
  },
  diferencias_por_tema: [],
  resumen: {
    temas_coinciden: 0,
    temas_con_diferencias_titulo: 0,
    temas_sin_mapeo: 0,
    temas_con_mapeo: 0
  }
};

// Crear mapeo por número de tema
const inapMap = {};
inap.temas.forEach(tema => {
  inapMap[tema.numero] = tema;
});

// Analizar cada tema
oficial.temas.forEach(temaOficial => {
  const temaBD = inapMap[temaOficial.numero];
  
  const diferencia = {
    numero: temaOficial.numero,
    bloque: temaOficial.bloque,
    titulo_oficial: temaOficial.titulo,
    titulo_bd: temaBD ? temaBD.titulo : null,
    titulos_coinciden: false,
    tiene_mapeo: false,
    leyes_mapeadas: [],
    total_leyes: 0,
    total_articulos: 0
  };
  
  if (temaBD) {
    // Comparar títulos (simplificado)
    const tituloOficialSimple = temaOficial.titulo.toLowerCase().substring(0, 50);
    const tituloBDSimple = temaBD.titulo.toLowerCase().substring(0, 50);
    diferencia.titulos_coinciden = tituloOficialSimple.includes(tituloBDSimple.substring(0, 30)) || 
                                    tituloBDSimple.includes(tituloOficialSimple.substring(0, 30));
    
    // Analizar leyes
    if (temaBD.leyes && temaBD.leyes.length > 0) {
      diferencia.tiene_mapeo = true;
      diferencia.total_leyes = temaBD.leyes.length;
      diferencia.total_articulos = temaBD.leyes.reduce((sum, ley) => sum + ley.articulos.length, 0);
      
      diferencia.leyes_mapeadas = temaBD.leyes.map(ley => ({
        nombre: ley.nombre,
        nombre_completo: ley.nombre_completo,
        cantidad_articulos: ley.articulos.length,
        articulos: ley.articulos
      }));
      
      analisis.resumen.temas_con_mapeo++;
    } else {
      analisis.resumen.temas_sin_mapeo++;
    }
    
    if (diferencia.titulos_coinciden) {
      analisis.resumen.temas_coinciden++;
    } else {
      analisis.resumen.temas_con_diferencias_titulo++;
    }
  } else {
    analisis.resumen.temas_sin_mapeo++;
  }
  
  analisis.diferencias_por_tema.push(diferencia);
});

// Guardar análisis
fs.writeFileSync('analisis_diferencias.json', JSON.stringify(analisis, null, 2), 'utf8');

console.log('✅ Análisis de diferencias creado');
console.log('');
console.log('📊 RESUMEN:');
console.log('Total temas oficial:', analisis.metadata.total_temas_oficial);
console.log('Total temas BD:', analisis.metadata.total_temas_bd);
console.log('Temas con mapeo completo:', analisis.resumen.temas_con_mapeo);
console.log('Temas sin mapeo:', analisis.resumen.temas_sin_mapeo);
console.log('Títulos que coinciden:', analisis.resumen.temas_coinciden);
console.log('Títulos con diferencias:', analisis.resumen.temas_con_diferencias_titulo);
console.log('');
console.log('🔍 TEMAS SIN MAPEO O CON PROBLEMAS:');
analisis.diferencias_por_tema.forEach(tema => {
  if (!tema.tiene_mapeo) {
    console.log('  ❌ Tema ' + tema.numero + ': SIN MAPEO');
  } else if (!tema.titulos_coinciden) {
    console.log('  ⚠️  Tema ' + tema.numero + ': Título diferente');
    console.log('      Oficial: ' + tema.titulo_oficial.substring(0, 60) + '...');
    console.log('      BD: ' + tema.titulo_bd.substring(0, 60) + '...');
  }
});
console.log('');
console.log('📈 DISTRIBUCIÓN DE LEYES POR TEMA:');
analisis.diferencias_por_tema.forEach(tema => {
  if (tema.tiene_mapeo) {
    console.log('  Tema ' + tema.numero + ': ' + tema.total_leyes + ' leyes, ' + tema.total_articulos + ' artículos');
  }
});
