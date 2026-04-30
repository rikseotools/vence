#!/usr/bin/env node
/**
 * Build complete mapping: InnoTest leyID → Vence BD law_id
 * Searches BD for each law using article content matching
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Manual mapping for the top leyIDs (verified earlier)
const MANUAL_MAP = {
  // Leyes principales
  1: { pattern: 'Ley 39/2015', name: 'LPAC' },
  2: { pattern: 'Ley 40/2015', name: 'LRJSP' },
  3: { pattern: 'CP', name: 'Código Penal', exact: true },
  4: { pattern: 'LECrim', name: 'LECrim', exact: true },
  6: { pattern: 'LOFCS', name: 'LO 2/1986 FCSE', exact: true },
  9: { pattern: 'LECrim', name: 'LECrim (bloque 2)', exact: true },
  10: { pattern: 'LO 6/1985', name: 'LOPJ' },
  11: { pattern: 'LSNPC', name: 'Ley 17/2015 Protección Civil', exact: true },
  12: { pattern: 'LO 6/1984', name: 'Habeas Corpus' },
  13: { pattern: 'RD 769/1987', name: 'Policía Judicial' },
  15: { pattern: 'Ley 40/2015', name: 'LRJSP (DF 3ª Ley Gobierno)' },
  16: { pattern: 'LPRL', name: 'Ley 31/1995 PRL', exact: true },
  22: { pattern: 'RD 240/2007', name: 'Libre circulación UE' },
  23: { pattern: 'Ley 42/2007', name: 'Patrimonio Natural' },
  26: { pattern: 'LO 4/2000', name: 'Extranjería' },
  33: { pattern: 'LSP', name: 'Ley 5/2014 Seguridad Privada' },
  37: { pattern: 'LO 1/2004', name: 'Violencia género' },
  39: { pattern: 'LO 3/1981', name: 'Defensor del Pueblo' },
  46: { pattern: null, name: 'Consejo DDHH ONU (virtual)' },
  48: { pattern: 'Ley 29/2014', name: 'Régimen Personal GC' },
  49: { pattern: 'Estructura Ministerio Interior', name: 'Estructura DGGC (virtual)' },
  54: { pattern: 'LO 5/2000', name: 'Menores' },
  55: { pattern: 'Instituciones Internacionales GC', name: 'Carta ONU (virtual)' },
  56: { pattern: 'Código Civil', name: 'Código Civil' },
  58: { pattern: 'TUE', name: 'Tratado UE', exact: true },
  61: { pattern: 'LO 1/1982', name: 'Honor/intimidad' },
  67: { pattern: null, name: 'RD 179/2005 PRL GC (no en BD)' },
  69: { pattern: 'TFUE', name: 'Tratado Funcionamiento UE', exact: true },
  71: { pattern: 'LO 3/2018', name: 'LOPDGDD' },
  72: { pattern: 'CE', name: 'Constitución Española', exact: true },
  73: { pattern: 'LO 3/2007', name: 'Igualdad' },
  74: { pattern: null, name: 'RD 67/2010 PRL AGE (no en BD)' },
  77: { pattern: 'Ley 6/2020', name: 'Servicios confianza' },
  80: { pattern: 'RD 4/2010', name: 'ENI' },
  82: { pattern: null, name: 'Adhesión España (conceptual)' },
  91: { pattern: null, name: 'Estatuto de Roma (virtual)' },
  95: { pattern: null, name: 'CEDH (virtual)' },
  97: { pattern: null, name: 'Convención Tortura (virtual)' },
  99: { pattern: null, name: 'EUROJUST (virtual)' },
  100: { pattern: 'Instituciones Internacionales GC', name: 'CEPOL (virtual)' },
  103: { pattern: null, name: 'Carta DDFF UE (virtual)' },
  105: { pattern: 'Instituciones Internacionales GC', name: 'EUROPOL (virtual)' },
  106: { pattern: 'Instituciones Internacionales GC', name: 'INTERPOL (virtual)' },
  107: { pattern: 'Instituciones Internacionales GC', name: 'INTERPOL2 (virtual)' },
  109: { pattern: 'Instituciones Internacionales GC', name: 'Consejo Europa (virtual)' },
  112: { pattern: null, name: 'CIJ (virtual)' },
  120: { pattern: null, name: 'EUROPOL autoridad control (virtual)' },
  121: { pattern: null, name: 'Directiva eficiencia energética' },
  124: { pattern: null, name: 'TEDH (virtual)' },
  128: { pattern: 'Instituciones Internacionales GC', name: 'OIT (virtual)' },
  139: { pattern: null, name: 'Ciberseguridad CCN-CERT (virtual)' },
  158: { pattern: 'RD 137/1993', name: 'Reglamento Armas' },
  164: { pattern: null, name: 'Carta Social Europea (virtual)' },
  168: { pattern: 'Ley 6/2020', name: 'Servicios confianza (bloque 2)' },
  183: { pattern: null, name: 'OTAN (virtual)' },
  184: { pattern: null, name: 'Estatuto TJUE (virtual)' },
  185: { pattern: null, name: 'Reglamento Consejo UE (virtual)' },
  191: { pattern: null, name: 'Reglamento Defensor Pueblo (virtual)' },
  197: { pattern: 'Instituciones Internacionales GC', name: 'FRONTEX (virtual)' },
  203: { pattern: null, name: 'CEDH2 (virtual)' },
  205: { pattern: null, name: 'Consejo DDHH ONU2 (virtual)' },
  208: { pattern: 'Ley 4/2015 Estatuto', name: 'Estatuto Víctima' },
  210: { pattern: null, name: 'Parlamento Europeo (virtual)' },
  215: { pattern: null, name: 'Carta Social Europea ratificada (virtual)' },
  268: { pattern: 'RD 176/2022', name: 'Código Conducta GC (art reglamento)' },
  269: { pattern: 'RD 176/2022', name: 'Código Conducta GC' },
  311: { pattern: 'RD 130/2017', name: 'Reglamento Explosivos' },
  315: { pattern: 'Ley 11/2022', name: 'Telecomunicaciones' },
  317: { pattern: 'LO 18/2003', name: 'Cooperación Corte Penal' },
  318: { pattern: null, name: 'Principios Fuerza ONU (virtual)' },
  319: { pattern: 'LO 12/1995', name: 'Contrabando' },
  320: { pattern: 'RD 1649/1998', name: 'Contrabando Admin' },
  321: { pattern: null, name: 'Código Aduanero UE (virtual)' },
  322: { pattern: 'Instituciones Internacionales GC', name: 'OMS (virtual)' },
  324: { pattern: 'Instituciones Internacionales GC', name: 'OMS2 (virtual)' },
  326: { pattern: 'Instituciones Internacionales GC', name: 'FAO comité (virtual)' },
  327: { pattern: 'Instituciones Internacionales GC', name: 'FAO consejo (virtual)' },
  328: { pattern: 'Instituciones Internacionales GC', name: 'FAO conferencia (virtual)' },
  329: { pattern: 'Instituciones Internacionales GC', name: 'FMI (virtual)' },
  330: { pattern: 'LO 11/2007', name: 'Derechos GC' },
  376: { pattern: null, name: 'Estructura DGGC periférica (virtual)' },
  384: { pattern: null, name: 'Consejo DDHH composición (virtual)' },
  399: { pattern: 'Estructura Ministerio Interior', name: 'Estructura Min Interior (virtual)' },
  401: { pattern: 'Estructura Ministerio Interior', name: 'Estructura Min Defensa (virtual)' },
  408: { pattern: null, name: 'Directiva 2023/1791 eficiencia (virtual)' },
  411: { pattern: 'RD 4/2010', name: 'ENI glosario' },
  416: { pattern: 'RD 806/2014', name: 'RD 806/2014 TIC AGE' },
  466: { pattern: null, name: 'Historia GC (virtual)' },
  735: { pattern: 'Instituciones Internacionales GC', name: 'Carta ONU2 (virtual)' },

  // Leyes con pattern pero probablemente otro bloque de la misma ley
  5: { pattern: null, name: 'DUDH (virtual)' },
  7: { pattern: null, name: 'Pacto Derechos Civiles (virtual)' },
  8: { pattern: null, name: 'Pacto Derechos Económicos (virtual)' },
  40: { pattern: null, name: 'Protocolo Tortura (virtual)' },
  42: { pattern: null, name: 'Estructura DGGC apoyo (virtual)' },
  50: { pattern: null, name: 'Estructura DGGC periférica2 (virtual)' },
};

async function main() {
  const lawCache = {};

  async function findLaw(pattern, exact) {
    if (!pattern) return null;
    if (lawCache[pattern]) return lawCache[pattern];

    let data;
    if (exact) {
      ({ data } = await s.from('laws').select('id, short_name').eq('short_name', pattern).limit(1));
    }
    if (!data || data.length === 0) {
      ({ data } = await s.from('laws').select('id, short_name').ilike('short_name', '%' + pattern + '%').limit(1));
    }
    if (data && data.length > 0) {
      lawCache[pattern] = data[0];
      return data[0];
    }
    return null;
  }

  // Build the final map
  const finalMap = {}; // leyID → { law_id, short_name } or null
  let mapped = 0, virtual = 0, missing = 0;

  for (const [leyId, info] of Object.entries(MANUAL_MAP)) {
    if (!info.pattern) {
      finalMap[leyId] = null; // virtual/not in BD
      virtual++;
      continue;
    }

    const law = await findLaw(info.pattern, info.exact);
    if (law) {
      finalMap[leyId] = { law_id: law.id, short_name: law.short_name };
      mapped++;
    } else {
      finalMap[leyId] = null;
      missing++;
      console.log('❌ leyID=' + leyId + ' pattern=' + info.pattern + ' → NOT FOUND');
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('Mapped to BD:', mapped);
  console.log('Virtual (no BD):', virtual);
  console.log('Missing:', missing);
  console.log('Total:', Object.keys(finalMap).length);

  // Save the map as JSON for the import script
  const outPath = '/home/manuel/Documentos/github/vence/preguntas-para-subir/innotest-guardia-civil/_law_map.json';
  fs.writeFileSync(outPath, JSON.stringify(finalMap, null, 2));
  console.log('\nSaved to', outPath);

  // Also save the full map with names for reference
  const refMap = {};
  for (const [leyId, info] of Object.entries(MANUAL_MAP)) {
    refMap[leyId] = {
      name: info.name,
      bd_law_id: finalMap[leyId]?.law_id || null,
      bd_short_name: finalMap[leyId]?.short_name || null,
    };
  }
  fs.writeFileSync(outPath.replace('.json', '_reference.json'), JSON.stringify(refMap, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
