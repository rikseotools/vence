// Build Administrativo C1 Región de Murcia (CARM). FASE 2-3.
// 28 temas / 3 bloques (temario Orden 4/05/2016 BORM 114). Banco Murcia + común. Cero imports.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='administrativo_carm';
const SLUG='administrativo-carm';
const L={
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', EST:'193d1d8d-98a0-40ab-93b2-434e157eb18e',
  PRES:'c72dfed6-cc05-4a98-a3b3-9eb707fe7d4c', ORG:'0e44c4a0-89a1-48dd-9d3e-2c5201518562',
  L39:'218452f5-b9f6-48f0-a25b-26df9cb19644', L40:'95680d57-feb1-41c0-bb27-236024815feb',
  PAT:'fbf0e71a-0189-4720-9d32-e9a8a9ffa63b', ATEN:'1da2161f-6083-4b10-ada9-2f8c1be4c877',
  LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b', RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c',
  LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe', IGVG:'1d704410-3d48-4471-8302-d79c2bb498a9',
  LO3_2007:'6e59eacd-9298-4164-9d78-9e9343d9a900', TR:'f4cdde34-67f4-4c20-b2f5-efa8b79d88e8',
  RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0', FP:'9539ed02-43f8-4f71-a7fd-fbab6f731721',
  RDL8:'eabb640e-fa9b-47a8-8d76-2a580115cfb0', REG:'d6f6bdca-6ec5-4b22-99fa-684da889e6f8',
  HAC:'b92d63ce-0391-4208-b68d-a5bc4da268e4', LOFCA:'a1748252-e354-4ebd-8b29-03a8452bf609',
  L9_2017:'4f605392-8137-4962-9e66-ca5f275e93ee',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
const CONTR=['1','2','3','11','12','13','14','15','16','17','25','26','27','28','29','36','37','99','100','101','116','117','122','124','131','145','156','158','159','160','162','166','167','168','169'];
const T=[
 // BLOQUE I — Organización del Estado y gestión administrativa (1-14)
 {n:1,b:1,t:'La Constitución Española de 1978. Derechos y deberes. Garantías y suspensión',e:'La Constitución Española de 1978: Título Preliminar. Derechos y deberes fundamentales; garantías y suspensión. El control judicial de la Administración.',s:[sc(L.CE,[...R(1,55),'106','116','153'])]},
 {n:2,b:1,t:'El Estatuto de Autonomía de la Región de Murcia',e:'El Estatuto de Autonomía de la Región de Murcia: órganos institucionales. Régimen jurídico. Reforma.',s:[sc(L.EST)]},
 {n:3,b:1,t:'El Presidente. El Consejo de Gobierno. La Administración Pública de la Región de Murcia',e:'El Presidente. El Consejo de Gobierno de la Región de Murcia. Los Consejeros. La Administración Pública de la Región de Murcia: régimen jurídico, organización y funcionamiento. La Administración institucional. (Ley 6/2004 del Estatuto del Presidente y del Consejo de Gobierno; Ley 7/2004 de Organización de la Administración Pública de Murcia).',s:[sc(L.PRES),sc(L.ORG)]},
 {n:4,b:1,t:'El régimen jurídico del Sector Público. Los órganos. Órganos colegiados',e:'Régimen jurídico del Sector Público: ámbito y principios. Relaciones entre Administraciones Públicas. Los órganos: principios generales y competencia. Órganos colegiados. Abstención y recusación. (Ley 40/2015 de Régimen Jurídico del Sector Público).',s:[sc(L.L40,[...R(1,31),...R(140,158)])]},
 {n:5,b:1,t:'Los interesados. Derechos de los ciudadanos. El silencio. Términos y plazos',e:'Los interesados; representación, pluralidad, identificación. La actividad de las Administraciones Públicas: derechos de los ciudadanos. El acceso a archivos y registros. La obligación de resolver. El silencio administrativo. Los términos y plazos. (Ley 39/2015).',s:[sc(L.L39,[...R(3,33)])]},
 {n:6,b:1,t:'Las disposiciones y los actos administrativos: requisitos, eficacia, nulidad',e:'Las disposiciones y los actos administrativos: requisitos, eficacia, nulidad y anulabilidad. (Ley 39/2015).',s:[sc(L.L39,R(34,52))]},
 {n:7,b:1,t:'Disposiciones generales sobre los procedimientos administrativos',e:'Disposiciones generales sobre los procedimientos: iniciación, ordenación, instrucción, finalización y ejecución. (Ley 39/2015).',s:[sc(L.L39,R(53,105))]},
 {n:8,b:1,t:'La revisión de los actos en vía administrativa. Los recursos administrativos',e:'Revisión de los actos en vía administrativa: revisión de oficio. Los recursos administrativos. (Ley 39/2015).',s:[sc(L.L39,R(106,126))]},
 {n:9,b:1,t:'La potestad sancionadora. La responsabilidad patrimonial de la Administración',e:'La potestad sancionadora y el procedimiento sancionador. La responsabilidad patrimonial de la Administración. La responsabilidad de las autoridades y personal. (Ley 40/2015).',s:[sc(L.L40,R(25,37))]},
 {n:10,b:1,t:'El Patrimonio: bienes demaniales y patrimoniales',e:'El Patrimonio de la Comunidad Autónoma: disposiciones generales. Los bienes demaniales: afectación, desafectación, mutación. Los bienes patrimoniales: adquisición. (Ley 33/2003 del Patrimonio de las Administraciones Públicas, como marco básico).',s:[sc(L.PAT,[...R(1,20),...R(50,80)])]},
 {n:11,b:1,t:'Información administrativa y atención al ciudadano',e:'Información administrativa y atención al ciudadano en los canales presencial, electrónico y telefónico. (Decreto 236/2010 de atención al ciudadano de la Región de Murcia; Ley 39/2015).',s:[sc(L.ATEN),sc(L.L39,R(13,14))]},
 {n:12,b:1,t:'La protección de datos de carácter personal',e:'Protección de Datos de Carácter Personal: disposiciones generales. Datos especialmente protegidos. (LO 3/2018; Reglamento General de Protección de Datos).',s:[sc(L.LO3_2018,R(1,37)),sc(L.RGPD)]},
 {n:13,b:1,t:'La Ley de Prevención de Riesgos Laborales',e:'La Ley de Prevención de Riesgos Laborales: derechos y obligaciones. Los servicios de prevención. (Ley 31/1995).',s:[sc(L.LPRL,R(1,32))]},
 {n:14,b:1,t:'Igualdad e impacto de género. Transparencia y acceso a la información',e:'Igualdad: disposiciones generales; informes de impacto de género. Transparencia y acceso a la información pública. (Ley 7/2007 de Igualdad y de protección contra la violencia de género de Murcia; LO 3/2007; Ley 12/2014 de Transparencia de Murcia).',s:[sc(L.IGVG),sc(L.LO3_2007,R(1,40)),sc(L.TR)]},
 // BLOQUE II — Gestión de recursos humanos (15-21)
 {n:15,b:2,t:'El Estatuto Básico del Empleado Público',e:'El Estatuto Básico del Empleado Público: objeto, ámbito, tipos de personal. La carrera administrativa. Las incompatibilidades. (TREBEP, RDL 5/2015).',s:[sc(L.RDL5,[...R(8,30),...R(81,84)])]},
 {n:16,b:2,t:'La Ley de Función Pública de la Región de Murcia',e:'La Ley de Función Pública de la Región de Murcia: objeto y ámbito. Las clases de personal y su régimen jurídico. (Ley 1/2001 de la Función Pública de la Región de Murcia).',s:[sc(L.FP)]},
 {n:17,b:2,t:'OEP y selección. Carrera y provisión. Situaciones administrativas',e:'La Oferta de Empleo Público y la selección. Adquisición y pérdida de la condición de funcionario. La carrera administrativa y la provisión de puestos. Las situaciones administrativas. (Ley 1/2001 de Función Pública de Murcia; TREBEP).',s:[sc(L.FP),sc(L.RDL5,[...R(55,68),...R(85,92)])]},
 {n:18,b:2,t:'Retribuciones y Seguridad Social. Derechos, deberes y régimen disciplinario',e:'Sistema de retribuciones y régimen de Seguridad Social. Derechos, deberes, incompatibilidades y responsabilidades de los funcionarios. El régimen disciplinario. (Ley 1/2001 de Función Pública de Murcia; TREBEP).',s:[sc(L.FP),sc(L.RDL5,[...R(22,30),...R(52,54),...R(93,98)])]},
 {n:19,b:2,t:'Órganos de representación. Negociación colectiva. Derecho de reunión',e:'Órganos de representación, determinación de las condiciones de trabajo y participación del personal. La negociación colectiva. El derecho de reunión. (TREBEP, RDL 5/2015).',s:[sc(L.RDL5,R(31,46))]},
 {n:20,b:2,t:'La sede electrónica. Documento y expediente electrónico. Interoperabilidad',e:'La sede electrónica. Identificación y autenticación. El documento electrónico. El expediente electrónico. La Plataforma de Interoperabilidad. (Ley 39/2015; Ley 40/2015; Decreto 302/2011 del Registro de la Región de Murcia).',s:[sc(L.L39,[...R(13,17),...R(26,28)]),sc(L.L40,R(38,46)),sc(L.REG)]},
 {n:21,b:2,t:'El Régimen General de la Seguridad Social. Clases pasivas',e:'El Régimen General de la Seguridad Social: campo de aplicación, inscripción de empresas, afiliación, altas y bajas, cotización, acción protectora. El régimen especial de clases pasivas. (TR Ley General de la Seguridad Social, RDL 8/2015).',s:[sc(L.RDL8,[...R(1,50),...R(161,200)])]},
 // BLOQUE III — Gestión económico-presupuestaria y tributaria (22-28)
 {n:22,b:3,t:'La Hacienda Pública Regional. Derechos y obligaciones económicas',e:'La Hacienda Pública Regional: principios y derechos económicos. La administración de los derechos y obligaciones económicas. (DL 1/1999 de Hacienda de la Región de Murcia).',s:[sc(L.HAC,R(1,40))]},
 {n:23,b:3,t:'Los Presupuestos. Créditos y modificaciones. Ejecución. Control interno',e:'Presupuestos y gestión económico-financiera: elaboración y aprobación de los Presupuestos Generales de la Comunidad Autónoma. Créditos y modificaciones. Ejecución y liquidación. El control interno y la Intervención. (DL 1/1999 de Hacienda de Murcia).',s:[sc(L.HAC,R(29,110))]},
 {n:24,b:3,t:'El Plan General de Contabilidad Pública de la Región de Murcia',e:'El Plan General de Contabilidad Pública de la Región de Murcia: ámbito, fines, principios contables. (DL 1/1999 de Hacienda de la Región de Murcia, régimen de contabilidad).',s:[sc(L.HAC,R(111,140))]},
 {n:25,b:3,t:'La LOFCA. Cesión de tributos del Estado a la CARM',e:'La Ley Orgánica de Financiación de las Comunidades Autónomas (LOFCA): recursos de las Comunidades Autónomas. La cesión de tributos del Estado a la Región de Murcia.',s:[sc(L.LOFCA)]},
 {n:26,b:3,t:'La Ley de Tasas, Precios Públicos y Contribuciones Especiales de Murcia',e:'La Ley de Tasas, Precios Públicos y Contribuciones Especiales de la Región de Murcia. (Régimen de ingresos de la Hacienda regional, DL 1/1999).',s:[sc(L.HAC,R(20,40))]},
 {n:27,b:3,t:'Los contratos del Sector Público: ámbito, régimen y órganos de contratación',e:'Los contratos del Sector Público: ámbito subjetivo, carácter administrativo o privado, régimen jurídico, requisitos y órganos de contratación. (Ley 9/2017 de Contratos del Sector Público).',s:[sc(L.L9_2017,CONTR.filter(a=>parseInt(a)<=130))]},
 {n:28,b:3,t:'Preparación y adjudicación de los contratos. El contrato de obras',e:'Actuaciones preparatorias de los contratos. Los procedimientos de adjudicación. El contrato de obras. (Ley 9/2017 de Contratos del Sector Público).',s:[sc(L.L9_2017,['116','117','122','124','131','145','156','158','159','160','162','166','167','231','232','233','234','235','236','237','238','239','240','241','242','243','244','245'])]},
];
const BLOQUES=[
 {n:1,t:'Organización del Estado y gestión administrativa',i:'🏛️'},
 {n:2,t:'Gestión de Recursos Humanos',i:'👥'},
 {n:3,t:'Gestión Económico-Presupuestaria y Tributaria',i:'💶'},
];
async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}
(async () => {
  const { data: ex } = await s.from('oposiciones').select('id').eq('slug',SLUG);
  if(ex&&ex.length){console.log('⚠️ ya existe oposiciones con slug '+SLUG+':',ex.map(o=>o.id).join(','));}
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','auxiliar-administrativo-carm').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Administrativo de la Región de Murcia (Cuerpo Administrativo)', short_name:'Administrativo CARM', slug:SLUG,
    categoria:'C1', grupo:'C', subgrupo:'C1', administracion:'autonomica', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:true, temas_count:28, bloques_count:3,
    titulo_requerido:'Bachiller, Técnico o equivalente',
    diario_oficial:'BORM', diario_referencia:'BORM nº 226, de 30/09/2025 (convocatoria CGX00L24); temario Orden 4/05/2016 (BORM nº 114)',
    programa_url:'https://empleopublico.carm.es/publicaciones/37400.pdf',
    seguimiento_url:'https://empleopublico.carm.es/web/pagina?IDCONTENIDO=2340&IDTIPO=200&CODIGO_CUERPO=CGX00',
    estado_proceso:'pendiente_examen',
    oep_decreto:'Decreto 247/2022 (OEP 2022) y Decreto 439/2023 (OEP 2023)', oep_fecha:'2023-12-27',
    convocatoria_numero:'CGX00L24', convocatoria_fecha:'2025-09-30', convocatoria_dogv:'BORM nº 226, de 30/09/2025',
    plazas_libres:48, plazas_promocion_interna:0, plazas_discapacidad:3,
    exam_date:'2026-06-28', inscription_start:'2025-10-01', inscription_deadline:'2025-10-28',
    boe_publication_date:'2025-09-30', boe_reference:'BORM nº 226, de 30/09/2025 (Orden 19/09/2025); temario Orden 4/05/2016 (BORM nº 114, 18/05/2016)',
    color_primario:'red',
    seo_title:'Administrativo Región de Murcia (CARM, C1) | 48 plazas, 28 temas | Vence',
    seo_description:'Prepara el Cuerpo Administrativo (C1) de la Región de Murcia (CARM): 48 plazas, 28 temas oficiales (Orden 4/05/2016). Tests por tema con legislación literal y temario actualizado.',
    landing_description:'Cuerpo Administrativo (subgrupo C1) de la Administración Pública de la Región de Murcia (CARM). Convocatoria 2025-2026 (BORM nº 226): 48 plazas turno libre.',
    landing_estadisticas:[
      {numero:'48',texto:'Plazas turno libre',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'3',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'Bachiller',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La convocatoria del Cuerpo Administrativo (C1) de la CARM (BORM nº 226, código CGX00L24) oferta 48 plazas de turno libre, acumulando las OEP 2022 y 2023.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El ejercicio único está previsto para el 28 de junio de 2026. El plazo de solicitudes se cerró en octubre de 2025. La oposición es recurrente: puedes prepararte para esta y las próximas convocatorias.'},
      {pregunta:'¿Qué temario entra?',respuesta:'28 temas (Orden de 4 de mayo de 2016) en tres bloques: Organización del Estado y gestión administrativa, Gestión de Recursos Humanos y Gestión Económico-Presupuestaria y Tributaria.'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Bachiller, Formación Profesional de Segundo Grado o equivalente. No se exige idioma (Murcia no tiene lengua cooficial).'},
    ],
    examen_config:{tipo:'test',penalizacion:'Según las bases de la convocatoria',total_preguntas:100,duracion_total_minutos:120,
      notas:'Según convocatoria CGX00L24 (Orden de 14/02/2025 de estructura de ejercicios). Ejercicio único tipo test.'},
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
  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2025,is_current:true,estado_proceso:'pendiente_examen',oep_decreto:'Decreto 247/2022 + 439/2023',oep_fecha:'2023-12-27',plazas_libres:48,plazas_discapacidad:3,boe_publication_date:'2025-09-30',boe_reference:'BORM nº 226, de 30/09/2025',programa_url:row.programa_url}));
  console.log('✅ convocatoria');
  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2025-09-30',titulo:'Convocatoria publicada (BORM nº 226)',descripcion:'Orden de 19/09/2025 (código CGX00L24). 48 plazas turno libre del Cuerpo Administrativo (C1).',url:'https://empleopublico.carm.es/publicaciones/37396.pdf',status:'completed',order_index:1},
    {oposicion_id:oid,fecha:'2026-04-09',titulo:'Lista definitiva de admitidos',descripcion:'BORM nº 80, de 09/04/2026.',url:null,status:'completed',order_index:2},
    {oposicion_id:oid,fecha:'2026-06-28',titulo:'Examen (ejercicio único)',descripcion:'Previsto para el 28 de junio de 2026.',url:null,status:'upcoming',order_index:3},
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 Murcia C1 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
