const fs = require('fs');
const path = '/home/manuel/Documentos/github/vence/preguntas-para-subir/Tema_1,_Atención_al_público/';

const files = fs.readdirSync(path).filter(f => f.endsWith('.json'));

// Better law extraction
const lawArticles = {};

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path + file));

  data.questions.forEach(q => {
    const exp = (q.explanation || '').toLowerCase();

    // RD 208/1996
    if (exp.includes('208/1996') || exp.includes('real decreto 208')) {
      if (!lawArticles['RD 208/1996']) lawArticles['RD 208/1996'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => {
        const num = a.match(/\d+/)[0];
        lawArticles['RD 208/1996'].add(num);
      });
    }

    // RD 951/2005
    if (exp.includes('951/2005')) {
      if (!lawArticles['RD 951/2005']) lawArticles['RD 951/2005'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['RD 951/2005'].add(a.match(/\d+/)[0]));
    }

    // RD 366/2007
    if (exp.includes('366/2007')) {
      if (!lawArticles['RD 366/2007']) lawArticles['RD 366/2007'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['RD 366/2007'].add(a.match(/\d+/)[0]));
    }

    // Ley 39/2015
    if (exp.includes('39/2015') || exp.includes('lpac')) {
      if (!lawArticles['Ley 39/2015']) lawArticles['Ley 39/2015'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['Ley 39/2015'].add(a.match(/\d+/)[0]));
    }

    // Ley 40/2015
    if (exp.includes('40/2015')) {
      if (!lawArticles['Ley 40/2015']) lawArticles['Ley 40/2015'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['Ley 40/2015'].add(a.match(/\d+/)[0]));
    }

    // RD 221/1987 (Peticiones)
    if (exp.includes('221/1987')) {
      if (!lawArticles['RD 221/1987']) lawArticles['RD 221/1987'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['RD 221/1987'].add(a.match(/\d+/)[0]));
    }

    // LO 4/2001 (Derecho petición)
    if (exp.includes('4/2001') && exp.includes('orgánica')) {
      if (!lawArticles['LO 4/2001']) lawArticles['LO 4/2001'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['LO 4/2001'].add(a.match(/\d+/)[0]));
    }

    // RDL 1/2013 (Discapacidad)
    if (exp.includes('1/2013')) {
      if (!lawArticles['RDL 1/2013']) lawArticles['RDL 1/2013'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['RDL 1/2013'].add(a.match(/\d+/)[0]));
    }

    // CE
    if (exp.includes('constitución') || exp.includes('c.e.')) {
      if (!lawArticles['CE']) lawArticles['CE'] = new Set();
      const arts = exp.match(/artículo\s+(\d+)/gi) || [];
      arts.forEach(a => lawArticles['CE'].add(a.match(/\d+/)[0]));
    }
  });
});

console.log('📊 LEYES Y ARTÍCULOS DETECTADOS:\n');
Object.entries(lawArticles)
  .sort((a, b) => b[1].size - a[1].size)
  .forEach(([law, arts]) => {
    const artArray = Array.from(arts).sort((a,b) => parseInt(a) - parseInt(b));
    console.log('📜 ' + law + ': ' + artArray.length + ' artículos');
    console.log('   Arts: ' + artArray.join(', '));
    console.log('');
  });
