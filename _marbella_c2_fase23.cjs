// Build Auxiliar Administrativo C2 Ayuntamiento de Marbella. FASE 2-3.
// 27 temas / 5 bloques (6 comunes + 21 específicas). Banco común + Andalucía + local + ofimática.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_ayuntamiento_marbella';
const SLUG='auxiliar-administrativo-ayuntamiento-marbella';
const L={
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40:'95680d57-feb1-41c0-bb27-236024815feb', RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  L7_1985:'06784434-f549-4ea2-894f-e2e400881545', L9_2017:'4f605392-8137-4962-9e66-ca5f275e93ee',
  LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b', RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c',
  LO3_2007:'6e59eacd-9298-4164-9d78-9e9343d9a900', LO1_2004:'f5c17b23-2547-43d2-800c-39f5ea925c2f',
  TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7', EST_AND:'5238bdc9-2ee4-44a7-bcb2-413ba78cb230',
  FP_AND:'53df9e3c-dc44-4e0f-98d1-e69785ba8554', IG_AND:'1c53e192-9db1-4e83-a6d7-53ef6b2ebc33',
  VG_AND:'8e7c797c-77b5-4013-8ac9-9aaec19814c8', L19_2013:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  TR_AND:'8c564cd0-4b74-4218-8126-543185e29eb6', LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',
  RD1708:'6cea0a54-de66-44ac-8f8e-041a6abce4aa', INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',
  WIN:'cb536623-fb75-429c-a839-0154b76ee27b', WORD:'4197a28f-4ad0-490d-b43f-9b21dbb82758',
  EXCEL:'b49380e5-754c-40f1-8c64-0cfadd5d1a56', NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
const CONTR=['1','2','3','11','12','13','14','15','16','17','25','26','27','28','29','36','37','99','100','101','116','117','131','145','156','316','317','318','319','320','321'];

const T=[
 // BLOQUE 1 — MATERIAS COMUNES (1-6)
 {n:1,b:1,t:'La Constitución Española de 1978. Derechos fundamentales. El Tribunal Constitucional',e:'La Constitución Española de 1978. Estructura. Características generales, estructura y contenido. Principios que informan la Constitución de 1978. Derechos fundamentales y Libertades Públicas. El Tribunal Constitucional.',s:[sc(L.CE,[...R(1,55),'116',...R(159,165)])]},
 {n:2,b:1,t:'La Corona: carácter, sucesión, proclamación y funciones',e:'La Corona: carácter, sucesión, proclamación y funciones.',s:[sc(L.CE,R(56,65))]},
 {n:3,b:1,t:'Las Cortes Generales. El Gobierno',e:'Las Cortes Generales. Concepto, elementos, funcionamiento y funciones normativas. El Gobierno: concepto, integración, cese, responsabilidad, funciones, deberes y regulación.',s:[sc(L.CE,R(66,107))]},
 {n:4,b:1,t:'La Administración Pública en el ordenamiento jurídico español. Tipología de Entes Públicos',e:'La Administración Pública en el ordenamiento jurídico español. Tipología de los Entes Públicos. Las Administraciones del Estado, autonómica, local e institucional. (Ley 40/2015 de Régimen Jurídico del Sector Público; Ley 7/1985).',s:[sc(L.L40,[...R(1,4),...R(54,57),...R(81,86)]),sc(L.L7_1985,R(1,3))]},
 {n:5,b:1,t:'Las Comunidades Autónomas. El Estatuto de Autonomía para Andalucía',e:'Las Comunidades Autónomas: Constitución y competencias. Competencias del Estado y de las Comunidades Autónomas: Introducción al Estatuto de Autonomía para Andalucía, y su sistema de distribución de competencias. (Constitución, Título VIII).',s:[sc(L.CE,R(137,158)),sc(L.EST_AND)]},
 {n:6,b:1,t:'Fuentes del Derecho Público. La jerarquía de las fuentes. Leyes y Reglamentos',e:'Fuentes del Derecho Público: enumeración y principios. La jerarquía de las fuentes. Fuentes escritas: Leyes y Reglamentos. (Constitución Española; Ley 39/2015).',s:[sc(L.CE,['1','9','81','82','83','86','97']),sc(L.L39,R(128,133))]},
 // BLOQUE 2 — ADMINISTRACIÓN LOCAL (7-11)
 {n:7,b:2,t:'El Régimen Local español. Entidades que integran la Administración Local',e:'El Régimen Local español. Concepto de Régimen Local español. Concepto de Administración Local, evolución del Régimen Local. Principios constitucionales y regulación jurídica. La Administración Local: Entidades que la integran. Regulación actual. (Ley 7/1985).',s:[sc(L.L7_1985,[...R(1,10)])]},
 {n:8,b:2,t:'El Municipio. El término municipal. La población. El empadronamiento',e:'El Municipio: evolución, concepto, elementos esenciales, denominación y cambio de nombre de los municipios. El Término municipal: concepto, caracteres, alteración del término municipal. La población: concepto. El empadronamiento: regulación, concepto. (Ley 7/1985).',s:[sc(L.L7_1985,R(11,18))]},
 {n:9,b:2,t:'Organización municipal. Clases de órganos. Competencias',e:'Organización municipal: concepto. Clases de órganos. Órganos de régimen común. Competencias: concepto y clases. Título X de la Ley 7/1985, de 2 de abril, reguladora de las Bases del Régimen Local.',s:[sc(L.L7_1985,[...R(19,27),...R(121,138)])]},
 {n:10,b:2,t:'La Provincia. Organización y competencias provinciales',e:'La Provincia: evolución, elementos esenciales. Competencias de la provincia. Organización provincial y competencias de los órganos. (Ley 7/1985, Título III).',s:[sc(L.L7_1985,R(31,38))]},
 {n:11,b:2,t:'Haciendas locales. Recursos. Las Ordenanzas Fiscales',e:'Haciendas locales. Clasificación de los recursos. Conceptos generales. Potestad tributaria de los Entes locales. Fases de la potestad tributaria. Fiscalidad de las Haciendas locales. Clasificación de los ingresos. Ordenanzas Fiscales. Tramitación, contenido y entrada en vigor. (TR Ley Reguladora de las Haciendas Locales, RDL 2/2004).',s:[sc(L.TRLRHL,R(2,19))]},
 // BLOQUE 3 — RÉGIMEN JURÍDICO Y DERECHOS (12-18)
 {n:12,b:3,t:'La Ley 31/1995 de Prevención de Riesgos Laborales',e:'La Ley 31/1995, de 8 de noviembre, Prevención de Riesgos Laborales: Objeto y ámbito de aplicación. Nociones básicas de Seguridad e Higiene en el Trabajo.',s:[sc(L.LPRL,R(1,16))]},
 {n:13,b:3,t:'La Ley Orgánica 3/2018 de Protección de Datos. El RGPD',e:'La Ley Orgánica 3/2018, de 5 de diciembre, de Protección de datos de carácter personal y garantía de los derechos digitales. Reglamento general de protección de datos.',s:[sc(L.LO3_2018,R(1,37)),sc(L.RGPD)]},
 {n:14,b:3,t:'Normativa estatal, autonómica y local en materia de igualdad',e:'Normativa estatal, autonómica y local en materia de igualdad: La obligación administrativa de empleo de un lenguaje inclusivo. Definición de acoso sexual y acoso por razón de sexo. Presupuestos con enfoque de género. (LO 3/2007; Ley 12/2007 de Andalucía).',s:[sc(L.LO3_2007,R(1,40)),sc(L.IG_AND)]},
 {n:15,b:3,t:'Normativa estatal y autonómica en materia de violencia de género',e:'Normativa estatal y autonómica en materia de violencia de género: La ampliación del concepto de víctima en la normativa andaluza y derechos de las víctimas de violencia de género. (LO 1/2004; Ley 13/2007 de Andalucía).',s:[sc(L.LO1_2004,R(1,28)),sc(L.VG_AND)]},
 {n:16,b:3,t:'Los actos administrativos. El procedimiento administrativo común. Cómputo de plazos',e:'Los actos administrativos: concepto y clases. Motivación y notificación. Eficacia y validez de los actos. Principios generales del procedimiento administrativo. Fases del procedimiento común. Días y horas hábiles. Cómputo de plazos. (Ley 39/2015).',s:[sc(L.L39,[...R(30,52),...R(53,105)])]},
 {n:17,b:3,t:'Recursos administrativos: alzada, reposición y revisión',e:'Recursos administrativos: concepto, clases, interposición, objeto, fin de la vía administrativa, suspensión de la ejecución, audiencia al interesado, resolución. Recurso de alzada, recurso potestativo de reposición y recurso extraordinario de revisión: objeto, interposición y plazos. (Ley 39/2015).',s:[sc(L.L39,R(112,126))]},
 {n:18,b:3,t:'Ordenanzas y Reglamentos de las Entidades Locales',e:'Ordenanzas y Reglamentos de las Entidades Locales. Clases. Procedimiento de elaboración y aprobación. (Ley 7/1985).',s:[sc(L.L7_1985,['4','22','49','65','70'])]},
 // BLOQUE 4 — GESTIÓN Y FUNCIÓN PÚBLICA LOCAL (19-25)
 {n:19,b:4,t:'Funcionamiento de los órganos colegiados locales. Actas y certificados',e:'Funcionamiento de los órganos colegiados locales. Convocatoria y orden del día. Requisitos de constitución. Votaciones. Actas y certificados de acuerdos. (Ley 7/1985; Ley 40/2015).',s:[sc(L.L7_1985,[...R(46,48),'70']),sc(L.L40,R(15,18))]},
 {n:20,b:4,t:'El registro de entrada y salida. El Archivo. El acceso a archivos y registros',e:'El registro de entrada y salida de documentos. La presentación de instancias y documentos en las oficinas públicas. La informatización de los registros. Comunicaciones y notificaciones. El Archivo. Clases de archivos. Principales criterios de ordenación. El derecho de los ciudadanos al acceso a archivos y registros. (Ley 39/2015; RD 1708/2011).',s:[sc(L.L39,['16','26','27','28','40','41','42','43']),sc(L.RD1708,['5','8','9','10','11','12'])]},
 {n:21,b:4,t:'Los Presupuestos locales. Estructura, aprobación y modificaciones',e:'Los Presupuestos locales: concepto. Principio de estabilidad presupuestaria. Contenido del presupuesto general. Anexos. Estructura presupuestaria. Formación y aprobación. Entrada en vigor. Ejercicio presupuestario. Liquidación. Modificaciones presupuestarias. (TR Ley Reguladora de las Haciendas Locales, RDL 2/2004).',s:[sc(L.TRLRHL,R(162,193))]},
 {n:22,b:4,t:'La Función pública local. Funcionarios. Personal laboral. Régimen disciplinario',e:'La Función pública local y su organización: ideas generales. Concepto de funcionario. Clases. El personal laboral al servicio de las Entidades locales. Régimen jurídico. Personal eventual. Derechos y deberes de los Funcionarios públicos locales. Régimen disciplinario. Derecho de sindicación. La Función Pública en Andalucía. (TREBEP RDL 5/2015; Ley 5/2023 de Andalucía).',s:[sc(L.RDL5,[...R(8,54),...R(85,98)]),sc(L.FP_AND)]},
 {n:23,b:4,t:'Los Bienes de las Entidades locales',e:'Los Bienes de las Entidades locales: concepto, clases. Bienes de dominio público local. Bienes patrimoniales locales, enajenación, cesión y utilización. (Ley 7/1985).',s:[sc(L.L7_1985,R(79,83))]},
 {n:24,b:4,t:'Los Contratos del Sector Público. Especial regulación en el ámbito local',e:'Los Contratos del Sector Público. Clases. Especial regulación en el ámbito local: Competencias en materia de contratación en las Entidades Locales. Normas específicas de contratación pública en las Entidades Locales. (Ley 9/2017 de Contratos del Sector Público).',s:[sc(L.L9_2017,CONTR)]},
 {n:25,b:4,t:'Formas de la acción administrativa: Fomento, Policía y Servicio Público. Licencias',e:'Formas de la acción administrativa: Fomento. Policía. Servicio Público. Clasificación. Procedimiento de concesión de licencias: concepto y caracteres. Actividades sometidas a licencia. Procedimiento. Efectos. La responsabilidad de la Administración. (Ley 7/1985; Ley 40/2015).',s:[sc(L.L7_1985,['84','84 bis','84 ter','85','86']),sc(L.L40,R(32,37))]},
 // BLOQUE 5 — TRANSPARENCIA E INFORMÁTICA (26-27)
 {n:26,b:5,t:'La Ley 19/2013 de transparencia, acceso a la información pública y buen gobierno',e:'La Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información pública y buen gobierno. Publicidad activa. Derecho de acceso a la información pública. Ejercicio del derecho y límites. Referencia a la Ley 1/2014, de 24 de junio, de Transparencia Pública de Andalucía.',s:[sc(L.L19_2013),sc(L.TR_AND)]},
 {n:27,b:5,t:'Informática básica. Windows. Word y Excel. Internet y correo electrónico',e:'Informática básica: conceptos fundamentales sobre hardware y software. Sistemas operativos (especial referencia a Windows). Sistemas ofimáticos. Procesadores de texto y hojas de cálculo (especial referencia a Microsoft Word y Excel). Internet, Portal interno y correo electrónico.',s:[sc(L.INFO),sc(L.WIN),sc(L.WORD),sc(L.EXCEL),sc(L.NET)]},
];
const BLOQUES=[
 {n:1,t:'Materias Comunes',i:'🏛️'},{n:2,t:'Administración Local',i:'🏘️'},
 {n:3,t:'Régimen Jurídico y Derechos',i:'⚖️'},{n:4,t:'Gestión y Función Pública Local',i:'👥'},
 {n:5,t:'Transparencia e Informática',i:'💻'},
];
async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}
(async () => {
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','auxiliar-administrativo-ayuntamiento-sevilla').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Auxiliar Administrativo del Ayuntamiento de Marbella', short_name:'Aux. Ayto. Marbella', slug:SLUG,
    categoria:'C2', grupo:'C', subgrupo:'C2', administracion:'autonomica', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:true, temas_count:27, bloques_count:5,
    titulo_requerido:'Graduado en Educación Secundaria Obligatoria (ESO) o equivalente',
    diario_oficial:'BOP Málaga', diario_referencia:'BOP Málaga nº 47, de 10/03/2026 (CVE 20260310-00731-2026)',
    programa_url:'https://www.bopmalaga.es/',
    seguimiento_url:'https://marbella.sedelectronica.es',
    estado_proceso:'convocada',
    oep_decreto:'OEP extraordinaria 2023 + ordinaria 2024 + ordinaria 2025', oep_fecha:'2026-03-10',
    convocatoria_numero:'Anuncio 731/2026 (JGL 17/02/2026)', convocatoria_fecha:'2026-03-10', convocatoria_dogv:'BOP Málaga nº 47, de 10/03/2026',
    plazas_libres:16, plazas_promocion_interna:0, plazas_discapacidad:1,
    exam_date:null, inscription_start:null, inscription_deadline:null,
    boe_publication_date:null, boe_reference:'Bases en BOP Málaga nº 47, 10/03/2026; extracto BOE pendiente de publicación',
    color_primario:'green',
    seo_title:'Auxiliar Administrativo Ayuntamiento de Marbella 2026 (C2) | 17 plazas | Vence',
    seo_description:'Prepara el Auxiliar Administrativo del Ayuntamiento de Marbella: convocatoria 2026 con 17 plazas (concurso-oposición). 27 temas oficiales, tests por tema con legislación literal. Inscripción pendiente de extracto en BOE.',
    landing_description:'Escala de Administración General, Subescala Auxiliar (subgrupo C2) del Ayuntamiento de Marbella. Convocatoria 2026 (BOP Málaga nº 47): 17 plazas (16 + 1 discapacidad), concurso-oposición. Inscripción a la espera del extracto en el BOE.',
    landing_estadisticas:[
      {numero:'17',texto:'Plazas convocatoria 2026',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'5',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'ESO',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La convocatoria 2026 (BOP Málaga nº 47) oferta 17 plazas: 16 de cupo general y 1 reservada a personas con discapacidad intelectual, acumulando las OEP 2023-2025.'},
      {pregunta:'¿Cuándo se abre la inscripción?',respuesta:'El plazo (20 días hábiles) se abrirá cuando se publique el extracto de la convocatoria en el BOE, pendiente a fecha de hoy. Conviene ir preparándose desde ya.'},
      {pregunta:'¿Qué sistema selectivo es?',respuesta:'Concurso-oposición. La fase de oposición tiene dos ejercicios: un test de 40 preguntas (3 alternativas) sobre todo el temario y un supuesto práctico.'},
      {pregunta:'¿Qué temario entra?',respuesta:'27 temas: 6 de Materias Comunes (Constitución, organización del Estado y de Andalucía, fuentes) y 21 de Materias Específicas (administración local, procedimiento, función pública local, haciendas locales, transparencia e informática).'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Graduado en Educación Secundaria Obligatoria (ESO) o equivalente.'},
    ],
    examen_config:{tipo:'test',penalizacion:'Según las bases de la convocatoria',total_preguntas:40,duracion_total_minutos:60,
      partes:[{nombre:'Primer ejercicio (test, 40 preguntas, 3 alternativas)',preguntas:40},{nombre:'Segundo ejercicio (supuesto práctico)',preguntas:0}],
      notas:'Según BOP Málaga nº 47. Dos ejercicios eliminatorios: test (máx 60 min) + supuesto práctico a elegir entre dos (máx 90 min, con textos legales no comentados).'},
  });
  const ins=await chk('oposiciones',s.from('oposiciones').insert(row).select('id').single());
  const oid=ins.data.id; console.log('✅ oposiciones',oid);
  await chk('bloques',s.from('oposicion_bloques').insert(BLOQUES.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.t,icon:b.i,sort_order:b.n}))));
  console.log('✅ bloques',BLOQUES.length);
  const tRows=T.map(t=>({position_type:PT,topic_number:t.n,title:t.t,description:t.e,epigrafe:t.e,bloque_number:t.b,descripcion_corta:t.t,disponible:true,difficulty:'medium',estimated_hours:8,is_active:true}));
  const tIns=await chk('topics',s.from('topics').insert(tRows).select('id,topic_number'));
  const byNum={}; tIns.data.forEach(r=>byNum[r.topic_number]=r.id);
  console.log('✅ topics',tIns.data.length);
  const scope=[]; for(const t of T){for(const sp of t.s){scope.push({topic_id:byNum[t.n],law_id:sp.law,article_numbers:sp.arts});}}
  await chk('topic_scope',s.from('topic_scope').insert(scope));
  console.log('✅ topic_scope',scope.length);
  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2026,is_current:true,estado_proceso:'convocada',oep_decreto:'OEP 2023-2025',oep_fecha:'2026-03-10',plazas_libres:16,plazas_discapacidad:1,boe_publication_date:null,boe_reference:'BOP Málaga nº 47, 10/03/2026 (extracto BOE pendiente)',programa_url:row.programa_url}));
  console.log('✅ convocatoria');
  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2026-03-10',titulo:'Bases publicadas (BOP Málaga nº 47)',descripcion:'Acuerdo JGL 17/02/2026. 17 plazas (16 + 1 discapacidad), concurso-oposición.',url:'https://www.bopmalaga.es/',status:'completed',order_index:1},
    {oposicion_id:oid,fecha:'2026-07-01',titulo:'Publicación del extracto en el BOE (pendiente)',descripcion:'Abrirá el plazo de inscripción (20 días hábiles). Fecha estimada.',url:null,status:'current',order_index:2},
    {oposicion_id:oid,fecha:'2026-11-01',titulo:'Examen (previsión)',descripcion:'Fecha sin fijar. Test (40 preguntas) + supuesto práctico.',url:null,status:'upcoming',order_index:3},
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 Marbella C2 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
