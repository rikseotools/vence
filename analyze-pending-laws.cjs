require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Patrones para detectar leyes en explicaciones
const lawPatterns = [
  // Constitución
  { pattern: /constituci[oó]n\s+espa[nñ]ola/gi, name: 'CE' },

  // Leyes Orgánicas
  { pattern: /ley\s+org[aá]nica\s+(\d+)\/(\d{4})/gi, extract: (m) => `LO ${m[1]}/${m[2]}` },
  { pattern: /lo\s+(\d+)\/(\d{4})/gi, extract: (m) => `LO ${m[1]}/${m[2]}` },
  { pattern: /lopdgdd/gi, name: 'LO 3/2018' },
  { pattern: /lotc/gi, name: 'LO 2/1979' },
  { pattern: /lopj/gi, name: 'LO 6/1985' },

  // Leyes ordinarias
  { pattern: /ley\s+(\d+)\/(\d{4})/gi, extract: (m) => `Ley ${m[1]}/${m[2]}` },

  // Reales Decretos
  { pattern: /real\s+decreto\s+(\d+)\/(\d{4})/gi, extract: (m) => `RD ${m[1]}/${m[2]}` },
  { pattern: /rd\s+(\d+)\/(\d{4})/gi, extract: (m) => `RD ${m[1]}/${m[2]}` },
  { pattern: /r\.d\.\s*(\d+)\/(\d{4})/gi, extract: (m) => `RD ${m[1]}/${m[2]}` },

  // Real Decreto Legislativo
  { pattern: /real\s+decreto\s+legislativo\s+(\d+)\/(\d{4})/gi, extract: (m) => `RDLeg ${m[1]}/${m[2]}` },
  { pattern: /rdleg\s+(\d+)\/(\d{4})/gi, extract: (m) => `RDLeg ${m[1]}/${m[2]}` },

  // RGPD
  { pattern: /reglamento\s*\(ue\)\s*2016\/679/gi, name: 'Reglamento UE 2016/679' },
  { pattern: /rgpd/gi, name: 'Reglamento UE 2016/679' },

  // Tratados UE
  { pattern: /tratado\s+de\s+funcionamiento/gi, name: 'TFUE' },
  { pattern: /tfue/gi, name: 'TFUE' },
  { pattern: /tratado\s+de\s+la\s+uni[oó]n\s+europea/gi, name: 'TUE' },
  { pattern: /tue(?!\w)/gi, name: 'TUE' },

  // Reglamentos de las Cámaras
  { pattern: /reglamento\s+del\s+congreso/gi, name: 'Reglamento del Congreso' },
  { pattern: /reglamento\s+del\s+senado/gi, name: 'Reglamento del Senado' },

  // TREBEP
  { pattern: /trebep/gi, name: 'RDLeg 5/2015' },
  { pattern: /estatuto\s+b[aá]sico\s+del\s+empleado\s+p[uú]blico/gi, name: 'RDLeg 5/2015' },

  // LRBRL
  { pattern: /lrbrl/gi, name: 'Ley 7/1985' },
  { pattern: /ley\s+reguladora\s+de\s+las\s+bases\s+del\s+r[eé]gimen\s+local/gi, name: 'Ley 7/1985' },

  // Ley del Gobierno
  { pattern: /ley\s+del\s+gobierno/gi, name: 'Ley 50/1997' },

  // LGSS
  { pattern: /lgss/gi, name: 'RDLeg 8/2015' },
  { pattern: /ley\s+general\s+de\s+la\s+seguridad\s+social/gi, name: 'RDLeg 8/2015' },

  // Estatuto de los Trabajadores
  { pattern: /estatuto\s+de\s+los\s+trabajadores/gi, name: 'RDLeg 2/2015' },

  // LCSP
  { pattern: /lcsp/gi, name: 'Ley 9/2017' },
  { pattern: /ley\s+de\s+contratos\s+del\s+sector\s+p[uú]blico/gi, name: 'Ley 9/2017' },

  // Ley General Presupuestaria
  { pattern: /ley\s+general\s+presupuestaria/gi, name: 'Ley 47/2003' },
  { pattern: /lgp/gi, name: 'Ley 47/2003' },

  // Ley de Subvenciones
  { pattern: /ley\s+general\s+de\s+subvenciones/gi, name: 'Ley 38/2003' },
  { pattern: /lgs/gi, name: 'Ley 38/2003' },
];

function extractLaws(text) {
  const laws = new Set();
  const lowerText = text.toLowerCase();

  for (const lp of lawPatterns) {
    if (lp.name) {
      if (lp.pattern.test(text)) {
        laws.add(lp.name);
      }
      lp.pattern.lastIndex = 0;
    } else if (lp.extract) {
      let match;
      while ((match = lp.pattern.exec(text)) !== null) {
        laws.add(lp.extract(match));
      }
      lp.pattern.lastIndex = 0;
    }
  }

  return Array.from(laws);
}

function getAllJsonFiles(dir) {
  const files = [];

  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Excluir "ya subido"
        if (!item.includes('ya subido')) {
          walkDir(fullPath);
        }
      } else if (item.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(dir);
  return files;
}

(async () => {
  const basePath = './preguntas-para-subir';
  const jsonFiles = getAllJsonFiles(basePath);

  console.log('Archivos JSON encontrados:', jsonFiles.length);

  const lawsByTema = {};
  const allLaws = new Set();
  let totalQuestions = 0;

  for (const file of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const tema = data.tema || path.dirname(file).split('/').pop();

      if (!lawsByTema[tema]) {
        lawsByTema[tema] = { laws: new Set(), questions: 0 };
      }

      lawsByTema[tema].questions += data.questions?.length || 0;
      totalQuestions += data.questions?.length || 0;

      for (const q of data.questions || []) {
        const exp = q.explanation || '';
        const laws = extractLaws(exp);
        laws.forEach(law => {
          lawsByTema[tema].laws.add(law);
          allLaws.add(law);
        });
      }
    } catch (e) {
      console.log('Error leyendo:', file, e.message);
    }
  }

  console.log('\n=== RESUMEN POR TEMA ===\n');

  for (const [tema, info] of Object.entries(lawsByTema).sort()) {
    console.log(`📚 ${tema}`);
    console.log(`   Preguntas: ${info.questions}`);
    console.log(`   Leyes: ${Array.from(info.laws).join(', ') || '(sin detectar)'}`);
    console.log('');
  }

  console.log('\n=== TODAS LAS LEYES DETECTADAS ===\n');
  const sortedLaws = Array.from(allLaws).sort();
  sortedLaws.forEach(law => console.log('  - ' + law));

  console.log('\n=== VERIFICANDO EN BASE DE DATOS ===\n');

  // Obtener leyes con boe_url (en monitoreo)
  const { data: monitoredLaws } = await supabase
    .from('laws')
    .select('short_name, boe_url')
    .not('boe_url', 'is', null);

  const monitoredSet = new Set(monitoredLaws?.map(l => l.short_name) || []);

  // Obtener todas las leyes
  const { data: allDbLaws } = await supabase
    .from('laws')
    .select('short_name');

  const dbLawsSet = new Set(allDbLaws?.map(l => l.short_name) || []);

  console.log('Leyes en monitoreo (con BOE URL):', monitoredLaws?.length || 0);
  console.log('Total leyes en BD:', allDbLaws?.length || 0);

  console.log('\n--- ESTADO DE CADA LEY ---\n');

  let inMonitoring = 0;
  let inDbNoMonitoring = 0;
  let missing = 0;

  for (const law of sortedLaws) {
    if (monitoredSet.has(law)) {
      console.log('✅ ' + law + ' (en monitoreo)');
      inMonitoring++;
    } else if (dbLawsSet.has(law)) {
      console.log('⚠️  ' + law + ' (existe pero SIN monitoreo)');
      inDbNoMonitoring++;
    } else {
      console.log('❌ ' + law + ' (NO existe en BD)');
      missing++;
    }
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log('Total preguntas pendientes:', totalQuestions);
  console.log('Leyes diferentes detectadas:', sortedLaws.length);
  console.log('  ✅ En monitoreo:', inMonitoring);
  console.log('  ⚠️  Sin monitoreo:', inDbNoMonitoring);
  console.log('  ❌ No existen:', missing);
})();
