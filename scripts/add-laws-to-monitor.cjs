#!/usr/bin/env node
// Añade leyes importantes para distintas oposiciones al sistema de monitoreo
// Uso: node scripts/add-laws-to-monitor.cjs

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Leyes a añadir con sus URLs del BOE
const LEYES_A_ANADIR = [
  // === CÓDIGO PENAL Y JUSTICIA ===
  {
    short_name: 'CP',
    name: 'Ley Orgánica 10/1995, de 23 de noviembre, del Código Penal',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-25444',
    category: 'Justicia'
  },
  {
    short_name: 'LECrim',
    name: 'Real Decreto de 14 de septiembre de 1882, Ley de Enjuiciamiento Criminal',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1882-6036',
    category: 'Justicia'
  },
  {
    short_name: 'LH',
    name: 'Decreto de 8 de febrero de 1946, Ley Hipotecaria',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1946-2453',
    category: 'Justicia'
  },
  {
    short_name: 'RH',
    name: 'Decreto de 14 de febrero de 1947, Reglamento Hipotecario',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1947-3843',
    category: 'Justicia'
  },
  {
    short_name: 'LRC',
    name: 'Ley 20/2011, de 21 de julio, del Registro Civil',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-12628',
    category: 'Justicia'
  },
  {
    short_name: 'RDAJ',
    name: 'Real Decreto 1608/2005, de 30 de diciembre, Reglamento Orgánico del Cuerpo de Auxilio Judicial',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-795',
    category: 'Justicia'
  },
  {
    short_name: 'RDTP',
    name: 'Real Decreto 1451/2005, de 7 de diciembre, Reglamento de ingreso, provisión de puestos de trabajo y promoción profesional del personal funcionario al servicio de la Administración de Justicia',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2005-20351',
    category: 'Justicia'
  },

  // === POLICÍA Y SEGURIDAD ===
  {
    short_name: 'LOFCS',
    name: 'Ley Orgánica 2/1986, de 13 de marzo, de Fuerzas y Cuerpos de Seguridad',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1986-6859',
    category: 'Seguridad'
  },
  {
    short_name: 'LSP',
    name: 'Ley 5/2014, de 4 de abril, de Seguridad Privada',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-3649',
    category: 'Seguridad'
  },
  {
    short_name: 'RP',
    name: 'Real Decreto 190/1996, de 9 de febrero, Reglamento Penitenciario',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1996-3307',
    category: 'Seguridad'
  },
  {
    short_name: 'LOGP',
    name: 'Ley Orgánica 1/1979, de 26 de septiembre, General Penitenciaria',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1979-23708',
    category: 'Seguridad'
  },
  {
    short_name: 'Ley Tráfico',
    name: 'Real Decreto Legislativo 6/2015, de 30 de octubre, Ley sobre Tráfico, Circulación de Vehículos a Motor y Seguridad Vial',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722',
    category: 'Seguridad'
  },
  {
    short_name: 'RGC',
    name: 'Real Decreto 1428/2003, de 21 de noviembre, Reglamento General de Circulación',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514',
    category: 'Seguridad'
  },
  {
    short_name: 'LEx',
    name: 'Ley Orgánica 4/2000, de 11 de enero, sobre derechos y libertades de los extranjeros en España y su integración social',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-544',
    category: 'Seguridad'
  },
  {
    short_name: 'REx',
    name: 'Real Decreto 557/2011, de 20 de abril, Reglamento de la Ley Orgánica 4/2000, sobre derechos y libertades de los extranjeros',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-7703',
    category: 'Seguridad'
  },

  // === CORREOS ===
  {
    short_name: 'LSP2010',
    name: 'Ley 43/2010, de 30 de diciembre, del servicio postal universal, de los derechos de los usuarios y del mercado postal',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-20139',
    category: 'Correos'
  },
  {
    short_name: 'RSP',
    name: 'Real Decreto 1829/1999, de 3 de diciembre, Reglamento por el que se regula la prestación de los servicios postales',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1999-24916',
    category: 'Correos'
  },

  // === HACIENDA Y TRIBUTARIO ===
  {
    short_name: 'LGT',
    name: 'Ley 58/2003, de 17 de diciembre, General Tributaria',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186',
    category: 'Hacienda'
  },
  {
    short_name: 'RGGIT',
    name: 'Real Decreto 1065/2007, de 27 de julio, Reglamento General de Gestión e Inspección Tributaria',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984',
    category: 'Hacienda'
  },
  {
    short_name: 'LIRPF',
    name: 'Ley 35/2006, de 28 de noviembre, del Impuesto sobre la Renta de las Personas Físicas',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764',
    category: 'Hacienda'
  },
  {
    short_name: 'LIVA',
    name: 'Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740',
    category: 'Hacienda'
  },
  {
    short_name: 'LIS',
    name: 'Ley 27/2014, de 27 de noviembre, del Impuesto sobre Sociedades',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-12328',
    category: 'Hacienda'
  },

  // === LABORAL Y SEGURIDAD SOCIAL ===
  {
    short_name: 'ET',
    name: 'Real Decreto Legislativo 2/2015, de 23 de octubre, Estatuto de los Trabajadores',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430',
    category: 'Laboral'
  },
  {
    short_name: 'LGSS',
    name: 'Real Decreto Legislativo 8/2015, de 30 de octubre, Ley General de la Seguridad Social',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724',
    category: 'Laboral'
  },
  {
    short_name: 'LPRL',
    name: 'Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-24292',
    category: 'Laboral'
  },
  {
    short_name: 'LISOS',
    name: 'Real Decreto Legislativo 5/2000, de 4 de agosto, Ley sobre Infracciones y Sanciones en el Orden Social',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-15060',
    category: 'Laboral'
  },
  {
    short_name: 'LRJS',
    name: 'Ley 36/2011, de 10 de octubre, reguladora de la Jurisdicción Social',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-15936',
    category: 'Laboral'
  },

  // === MERCANTIL Y CIVIL ===
  {
    short_name: 'CCom',
    name: 'Real Decreto de 22 de agosto de 1885, Código de Comercio',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1885-6627',
    category: 'Mercantil'
  },
  {
    short_name: 'LSC',
    name: 'Real Decreto Legislativo 1/2010, de 2 de julio, Ley de Sociedades de Capital',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-10544',
    category: 'Mercantil'
  },
  {
    short_name: 'LC',
    name: 'Real Decreto Legislativo 1/2020, de 5 de mayo, Ley Concursal',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2020-4859',
    category: 'Mercantil'
  },
  {
    short_name: 'TRLGDCU',
    name: 'Real Decreto Legislativo 1/2007, de 16 de noviembre, Ley General para la Defensa de los Consumidores y Usuarios',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555',
    category: 'Civil'
  },

  // === SANIDAD ===
  {
    short_name: 'LGS',
    name: 'Ley 14/1986, de 25 de abril, General de Sanidad',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1986-10499',
    category: 'Sanidad'
  },
  {
    short_name: 'LCCSNS',
    name: 'Ley 16/2003, de 28 de mayo, de cohesión y calidad del Sistema Nacional de Salud',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-10715',
    category: 'Sanidad'
  },
  {
    short_name: 'LOPS',
    name: 'Ley 44/2003, de 21 de noviembre, de ordenación de las profesiones sanitarias',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-21340',
    category: 'Sanidad'
  },
  {
    short_name: 'LAP',
    name: 'Ley 41/2002, de 14 de noviembre, básica reguladora de la autonomía del paciente',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-22188',
    category: 'Sanidad'
  },

  // === EDUCACIÓN ===
  {
    short_name: 'LOMLOE',
    name: 'Ley Orgánica 3/2020, de 29 de diciembre, por la que se modifica la LOE',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2020-17264',
    category: 'Educación'
  },

  // === PROTECCIÓN CIVIL ===
  {
    short_name: 'LSNPC',
    name: 'Ley 17/2015, de 9 de julio, del Sistema Nacional de Protección Civil',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-7730',
    category: 'Protección Civil'
  },

  // === MEDIO AMBIENTE ===
  {
    short_name: 'LEA',
    name: 'Ley 21/2013, de 9 de diciembre, de evaluación ambiental',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2013-12913',
    category: 'Medio Ambiente'
  },
  {
    short_name: 'LRSC',
    name: 'Ley 7/2022, de 8 de abril, de residuos y suelos contaminados para una economía circular',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-5809',
    category: 'Medio Ambiente'
  },

  // === URBANISMO ===
  {
    short_name: 'TRLS',
    name: 'Real Decreto Legislativo 7/2015, de 30 de octubre, Ley de Suelo y Rehabilitación Urbana',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-11723',
    category: 'Urbanismo'
  },

  // === ADMINISTRACIÓN LOCAL ===
  {
    short_name: 'TRRL',
    name: 'Real Decreto Legislativo 781/1986, de 18 de abril, Texto Refundido de las Disposiciones Legales vigentes en materia de Régimen Local',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1986-9865',
    category: 'Administración Local'
  },
  {
    short_name: 'LRSAL',
    name: 'Ley 27/2013, de 27 de diciembre, de racionalización y sostenibilidad de la Administración Local',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2013-13756',
    category: 'Administración Local'
  },
  {
    short_name: 'LRHL',
    name: 'Real Decreto Legislativo 2/2004, de 5 de marzo, Ley Reguladora de las Haciendas Locales',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2004-4214',
    category: 'Administración Local'
  },

  // === FUNCIÓN PÚBLICA AUTONÓMICA (ejemplos) ===
  {
    short_name: 'EBEP-Andalucía',
    name: 'Ley 5/2023, de 7 de junio, de la Función Pública de Andalucía',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2023-14729',
    category: 'Función Pública Autonómica'
  },

  // === NOTARIADO Y REGISTRO ===
  {
    short_name: 'LN',
    name: 'Ley del Notariado de 28 de mayo de 1862',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1862-4073',
    category: 'Notariado'
  },
  {
    short_name: 'RN',
    name: 'Decreto de 2 de junio de 1944, Reglamento de la organización y régimen del Notariado',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1944-6578',
    category: 'Notariado'
  },

  // === PROCEDIMIENTO Y RECURSOS ===
  {
    short_name: 'LJCA',
    name: 'Ley 29/1998, de 13 de julio, reguladora de la Jurisdicción Contencioso-administrativa',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1998-16718',
    category: 'Procedimiento'
  },

  // === OTRAS OPOSICIONES ESPECÍFICAS ===
  {
    short_name: 'LM',
    name: 'Ley 17/2001, de 7 de diciembre, de Marcas',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2001-23093',
    category: 'Propiedad Industrial'
  },
  {
    short_name: 'LP',
    name: 'Ley 24/2015, de 24 de julio, de Patentes',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-8328',
    category: 'Propiedad Industrial'
  },
  {
    short_name: 'LPI',
    name: 'Real Decreto Legislativo 1/1996, de 12 de abril, Ley de Propiedad Intelectual',
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1996-8930',
    category: 'Propiedad Intelectual'
  },
];

async function main() {
  console.log('=== Añadiendo leyes al sistema de monitoreo ===\n');

  let added = 0;
  let skipped = 0;
  let errors = [];

  for (const ley of LEYES_A_ANADIR) {
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('laws')
      .select('id, short_name')
      .or(`short_name.eq.${ley.short_name},boe_url.eq.${ley.boe_url}`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`⏭️  ${ley.short_name} - Ya existe`);
      skipped++;
      continue;
    }

    // Determinar tipo según el nombre (solo: constitution, law, regulation)
    let type = 'law';
    const nameLower = ley.name.toLowerCase();
    if (nameLower.includes('reglamento') || nameLower.includes('real decreto') || nameLower.includes('decreto') || nameLower.includes('orden')) {
      type = 'regulation';
    }

    // Insertar nueva ley
    const { error } = await supabase.from('laws').insert({
      short_name: ley.short_name,
      name: ley.name,
      boe_url: ley.boe_url,
      type: type,
      is_active: true
    });

    if (error) {
      console.log(`❌ ${ley.short_name} - Error: ${error.message}`);
      errors.push({ ley: ley.short_name, error: error.message });
    } else {
      console.log(`✅ ${ley.short_name} - ${ley.category}`);
      added++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`✅ Añadidas: ${added}`);
  console.log(`⏭️  Ya existían: ${skipped}`);
  console.log(`❌ Errores: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrores:');
    errors.forEach(e => console.log(`  - ${e.ley}: ${e.error}`));
  }

  // Contar total
  const { count } = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`\n📈 Total leyes en sistema: ${count}`);
}

main().catch(console.error);
