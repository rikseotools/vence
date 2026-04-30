require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PT = 'administrativo_galicia';

const topics = [
  // === BLOQUE I ===
  { n: 1, bloque: 1, title: 'La Constitución Española de 1978', descCorta: 'La Constitución española de 1978: título preliminar, título I (excepto cap. III 3º), título II, III (excepto caps II y III), IV, V y VIII.',
    epigrafe: 'La Constitución española de 1978: título preliminar, título I (excepto capítulo III 3º), título II, título III (excepto capítulos II e III), título IV, título V y título VIII' },
  { n: 2, bloque: 1, title: 'Estatuto de Autonomía de Galicia', descCorta: 'Ley orgánica 1/1981 del Estatuto de Autonomía para Galicia: títulos preliminar, I, II, III y V.',
    epigrafe: 'Ley orgánica 1/1981, de 6 de abril, del Estatuto de autonomía para Galicia: título preliminar, título I, título II, título III y título V' },
  { n: 3, bloque: 1, title: 'La Unión Europea y el derecho derivado', descCorta: 'La Unión Europea y el derecho derivado: reglamentos, directivas, decisiones, recomendaciones y dictámenes.',
    epigrafe: 'La Unión Europea, el derecho derivado: reglamentos, directivas, decisiones, recomendaciones y dictámenes' },
  { n: 4, bloque: 1, title: 'Fuentes del derecho europeo', descCorta: 'Fuentes del derecho europeo: actos jurídicos, procedimientos de adopción y otras disposiciones TFUE. Integración del derecho europeo en España.',
    epigrafe: 'Fuentes del derecho europeo: actos jurídicos de la Unión, procedimientos de adopción y otras disposiciones según el Tratado de funcionamiento de la Unión Europea. La integración del derecho europeo en España' },
  { n: 5, bloque: 1, title: 'Las instituciones de la Unión Europea', descCorta: 'Las instituciones de la Unión Europea: Parlamento, Consejo Europeo, Consejo, Comisión y otras instituciones.',
    epigrafe: 'Las instituciones de la Unión Europea: el Parlamento, el Consejo Europeo, el Consejo y la Comisión. Otras instituciones' },
  { n: 6, bloque: 1, title: 'Las competencias de la Unión Europea', descCorta: 'Las competencias de la Unión Europea. El marco de atribuciones concedidas por los tratados. El desarrollo de las competencias.',
    epigrafe: 'Las competencias de la Unión Europea. El marco de atribuciones concedidas por los tratados. El desarrollo de las competencias de la Unión' },
  { n: 7, bloque: 1, title: 'Ley 31/1995 de prevención de riesgos laborales', descCorta: 'Ley 31/1995 de prevención de riesgos laborales: capítulo III.',
    epigrafe: 'Ley 31/1995, de 8 de noviembre, de prevención de riesgos laborales: capítulo III' },

  // === BLOQUE II ===
  { n: 8, bloque: 2, title: 'Ley 39/2015 del Procedimiento Administrativo Común', descCorta: 'Ley 39/2015 del procedimiento administrativo común: títulos preliminar, I, II, III, IV y V.',
    epigrafe: 'Ley 39/2015, de 1 de octubre, del procedimiento administrativo común de las administraciones públicas: títulos preliminar, I, II, III, IV y V' },
  { n: 9, bloque: 2, title: 'Ley 40/2015 de Régimen Jurídico del Sector Público', descCorta: 'Ley 40/2015 de régimen jurídico del sector público: capítulos I, II (excepto subsec 2ª sec 3ª), III, IV y V del título preliminar.',
    epigrafe: 'Ley 40/2015, de 1 de octubre, de régimen jurídico del sector público: capítulos I, II (excepto subsección 2ª de sección 3ª), III, IV y V del título preliminar' },
  { n: 10, bloque: 2, title: 'Ley 16/2010 de organización de la Administración de Galicia', descCorta: 'Ley 16/2010 de organización y funcionamiento de la Administración general y sector público autonómico de Galicia: títulos preliminar, I, II y cap I del título III.',
    epigrafe: 'Ley 16/2010, de 17 de diciembre, de organización y funcionamiento de la Administración general y del sector público autonómico de Galicia: títulos preliminar, I, II y capítulo I del título III' },
  { n: 11, bloque: 2, title: 'Ley 9/2017 de Contratos del Sector Público', descCorta: 'Ley 9/2017 de contratos del sector público: título preliminar, libro primero (excepto cap V título I) y cap I título I del libro segundo.',
    epigrafe: 'Ley 9/2017, de 8 de noviembre, de contratos del sector público: título preliminar, libro primero (excepto capítulo V del título I) y capítulo I del título I (excepto subsecciones 5, 6 y 7 de sección 2) del libro segundo' },
  { n: 12, bloque: 2, title: 'Ley 9/2007 de Subvenciones de Galicia', descCorta: 'Ley 9/2007 de subvenciones de Galicia: títulos preliminar e I.',
    epigrafe: 'Ley 9/2007, de 13 de junio, de subvenciones de Galicia: títulos preliminar e I' },
  { n: 13, bloque: 2, title: 'Ley 2/2015 del Empleo Público de Galicia', descCorta: 'Ley 2/2015 del empleo público de Galicia: títulos I al IX.',
    epigrafe: 'Ley 2/2015, de 29 de abril, del empleo público de Galicia: títulos I al IX' },
  { n: 14, bloque: 2, title: 'Régimen financiero y presupuestario de Galicia', descCorta: 'Decreto legislativo 1/1999 del texto refundido de la Ley de régimen financiero y presupuestario de Galicia: título preliminar y caps I e III del título III.',
    epigrafe: 'Decreto legislativo 1/1999, de 7 de octubre, texto refundido de la Ley de régimen financiero y presupuestario de Galicia: título preliminar y capítulos I e III del título III' },
  { n: 15, bloque: 2, title: 'RDL 1/2013 Derechos de las personas con discapacidad', descCorta: 'Real decreto legislativo 1/2013 de la Ley general de derechos de las personas con discapacidad: título preliminar, título I (sec 1ª cap V y cap VIII) y título II.',
    epigrafe: 'Real decreto legislativo 1/2013, de 29 de noviembre, texto refundido de la Ley general de derechos de las personas con discapacidad y de su inclusión social: título preliminar, título I (sección 1ª del capítulo V y capítulo VIII) y título II' },
  { n: 16, bloque: 2, title: 'Ley 1/2016 de Transparencia y Buen Gobierno', descCorta: 'Ley 1/2016 de transparencia y buen gobierno: título preliminar, título I (caps I, II, IV, V) y título II (secs 1ª, 2ª y 3ª del cap I).',
    epigrafe: 'Ley 1/2016, de 18 de enero, de transparencia y buen gobierno: título preliminar, título I (capítulos I, II, IV, V) y título II (secciones 1ª, 2ª y 3ª del capítulo I)' },
  { n: 17, bloque: 2, title: 'Ley 7/2023 de Igualdad de Galicia', descCorta: 'Ley 7/2023 para la igualdad efectiva de mujeres y hombres de Galicia: títulos preliminar, I, II (caps I, II, XI), VII y VIII.',
    epigrafe: 'Ley 7/2023, de 30 de noviembre, para la igualdad efectiva de mujeres y hombres de Galicia: títulos preliminar, I, II (capítulos I, II, XI), VII y VIII' },
  { n: 18, bloque: 2, title: 'Estatuto de los Trabajadores', descCorta: 'Real decreto legislativo 2/2015 del Estatuto de los Trabajadores: cap I sec 4ª, cap II secs 1ª y 2ª, cap III sec 1ª del título I.',
    epigrafe: 'Real decreto legislativo 2/2015, de 23 de octubre, texto refundido de la Ley del Estatuto de los trabajadores: capítulo I (sección 4ª), capítulo II (secciones 1ª y 2ª) y capítulo III (sección 1ª) del título I' },
  { n: 19, bloque: 2, title: 'Ley General de la Seguridad Social', descCorta: 'Real decreto legislativo 8/2015 de la LGSS: caps II, III y IV (secs 1ª) título I, cap XI (excepto arts 196-199) título II y cap I (sec 1ª) título VI.',
    epigrafe: 'Real decreto legislativo 8/2015, de 30 de octubre, texto refundido de la Ley general de la seguridad social: capítulos II, III y IV (secciones 1ª) del título I, capítulo XI (excepto artículos 196-199) del título II y capítulo I (sección 1ª) del título VI' },
];

(async () => {
  // Insert bloques first
  console.log('=== Insertando bloques ===');
  const bloques = [
    { position_type: PT, bloque_number: 1, titulo: 'Bloque I: Parte General', icon: '🏛️', sort_order: 1 },
    { position_type: PT, bloque_number: 2, titulo: 'Bloque II: Parte Específica', icon: '⚖️', sort_order: 2 },
  ];
  for (const b of bloques) {
    const { data: existing } = await s.from('oposicion_bloques').select('id').eq('position_type', PT).eq('bloque_number', b.bloque_number).maybeSingle();
    if (existing) { console.log(' ⏭️  b' + b.bloque_number, 'ya existe'); continue; }
    const { error } = await s.from('oposicion_bloques').insert(b);
    if (error) { console.error('❌ b' + b.bloque_number, error.message); continue; }
    console.log(' ✅ b' + b.bloque_number, '|', b.titulo);
  }

  // Insert topics
  console.log('\n=== Insertando topics ===');
  for (const t of topics) {
    const { data: existing } = await s.from('topics').select('id').eq('position_type', PT).eq('topic_number', t.n).maybeSingle();
    if (existing) { console.log(' ⏭️  T' + t.n, 'ya existe'); continue; }
    const { error } = await s.from('topics').insert({
      position_type: PT,
      topic_number: t.n,
      title: t.title,
      description: t.epigrafe,
      epigrafe: t.epigrafe,
      descripcion_corta: t.descCorta,
      bloque_number: t.bloque,
      difficulty: 'medium',
      estimated_hours: 10,
      is_active: true,
      disponible: true,
    });
    if (error) { console.error('❌ T' + t.n, error.message); continue; }
    console.log(' ✅ T' + String(t.n).padStart(2, '0'), '|', t.title);
  }

  console.log('\n=== Resultado ===');
  const { data: finalTopics } = await s.from('topics').select('topic_number, title, bloque_number').eq('position_type', PT).order('topic_number');
  console.log('Total topics:', finalTopics.length);
})();
