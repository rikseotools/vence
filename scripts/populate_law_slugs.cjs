// scripts/populate_law_slugs.cjs
// Fase 2: Poblar columna slug en tabla laws desde diccionarios existentes
//
// Ejecutar con: node scripts/populate_law_slugs.cjs

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Diccionario SHORT_NAME → SLUG (extraído de lawMappingUtils.ts)
const SHORT_NAME_TO_SLUG = {
  // Principales
  'Gobierno Abierto': 'gobierno-abierto',
  'Agenda 2030': 'agenda-2030',
  'Orden HFP/134/2018': 'orden-hfp-134-2018',
  'Orden APU/1461/2002': 'orden-apu-1461-2002',
  'Orden PCM/7/2021': 'orden-pcm-7-2021',
  'Orden PCM/1382/2021': 'orden-pcm-1382-2021',
  'Orden DSA/819/2020': 'orden-dsa-819-2020',
  'Orden HFP/266/2023': 'orden-hfp-266-2023',
  'Orden PRE/1576/2002': 'orden-pre-1576-2002',
  'Orden HAP/1949/2014': 'orden-hap-1949-2014',
  'Ley 4/2023': 'ley-4-2023',
  'Protocolo nº 1': 'protocolo-1',
  'Protocolo nº 2': 'protocolo-2',
  'Reglamento (CE) nº 1049/2001': 'reglamento-ce-1049-2001',
  'Reglamento (UE, Euratom) 2018/1046': 'reglamento-ue-2018-1046',
  'LPAC': 'ley-39-2015',
  'LRJSP': 'ley-40-2015',
  'Ley 39/2015': 'ley-39-2015',
  'CE': 'constitucion-espanola',
  'TUE': 'tue',
  'TFUE': 'tfue',
  'Código Civil': 'codigo-civil',
  'Código Penal': 'codigo-penal',
  'Estatuto de los Trabajadores': 'estatuto-trabajadores',

  // Real Decretos
  'RD 364/1995': 'rd-364-1995',
  'RD 365/1995': 'rd-365-1995',
  'RD 366/2007': 'rd-366-2007',
  'RD 375/2003': 'rd-375-2003',
  'RD 462/2002': 'rd-462-2002',
  'RD 829/2023': 'rd-829-2023',
  'RD 861/1986': 'rd-861-1986',
  'RD 951/2005': 'rd-951-2005',
  'RD 208/1996': 'rd-208-1996',
  'RD 210/2024': 'rd-210-2024',
  'RD 2271/2004': 'rd-2271-2004',
  'Ley 10/2010': 'ley-10-2010',
  'Ley 39/2006': 'ley-39-2006',

  // Abreviaturas → número oficial (SEO)
  'LOTC': 'lo-2-1979',
  'LOPJ': 'lo-6-1985',
  'LOFCS': 'lo-2-1986',
  'LOPD': 'lo-3-2018',
  'LOMLOE': 'lo-3-2020',
  'LOGP': 'lo-1-1979',
  'LOREG': 'lo-5-1985',
  'LOEx': 'lo-4-2000',
  'LOPDGDD': 'lo-3-2018',
  'TREBEP': 'rdl-5-2015',
  'EBEP': 'rdl-5-2015',
  'LSP': 'ley-5-2014',
  'CP': 'lo-10-1995',
  'LAP': 'lap',
  'Ley 30/1992': 'ley-30-1992',
  'LECrim': 'rd-14-sep-1882',
  'LEC': 'ley-1-2000',
  'LCSP': 'ley-9-2017',
  'TRLGSS': 'rdl-8-2015',
  'CCom': 'codigo-comercio',

  // LO formato oficial
  'LO 6/1984': 'lo-6-1984',
  'LO 6/1985': 'lo-6-1985',
  'LO 3/1981': 'lo-3-1981',
  'LO 2/1979': 'lo-2-1979',
  'LO 2/1986': 'lo-2-1986',
  'LO 1/1979': 'lo-1-1979',
  'LO 3/2018': 'lo-3-2018',
  'LO 3/2020': 'lo-3-2020',
  'LO 5/1985': 'lo-5-1985',
  'LO 5/1995': 'lo-5-1995',
  'LO 4/2000': 'lo-4-2000',
  'LO 10/1995': 'lo-10-1995',
  'LO 3/2007': 'lo-3-2007',
  'Ley 50/1981': 'ley-50-1981',

  // Otras leyes específicas
  'I Plan Gobierno Abierto': 'i-plan-gobierno-abierto',
  'IV Plan de Gobierno Abierto': 'iv-plan-gobierno-abierto',
  'III Plan de Gobierno Abierto': 'iii-plan-gobierno-abierto',
  'Ley 47/2003': 'ley-47-2003',
  'Reglamento UE 2016/679': 'reglamento-ue-2016-679',

  // C1 Administrativo Estado
  'LO 3/1980': 'lo-3-1980',
  'LO 11/1985': 'lo-11-1985',
  'LO 6/2002': 'lo-6-2002',
  'LO 8/1980': 'lo-8-1980',
  'Ley 7/1988': 'ley-7-1988',
  'Ley 1/2000': 'ley-1-2000',
  'Ley 17/2009': 'ley-17-2009',
  'Ley 33/2003': 'ley-33-2003',
  'Ley 34/2002': 'ley-34-2002',
  'Ley 11/2007': 'ley-11-2007',
  'Ley 6/1997': 'ley-6-1997',
  'RD 887/2006': 'rd-887-2006',
  'RD 429/1993': 'rd-429-1993',
  'RD 1398/1993': 'rd-1398-1993',
  'RD 1671/2009': 'rd-1671-2009',
  'RD 4/2010': 'rd-4-2010',
  'RD 3/2010': 'rd-3-2010',
  'RDL 2/2004': 'rdl-2-2004',
  'RDL 1/2020': 'rdl-1-2020',

  // Abreviaturas UPPERCASE
  'LCCSNS': 'lccsns',
  'LEA': 'lea',
  'LGS': 'lgs',
  'LGT': 'lgt',
  'LH': 'lh',
  'LIRPF': 'lirpf',
  'LIS': 'lis',
  'LISOS': 'lisos',
  'LIVA': 'liva',
  'LM': 'lm',
  'LN': 'ln',
  'LOPS': 'lops',
  'LP': 'lp',
  'LPI': 'lpi',
  'LPRL': 'lprl',
  'LRC': 'lrc',
  'LRJS': 'lrjs',
  'LRSAL': 'lrsal',
  'LRSC': 'lrsc',
  'LSC': 'lsc',
  'LSNPC': 'lsnpc',
  'LSP2010': 'lsp2010',
  'ODM': 'odm',
  'RDAJ': 'rdaj',
  'RDTP': 'rdtp',
  'REx': 'rex',
  'RGC': 'rgc',
  'RGGIT': 'rggit',
  'RH': 'rh',
  'RN': 'rn',
  'RP': 'rp',
  'RSP': 'rsp',
  'TRLGDCU': 'trlgdcu',
  'TRLS': 'trls',
  'TRRL': 'trrl',

  // Constitución y tratados
  'Constitución Española': 'constitucion-espanola',
  'Carta DFUE': 'carta-dfue',
  'CEDH': 'cedh',
  'PIDCP': 'pidcp',
  'DUDH': 'dudh',

  // Reglamentos de Cortes
  'Reglamento del Congreso': 'reglamento-congreso',
  'Reglamento del Senado': 'reglamento-senado',

  // Tramitación Procesal
  'LO 7/2015': 'lo-7-2015',
  'LO 5/2000': 'lo-5-2000',
  'LO 4/1981': 'lo-4-1981',
  'LO 7/1988': 'lo-7-1988',
  'Ley 19/2015': 'ley-19-2015',
  'Ley 29/1998': 'ley-29-1998',
  'Ley 36/2011': 'ley-36-2011',
  'Ley 15/2015': 'ley-15-2015',
  'Ley 3/2023': 'ley-3-2023',
  'Ley 35/2015': 'ley-35-2015',
  'Ley 22/2003': 'ley-22-2003',
  'Ley 23/2014': 'ley-23-2014',
  'Ley 20/2022': 'ley-20-2022',
  'Ley 41/2015': 'ley-41-2015',
  'Ley 4/2015': 'ley-4-2015',
  'Ley 5/2012': 'ley-5-2012',
  'RD 1065/2015': 'rd-1065-2015',
  'RD 1608/2005': 'rd-1608-2005',
  'RD 937/2003': 'rd-937-2003',
  'RD 190/1996': 'rd-190-1996',
  'RD 1917/2024': 'rd-1917-2024',
  'RDL 6/2023': 'rdl-6-2023',

  // Más leyes comunes
  'Ley 40/2015': 'ley-40-2015',
  'Ley 18/2011': 'ley-18-2011',
  'Ley 58/2003': 'ley-58-2003',
  'Ley 7/1985': 'ley-7-1985',
  'Ley 50/1997': 'ley-50-1997',
  'Ley 19/2013': 'ley-19-2013',
  'Ley 3/2015': 'ley-3-2015',
  'Ley 9/2014': 'ley-9-2014',
  'Ley 34/2006': 'ley-34-2006',
  'Ley 3/2020': 'ley-3-2020',
  'Ley 52/2003': 'ley-52-2003',
  'Ley 31/1995': 'ley-31-1995',
  'Ley 24/2011': 'ley-24-2011',
  'Ley 35/2006': 'ley-35-2006',
  'Ley 27/2014': 'ley-27-2014',
  'Ley 37/2007': 'ley-37-2007',
  'RD 1112/2018': 'rd-1112-2018',
  'RD 203/2021': 'rd-203-2021',
  'RD 1720/2007': 'rd-1720-2007',
  'RD 1373/2003': 'rd-1373-2003',
  'RD 424/2017': 'rd-424-2017',
  'RD 110/2015': 'rd-110-2015',
  'RD 2669/1998': 'rd-2669-1998',
  'RDL 5/2015': 'rdl-5-2015',
  'RD 311/2022': 'rd-311-2022',

  // Informática
  'Base de datos: Access': 'access',
  'Hoja de cálculo: Excel': 'excel',
  'Procesador de textos: Word': 'word',
  'Internet y Correo': 'internet-correo',
  'Sistema Operativo: Windows 10': 'windows-10',
  'Word 365': 'word-365',
  'Excel 365': 'excel-365',
  'Excel 365 Completo': 'excel-365-completo',
  'Word 365 Completo': 'word-365-completo',
  'Access 365': 'access-365',
  'Outlook 365': 'outlook-365',
  'PowerPoint 365': 'powerpoint-365',
  'Windows 11': 'windows-11',
  'Windows 10': 'windows-10',

  // Leyes de informática
  'Ley 59/2003': 'ley-59-2003',
  'Ley 6/2020': 'ley-6-2020',
  'Ley 56/2007': 'ley-56-2007',

  // RGPD y protección de datos
  'Reglamento (UE) 2016/679': 'reglamento-ue-2016-679',
  'RGPD': 'reglamento-ue-2016-679',

  // Más leyes de Tramitación
  'Ley 70/1978': 'ley-70-1978',
  'LO 2/1980': 'lo-2-1980',
  'LO 1/1982': 'lo-1-1982',
  'LO 7/1980': 'lo-7-1980',
  'LO 1/1981': 'lo-1-1981',
  'LO 2/1982': 'lo-2-1982',
  'LO 8/1985': 'lo-8-1985',
  'LO 9/1983': 'lo-9-1983',
  'LO 7/2003': 'lo-7-2003',
  'LO 7/2014': 'lo-7-2014',
  'LO 12/2009': 'lo-12-2009',
  'LO 15/1999': 'lo-15-1999',
  'LO 2/2012': 'lo-2-2012',
  'LO 8/2015': 'lo-8-2015',
  'LO 1/2015': 'lo-1-2015',
  'LO 1/2004': 'lo-1-2004',

  // Más RD
  'RD 463/2020': 'rd-463-2020',
  'RD 635/2015': 'rd-635-2015',
  'RD 658/2001': 'rd-658-2001',
  'RD 775/1997': 'rd-775-1997',
  'RD 796/2005': 'rd-796-2005',
  'RD 84/2018': 'rd-84-2018',
  'RD 939/2005': 'rd-939-2005',
};

/**
 * Genera slug desde short_name (misma lógica que generateLawSlug en lawMappingUtils.ts)
 */
function generateLawSlug(shortName) {
  if (!shortName) return 'unknown';

  // Primero verificar diccionario explícito
  if (SHORT_NAME_TO_SLUG[shortName]) {
    return SHORT_NAME_TO_SLUG[shortName];
  }

  // Generación automática
  return shortName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Obtener todas las leyes
    const { rows: laws } = await client.query(
      'SELECT id, short_name, slug FROM laws WHERE is_active = true ORDER BY short_name'
    );

    console.log(`\n📊 Total leyes activas: ${laws.length}`);
    console.log('─'.repeat(60));

    let updated = 0;
    let skipped = 0;
    let conflicts = [];

    // Mapa para detectar conflictos de slugs
    const slugMap = new Map();

    for (const law of laws) {
      const newSlug = generateLawSlug(law.short_name);

      // Verificar si ya tiene slug
      if (law.slug) {
        skipped++;
        continue;
      }

      // Verificar conflictos
      if (slugMap.has(newSlug)) {
        conflicts.push({
          slug: newSlug,
          laws: [slugMap.get(newSlug), law.short_name]
        });
        continue;
      }

      slugMap.set(newSlug, law.short_name);

      // Actualizar en BD
      await client.query(
        'UPDATE laws SET slug = $1 WHERE id = $2',
        [newSlug, law.id]
      );

      console.log(`✅ ${law.short_name} → ${newSlug}`);
      updated++;
    }

    console.log('─'.repeat(60));
    console.log(`\n📈 Resumen:`);
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ⏭️  Ya tenían slug: ${skipped}`);

    if (conflicts.length > 0) {
      console.log(`   ⚠️  Conflictos: ${conflicts.length}`);
      conflicts.forEach(c => {
        console.log(`      - "${c.slug}": ${c.laws.join(', ')}`);
      });
    }

    // Verificación final
    const { rows: verification } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE slug IS NOT NULL) as with_slug,
        COUNT(*) FILTER (WHERE slug IS NULL) as without_slug,
        COUNT(*) as total
      FROM laws
      WHERE is_active = true
    `);

    console.log(`\n🔍 Verificación final:`);
    console.log(`   Con slug: ${verification[0].with_slug}`);
    console.log(`   Sin slug: ${verification[0].without_slug}`);

  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);
