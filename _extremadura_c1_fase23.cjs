// FASE 2-3: Administrativo (Administración General) C1 Junta de Extremadura
// Promoción catalogada -> implementada. Temario Anexo IV Orden 23/12/2024 (DOE 250).
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PT = 'administrativo_extremadura';
const OPO_ID = '21f10c08-e6ed-49e6-a0fc-4e166c8f1ad6';

// Law IDs (verificados en BD)
const L = {
  gobierno: 'c734aa2f-69fe-44d1-8d14-744517e4c580',   // Ley 1/2002 Gobierno Ext
  trebep:   'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',   // RDL 5/2015 TREBEP
  fpext:    'ce3db3a0-6645-442a-8342-db0dec0c7ae6',   // Ley 13/2015 FP Ext
  convenio: '6287fe50-03eb-4dcf-a566-c3328de124d7',   // V Convenio Laboral JdE
  jornada:  '9f0503f8-05f3-431b-b9ac-1d8db50ff9af',   // Decreto 149/2013 Jornada Ext
  ingreso:  '5bae2d9e-8dd8-41f3-adb0-54a98cc7a518',   // Decreto 9/1994 Ingreso Ext
  lprl:     '8b1ae300-4ed3-4019-876c-780ea40ebbfe',   // LPRL 31/1995
  lo32007:  '6e59eacd-9298-4164-9d78-9e9343d9a900',   // LO 3/2007 Igualdad
  lo12004:  'f5c17b23-2547-43d2-800c-39f5ea925c2f',   // LO 1/2004 VG
  igualext: '631e1a64-8aa9-4d9f-9850-a88a9e755930',   // Ley 8/2011 Igualdad Ext
  ley40:    '95680d57-feb1-41c0-bb27-236024815feb',   // Ley 40/2015 RJSP
  ley39:    '218452f5-b9f6-48f0-a25b-26df9cb19644',   // Ley 39/2015 LPAC
  aeext:    '144b8b92-7f1d-4ff0-b83c-0cfe8515cd10',   // Decreto 225/2014 AE Ext
  lghp:     'd47fcaab-f099-499f-b47b-1996db4f71d6',   // Ley 5/2007 LGHP Ext
  ley9:     '4f605392-8137-4962-9e66-ca5f275e93ee',   // Ley 9/2017 LCSP
};

const R = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(String(i)); return o; };

// 30 temas: { n, b(loque), title, epigrafe, scope:[{law, arts|null}] }
const TEMAS = [
  { n:1, b:1, title:'El Gobierno y la Administración de la CAE (I)',
    epigrafe:'El Gobierno y la Administración de la Comunidad Autónoma de Extremadura (I): Estructura. Título Preliminar. El Presidente de la Comunidad Autónoma de Extremadura. La Junta de Extremadura.',
    scope:[{law:L.gobierno, arts:['1','2','3','4','5','6','11','12','13','14','15','16','17','19','20','23']}] },
  { n:2, b:1, title:'El Gobierno y la Administración de la CAE (II)',
    epigrafe:'El Gobierno y la Administración de la Comunidad Autónoma de Extremadura (II): Los Miembros de la Junta de Extremadura. Las relaciones del Presidente y la Junta con la Asamblea de Extremadura. La Administración de la Comunidad Autónoma: Principios y normas generales de actuación. Relaciones de la Comunidad Autónoma con otras Administraciones Públicas.',
    scope:[{law:L.gobierno, arts:['24','25','26','27','28','29','30','32','36','37','38','39','40','41','42','43','44','45','46']}] },
  { n:3, b:1, title:'El Gobierno y la Administración de la CAE (III)',
    epigrafe:'El Gobierno y la Administración de la Comunidad Autónoma de Extremadura (III): Los Órganos de la Administración de la Comunidad Autónoma. El procedimiento de elaboración de Reglamentos y anteproyectos de Ley. El ejercicio de sus competencias por los órganos de la Administración de la Comunidad Autónoma. El régimen jurídico de la actuación de la Administración de la Comunidad Autónoma. Las oficinas de asistencia a la ciudadanía.',
    scope:[{law:L.gobierno, arts:R(47,64)}] },
  { n:4, b:1, title:'El Gobierno y la Administración de la CAE (IV)',
    epigrafe:'El Gobierno y la Administración de la Comunidad Autónoma de Extremadura (IV): Los organismos públicos de la Comunidad Autónoma de Extremadura. La potestad sancionadora. La responsabilidad patrimonial de la administración de la Comunidad Autónoma y de sus autoridades y demás personal a su servicio.',
    scope:[{law:L.ley40, arts:['25','28','32','33','34','35','36','37']}] },
  { n:5, b:1, title:'Estatuto Básico del Empleado Público (TREBEP)',
    epigrafe:'Estatuto Básico del Empleado Público: Objeto y ámbito de aplicación. Clases de personal al servicio de las Administraciones Públicas. Derechos de los Empleados Públicos. Derecho a la Carrera Profesional y a la Promoción Interna. La evaluación del Desempeño. Derechos Retributivos.',
    scope:[{law:L.trebep, arts:['1','2','3','4','5','6','7','8','9','10','11','12','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','76']}] },
  { n:6, b:1, title:'La Función Pública de Extremadura (I)',
    epigrafe:'La Función Pública de Extremadura (I): Personal al servicio de las Administraciones Públicas de Extremadura. Ordenación y estructura de los recursos humanos. Adquisición y pérdida de la condición de empleado público.',
    scope:[{law:L.fpext, arts:R(1,45)}] },
  { n:7, b:1, title:'La Función Pública de Extremadura (II)',
    epigrafe:'La Función Pública de Extremadura (II): Acceso al empleo Público. Situaciones Administrativas. Ingreso del personal al servicio de la Comunidad Autónoma de Extremadura. El acceso de las personas con discapacidad al empleo público de la Comunidad Autónoma de Extremadura.',
    scope:[{law:L.fpext, arts:['46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','73']},{law:L.ingreso, arts:null}] },
  { n:8, b:1, title:'La Función Pública de Extremadura (III)',
    epigrafe:'La Función Pública de Extremadura (III): Situaciones Administrativas. Derechos del personal empleado público. Jornada de trabajo, permisos y vacaciones. La regulación de la jornada y horario de trabajo, los permisos y las vacaciones del personal funcionario al servicio de la Administración de la Comunidad Autónoma de Extremadura.',
    scope:[{law:L.fpext, arts:['70','71','72']},{law:L.jornada, arts:null}] },
  { n:9, b:1, title:'La Función Pública de Extremadura (IV)',
    epigrafe:'La Función Pública de Extremadura (IV): Promoción Profesional y evaluación del desempeño. Provisión de puestos de trabajo y movilidad.',
    scope:[{law:L.fpext, arts:R(102,132)}] },
  { n:10, b:1, title:'La Función Pública de Extremadura (V)',
    epigrafe:'La Función Pública de Extremadura (V): Régimen Retributivo. Deberes del personal empleado público, principios de conducta y régimen de incompatibilidades. La formación de los empleados públicos. Régimen disciplinario.',
    scope:[{law:L.fpext, arts:['80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97','98','99','100','101','133','134','135','136','137','138','139','140','141','142','143','144','145','146','147','148','149','150','151','152','153','154','155','156','157','158','159','160','161','162']}] },
  { n:11, b:1, title:'Personal Laboral - Convenio Colectivo (I)',
    epigrafe:'El Personal Laboral al servicio de la Junta de Extremadura: Convenio Colectivo para el personal laboral (I): Ámbito de aplicación y vigencia. Denuncia. Organización del trabajo. Comisión paritaria. Clasificación profesional. Retribuciones. Puestos y funciones de libre designación.',
    scope:[{law:L.convenio, arts:['1','2','3','4','5','6','7','8','9','7 bis']}] },
  { n:12, b:1, title:'Personal Laboral - Convenio Colectivo (II)',
    epigrafe:'El Personal Laboral al servicio de la Junta de Extremadura: Convenio Colectivo para el personal laboral (II): Movilidad geográfica. Supresión de puestos de trabajo de personal fijo discontinuo y zonificación. Cambio de puestos de trabajo. Permutas. Provisión de puestos de trabajo. Movilidad del personal laboral entre Administraciones Públicas. Movilidad funcional. Jornada y horario.',
    scope:[{law:L.convenio, arts:['11','12','13','14','15','16','17','18','19','15 bis']}] },
  { n:13, b:1, title:'Personal Laboral - Convenio Colectivo (III)',
    epigrafe:'El Personal Laboral al servicio de la Junta de Extremadura: Convenio Colectivo para el personal laboral (III): Horas Extraordinarias. Vacaciones. Permisos y licencias. Medidas complementarias de conciliación de la vida familiar y laboral. Permisos sin sueldo. Suspensión del contrato. Excedencia. Reingreso. Jubilación. Indemnización por incapacidad o fallecimiento. Régimen disciplinario.',
    scope:[{law:L.convenio, arts:['20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38']}] },
  { n:14, b:2, title:'Régimen Jurídico del Sector Público (I)',
    epigrafe:'Régimen Jurídico del Sector Público (I): Disposiciones generales. Los órganos de las Administraciones Públicas. Los Convenios. Las relaciones interadministrativas.',
    scope:[{law:L.ley40, arts:['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','47','48','49','50','51','52','53','140','141','142','143','144','145','146','147','148','149','150','151','152','153','154','155','156','157','158']}] },
  { n:15, b:2, title:'Régimen Jurídico del Sector Público (II)',
    epigrafe:'Régimen Jurídico del Sector Público (II): Los principios de la potestad sancionadora y la responsabilidad patrimonial de las Administraciones Públicas. Reglamento sobre procedimientos sancionadores seguidos por la Comunidad Autónoma de Extremadura.',
    scope:[{law:L.ley40, arts:['25','26','27','28','29','30','31','32','33','34','35','36','37']}] },
  { n:16, b:2, title:'El Procedimiento Administrativo Común (I)',
    epigrafe:'El Procedimiento Administrativo Común de las Administraciones Públicas (I): Disposiciones Generales. Los interesados en el procedimiento.',
    scope:[{law:L.ley39, arts:R(1,12)}] },
  { n:17, b:2, title:'El Procedimiento Administrativo Común (II)',
    epigrafe:'El Procedimiento Administrativo Común de las Administraciones Públicas (II): La actividad de las Administraciones Públicas. Los actos administrativos.',
    scope:[{law:L.ley39, arts:R(13,52)}] },
  { n:18, b:2, title:'El Procedimiento Administrativo Común (III)',
    epigrafe:'El Procedimiento Administrativo Común de las Administraciones Públicas (III): Las disposiciones sobre el procedimiento administrativo común. La revisión de los actos en vía administrativa. La iniciativa legislativa y de la potestad para dictar reglamentos y otras disposiciones.',
    scope:[{law:L.ley39, arts:['53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','106','107','108','109','110','111','112','113','114','115','116','117','118','119','120','121','122','123','124','125','126','127','128','129','130','131','132','133']}] },
  { n:19, b:2, title:'La contratación del sector público (I)',
    epigrafe:'La contratación del sector público (I): Disposiciones generales: Objeto y ámbito de aplicación de la Ley. Contratos del Sector Público. Disposiciones generales sobre la contratación del sector público.',
    scope:[{law:L.ley9, arts:['1','2','3','7','9','11','12','13','14','15','16','17','18']}] },
  { n:20, b:2, title:'La contratación del sector público (II)',
    epigrafe:'La contratación del sector público (II): Disposiciones generales sobre la contratación del sector público. Partes en el contrato.',
    scope:[{law:L.ley9, arts:['19','20','21','22','23','24','25','26','27','29','30','34','35','36','37','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','69']}] },
  { n:21, b:2, title:'La contratación del sector público (III)',
    epigrafe:'La contratación del sector público (III): Objeto, presupuesto base de licitación, valor estimado, precio del contrato y su revisión. Garantías exigibles en la contratación del sector público.',
    scope:[{law:L.ley9, arts:['99','100','101','102','103','104','105','106','107','108','109','110','111','112','116','117','118','119','120','121','122']}] },
  { n:22, b:2, title:'La contratación del sector público (IV)',
    epigrafe:'La contratación del sector público (IV): Disposiciones generales. De la preparación de los contratos de las Administraciones Públicas. De la adjudicación de los contratos de las Administraciones Públicas.',
    scope:[{law:L.ley9, arts:['124','131','135','136','139','143','145','150','152','153','155','156','158','159','160','161','162','187','188','189','190','191','192','193','194','195','196','197','198','199']}] },
  { n:23, b:2, title:'La contratación del sector público (V)',
    epigrafe:'La contratación del sector público (V): De los distintos tipos de contratos de las Administraciones públicas: contrato de obras, contrato de concesión de servicios, contrato de suministros y contrato de servicios.',
    scope:[{law:L.ley9, arts:['231','232','233','234','235','236','237','238','239','240','241','242','243','244','245','246','247','248','249','250','251','252','253','254','255','256','257','258','259','260','262','263','264','267','270','280','284','285','286','287','288','289','290','291','292','293','294','295','296','297','298','299','300','301','302','303','304','305','306','307','308','309','310','311','312','313']}] },
  { n:24, b:2, title:'La contratación del sector público (VI)',
    epigrafe:'La contratación del sector público (VI): Órganos competentes en materia de contratación. Registros oficiales. Normas en materia de contratación, convenios, encargos de gestión y transferencias en la Ley de Presupuestos Generales de la Comunidad Autónoma de Extremadura.',
    scope:[{law:L.ley9, arts:['314','315','323','324','325','326','328','329','332','333','334','335','337']}] },
  { n:25, b:2, title:'Administración Electrónica de Extremadura',
    epigrafe:'Régimen Jurídico de Administración Electrónica de la Comunidad Autónoma de Extremadura: Disposiciones Generales. Puntos de acceso electrónicos corporativos. Registro Electrónico. Comunicaciones y notificaciones electrónicas.',
    scope:[{law:L.aeext, arts:['1','2','3','4','5','6','7','8','9','19','20','21','22','23','24','25','26','27','28','29','30','31','32','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65']}] },
  { n:26, b:2, title:'La Hacienda Pública de la Comunidad Autónoma (I)',
    epigrafe:'La Hacienda Pública de la Comunidad Autónoma (I): Principios Generales. De los Presupuestos Generales de la Comunidad Autónoma: Contenido, estructura y elaboración de los presupuestos. De la Gestión Presupuestaria. Ley por la que se aprueban los Presupuestos Generales de la Comunidad Autónoma de Extremadura.',
    scope:[{law:L.lghp, arts:['9','17','30','34']}] },
  { n:27, b:2, title:'La Hacienda Pública de la Comunidad Autónoma (II)',
    epigrafe:'La Hacienda Pública de la Comunidad Autónoma de Extremadura (II): De los créditos y sus modificaciones: Disposiciones Generales. De las modificaciones de créditos. Competencias en materia de modificaciones de créditos.',
    scope:[{law:L.lghp, arts:['59','70','75','77']}] },
  { n:28, b:2, title:'Procedimiento de ejecución del gasto público',
    epigrafe:'Procedimiento de ejecución del gasto público: Procedimiento general. Procedimientos especiales: Anticipos de caja fija. Pagos a justificar. Pagos en firme. Tramitación anticipada de expedientes de gastos.',
    scope:[{law:L.lghp, arts:['25','78']}] },
  { n:29, b:2, title:'Ley de Prevención de Riesgos Laborales',
    epigrafe:'Ley de Prevención de Riesgos Laborales: Objeto, ámbito de aplicación y definiciones. Derechos y obligaciones.',
    scope:[{law:L.lprl, arts:['1','2','4','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29']}] },
  { n:30, b:2, title:'Igualdad entre Mujeres y Hombres y Violencia de Género en Extremadura',
    epigrafe:'Ley de Igualdad entre Mujeres y Hombres y contra la Violencia de Género en Extremadura: Disposiciones generales. Integración de la perspectiva de género en las políticas públicas. Violencia de Género: Derechos de las mujeres en situaciones de violencia de género a la atención integral y efectiva.',
    scope:[{law:L.igualext, arts:['1','2','3','4','20','21','22','23','24','25','26','27','28','29','30','31','32','76','77','78','79','80','81','82','83']},{law:L.lo32007, arts:['1','2','3','4','5','6','7','8','9','10','11','12','13','14']},{law:L.lo12004, arts:['1','2','3','10','14','17','19','20','21','23','24','27','30']}] },
];

(async () => {
  let err = 0;
  const fail = (msg, e) => { if (e) { console.error('❌', msg, e.message || e); err++; } };

  // 1. Bloques
  await s.from('oposicion_bloques').delete().eq('position_type', PT);
  const { error: be } = await s.from('oposicion_bloques').insert([
    { position_type: PT, bloque_number: 1, titulo: 'Bloque I: Organización y Empleo Público de Extremadura', icon: '🏛️', sort_order: 1 },
    { position_type: PT, bloque_number: 2, titulo: 'Bloque II: Derecho Administrativo, Contratación y Hacienda', icon: '⚖️', sort_order: 2 },
  ]);
  fail('bloques', be);

  // 2. Topics (limpiar y reinsertar)
  await s.from('topic_scope').delete().in('topic_id',
    (await s.from('topics').select('id').eq('position_type', PT)).data?.map(t => t.id) || ['00000000-0000-0000-0000-000000000000']);
  await s.from('topics').delete().eq('position_type', PT);

  const rows = TEMAS.map(t => ({
    position_type: PT, topic_number: t.n, bloque_number: t.b,
    title: t.title, description: t.epigrafe, epigrafe: t.epigrafe,
    descripcion_corta: t.title, difficulty: 'medium', estimated_hours: 12,
    is_active: true, disponible: true,
  }));
  const { data: ins, error: te } = await s.from('topics').insert(rows).select('id, topic_number');
  fail('topics', te);
  if (te) { console.log('ABORT'); return; }
  const idByNum = {}; ins.forEach(r => idByNum[r.topic_number] = r.id);

  // 3. Topic scope
  const scopeRows = [];
  for (const t of TEMAS) for (const sc of t.scope)
    scopeRows.push({ topic_id: idByNum[t.n], law_id: sc.law, article_numbers: sc.arts });
  const { error: se } = await s.from('topic_scope').insert(scopeRows);
  fail('topic_scope', se);

  // 4. Oposiciones row update
  const { error: oe } = await s.from('oposiciones').update({
    nombre: 'Administrativo (Administración General) de la Junta de Extremadura',
    short_name: 'Administrativo Extremadura',
    grupo: 'C', subgrupo: 'C1', categoria: 'C1',
    administracion: 'autonomica',
    plazas_libres: 9, plazas_discapacidad: 2, plazas_promocion_interna: null,
    temas_count: 30, bloques_count: 2,
    titulo_requerido: 'Bachiller o Técnico (o equivalente)',
    estado_proceso: 'lista_admitidos',
    exam_date: null,
    inscription_start: '2026-01-12', inscription_deadline: '2026-02-06',
    oep_decreto: 'Acuerdo Consejo de Gobierno 15/12/2021 (OEP 2021) y 27/12/2023 (OEP 2023)',
    oep_fecha: '2023-12-27',
    convocatoria_numero: 'Orden 23/12/2024 (acum. Orden 17/12/2025)',
    convocatoria_fecha: '2024-12-23',
    diario_oficial: 'DOE',
    diario_referencia: 'DOE núm. 250, 27/12/2024 (acum. DOE núm. 244, 19/12/2025)',
    programa_url: 'https://doe.juntaex.es/pdfs/doe/2024/2500o/24050212.pdf',
    seguimiento_url: 'https://www.juntaex.es/temas/trabajo-y-empleo/empleo-publico/buscador-de-empleo-publico',
    color_primario: 'emerald',
    seo_title: 'Administrativo Junta de Extremadura 2026 | Test y Temario C1 | Vence',
    seo_description: 'Prepara el Cuerpo Administrativo (C1) de la Junta de Extremadura: 30 temas oficiales del DOE, tests por tema y simulacros de examen (62 preguntas).',
    examen_config: {
      tipo: 'test', penalizacion: '1/4 (cada 4 erróneas resta 1 correcta; en blanco no puntúan)',
      total_preguntas: 62, duracion_total_minutos: 110,
      partes: [
        { nombre: 'Parte teórica', preguntas: 50, reserva: 6 },
        { nombre: 'Parte práctica (supuestos)', preguntas: 12, reserva: 4 },
      ],
      notas: 'Estructura modificada por Orden de 22/04/2026 (DOE núm. 81, 29/04/2026). Ejercicio único teórico-práctico.',
    },
    landing_estadisticas: [
      { numero: '11', texto: 'Plazas (OEP 2021-2023)', color: 'text-green-600' },
      { numero: '{temasCount}', texto: 'Temas oficiales', color: 'text-blue-600' },
      { numero: '62', texto: 'Preguntas en el examen', color: 'text-purple-600' },
      { numero: 'Bachiller', texto: 'Título requerido', color: 'text-orange-600' },
    ],
    landing_faqs: [
      { pregunta: '¿Cuántas plazas hay?', respuesta: 'Se convocan 11 plazas del Cuerpo Administrativo, Especialidad Administración General (9 por turno libre y 2 por discapacidad), correspondientes a las OEP 2021-2023, mediante la Orden de 23 de diciembre de 2024 y su acumulación por Orden de 17 de diciembre de 2025.' },
      { pregunta: '¿Cómo es el examen?', respuesta: 'Un único ejercicio teórico-práctico tipo test de 62 preguntas (50 teóricas + 12 prácticas de supuestos) en 110 minutos, con 4 respuestas alternativas. Cada 4 respuestas erróneas resta 1 correcta; las preguntas en blanco no puntúan.' },
      { pregunta: '¿Cuántos temas tiene el temario?', respuesta: 'El temario oficial (Anexo IV de la convocatoria) consta de 30 temas: organización y empleo público de Extremadura, derecho administrativo, contratación del sector público y hacienda pública autonómica.' },
      { pregunta: '¿Qué titulación se exige?', respuesta: 'Título de Bachiller o Técnico (Formación Profesional de Grado Medio) o equivalente.' },
      { pregunta: '¿Cuándo es el examen?', respuesta: 'Las listas definitivas de admitidos se publicaron en mayo de 2026. La fecha, hora y lugar del ejercicio se determinan por Resolución posterior publicada en el DOE.' },
    ],
  }).eq('id', OPO_ID);
  fail('oposiciones', oe);

  console.log(err === 0 ? '✅ FASE 2-3 OK' : `⚠️ ${err} errores`);
})();
