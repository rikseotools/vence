// Build Administrativo C1 Castilla-La Mancha (Cuerpo Ejecutivo, esp. Administrativa)
// FASE 2-3 del manual crear-nueva-oposicion.md. Clona la fila hermana
// administrativo-castilla-leon y reutiliza scope de aux-admin-clm + leyes comunes.
// Chequea r.error en CADA insert (reference_scaffolding_columnas_oposicion).
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PT = 'administrativo_clm';
const SLUG = 'administrativo-castilla-la-mancha';

// ---- law_ids (resueltos 18/06) ----
const L = {
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40:'95680d57-feb1-41c0-bb27-236024815feb', L9_2017:'4f605392-8137-4962-9e66-ca5f275e93ee',
  L38_2003:'09c18214-a630-4ae8-9f63-a742919f7f4c', L29_1998:'07daa1fe-7e8e-4e2d-9a33-6893229869e0',
  RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0', RDL8:'eabb640e-fa9b-47a8-8d76-2a580115cfb0',
  RDL2:'d0dc66a4-a089-4aa0-9d98-1793734f5a18', LO3_2007:'6e59eacd-9298-4164-9d78-9e9343d9a900',
  LO1_2004:'f5c17b23-2547-43d2-800c-39f5ea925c2f', L19_2013:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b', RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c',
  RD311:'625f2ac3-6f1f-4326-9a53-f758be6e94f8', RD203:'21e40a28-26c7-420d-99b8-39eb3059dd4f',
  CC:'899e61d1-e168-482b-9e86-4e7787eab6fc', TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',
  TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4',
  // CLM-specific
  ESTATUTO:'b374bb42-fdea-4c78-bd11-6c3cc0243b4b', GOBIERNO:'af2a6dca-945c-4ddc-93e1-521f584d7485',
  EMPLEO:'e2765833-c7bc-447f-ba20-825538f50455', HACIENDA:'31fcfc91-1b80-4e6c-955b-5153d423a4f6',
  PRESUP:'0b7d90cd-27cf-4b88-b1e5-d9fe223ab483', TRANSP:'e1899f6d-0f71-413d-8160-3447c433fa8b',
  IGUALDAD:'db6d30c1-1344-4b6f-a41e-5ac1826c6b40', CALIDAD:'e2a92f96-8fa0-42c5-b54b-fc990e97c627',
  PDATOS:'27ccc539-706e-4afd-a7c4-ef542fcc0c65', EELL:'200b62fd-ee8f-4055-b682-7029e06e05ad',
  // ofimatica
  INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2', WIN:'cb536623-fb75-429c-a839-0154b76ee27b',
  EXPL:'9a4d819f-50d6-421b-b3ea-d66d72b8524b', WORD:'9e48c8d9-b270-4a99-aa03-825e308b633c',
  EXCEL:'30dd450e-bb43-4166-8fb6-56f979e4c8b1', OUTLOOK:'2022e7b1-94c4-4faf-9d95-8d865ce59033',
  NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',
};

// ---- helpers de arrays de artículos ----
const R = (a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const CE_FULL = [...R(1,55),'116'];
const CE_FUENTES = ['1','9','53','81','82','83','84','85','86','87','93','94','96','97','128','133','149','150'];
const L39_ACTOS_PROC_REC = R(34,126); // actos+procedimiento+recursos (34-126 cubre todo)
const L39_PROC = R(53,105);
const L39_RECURSOS = R(106,126);
const L39_INTERES = [...R(1,28)];
const L39_ADMINE = ['13','14','15','16','17','18','19','26','27','28'];
const L40_REVRESP = R(32,37);
const L40_ORG = R(5,24);
const L40_PRINC_ORG = [...R(1,31)];
const L40_INTERADMIN = R(140,158);
const L40_CONVENIOS_SPI = [...R(47,53),...R(81,139)];
const L40_FUNCE = R(38,46);
const L40_SANC_RESP = R(25,37);
const CONTRATOS = ['1','2','3','5','11','12','13','14','15','16','17','19','20','21','22','25','26','27','29','36','37','42','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','69','71','73','74','76','77','78','79','80','81','82','85','86','92','95','96','98','99','100','101','102','103','104','105','106','107','108','109','110','111','112','116','117','118','119','120','121','122','124','131','135','136','139','143','145','149','150','152','153','155','156','158','159','160','162','187','188','189','190','191','192','193','194','195','196','197','198','199','204','206','209','211','213','214','215','219','231','232','233','234','235','236','237','238','239','240','241','242','243','244','245','246','247','248','249','251','252','253','255','256','257','258','259','260','262','263','264','267','270','280','284','285','286','287','288','289','290','291','292','293','294','295','296','297','298','299','300','301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','323','324','325','326','328','329','332','333','334','335','337'];
const CONTR_GEN = CONTRATOS.filter(a=>parseInt(a)<=115); // concepto/tipos/elementos/garantías
const CONTR_PROC = CONTRATOS.filter(a=>parseInt(a)>=116); // preparación/adjudicación/efectos
const EBEP_FULL = R(1,100);
const EBEP_SITUAC = [...R(85,98)];
const EBEP_RETRIB = R(22,30);
const LGS = R(1,69);
const LGSS_AFIL = R(1,50);
const LGSS_PRESTAC = R(151,200);
const ET_LABORAL = R(1,56);
const IG_LO3 = R(1,40);
const IG_LO1 = R(1,28);
const RGPD_SUB = ['2','3','4','5','6','7','8','9','10','12','13','14','15','16','17','18','19','20','21','22','24','25','26','27','28','30','32','33','35','36','37','38','39','40'];
const LO3_2018_SUB = R(1,37);
const L19_SUB = R(1,40);

// scope(law, arts|null)
const sc = (law, arts)=>({law, arts: arts||null});

// ---- 36 temas ----
const T = [
 // BLOQUE I — PARTE COMÚN (1-10)
 {n:1,b:1,t:'La Unión Europea: instituciones y libertades básicas',
  e:'La Unión Europea: instituciones comunitarias y libertades básicas. Las fuentes del derecho comunitario europeo, especial consideración a las Directivas.',
  s:[sc(L.TUE),sc(L.TFUE)]},
 {n:2,b:1,t:'La Constitución Española de 1978',
  e:'La Constitución Española de 1978: estructura y contenido. Los principios constitucionales y los valores superiores. Derechos y deberes fundamentales: su garantía y suspensión.',
  s:[sc(L.CE,CE_FULL)]},
 {n:3,b:1,t:'El Estatuto de Autonomía de CLM. El Gobierno y la Administración Regional',
  e:'El Estatuto de Autonomía de Castilla-La Mancha. El Gobierno y la Administración Regional: estructura, organización y régimen jurídico.',
  s:[sc(L.ESTATUTO),sc(L.GOBIERNO)]},
 {n:4,b:1,t:'Los actos administrativos. Los recursos. El procedimiento común',
  e:'Los actos administrativos: requisitos y eficacia. Nulidad y anulabilidad. Los recursos administrativos. El procedimiento administrativo común y sus fases.',
  s:[sc(L.L39,L39_ACTOS_PROC_REC),sc(L.L40,L40_REVRESP)]},
 {n:5,b:1,t:'Los contratos del Sector Público',
  e:'Los contratos del Sector público: clases y régimen jurídico. Sus elementos. Preparación, adjudicación, efectos, cumplimiento y extinción.',
  s:[sc(L.L9_2017,CONTRATOS)]},
 {n:6,b:1,t:'El personal al servicio de la JCCM: clases y régimen jurídico',
  e:'El personal al servicio de la Administración de la Junta de Comunidades de Castilla-La Mancha: clases y régimen jurídico.',
  s:[sc(L.RDL5,EBEP_FULL),sc(L.EMPLEO)]},
 {n:7,b:1,t:'El presupuesto de la JCCM. El control de la actividad financiera',
  e:'El presupuesto de la Junta de Comunidades de Castilla-La Mancha: elaboración, aprobación y ejecución. El control de la actividad financiera en la Administración Regional.',
  s:[sc(L.HACIENDA),sc(L.PRESUP)]},
 {n:8,b:1,t:'La igualdad efectiva de mujeres y hombres. Políticas públicas de igualdad',
  e:'La igualdad efectiva de mujeres y hombres. Políticas públicas de igualdad.',
  s:[sc(L.LO3_2007,IG_LO3),sc(L.LO1_2004,IG_LO1),sc(L.IGUALDAD)]},
 {n:9,b:1,t:'La transparencia en la Administración de la JCCM',
  e:'La transparencia en la Administración de la Junta de Comunidades de Castilla-La Mancha: publicidad activa y derecho de acceso a la información pública.',
  s:[sc(L.L19_2013,L19_SUB),sc(L.TRANSP)]},
 {n:10,b:1,t:'Seguridad de la Información. La protección de datos',
  e:'Conceptos básicos de Seguridad de la Información. La protección de datos: principios y derechos de los ciudadanos.',
  s:[sc(L.RD311),sc(L.LO3_2018,LO3_2018_SUB),sc(L.PDATOS),sc(L.RGPD,RGPD_SUB)]},
 // BLOQUE II — PARTE ESPECÍFICA (11-36)
 {n:11,b:2,t:'La administración pública: principios y organización. Relaciones interadministrativas',
  e:'La administración pública: principios de actuación y organización; relaciones interadministrativas.',
  s:[sc(L.L40,[...L40_PRINC_ORG,...L40_INTERADMIN])]},
 {n:12,b:2,t:'Relaciones AP-ciudadanos. Administración electrónica. Información y atención en CLM',
  e:'Relaciones entre la administración pública y los ciudadanos: administración electrónica. Funcionamiento electrónico del Sector Público. Información y atención al ciudadano en Castilla-La Mancha.',
  s:[sc(L.L39,L39_ADMINE),sc(L.L40,L40_FUNCE),sc(L.RD203),sc(L.CALIDAD)]},
 {n:13,b:2,t:'La relación orgánica: los órganos administrativos. La competencia. Órganos colegiados',
  e:'La relación orgánica: los órganos administrativos. La competencia y su ejercicio. Órganos colegiados.',
  s:[sc(L.L40,L40_ORG)]},
 {n:14,b:2,t:'Los Convenios. El Sector Público Institucional',
  e:'Los Convenios. El Sector Público Institucional.',
  s:[sc(L.L40,L40_CONVENIOS_SPI)]},
 {n:15,b:2,t:'El derecho Administrativo y sus fuentes. El procedimiento administrativo común',
  e:'El derecho Administrativo y sus fuentes. El procedimiento administrativo común.',
  s:[sc(L.CE,CE_FUENTES),sc(L.CC,R(1,7)),sc(L.L39,[...L39_INTERES,...R(128,133)]),sc(L.L40,R(1,4))]},
 {n:16,b:2,t:'Medios de impugnación. Revisión de oficio. Recursos. Jurisdicción contencioso-administrativa',
  e:'Medios de impugnación de la actuación administrativa. La revisión de oficio. Los recursos administrativos: concepto y clases. La jurisdicción contencioso-administrativa.',
  s:[sc(L.L39,L39_RECURSOS),sc(L.L29_1998)]},
 {n:17,b:2,t:'El procedimiento sancionador y el de responsabilidad patrimonial',
  e:'El procedimiento sancionador y el de responsabilidad patrimonial. Principios de la potestad sancionadora. La responsabilidad patrimonial de la Administración.',
  s:[sc(L.L40,L40_SANC_RESP)]},
 {n:18,b:2,t:'El servicio público. Los contratos: concepto, tipos, elementos y garantías',
  e:'El servicio público: formas de gestión. Los contratos del sector público: concepto y tipos. Elementos estructurales: objeto, presupuesto base de licitación, valor estimado y precio. Garantías exigibles.',
  s:[sc(L.L9_2017,CONTR_GEN)]},
 {n:19,b:2,t:'Preparación, adjudicación, efectos, cumplimiento y extinción de los contratos',
  e:'Preparación y adjudicación de los contratos de las Administraciones Públicas. Efectos, cumplimiento y extinción de los contratos administrativos. Prerrogativas de la Administración. Revisión de precios y otras alteraciones contractuales.',
  s:[sc(L.L9_2017,CONTR_PROC)]},
 {n:20,b:2,t:'La organización del personal de la JCCM. EBEP. Ley de Empleo Público de CLM',
  e:'La organización del personal de la JCCM. El Texto Refundido de la Ley del EBEP. La Ley de Empleo Público de Castilla-La Mancha. Derechos y deberes.',
  s:[sc(L.RDL5,EBEP_FULL),sc(L.EMPLEO)]},
 {n:21,b:2,t:'Situaciones administrativas. Régimen disciplinario',
  e:'Las situaciones administrativas del personal funcionario. Supuestos y efectos. Régimen disciplinario de los funcionarios: faltas, sanciones y procedimiento.',
  s:[sc(L.RDL5,EBEP_SITUAC),sc(L.EMPLEO)]},
 {n:22,b:2,t:'Las retribuciones del personal funcionario y laboral de CLM',
  e:'Las retribuciones del personal funcionario y laboral al servicio de Castilla-La Mancha. Básicas y complementarias. Otras retribuciones. Devengo y liquidación de derechos económicos. Pago de retribuciones al personal en activo.',
  s:[sc(L.RDL5,EBEP_RETRIB),sc(L.EMPLEO)]},
 {n:23,b:2,t:'El contrato laboral. El Convenio Colectivo de la JCCM',
  e:'El contrato laboral de trabajo: concepto, naturaleza y clases. El Convenio Colectivo del personal al servicio de la Administración de la JCCM.',
  s:[sc(L.RDL2,ET_LABORAL)]},
 {n:24,b:2,t:'El sistema español de la Seguridad Social. El Régimen General',
  e:'El sistema español de la Seguridad Social. El Régimen General: campo de aplicación, afiliación, cotización y recaudación. Los regímenes especiales. El régimen de MUFACE y clases pasivas.',
  s:[sc(L.RDL8,LGSS_AFIL)]},
 {n:25,b:2,t:'La acción protectora del Régimen General de la Seguridad Social',
  e:'La acción protectora del Régimen General de la Seguridad Social: régimen jurídico de las prestaciones.',
  s:[sc(L.RDL8,LGSS_PRESTAC)]},
 {n:26,b:2,t:'El presupuesto: concepto y principios. El presupuesto de la JCCM',
  e:'El presupuesto: concepto y principios presupuestarios. El presupuesto de la JCCM: características y estructura. Ejecución. Gastos plurianuales. Incorporaciones de créditos. Créditos extraordinarios y suplementos. Anticipos de tesorería. Créditos ampliables. Transferencias de crédito.',
  s:[sc(L.HACIENDA),sc(L.PRESUP)]},
 {n:27,b:2,t:'El procedimiento de ejecución del presupuesto de gastos',
  e:'El procedimiento de ejecución del presupuesto de gastos. Ordenación del gasto y del pago. Órganos competentes. Fases del procedimiento y documentos contables.',
  s:[sc(L.HACIENDA)]},
 {n:28,b:2,t:'Régimen jurídico y presupuestario de las subvenciones públicas en CLM',
  e:'Régimen jurídico y presupuestario de las subvenciones públicas en la Administración de la JCCM.',
  s:[sc(L.L38_2003,LGS),sc(L.HACIENDA)]},
 {n:29,b:2,t:'El Estatuto de Autonomía de CLM: competencias. La Administración Local en CLM',
  e:'El Estatuto de Autonomía de Castilla-La Mancha: las competencias de la Junta. La organización territorial de Castilla-La Mancha. La Administración Local en Castilla-La Mancha.',
  s:[sc(L.ESTATUTO),sc(L.EELL)]},
 {n:30,b:2,t:'Informática básica',
  e:'Informática básica: hardware y software. Sistemas de almacenamiento de datos. Sistemas operativos. Nociones básicas de seguridad informática.',
  s:[sc(L.INFO)]},
 {n:31,b:2,t:'El sistema operativo Windows',
  e:'El sistema operativo Windows: fundamentos; entorno gráfico; escritorio; menú Inicio; configuración.',
  s:[sc(L.WIN)]},
 {n:32,b:2,t:'El explorador de Windows',
  e:'El explorador de Windows. Gestión de carpetas y archivos. Búsqueda. Equipo. Gestión de impresoras. Accesorios. Herramientas del sistema.',
  s:[sc(L.EXPL)]},
 {n:33,b:2,t:'Procesadores de textos: Word',
  e:'Procesadores de textos. Microsoft Word.',
  s:[sc(L.WORD)]},
 {n:34,b:2,t:'Hojas de cálculo: Excel',
  e:'Hojas de cálculo. Microsoft Excel.',
  s:[sc(L.EXCEL)]},
 {n:35,b:2,t:'Internet: protocolos y servicios',
  e:'Internet: protocolos y servicios. Navegadores.',
  s:[sc(L.NET)]},
 {n:36,b:2,t:'Correo electrónico: Outlook',
  e:'Correo electrónico. Microsoft Outlook.',
  s:[sc(L.OUTLOOK)]},
];

async function chk(label, p){ const r = await p; if(r.error){ console.log('❌ '+label+':', r.error.message); throw new Error(label); } return r; }

(async () => {
  // 1) clonar fila hermana administrativo-castilla-leon
  const { data: sis, error: e0 } = await s.from('oposiciones').select('*').eq('slug','administrativo-castilla-leon').single();
  if(e0){ console.log('❌ leer hermana:', e0.message); return; }

  const row = { ...sis };
  delete row.id; delete row.created_at;
  Object.assign(row, {
    nombre: 'Administrativo de Castilla-La Mancha (Cuerpo Ejecutivo, especialidad Administrativa)',
    short_name: 'Administrativo CLM',
    slug: SLUG,
    categoria: 'C1', grupo: 'C', subgrupo: 'C1',
    administracion: 'autonomica', tipo_acceso: 'libre',
    is_active: false, is_convocatoria_activa: false,
    temas_count: 36, bloques_count: 2,
    titulo_requerido: 'Bachiller, Técnico o equivalente',
    diario_oficial: 'DOCM', diario_referencia: 'DOCM nº 240, de 12/12/2025 (disp. 2025/9540)',
    programa_url: 'https://empleopublico.castillalamancha.es/system/files/ficheros/temario_c1_cuerpo_ejecutivo_espec._administrativa_libre_y_dis_0.pdf',
    seguimiento_url: 'https://empleopublico.castillalamancha.es/administracion-general',
    estado_proceso: 'oep_aprobada',
    oep_decreto: 'Acuerdo del Consejo de Gobierno de 09/12/2025 (OEP 2025)',
    oep_fecha: '2025-12-12',
    convocatoria_numero: null, convocatoria_fecha: null, convocatoria_dogv: null,
    plazas_libres: 23, plazas_promocion_interna: 1, plazas_discapacidad: 0,
    exam_date: null, inscription_start: null, inscription_deadline: null,
    boe_publication_date: '2025-12-12',
    boe_reference: 'DOCM nº 240, de 12/12/2025 (OEP 2025, disp. 2025/9540)',
    color_primario: 'red',
    seo_title: 'Administrativo Castilla-La Mancha (JCCM) 2026 | Tests OEP 23 plazas | Vence',
    seo_description: 'Prepara el Cuerpo Ejecutivo (Administrativo C1) de Castilla-La Mancha: OEP 2025 con 23 plazas turno libre pendiente de convocatoria. 36 temas oficiales, tests por tema con legislación literal del DOCM.',
    landing_description: 'Cuerpo Ejecutivo, especialidad Administrativa (subgrupo C1) de la Junta de Comunidades de Castilla-La Mancha. OEP 2025: 23 plazas turno libre pendientes de convocatoria.',
    landing_estadisticas: [
      { numero:'23', texto:'Plazas OEP 2025', color:'text-green-600' },
      { numero:'{temasCount}', texto:'Temas oficiales', color:'text-blue-600' },
      { numero:'2', texto:'Bloques (común + específico)', color:'text-purple-600' },
      { numero:'Bachiller', texto:'Título requerido', color:'text-orange-600' },
    ],
    landing_faqs: [
      { pregunta:'¿Cuántas plazas hay?', respuesta:'La OEP 2025 (Acuerdo de 09/12/2025, DOCM nº 240) reserva 23 plazas de turno libre para el Cuerpo Ejecutivo, especialidad Administrativa (C1), pendientes de convocatoria.' },
      { pregunta:'¿Cuándo es el examen?', respuesta:'Aún no hay convocatoria publicada ni fecha de examen. La JCCM debe convocar antes del 31/03/2027. Puedes ir preparándote con el temario vigente.' },
      { pregunta:'¿Qué temario entra?', respuesta:'36 temas en dos partes: Parte Común (10 temas) y Parte Específica (26 temas), según el programa oficial de la JCCM.' },
      { pregunta:'¿Qué titulación necesito?', respuesta:'Título de Bachiller, Técnico (FP de grado medio o superior) o equivalente.' },
      { pregunta:'¿Hay requisito de idioma?', respuesta:'No. Castilla-La Mancha no tiene lengua cooficial, por lo que no se exige prueba de idioma autonómico.' },
    ],
    examen_config: {
      tipo:'test', penalizacion:'1/4 del valor del acierto (regla estándar JCCM; confirmar en la convocatoria)',
      total_preguntas:100, duracion_total_minutos:120,
      notas:'Estimación basada en convocatorias previas del cuerpo y la regla general de la JCCM. Se actualizará cuando se publique la convocatoria de la OEP 2025.',
    },
  });

  const ins = await chk('insert oposiciones', s.from('oposiciones').insert(row).select('id').single());
  const oposicionId = ins.data.id;
  console.log('✅ oposiciones id=', oposicionId);

  // 2) bloques
  await chk('bloques', s.from('oposicion_bloques').insert([
    { position_type:PT, bloque_number:1, titulo:'Parte Común', icon:'⚖️', sort_order:1 },
    { position_type:PT, bloque_number:2, titulo:'Parte Específica', icon:'🏛️', sort_order:2 },
  ]));
  console.log('✅ 2 bloques');

  // 3) topics
  const topicsRows = T.map(t=>({
    position_type:PT, topic_number:t.n, title:t.t, description:t.e, epigrafe:t.e,
    bloque_number:t.b, descripcion_corta:t.t, disponible:true,
    difficulty:'medium', estimated_hours:10, is_active:true,
  }));
  const tIns = await chk('topics', s.from('topics').insert(topicsRows).select('id,topic_number'));
  const idByNum = {}; tIns.data.forEach(r=>idByNum[r.topic_number]=r.id);
  console.log('✅ topics:', tIns.data.length);

  // 4) topic_scope
  const scopeRows = [];
  for(const t of T){ for(const sp of t.s){ scopeRows.push({ topic_id:idByNum[t.n], law_id:sp.law, article_numbers:sp.arts }); } }
  await chk('topic_scope', s.from('topic_scope').insert(scopeRows));
  console.log('✅ topic_scope rows:', scopeRows.length);

  // 5) convocatoria (§2c) — clonar columnas de la hermana
  const { data: sisConv } = await s.from('convocatorias').select('*').eq('oposicion_id', sis.id).limit(1).maybeSingle();
  const convRow = {
    oposicion_id: oposicionId, 'año':2025, is_current:true, estado_proceso:'oep_aprobada',
    oep_decreto:'Acuerdo del Consejo de Gobierno de 09/12/2025 (OEP 2025)', oep_fecha:'2025-12-12',
    plazas_libres:23, plazas_discapacidad:0,
    boe_publication_date:'2025-12-12', boe_reference:'DOCM nº 240, de 12/12/2025 (disp. 2025/9540)',
    programa_url: row.programa_url,
  };
  await chk('convocatorias', s.from('convocatorias').insert(convRow));
  console.log('✅ convocatoria');

  // 6) hitos (forward-looking)
  await chk('hitos', s.from('convocatoria_hitos').insert([
    { oposicion_id:oposicionId, fecha:'2025-12-12', titulo:'OEP 2025 aprobada', descripcion:'Acuerdo del Consejo de Gobierno de 09/12/2025 (DOCM nº 240): 23 plazas turno libre del Cuerpo Ejecutivo, especialidad Administrativa (C1).', url:'https://docm.jccm.es/docm/descargarArchivo.do?ruta=2025/12/12/pdf/2025_9540.pdf&tipo=rutaDocm', status:'completed', order_index:1 },
    { oposicion_id:oposicionId, fecha:'2027-03-31', titulo:'Convocatoria (pendiente)', descripcion:'Plazo legal para publicar la convocatoria de la OEP 2025: antes del 31/03/2027. Sin fecha de examen confirmada.', url:null, status:'upcoming', order_index:2 },
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 CLM C1 completada. oposicion_id=', oposicionId);
})().catch(e=>{ console.log('ABORT:', e.message); process.exit(1); });
