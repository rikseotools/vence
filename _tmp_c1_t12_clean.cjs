require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function contentHash(q, a, b, c, d) {
  return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex');
}

// Reescrituras literales: antes → después
const fixes = {
  '2cc832ab-ba0e-4f90-bd16-b69c03ad9f69': 'Según el artículo 11 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, sobre las obligaciones de los beneficiarios de subvenciones, indica cuál NO es una de sus obligaciones:',

  '5504b01d-aaf4-4162-b365-89be553a1fee': 'De acuerdo con la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, el procedimiento para la concesión de subvenciones se inicia de oficio en el caso de concesión en régimen de concurrencia competitiva, salvo en los supuestos que regula el artículo 19.2 de dicha ley. La presentación de la solicitud de concesión de subvención por el interesado conllevará la autorización al órgano gestor para recabar las certificaciones que deban emitir: (indica la respuesta incorrecta)',

  '61b9da41-2b99-48d7-bfc9-00000000': null, // will be fetched dynamically
  '73b8ec3b-ffff-ffff-ffff-ffffffff': null,
};

// Patrones "texto antes → texto después" por ID completo
const updates = [
  {
    prefix: '2cc832ab',
    newText: 'Según el artículo 11 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, sobre las obligaciones de los beneficiarios de subvenciones, indica cuál NO es una de sus obligaciones:',
  },
  {
    prefix: '5504b01d',
    newText: 'De acuerdo con la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, el procedimiento para la concesión de subvenciones se inicia de oficio en el caso de concesión en régimen de concurrencia competitiva, salvo en los supuestos que regula el artículo 19.2 de dicha ley. La presentación de la solicitud de concesión de subvención por el interesado conllevará la autorización al órgano gestor para recabar las certificaciones que deban emitir: (indica la respuesta incorrecta)',
  },
  {
    prefix: '61b9da41',
    newText: 'Según el artículo 9 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, ¿qué se entiende por entidad colaboradora en la gestión de subvenciones?',
  },
  {
    prefix: '73b8ec3b',
    newText: 'Según el artículo 26 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, ¿qué clase de subvenciones necesitarán la autorización previa del Consejo de la Xunta de Galicia?',
  },
  {
    prefix: '8bb303d8',
    newText: 'Según el artículo 5 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, la gestión de las subvenciones a que se refiere la presente ley se realizará de acuerdo con los siguientes principios: (indica la respuesta incorrecta)',
  },
  {
    prefix: '906fd8e1',
    newText: 'Según el artículo 16 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, ¿qué fin tendrá el Registro Público de Subvenciones?',
  },
  {
    prefix: 'a5a8c1f7',
    newText: 'De acuerdo con el artículo 21.3 de la Ley 9/2007, de 13 de junio, de subvenciones de Galicia, el plazo para la emisión de los informes que se estimen necesarios para resolver o que sean exigidos por las normas que regulan la subvención, salvo que el órgano instructor solicite un plazo mayor o menor, será de:',
  },
];

(async () => {
  const ids = JSON.parse(fs.readFileSync('c1_t12_imported_ids.json'));
  const { data: qs } = await s.from('questions').select('id, question_text, option_a, option_b, option_c, option_d').in('id', ids);
  const idMap = new Map(qs.map(q => [q.id, q]));

  let fixed = 0;
  for (const u of updates) {
    const q = qs.find(x => x.id.startsWith(u.prefix));
    if (!q) { console.log('  ⚠️ no encontrada:', u.prefix); continue; }
    const newHash = contentHash(u.newText, q.option_a, q.option_b, q.option_c, q.option_d);
    const { error } = await s.from('questions').update({
      question_text: u.newText,
      content_hash: newHash,
    }).eq('id', q.id);
    if (error) { console.error('  ❌', q.id, error.message); continue; }
    fixed++;
    console.log('  ✅', u.prefix, '→ limpiada y reescrita');
  }
  console.log('\nFix aplicados:', fixed, '/', updates.length);

  // Verify final state
  console.log('\n=== Estado final ===');
  const { data: finalQs } = await s.from('questions').select('id, question_text').in('id', ids);
  const issues = finalQs.filter(q => /TEST LEY/i.test(q.question_text) || (!/ley\s*9\/2007|subvenciones de galicia/i.test(q.question_text) && !/presente ley/i.test(q.question_text.substring(0, 50))));
  console.log('Con basura o ambigüedad:', issues.length);
  for (const q of issues) console.log(' ', q.id.slice(0,8), '|', q.question_text.slice(0, 100));
})();
