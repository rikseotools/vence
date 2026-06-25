require('dotenv').config({ path: '.env.local' });
const fs = require('fs'), path = require('path');
const { Client } = require('pg');

function canon(ley) {
  let l = ley.trim().split(/\s*\+\s*|,/)[0].trim();
  const map = [
    [/^RP\s*1996$|^RP\s*96$|^RP$|^RP de 1996$/i, 'RP_190_1996'],
    [/^RP\s*1981$|^RP\s*81$/i, 'RP_1201_1981'],
    [/^CP\b/i, 'CODIGO_PENAL'], [/^CE\b/i, 'CE'], [/^LOGP/i, 'LOGP'],
    [/^LECR?IM/i, 'LECRIM'], [/^LOPJ/i, 'LOPJ'], [/^TREBEP/i, 'TREBEP'],
    [/^Ley 39\/2015/i, 'L39_2015'], [/^Ley 40\/2015/i, 'L40_2015'], [/^Ley 19\/2013/i, 'L19_2013'],
    [/^Ley 9\/2017/i, 'LCSP'], [/^Ley 45\/2015/i, 'L45_2015'], [/^Ley 50\/1997/i, 'LEY_GOBIERNO'],
    [/^Ley 47\/2003|^LGP$/i, 'LGP'], [/^RD 782\/2001/i, 'RD782_2001'], [/^RD 840\/2011/i, 'RD840_2011'],
    [/^RD 122\/2015/i, 'RD122_2015'], [/^TFUE/i, 'TFUE'], [/^TUE/i, 'TUE'],
    [/^LO 3\/1981/i, 'LO3_1981_DEFENSOR'], [/^LO 3\/2007/i, 'LO3_2007_IGUALDAD'], [/^LO 1\/2004/i, 'LO1_2004_VG'],
    [/^Ley 23\/2014/i, 'L23_2014'], [/^LOTC/i, 'LOTC'], [/^Ley 53\/1984/i, 'INCOMPAT'], [/^Ley 39\/2006/i, 'DEPENDENCIA'],
  ];
  for (const [re, k] of map) if (re.test(l)) return k;
  return 'OTRA::' + l;
}

const dir = 'preguntas-para-subir/instituciones-penitenciarias/convocatorias-anteriores';
const freq = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f)));
  for (const q of d.questions) {
    const t = (q.explanationTitle || '').trim();
    const m = t.match(/^\*?\s*Art\.?(?:[íi]culo)?\s*(\d+)(?:\s*(?:bis|ter|quater))?(?:\.\d+)?\s+(.+)$/i);
    if (!m) continue;
    const k = canon(m[2]);
    freq.set(k, (freq.get(k) || 0) + 1);
  }
}

const resolvers = {
  RP_190_1996: '49f8bf3f-42c4-4b73-811f-dba9a2048bd1', CODIGO_PENAL: '3b2c702d-25c4-4fd9-86cb-12157f6799a2',
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941', LOGP: '7bc4187c-24cc-4a74-b76b-1a2db5f3e7e9',
  LECRIM: '8ea21d39-5f6c-4d4c-801b-ffdf7ca366e5', LOPJ: 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  TREBEP: 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0', L39_2015: '218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40_2015: '95680d57-feb1-41c0-bb27-236024815feb', L19_2013: 'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  LCSP: '4f605392-8137-4962-9e66-ca5f275e93ee', L45_2015: '95b11c4b-1f34-428f-83ae-3fe894326e40',
  L23_2014: '9613f909-57a3-4579-b83c-a667b4350e8d',
};
const lookup = {
  LEY_GOBIERNO: ['%50/1997%'], LGP: ['%47/2003%', '%General Presupuestaria%'],
  RD782_2001: ['%782/2001%'], RD840_2011: ['%840/2011%'], RD122_2015: ['%122/2015%'],
  TFUE: ['%TFUE%', '%Funcionamiento de la Unión%'], TUE: ['%Tratado de la Unión%'],
  LO3_1981_DEFENSOR: ['%3/1981%', '%Defensor del Pueblo%'], LO3_2007_IGUALDAD: ['%3/2007%', '%igualdad efectiva%'],
  LO1_2004_VG: ['%1/2004%', '%Violencia de Género%'], LOTC: ['%2/1979%', '%Tribunal Constitucional%'],
  INCOMPAT: ['%53/1984%'], DEPENDENCIA: ['%39/2006%'], RP_1201_1981: ['%1201/1981%'],
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const tryFind = async (terms) => {
    for (const t of terms) {
      const r = await c.query('SELECT id,short_name FROM laws WHERE short_name ILIKE $1 OR name ILIKE $1 LIMIT 1', [t]);
      if (r.rows[0]) return r.rows[0];
    }
    return null;
  };
  console.log('=== COBERTURA DE LEYES (preguntas con art parseado) ===');
  let mapeadas = 0, faltan = 0;
  const resolved = {};
  for (const [k, n] of [...freq.entries()].sort((a, b) => b[1] - a[1])) {
    let id = resolvers[k];
    if (!id && lookup[k]) { const f = await tryFind(lookup[k]); if (f) id = f.id; }
    if (id) { mapeadas += n; resolved[k] = id; console.log('  OK   ' + String(n).padStart(4) + ' x ' + k + '  (' + id.slice(0, 8) + ')'); }
    else { faltan += n; console.log('  FALTA' + String(n).padStart(4) + ' x ' + k); }
  }
  console.log('\nTOTAL con art:', mapeadas + faltan, '| mapeadas:', mapeadas, '| sin ley en BD:', faltan);
  await c.end();
})();
