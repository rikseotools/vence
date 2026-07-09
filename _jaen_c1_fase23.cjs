// Build Administrativo C1 Diputación de Jaén. FASE 2-3. Clona hermana diputación Córdoba.
// 40 temas / 6 bloques (8 comunes + 32 específicas). Reutiliza banco Andalucía + común + hacienda local.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='administrativo_diputacion_jaen';
const SLUG='administrativo-diputacion-jaen';

const L={
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40:'95680d57-feb1-41c0-bb27-236024815feb', RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  L7_1985:'06784434-f549-4ea2-894f-e2e400881545', L9_2017:'4f605392-8137-4962-9e66-ca5f275e93ee',
  LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b', RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c',
  LO3_2007:'6e59eacd-9298-4164-9d78-9e9343d9a900', LO1_2004:'f5c17b23-2547-43d2-800c-39f5ea925c2f',
  TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7', EST_AND:'5238bdc9-2ee4-44a7-bcb2-413ba78cb230',
  FP_AND:'53df9e3c-dc44-4e0f-98d1-e69785ba8554', IG_AND:'1c53e192-9db1-4e83-a6d7-53ef6b2ebc33',
  VG_AND:'8e7c797c-77b5-4013-8ac9-9aaec19814c8', L19_2013:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  L38_2003:'09c18214-a630-4ae8-9f63-a742919f7f4c', RDL8:'eabb640e-fa9b-47a8-8d76-2a580115cfb0',
  RD1708:'6cea0a54-de66-44ac-8f8e-041a6abce4aa', CC:'899e61d1-e168-482b-9e86-4e7787eab6fc',
  TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da', TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4',
  GOB_AND:'248b0948-dfec-4403-af67-938e7873ae69', ADM_AND:'5643454c-8c6e-4fd0-a238-9ac0d091ea6c',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
const CONTR=['1','2','3','11','12','13','14','15','16','17','25','26','27','28','29','36','37','99','100','101','102','103','111','116','117','122','124','131','145','150','156','190','191','192','193','203','204','205','209','211','213'];

const T=[
 // BLOQUE 1 — MATERIAS COMUNES (1-8)
 {n:1,b:1,t:'La Constitución Española de 1978',e:'La Constitución Española de 1978. Antecedentes. Características y estructura. Principios Generales. Derechos y deberes fundamentales de los españoles.',s:[sc(L.CE,[...R(1,55),'116'])]},
 {n:2,b:1,t:'Los Poderes del Estado. La Corona. El Gobierno. Las Cortes. El Poder Judicial',e:'Los Poderes del Estado: nociones generales. La Corona. El Gobierno: composición y funciones. Las Cortes Generales: composición, atribuciones y funcionamiento. Las relaciones entre el Gobierno y las Cortes Generales. El Poder Judicial: regulación constitucional y órganos de gobierno.',s:[sc(L.CE,R(56,127))]},
 {n:3,b:1,t:'La Administración Pública Española. La AGE. Órganos superiores y periféricos',e:'La Administración Pública Española. La Administración General del Estado. Órganos Superiores y Órganos Periféricos.',s:[sc(L.L40,[...R(54,80),...R(1,4)])]},
 {n:4,b:1,t:'Las Comunidades Autónomas. La Comunidad Autónoma de Andalucía. El Estatuto de Autonomía',e:'Las Comunidades Autónomas: vías de acceso a la autonomía. La Comunidad Autónoma de Andalucía: competencias. El Estatuto de Autonomía de Andalucía.',s:[sc(L.CE,R(137,158)),sc(L.EST_AND)]},
 {n:5,b:1,t:'El Régimen Local Español. Organización municipal y provincial. Competencias',e:'El Régimen Local Español. Clases de Entidades Locales. Organización municipal. Competencias municipales. Organización provincial. Competencias provinciales.',s:[sc(L.L7_1985,[...R(1,38),...R(41,48)])]},
 {n:6,b:1,t:'Las Haciendas Locales. Los recursos de las Entidades Locales. Las ordenanzas fiscales',e:'Las Haciendas Locales. Los recursos de las Entidades Locales. Estudio especial de los ingresos tributarios. Las ordenanzas fiscales. Régimen de recursos.',s:[sc(L.TRLRHL,[...R(2,19)])]},
 {n:7,b:1,t:'Los derechos de los ciudadanos ante la Administración. Participación ciudadana',e:'Los derechos de los ciudadanos ante la Administración Pública. Colaboración y participación de los ciudadanos en la Administración con especial referencia a la Administración Local.',s:[sc(L.L39,R(13,33)),sc(L.L7_1985,['18','69','70','70 bis','71'])]},
 {n:8,b:1,t:'Políticas sociales: Igualdad, Violencia de Género, Discapacidad y Dependencia',e:'Políticas sociales: Políticas de Igualdad de género y contra la Violencia de Género. Discapacidad y Dependencia. Normativa Estatal y de la Comunidad Autónoma de Andalucía.',s:[sc(L.LO3_2007,R(1,40)),sc(L.LO1_2004,R(1,28)),sc(L.IG_AND),sc(L.VG_AND)]},
 // BLOQUE 2 — DERECHO ADMINISTRATIVO GENERAL (esp 1-13 → T9-21)
 {n:9,b:2,t:'El principio de legalidad. Las potestades administrativas. La actividad discrecional',e:'Sometimiento de la Administración a la Ley y al Derecho. El principio de legalidad. Las potestades administrativas. La actividad discrecional, límites y control: la desviación de poder. (Ley 40/2015, de Régimen Jurídico del Sector Público; Constitución Española).',s:[sc(L.CE,['9','103','106']),sc(L.L40,R(1,4))]},
 {n:10,b:2,t:'Fuentes del Derecho Administrativo. Jerarquía normativa',e:'Fuentes del Derecho Administrativo. Jerarquía normativa. Fuentes subsidiarias e indirectas: La Costumbre. La práctica administrativa. Los Principios Generales del Derecho, los Tratados Internacionales. La Jurisprudencia y la Doctrina científica.',s:[sc(L.CE,['1','9','93','94','96','97']),sc(L.CC,R(1,7))]},
 {n:11,b:2,t:'La Constitución como fuente. La Ley. Decretos Legislativos y Decretos-Leyes',e:'La Constitución como fuente del Derecho Administrativo. La Ley: concepto y clases. Relaciones entre la Ley autonómica y la estatal. Decretos Legislativos y Decretos-Leyes.',s:[sc(L.CE,['81','82','83','84','85','86','87','149','150'])]},
 {n:12,b:2,t:'El Reglamento y la potestad reglamentaria',e:'El Reglamento y la potestad reglamentaria. Clases de Reglamentos. Fundamento, titularidad y límites. Control de los reglamentos ilegales. Relaciones entre la Ley y el Reglamento. Procedimiento de elaboración. (Ley 39/2015 y Ley 40/2015).',s:[sc(L.L39,R(128,133)),sc(L.L40,['1','2','3'])]},
 {n:13,b:2,t:'La relación jurídico-administrativa. El administrado. Actos del administrado',e:'La relación jurídico-administrativa. Concepto. Sujetos. El administrado: concepto y clases. Capacidad y causas modificativas. Situaciones jurídicas. Derechos del administrado. Actos jurídicos del administrado. (Ley 39/2015).',s:[sc(L.L39,[...R(3,13),...R(53,53)])]},
 {n:14,b:2,t:'El acto administrativo: concepto, clases, elementos y eficacia',e:'El acto administrativo. Concepto. Clases. Elementos. Motivación y notificación. Eficacia. Ejecutividad y ejecución forzosa. Suspensión. (Ley 39/2015).',s:[sc(L.L39,R(34,52))]},
 {n:15,b:2,t:'Validez e invalidez de los actos. Revisión de oficio',e:'Validez e invalidez de los actos administrativos. Actos nulos y anulables. Irregularidades no invalidantes. Convalidación, conversión y conservación. Revisión de los actos: revisión de oficio, anulación y revocación. (Ley 39/2015).',s:[sc(L.L39,[...R(47,52),...R(106,111)])]},
 {n:16,b:2,t:'La obligación de resolver. El silencio administrativo. Los plazos',e:'La obligación de resolver: actos presuntos. Los actos en régimen jurídico privado. Dimensión temporal del procedimiento. Cómputo de plazos. Tramitación de urgencia. Procedimientos especiales. (Ley 39/2015).',s:[sc(L.L39,R(21,33))]},
 {n:17,b:2,t:'El procedimiento administrativo común. Fases. Los interesados',e:'El procedimiento administrativo común. Principios informadores. Las fases. Abstención y recusación. Procedimientos de ejecución. Los interesados y su representación. (Ley 39/2015).',s:[sc(L.L39,R(53,105))]},
 {n:18,b:2,t:'Los recursos administrativos. Las reclamaciones económico-administrativas',e:'Los recursos administrativos: concepto y clases. Requisitos generales. Materias recurribles, legitimación y órgano competente. Recursos de reposición, alzada y revisión. Las reclamaciones económico-administrativas. (Ley 39/2015).',s:[sc(L.L39,R(112,126))]},
 {n:19,b:2,t:'La Ley de Contratos del Sector Público',e:'Ley de Contratos del Sector Público: objeto y ámbito. Contratos del sector público. Partes. Objeto, presupuesto base, valor estimado, precio y revisión. Garantías. Preparación, adjudicación, efectos, modificación, suspensión y extinción. Cesión y subcontratación.',s:[sc(L.L9_2017,CONTR)]},
 {n:20,b:2,t:'La potestad sancionadora y el procedimiento sancionador',e:'La potestad sancionadora y el procedimiento sancionador: principios. Procedimiento general. Procedimiento simplificado. (Ley 40/2015 y Ley 39/2015).',s:[sc(L.L40,R(25,31)),sc(L.L39,['63','64','85','89','90','96'])]},
 {n:21,b:2,t:'La responsabilidad patrimonial de la Administración',e:'La responsabilidad patrimonial de la Administración. Presupuestos. Daños resarcibles. Acción y procedimiento. Responsabilidad de autoridades y personal. (Ley 40/2015).',s:[sc(L.L40,R(32,37))]},
 // BLOQUE 3 — RÉGIMEN LOCAL Y PROTECCIÓN DE DATOS (esp 14-20 → T22-28)
 {n:22,b:3,t:'El Servicio Público Local. Formas de gestión',e:'El Servicio Público Local: formas de gestión. Agencia Pública Administrativa Local. Agencia Pública Empresarial Local. Sociedad Mercantil Local. Sociedad Interlocal. Fundación Pública Local. La Empresa Mixta. (Ley 7/1985).',s:[sc(L.L7_1985,['85','85 bis','86'])]},
 {n:23,b:3,t:'Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de derechos digitales',e:'Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales. Objeto y régimen jurídico.',s:[sc(L.LO3_2018,R(1,37)),sc(L.RGPD)]},
 {n:24,b:3,t:'La potestad normativa de las Entidades Locales: Ordenanzas, reglamentos y bandos',e:'La potestad normativa de las Entidades Locales: Ordenanzas, reglamentos y bandos. Procedimiento de elaboración y aprobación. Infracción a ordenanzas y bandos. (Ley 7/1985).',s:[sc(L.L7_1985,['4','49','70','70 bis','139','140','141'])]},
 {n:25,b:3,t:'La Provincia como entidad local. El Reglamento Orgánico de la Diputación de Jaén',e:'La Provincia como entidad local. Historia. Regulación constitucional. Organización y competencias provinciales. El Reglamento Orgánico de la Diputación Provincial de Jaén. (Ley 7/1985, Título III).',s:[sc(L.L7_1985,R(31,38)),sc(L.CE,['141'])]},
 {n:26,b:3,t:'El Municipio. El término municipal. La población. La organización municipal',e:'El Municipio. Historia. Concepto y elementos. Clases de entes municipales. El término municipal. La población: empadronamiento. El estatuto de los vecinos. La organización municipal. Régimen común y gran población. El concejo abierto. (Ley 7/1985).',s:[sc(L.L7_1985,[...R(11,30)])]},
 {n:27,b:3,t:'Funcionamiento de los órganos colegiados locales. Actas. El registro de documentos',e:'Funcionamiento de los órganos colegiados locales: régimen de sesiones y acuerdos. Actas, certificaciones, comunicaciones, notificaciones y publicación. Las resoluciones de la Presidencia. El registro de documentos. (Ley 7/1985).',s:[sc(L.L7_1985,[...R(46,48),'70']),sc(L.L40,R(15,18))]},
 {n:28,b:3,t:'Los bienes de las Entidades Locales',e:'Los bienes de las Entidades Locales. Dominio público. Comunales. Patrimoniales o de propios. Alteración de la calificación jurídica. Utilización, conservación y tutela. Adquisición y enajenación. Prerrogativas. (Ley 7/1985).',s:[sc(L.L7_1985,R(79,83))]},
 // BLOQUE 4 — FUNCIÓN PÚBLICA LOCAL (esp 21-25 → T29-33)
 {n:29,b:4,t:'El TREBEP. El personal al servicio de las Entidades Locales',e:'El RDLeg 5/2015, TREBEP. El personal al servicio de las Entidades Locales: clases y régimen jurídico. Personal directivo en las Corporaciones locales.',s:[sc(L.RDL5,[...R(8,26),...R(89,100)])]},
 {n:30,b:4,t:'Plantillas y RPT. Oferta de empleo y planes de empleo',e:'Instrumentos de organización del personal: plantillas y relaciones de puestos de trabajo. Instrumentos reguladores de los recursos humanos: la oferta de empleo, los planes de empleo y otros sistemas de racionalización. (TREBEP).',s:[sc(L.RDL5,[...R(69,77)]),sc(L.L7_1985,['90','91'])]},
 {n:31,b:4,t:'El acceso a los empleos locales. Situaciones administrativas',e:'El acceso a los empleos locales: principios, requisitos, sistemas selectivos. Adquisición y pérdida de la relación de servicios. Provisión de puestos y movilidad. Situaciones administrativas. (TREBEP).',s:[sc(L.RDL5,[...R(55,68),...R(78,92)])]},
 {n:32,b:4,t:'Los derechos de los funcionarios locales. Seguridad Social',e:'Los derechos de los funcionarios locales: individuales; sociales, profesionales y retributivos. Derechos colectivos: sindicación y representación. La huelga y la negociación colectiva. El régimen de la Seguridad Social. (TREBEP; TR Ley General de la Seguridad Social).',s:[sc(L.RDL5,[...R(14,51)]),sc(L.RDL8,R(1,50))]},
 {n:33,b:4,t:'Los deberes de los funcionarios. Régimen disciplinario. Incompatibilidades',e:'Los deberes de los funcionarios locales. Régimen disciplinario. Responsabilidad civil, penal y patrimonial. Incompatibilidades. Los delitos cometidos por funcionarios públicos. (TREBEP).',s:[sc(L.RDL5,[...R(52,54),...R(93,98)])]},
 // BLOQUE 5 — HACIENDAS LOCALES (esp 26-30 → T34-38)
 {n:34,b:5,t:'IBI, IAE, IIVTNU, IVTM e ICIO',e:'El Impuesto sobre Bienes Inmuebles. El Impuesto sobre Actividades Económicas. El Impuesto sobre el Incremento del Valor de los Terrenos de Naturaleza Urbana. El Impuesto sobre Vehículos de Tracción Mecánica. El Impuesto sobre Construcciones, Instalaciones y Obras. (TR Ley Reguladora de las Haciendas Locales).',s:[sc(L.TRLRHL,[...R(59,110)])]},
 {n:35,b:5,t:'Las Tasas. Las Contribuciones Especiales. Los Precios Públicos',e:'Las Tasas. Las Contribuciones Especiales. Los Precios Públicos. (TR Ley Reguladora de las Haciendas Locales).',s:[sc(L.TRLRHL,[...R(20,47)])]},
 {n:36,b:5,t:'La gestión recaudatoria local',e:'La gestión recaudatoria local. Procedimientos de recaudación: voluntario y ejecutivo. Aplazamientos y fraccionamientos. (TR Ley Reguladora de las Haciendas Locales).',s:[sc(L.TRLRHL,[...R(10,19)])]},
 {n:37,b:5,t:'El gasto público local. Ejecución de los gastos públicos',e:'El gasto público local: concepto y régimen legal. Ejecución de los gastos públicos. (TR Ley Reguladora de las Haciendas Locales).',s:[sc(L.TRLRHL,[...R(162,180)])]},
 {n:38,b:5,t:'Los Presupuestos de las Entidades Locales. Modificaciones presupuestarias',e:'Los Presupuestos de las Entidades Locales. Principios, integración y documentos. Elaboración y aprobación. Bases de ejecución. Modificaciones presupuestarias: créditos extraordinarios, suplementos, transferencias y otras figuras. (TR Ley Reguladora de las Haciendas Locales).',s:[sc(L.TRLRHL,[...R(162,193)])]},
 // BLOQUE 6 — DOCUMENTACIÓN Y ADMINISTRACIÓN ELECTRÓNICA (esp 31-32 → T39-40)
 {n:39,b:6,t:'Los documentos administrativos. El expediente. El lenguaje administrativo',e:'Los documentos administrativos: concepto, funciones, características, tipos. Formación del expediente. Técnicas de redacción. El lenguaje y estilo administrativo. (Ley 39/2015; RD 1708/2011).',s:[sc(L.L39,['16','26','27','28','70']),sc(L.RD1708,['5','8','9','10','11','12'])]},
 {n:40,b:6,t:'La Administración Electrónica',e:'La Administración Electrónica. Marco normativo. Incidencia en el procedimiento administrativo común y en la actuación de la Administración. (Ley 39/2015; Ley 40/2015).',s:[sc(L.L39,['13','14','15','16','26','41','42','43']),sc(L.L40,R(38,46))]},
];

const BLOQUES=[
 {n:1,t:'Materias Comunes',i:'🏛️'},{n:2,t:'Derecho Administrativo General',i:'⚖️'},
 {n:3,t:'Régimen Local y Protección de Datos',i:'🏘️'},{n:4,t:'Función Pública Local',i:'👥'},
 {n:5,t:'Haciendas Locales',i:'💶'},{n:6,t:'Documentación y Administración Electrónica',i:'📄'},
];

async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}
(async () => {
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','auxiliar-administrativo-diputacion-cordoba').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Administrativo de la Diputación Provincial de Jaén', short_name:'Administrativo Dip. Jaén', slug:SLUG,
    categoria:'C1', grupo:'C', subgrupo:'C1', administracion:'autonomica', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:true, temas_count:40, bloques_count:6,
    titulo_requerido:'Bachiller, Técnico o equivalente',
    diario_oficial:'BOP Jaén', diario_referencia:'BOP Jaén nº 97, de 21/05/2026 (BOE-A-2026-12635)',
    programa_url:'https://bop.dipujaen.es/descargarws.dip?fechaBoletin=2026-05-21&numeroEdicto=2396&boletinSuplemento=0&ejercicioBop=2026&tipo=bop&anioExpedienteEdicto=2026',
    seguimiento_url:'https://sede.dipujaen.es/Convocatorias',
    estado_proceso:'inscripcion_abierta',
    oep_decreto:'OEP 2024 + 2025 + 2026 (acumuladas) — Resolución nº 1712 de 19/05/2026', oep_fecha:'2026-05-21',
    convocatoria_numero:'Edicto 2026/2396', convocatoria_fecha:'2026-05-21', convocatoria_dogv:'BOP Jaén nº 97, de 21/05/2026',
    plazas_libres:31, plazas_promocion_interna:0, plazas_discapacidad:4,
    exam_date:null, inscription_start:'2026-06-12', inscription_deadline:'2026-07-09',
    boe_publication_date:'2026-06-11', boe_reference:'BOE-A-2026-12635 (BOE nº 142, 11/06/2026); bases BOP Jaén nº 97, 21/05/2026',
    color_primario:'green',
    seo_title:'Administrativo Diputación de Jaén 2026 (C1) | 31 plazas, inscripción abierta | Vence',
    seo_description:'Prepara el Cuerpo Administrativo (C1) de la Diputación Provincial de Jaén: convocatoria 2026 con 31 plazas turno libre, inscripción abierta hasta el 9 de julio. 40 temas oficiales, tests por tema con legislación literal.',
    landing_description:'Escala de Administración General, Subescala Administrativa (subgrupo C1) de la Diputación Provincial de Jaén. Convocatoria 2026 (BOP nº 97): 31 plazas turno libre + 4 discapacidad, inscripción abierta hasta el 9 de julio de 2026.',
    landing_estadisticas:[
      {numero:'31',texto:'Plazas turno libre 2026',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'6',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'Bachiller',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La convocatoria 2026 (BOP Jaén nº 97, Resolución 1712/2026) oferta 35 plazas: 31 de turno libre y 4 reservadas a personas con discapacidad, acumulando las OEP 2024, 2025 y 2026.'},
      {pregunta:'¿Hasta cuándo puedo inscribirme?',respuesta:'El plazo de presentación de solicitudes está abierto hasta el 9 de julio de 2026 (sede electrónica de la Diputación de Jaén).'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La fecha aún no está fijada; se publicará con la lista de admitidos. El proceso consta de un ejercicio teórico (test) y un ejercicio práctico (supuesto).'},
      {pregunta:'¿Qué temario entra?',respuesta:'40 temas: 8 de Materias Comunes (Constitución, organización del Estado y de Andalucía, régimen local, haciendas locales, políticas sociales) y 32 de Materias Específicas (Derecho Administrativo, régimen local y provincial, función pública local, haciendas locales, administración electrónica).'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Bachiller, Técnico (FP de grado medio) o equivalente.'},
    ],
    examen_config:{tipo:'test',penalizacion:'Según las bases de la convocatoria',total_preguntas:50,duracion_total_minutos:90,
      partes:[{nombre:'Ejercicio teórico (test, materias comunes)',preguntas:50},{nombre:'Ejercicio práctico (supuesto, materias específicas)',preguntas:0}],
      notas:'Según la convocatoria 2026 (BOP Jaén nº 97). Dos ejercicios eliminatorios: teórico tipo test (mínimo 50 preguntas, 4 opciones) + práctico.'},
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
  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2026,is_current:true,estado_proceso:'inscripcion_abierta',oep_decreto:'OEP 2024+2025+2026 (Resolución 1712/2026)',oep_fecha:'2026-05-21',plazas_libres:31,plazas_discapacidad:4,boe_publication_date:'2026-06-11',boe_reference:'BOE-A-2026-12635; BOP Jaén nº 97, 21/05/2026',programa_url:row.programa_url}));
  console.log('✅ convocatoria');
  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2026-05-21',titulo:'Bases publicadas (BOP Jaén nº 97)',descripcion:'Resolución nº 1712 de 19/05/2026. 35 plazas (31 libre + 4 discapacidad) del Cuerpo Administrativo (C1).',url:row.programa_url,status:'completed',order_index:1},
    {oposicion_id:oid,fecha:'2026-06-12',titulo:'Apertura del plazo de inscripción',descripcion:'Extracto en BOE-A-2026-12635 (11/06/2026).',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-12635',status:'completed',order_index:2},
    {oposicion_id:oid,fecha:'2026-07-09',titulo:'Cierre del plazo de inscripción',descripcion:'Último día para presentar solicitudes en la sede electrónica.',url:null,status:'current',order_index:3},
    {oposicion_id:oid,fecha:'2026-11-01',titulo:'Examen (previsión)',descripcion:'Fecha sin fijar; se publicará con la lista de admitidos. Ejercicio teórico (test) + práctico.',url:null,status:'upcoming',order_index:4},
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 Jaén C1 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
