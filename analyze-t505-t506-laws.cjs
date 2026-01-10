const fs = require('fs');
const path = require('path');

const T505_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_5,_Gastos_para_la_compra_de_bienes_y_servicios,_de_inversión,_de_transferencias_y_pagos';
const T506_PATH = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_6,_Gestión_económica_y_financiera_de_los_contratos_del_sector_público_y_de_las_subvenciones';

function analyzeLawReferences(basePath, tema) {
  const files = fs.readdirSync(basePath).filter(f => f.endsWith('.json'));
  const lawRefs = {};
  let totalQuestions = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(basePath, fileName), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      totalQuestions++;
      const text = ((q.explanation || '') + ' ' + (q.question || '')).toLowerCase();

      // Detectar leyes específicas
      if (text.includes('47/2003') || text.includes('ley general presupuestaria')) {
        lawRefs['Ley 47/2003 LGP'] = (lawRefs['Ley 47/2003 LGP'] || 0) + 1;
      }
      if (text.includes('9/2017') || text.includes('contratos del sector público') || text.includes('lcsp')) {
        lawRefs['Ley 9/2017 LCSP'] = (lawRefs['Ley 9/2017 LCSP'] || 0) + 1;
      }
      if (text.includes('38/2003') || text.includes('ley general de subvenciones')) {
        lawRefs['Ley 38/2003 LGS'] = (lawRefs['Ley 38/2003 LGS'] || 0) + 1;
      }
      if (text.includes('887/2006') || text.includes('reglamento.*subvenciones')) {
        lawRefs['RD 887/2006 Rgto Subvenciones'] = (lawRefs['RD 887/2006 Rgto Subvenciones'] || 0) + 1;
      }
      if (text.includes('1619/2012')) {
        lawRefs['RD 1619/2012'] = (lawRefs['RD 1619/2012'] || 0) + 1;
      }
      if (text.includes('orden hap/1650/2015') || text.includes('1650/2015')) {
        lawRefs['Orden HAP/1650/2015'] = (lawRefs['Orden HAP/1650/2015'] || 0) + 1;
      }
      if (text.includes('orden eha/1049/2008') || text.includes('1049/2008')) {
        lawRefs['Orden EHA/1049/2008'] = (lawRefs['Orden EHA/1049/2008'] || 0) + 1;
      }
      if (text.includes('real decreto 939/2005') || text.includes('939/2005') || text.includes('reglamento general de recaudación')) {
        lawRefs['RD 939/2005 RGR'] = (lawRefs['RD 939/2005 RGR'] || 0) + 1;
      }

      // Buscar artículos mencionados
      const artMatch = text.match(/art[íi]culo\s+(\d+)/i);
      if (artMatch) {
        // Guardar referencia para debug
      }
    }
  }

  console.log(`\n=== ${tema} ===`);
  console.log(`Total preguntas: ${totalQuestions}`);
  console.log('\nLeyes referenciadas:');

  const sorted = Object.entries(lawRefs).sort((a, b) => b[1] - a[1]);
  for (const [law, count] of sorted) {
    console.log(`  - ${law}: ${count} preguntas`);
  }

  return { totalQuestions, lawRefs };
}

console.log('=== ANÁLISIS DE LEYES EN T505 Y T506 ===');
analyzeLawReferences(T505_PATH, 'T505 - Gastos');
analyzeLawReferences(T506_PATH, 'T506 - Contratos y Subvenciones');
