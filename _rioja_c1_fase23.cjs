// Build Administrativo C1 La Rioja (Cuerpo Administrativo de Administración General)
// FASE 2-3. Clona hermana administrativo-castilla-leon. 42 temas / 6 bloques.
// Temas autonómicos -> leyes Rioja importadas (BOE sync). Comunes -> banco existente.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT = 'administrativo_la_rioja';
const SLUG = 'administrativo-la-rioja';

const L = {
  // Rioja imported
  EST:'009bd817-80aa-4fba-9b8a-6be04f3f849b', L4_2005:'bf8a7564-f6b8-4bf0-b01c-c58b06124895',
  L3_2003:'f7b273ed-a16c-4366-86b9-e713fdd6c89b', FP:'0e7507c9-8890-464f-bf13-596d06f8ce6b',
  HAC:'e8e72389-c12c-4936-821a-fc05d2aa8020', LEF:'5cea3473-4755-430b-9775-f521ac9ba3f4',
  // common
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40:'95680d57-feb1-41c0-bb27-236024815feb', L9_2017:'4f605392-8137-4962-9e66-ca5f275e93ee',
  L38:'09c18214-a630-4ae8-9f63-a742919f7f4c', L29:'07daa1fe-7e8e-4e2d-9a33-6893229869e0',
  RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0', RDL8:'eabb640e-fa9b-47a8-8d76-2a580115cfb0',
  RDL2:'d0dc66a4-a089-4aa0-9d98-1793734f5a18', LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b',
  RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c', TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',
  TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4', CC:'899e61d1-e168-482b-9e86-4e7787eab6fc',
  L7_1985:'06784434-f549-4ea2-894f-e2e400881545', L50_1997:'1ed89e01-ace0-4894-8bd4-fa00db74d34a',
  L30_1984:'9f60b1b4-0aa1-49bf-8757-b71ab261108a', WORD:'4197a28f-4ad0-490d-b43f-9b21dbb82758',
  EXCEL:'b49380e5-754c-40f1-8c64-0cfadd5d1a56', ACCESS:'b403019a-bdf7-4795-886e-1d26f139602d',
  INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
const CONTR=['1','2','3','5','11','12','13','14','15','16','17','19','20','21','22','25','26','27','29','36','37','42','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','69','71','73','74','76','77','78','79','80','81','82','85','86','92','95','96','98','99','100','101','102','103','104','105','106','107','108','109','110','111','112','116','117','118','119','120','121','122','124','131','135','136','139','143','145','149','150','152','153','155','156','158','159','160','162','187','188','189','190','191','192','193','194','195','196','197','198','199','204','206','209','211','213','214','215','219','231','232','233','234','235','236','237','238','239','240','241','242','243','244','245','246','247','248','249','251','252','253','255','256','257','258','259','260','262','263','264','267','270','280','284','285','286','287','288','289','290','291','292','293','294','295','296','297','298','299','300','301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','323','324','325','326','328','329','332','333','334','335','337'];

// 42 temas: n, bloque, title, epigrafe(literal), scope
const T=[
 // BLOQUE 1 — Parte General I: Organización del Estado (1-10)
 {n:1,b:1,t:'La Constitución Española de 1978. Estructura y derechos fundamentales',e:'La Constitución Española de 1978. Estructura y contenido. Derechos y deberes fundamentales. Su garantía y suspensión.',s:[sc(L.CE,[...R(1,55),'116'])]},
 {n:2,b:1,t:'El Tribunal Constitucional y el Defensor del Pueblo. Reforma de la Constitución',e:'El Tribunal Constitucional y el Defensor del Pueblo. Reforma de la Constitución.',s:[sc(L.CE,['54',...R(159,165),...R(166,169)])]},
 {n:3,b:1,t:'La Jefatura del Estado. La Corona',e:'La Jefatura del Estado. La Corona. Funciones constitucionales del Rey. Sucesión y Regencia.',s:[sc(L.CE,R(56,65))]},
 {n:4,b:1,t:'Las Cortes Generales. La elaboración de las leyes. Los Tratados Internacionales',e:'Las Cortes Generales. Composición, atribuciones y funcionamiento del Congreso y del Senado. La elaboración de las leyes. Los Tratados Internacionales.',s:[sc(L.CE,R(66,96))]},
 {n:5,b:1,t:'El Poder Judicial. El CGPJ. El Tribunal Supremo',e:'El Poder Judicial. El Consejo General del Poder Judicial. El Tribunal Supremo. La organización judicial española.',s:[sc(L.CE,R(117,127))]},
 {n:6,b:1,t:'El Gobierno y la Administración. El Consejo de Ministros. El Presidente',e:'El Gobierno y la Administración. Relaciones entre el Gobierno y las Cortes Generales. Designación, duración y responsabilidad del Gobierno. El Consejo de Ministros. El Presidente del Gobierno. Los Ministros, Secretarios de Estado, Subsecretarios y demás órganos administrativos.',s:[sc(L.CE,R(97,107)),sc(L.L50_1997,R(1,26))]},
 {n:7,b:1,t:'La Administración periférica del Estado. Delegados y Subdelegados del Gobierno',e:'La Administración periférica del Estado. Los Delegados y Subdelegados del Gobierno. Otros órganos periféricos.',s:[sc(L.L40,R(69,80))]},
 {n:8,b:1,t:'La organización territorial del Estado. La Administración Local. Las CCAA',e:'La organización territorial del Estado en la Constitución. La Administración Local: la Provincia y el Municipio. Las Comunidades Autónomas: su contenido y competencias. Los Estatutos de Autonomía.',s:[sc(L.CE,R(137,158)),sc(L.L7_1985,R(1,13))]},
 {n:9,b:1,t:'La Ley de Régimen Jurídico del Sector Público: los órganos administrativos',e:'La Ley de Régimen Jurídico del Sector Público: De los órganos de las Administraciones Públicas.',s:[sc(L.L40,R(5,24))]},
 {n:10,b:1,t:'El sistema institucional de la Unión Europea',e:'El sistema institucional de la Unión Europea: el Parlamento Europeo, el Consejo Europeo, el Consejo, la Comisión Europea, el Tribunal de Justicia de la Unión Europea, el Banco Central Europeo y el Tribunal de Cuentas. Efectos de la integración europea sobre la organización del Estado español.',s:[sc(L.TUE),sc(L.TFUE)]},
 // BLOQUE 2 — Parte General II: Org. y Admón CAR (11-16) AUTONÓMICAS
 {n:11,b:2,t:'El Estatuto de Autonomía de La Rioja (I): estructura, competencias y reforma',e:'El Estatuto de Autonomía de La Rioja (I): Estructura. Competencias de la Comunidad Autónoma. Reforma del Estatuto.',s:[sc(L.EST)]},
 {n:12,b:2,t:'El Estatuto de Autonomía de La Rioja (II): organización institucional',e:'El Estatuto de Autonomía de La Rioja (II): Organización institucional. El Parlamento. El Presidente de la Comunidad Autónoma de La Rioja. El Gobierno.',s:[sc(L.EST)]},
 {n:13,b:2,t:'El Estatuto de Autonomía de La Rioja (III): administración y financiación',e:'El Estatuto de Autonomía de La Rioja (III): Administración y régimen jurídico. Financiación de la Comunidad.',s:[sc(L.EST)]},
 {n:14,b:2,t:'La Ley de Funcionamiento y Régimen Jurídico de la Administración CAR (I)',e:'La Ley de Funcionamiento y Régimen Jurídico de la Administración de la Comunidad Autónoma de La Rioja (I): Del funcionamiento de la Administración de la Comunidad Autónoma de La Rioja (Título I).',s:[sc(L.L4_2005)]},
 {n:15,b:2,t:'La Ley de Funcionamiento y Régimen Jurídico de la Administración CAR (II)',e:'La Ley de Funcionamiento y Régimen Jurídico de la Administración de la Comunidad Autónoma de La Rioja (II): Del régimen jurídico de la actuación de la Administración: De la potestad sancionadora. De la responsabilidad patrimonial de la Administración de la CAR.',s:[sc(L.L4_2005)]},
 {n:16,b:2,t:'La Ley de organización del sector público de la Administración General CAR',e:'La Ley de organización del sector público de la Administración General de la Comunidad Autónoma de La Rioja: La Administración General de la Comunidad Autónoma de La Rioja.',s:[sc(L.L3_2003)]},
 // BLOQUE 3 — Parte Específica I: Derecho Administrativo General (17-26)
 {n:17,b:3,t:'Las fuentes del Derecho Administrativo. La Ley. El Reglamento',e:'Las Fuentes del Derecho Administrativo. La jerarquía de las fuentes. La Constitución. La Ley. Disposiciones normativas con fuerza de Ley. El Reglamento.',s:[sc(L.CE,['1','9','53','81','82','83','84','85','86','87','93','94','96','97']),sc(L.CC,R(1,7)),sc(L.L39,R(128,133))]},
 {n:18,b:3,t:'El acto administrativo: concepto, clases y elementos. Eficacia y validez',e:'El acto administrativo: concepto, clases y elementos. Eficacia y validez de los actos administrativos. Su motivación y notificación: revisión, anulación y revocación. El principio de legalidad en la actuación administrativa.',s:[sc(L.L39,[...R(34,52),...R(106,126)])]},
 {n:19,b:3,t:'El Procedimiento Administrativo. Garantías y fases',e:'El Procedimiento Administrativo. Garantías del procedimiento. La iniciación, ordenación, instrucción y terminación del procedimiento administrativo. Tramitación simplificada. Los derechos de las personas en sus relaciones con las Administraciones Públicas. Derecho y obligación de relacionarse electrónicamente.',s:[sc(L.L39,[...R(13,28),...R(53,105)])]},
 {n:20,b:3,t:'Los recursos administrativos: alzada, reposición y revisión',e:'Los recursos administrativos: objeto y clases. Recurso de alzada, recurso potestativo de reposición y recurso extraordinario de revisión.',s:[sc(L.L39,R(106,126))]},
 {n:21,b:3,t:'La Jurisdicción Contencioso-Administrativa',e:'La Jurisdicción Contencioso-Administrativa: ámbito, las partes en el proceso y objeto del recurso contencioso-administrativo.',s:[sc(L.L29)]},
 {n:22,b:3,t:'Los contratos del Sector Público: concepto, tipos y elementos',e:'Los Contratos del Sector Público: concepto y elementos estructurales. Negocios y contratos excluidos. Cumplimiento y extinción. Tipos de contratos administrativos.',s:[sc(L.L9_2017,CONTR)]},
 {n:23,b:3,t:'Formas de la actividad administrativa: limitación, servicio público y fomento',e:'Formas de la actividad administrativa: la actividad de limitación, de servicio público y de fomento. Especial examen de las formas de gestión de los servicios públicos.',s:[sc(L.L40,['4','86']),sc(L.L7_1985,R(85,86))]},
 {n:24,b:3,t:'Responsabilidad patrimonial de las AAPP. La potestad sancionadora',e:'Responsabilidad patrimonial de las Administraciones Públicas. Concepto y clases. Requisitos. Procedimientos y efectos. Responsabilidad de las autoridades y personal. La potestad sancionadora.',s:[sc(L.L40,R(25,37))]},
 {n:25,b:3,t:'La expropiación forzosa',e:'La expropiación forzosa. Actos administrativos previos a la expropiación. Justiprecio. Jurado provincial de expropiación. Pago y ocupación de bienes. Inscripción registral.',s:[sc(L.LEF)]},
 {n:26,b:3,t:'Ley de Protección de Datos Personales y Garantía de los Derechos Digitales',e:'Ley de Protección de Datos Personales y Garantía de los Derechos Digitales: Disposiciones generales. Principios de Protección de Datos. Derechos de las Personas. Autoridades de protección de datos.',s:[sc(L.LO3_2018,R(1,37)),sc(L.RGPD)]},
 // BLOQUE 4 — Parte Específica II: Gestión de personal (27-31)
 {n:27,b:4,t:'La Función Pública en La Rioja. Clases de personal. OEP. Derechos y deberes',e:'La regulación de la Función Pública en la Comunidad Autónoma de La Rioja. Clases de personal al servicio de la Administración General de la CAR. Oferta de Empleo Público. Derechos y deberes de los empleados públicos.',s:[sc(L.FP),sc(L.RDL5,R(8,54))]},
 {n:28,b:4,t:'Personal funcionario de la CAR: selección, promoción, RPT y provisión',e:'Personal funcionario al servicio de la Administración General de la CAR: cuerpos de funcionarios. Registro de personal. Selección y Promoción. Relaciones de puestos de trabajo y provisión de los mismos.',s:[sc(L.FP),sc(L.RDL5,[...R(55,68),...R(78,84)])]},
 {n:29,b:4,t:'El personal laboral de la CAR. El contrato laboral. Convenios colectivos',e:'El personal laboral al servicio de la Administración General de la CAR. Selección. El contrato laboral: contenido, duración y suspensión. Negociación laboral, conflictos y convenios colectivos.',s:[sc(L.FP),sc(L.RDL2,R(1,56))]},
 {n:30,b:4,t:'El régimen de Seguridad Social. Afiliación. Cotización. Acción protectora',e:'El régimen de Seguridad Social. Afiliación. Cotización. Acción protectora, concepto y clases de prestaciones.',s:[sc(L.RDL8,R(1,50))]},
 {n:31,b:4,t:'Prestaciones del Régimen General de la Seguridad Social',e:'Prestaciones del Régimen General de la Seguridad Social. Asistencia sanitaria. Incapacidad temporal. Nacimiento y cuidado de menor. Invalidez. Jubilación. Muerte y supervivencia.',s:[sc(L.RDL8,R(151,200))]},
 // BLOQUE 5 — Parte Específica III: Gestión Financiera (32-39)
 {n:32,b:5,t:'El presupuesto: concepto y principios. El presupuesto por programas',e:'El presupuesto: concepto y principios presupuestarios. Ciclo presupuestario. Presupuesto por programas: Concepto y objetivos. Programación. Presupuestación y control. El presupuesto en base cero.',s:[sc(L.HAC)]},
 {n:33,b:5,t:'El presupuesto de la CAR: estructura, créditos y modificaciones',e:'El presupuesto de la Comunidad Autónoma de La Rioja: Concepto y estructura. Los créditos presupuestarios: características. Las modificaciones presupuestarias: transferencias, generaciones, créditos ampliables, habilitaciones, créditos extraordinarios, suplementos de crédito e incorporaciones.',s:[sc(L.HAC)]},
 {n:34,b:5,t:'La ejecución del presupuesto de gasto. La ordenación del pago',e:'El procedimiento administrativo de ejecución del presupuesto de gasto. Órganos competentes. Fases de procedimiento y sus documentos contables. Compromisos de gasto para ejercicios posteriores. La ordenación del pago: Concepto y competencias. Realización del pago: modo y perceptores.',s:[sc(L.HAC)]},
 {n:35,b:5,t:'Las retribuciones de los empleados públicos de la CAR. Nóminas',e:'Las retribuciones de los funcionarios públicos y del personal laboral al servicio de la Administración General de la CAR. Nóminas: estructura y normas de confección. Altas y bajas. Retribuciones básicas y complementarias. Devengo y liquidación. El pago de las retribuciones del personal en activo.',s:[sc(L.FP),sc(L.RDL5,R(22,30)),sc(L.HAC)]},
 {n:36,b:5,t:'La ejecución presupuestaria y los contratos administrativos',e:'La ejecución presupuestaria y los contratos administrativos: los contratos de obras, concesión de obras, concesión de servicios, de suministro y de servicios.',s:[sc(L.L9_2017,CONTR),sc(L.HAC)]},
 {n:37,b:5,t:'El procedimiento para la concesión de las subvenciones',e:'El procedimiento para la concesión de las subvenciones. Formas de adjudicación. La justificación de las subvenciones.',s:[sc(L.L38,R(1,69))]},
 {n:38,b:5,t:'Anticipos de caja fija y pagos a justificar',e:'El procedimiento de ejecución de los gastos periódicos y repetitivos: el sistema de anticipos de caja fija. Los pagos a justificar. La justificación de los libramientos.',s:[sc(L.HAC)]},
 {n:39,b:5,t:'El control del gasto público. El Tribunal de Cuentas',e:'El control del gasto público. Clases. El control parlamentario. El control externo: el Tribunal de Cuentas. El control interno: tipos. Especial referencia al control de legalidad.',s:[sc(L.HAC)]},
 // BLOQUE 6 — Informática (40-42)
 {n:40,b:6,t:'Bases de datos: Microsoft Access 2016',e:'Bases de datos: Microsoft Access 2016: principales funciones y utilidades. Tablas. Consultas. Formularios. Informes. Relaciones. Importación, vinculación y exportación de datos.',s:[sc(L.ACCESS)]},
 {n:41,b:6,t:'Hojas de cálculo: Microsoft Excel 2016',e:'Hojas de cálculo: Microsoft Excel 2016: el entorno de trabajo. Libros, hojas y celdas. Introducción y edición de datos. Formatos. Configuración e impresión. Fórmulas y Funciones. Vínculos. Gráficos. Gestión y análisis de datos.',s:[sc(L.EXCEL)]},
 {n:42,b:6,t:'Procesadores de textos: Microsoft Word 2016',e:'Procesadores de textos: Microsoft Word 2016: descripción de las principales pestañas en la cinta de opciones. Configuración de opciones y seguridad. Marcadores y referencias cruzadas. Formularios. Marcas de agua, letra capital e hipervínculo. Revisión ortográfica. Gráficos. Listas y columnas.',s:[sc(L.WORD)]},
];

const BLOQUES=[
 {n:1,t:'Organización del Estado y de la Administración Pública',i:'🏛️'},
 {n:2,t:'Organización y Administración de La Rioja',i:'🍇'},
 {n:3,t:'Derecho Administrativo General',i:'⚖️'},
 {n:4,t:'Gestión de Personal',i:'👥'},
 {n:5,t:'Gestión Financiera',i:'💶'},
 {n:6,t:'Informática',i:'💻'},
];

async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}

(async () => {
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','administrativo-castilla-leon').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Administrativo de La Rioja (Cuerpo Administrativo de Administración General)',
    short_name:'Administrativo La Rioja', slug:SLUG,
    categoria:'C1', grupo:'C', subgrupo:'C1', administracion:'autonomica', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:true,
    temas_count:42, bloques_count:6,
    titulo_requerido:'Bachiller, Técnico o equivalente',
    diario_oficial:'BOR', diario_referencia:'BOR nº 108, de 10/06/2026',
    programa_url:'https://ias1.larioja.org/boletin/Bor_Boletin_visor_Servlet?referencia=40818683-1-PDF-577914',
    seguimiento_url:'https://www.larioja.org/empleo-publico/es/oposiciones/administracion-general',
    estado_proceso:'inscripcion_abierta',
    oep_decreto:'Decreto 12/2026 (OEP 2026) + OEP 2025 + Decreto 23/2024 (acumuladas)',
    oep_fecha:'2026-05-14',
    convocatoria_numero:'FA.13/24-26', convocatoria_fecha:'2026-06-10', convocatoria_dogv:'BOR nº 108, de 10/06/2026',
    plazas_libres:17, plazas_promocion_interna:0, plazas_discapacidad:5,
    exam_date:null, inscription_start:'2026-06-11', inscription_deadline:'2026-07-08',
    boe_publication_date:'2026-06-10', boe_reference:'BOR nº 108, de 10/06/2026 (Resolución 1368/2026, de 5 de junio)',
    color_primario:'green',
    seo_title:'Administrativo La Rioja 2026 (C1) | 22 plazas, inscripción abierta | Vence',
    seo_description:'Prepara el Cuerpo Administrativo de Administración General (C1) del Gobierno de La Rioja: convocatoria 2026 con 22 plazas, inscripción abierta hasta el 8 de julio. 42 temas oficiales, tests por tema con legislación literal.',
    landing_description:'Cuerpo Administrativo de Administración General (subgrupo C1) del Gobierno de La Rioja. Convocatoria 2026 (BOR nº 108): 22 plazas, inscripción abierta hasta el 8 de julio de 2026.',
    landing_estadisticas:[
      {numero:'22',texto:'Plazas convocatoria 2026',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'6',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'Bachiller',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La convocatoria 2026 (Resolución 1368/2026, BOR nº 108) oferta 22 plazas: 17 de acceso libre y 5 reservadas a personas con discapacidad, acumulando las OEP 2024, 2025 y 2026.'},
      {pregunta:'¿Hasta cuándo puedo inscribirme?',respuesta:'El plazo de inscripción está abierto hasta el 8 de julio de 2026.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La fecha del primer ejercicio aún no está fijada; se determinará con la lista definitiva de admitidos (agosto es inhábil), previsiblemente en otoño de 2026.'},
      {pregunta:'¿Qué temario entra?',respuesta:'42 temas: Parte General (Organización del Estado y de La Rioja), Parte Específica (Derecho Administrativo, Gestión de Personal y Gestión Financiera) e Informática (Access, Excel y Word 2016).'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Bachiller, Técnico (FP de grado medio) o equivalente. No se exige idioma autonómico.'},
    ],
    examen_config:{tipo:'test',penalizacion:'Las respuestas erróneas penalizan según las bases',total_preguntas:90,duracion_total_minutos:120,
      partes:[{nombre:'Primer ejercicio (teórico)',preguntas:90},{nombre:'Segundo ejercicio (2 supuestos prácticos)',preguntas:40},{nombre:'Tercer ejercicio (ofimática Access/Excel/Word 2016)',preguntas:20}],
      notas:'Según la convocatoria 2026 (BOR nº 108). El 1er ejercicio: 90 preguntas (50% general / 50% específica).'},
  });
  const ins=await chk('oposiciones',s.from('oposiciones').insert(row).select('id').single());
  const oid=ins.data.id; console.log('✅ oposiciones',oid);

  await chk('bloques',s.from('oposicion_bloques').insert(BLOQUES.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.t,icon:b.i,sort_order:b.n}))));
  console.log('✅ bloques',BLOQUES.length);

  const tRows=T.map(t=>({position_type:PT,topic_number:t.n,title:t.t,description:t.e,epigrafe:t.e,bloque_number:t.b,descripcion_corta:t.t,disponible:true,difficulty:'medium',estimated_hours:10,is_active:true}));
  const tIns=await chk('topics',s.from('topics').insert(tRows).select('id,topic_number'));
  const byNum={}; tIns.data.forEach(r=>byNum[r.topic_number]=r.id);
  console.log('✅ topics',tIns.data.length);

  const scope=[]; for(const t of T){for(const sp of t.s){scope.push({topic_id:byNum[t.n],law_id:sp.law,article_numbers:sp.arts});}}
  await chk('topic_scope',s.from('topic_scope').insert(scope));
  console.log('✅ topic_scope',scope.length);

  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2026,is_current:true,estado_proceso:'inscripcion_abierta',oep_decreto:'Decreto 12/2026 (OEP 2026) + OEP 2025 + Decreto 23/2024',oep_fecha:'2026-05-14',plazas_libres:17,plazas_discapacidad:5,boe_publication_date:'2026-06-10',boe_reference:'BOR nº 108, de 10/06/2026',programa_url:row.programa_url}));
  console.log('✅ convocatoria');

  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2026-06-10',titulo:'Convocatoria publicada (BOR nº 108)',descripcion:'Resolución 1368/2026, de 5 de junio. 22 plazas (17 libre + 5 discapacidad) del Cuerpo Administrativo de Administración General (C1).',url:row.programa_url,status:'completed',order_index:1},
    {oposicion_id:oid,fecha:'2026-06-11',titulo:'Apertura del plazo de inscripción',descripcion:null,url:null,status:'completed',order_index:2},
    {oposicion_id:oid,fecha:'2026-07-08',titulo:'Cierre del plazo de inscripción',descripcion:'Último día para presentar solicitudes.',url:null,status:'current',order_index:3},
    {oposicion_id:oid,fecha:'2026-10-01',titulo:'Examen (previsión)',descripcion:'Fecha sin fijar; se determinará con la lista definitiva (agosto inhábil). Previsión: otoño 2026.',url:null,status:'upcoming',order_index:4},
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 La Rioja C1 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
