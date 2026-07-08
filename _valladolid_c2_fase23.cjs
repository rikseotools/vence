// Build Auxiliar Administrativo C2 Ayuntamiento de Valladolid. FASE 2-3.
// 30 temas (numeración oficial 1-7,9-31 — NO existe el 8) / 5 bloques. Banco CyL + común + local + ofimática.
// OEP 2026 (BOCYL 05/05/2026, 23 plz) sin convocar → usa temario de la convocatoria anterior (BOPVA 17/03/2025).
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_ayuntamiento_valladolid';
const SLUG='auxiliar-administrativo-ayuntamiento-valladolid';
const L={
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40:'95680d57-feb1-41c0-bb27-236024815feb', RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  L7_1985:'06784434-f549-4ea2-894f-e2e400881545', L9_2017:'4f605392-8137-4962-9e66-ca5f275e93ee',
  LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b', RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c',
  LO3_2007:'6e59eacd-9298-4164-9d78-9e9343d9a900', L4_2023:'d3a41325-047e-4d6a-99c5-fd8d5c8dc782',
  TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7', EST_CYL:'383d7ceb-0c2f-4e69-a699-40a7e1f762de',
  L19_2013:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798', TR_CYL:'932cbf9a-983e-49ac-a026-3187ece61979',
  AT_CYL:'29c983d6-4753-46ad-9c58-0ae8df14399b', ARCH_CYL:'85f38c74-cb16-42be-a8fa-799bb832515a',
  LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe', RD1708:'6cea0a54-de66-44ac-8f8e-041a6abce4aa',
  WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292', EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',
  NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
const CONTR=['1','2','3','11','12','13','14','15','16','17','25','26','27','28','29','36','37','99','100','101','116','117','131','145','156'];
const ORG_MUN=[...R(19,24),...R(122,138)];

const T=[
 // BLOQUE 1 — Organización del Estado y de Castilla y León (1-6)
 {n:1,b:1,t:'La Constitución Española de 1978. Reforma. El Tribunal Constitucional',e:'La Constitución Española de 1978: estructura y contenido. Los principios constitucionales y valores superiores. Los derechos y deberes fundamentales. Sus garantías y suspensión. Reforma de la Constitución. El Tribunal Constitucional.',s:[sc(L.CE,[...R(1,55),'116',...R(159,169)])]},
 {n:2,b:1,t:'La Corona. Las Cortes Generales. El Poder Judicial. El Defensor del Pueblo y el Tribunal de Cuentas',e:'La Corona. Funciones constitucionales del Rey o de la Reina. Sucesión y regencia. Las Cortes Generales: composición, atribuciones y funcionamiento. El Poder Judicial. La organización judicial española. Otros órganos constitucionales: el Defensor del Pueblo y el Tribunal de Cuentas.',s:[sc(L.CE,[...R(56,127),'136'])]},
 {n:3,b:1,t:'El Gobierno y la Administración. La Administración General del Estado',e:'El Gobierno y la Administración. La Administración General del Estado: regulación y organización. (Constitución Española; Ley 40/2015 de Régimen Jurídico del Sector Público).',s:[sc(L.CE,R(97,107)),sc(L.L40,R(54,80))]},
 {n:4,b:1,t:'Organización territorial (I): CCAA y Estatutos. La Comunidad de Castilla y León',e:'Organización territorial del Estado en la Constitución (I): Comunidades autónomas y Estatutos de Autonomía. Especial referencia a la Comunidad de Castilla y León: instituciones de Gobierno y competencias en el Estatuto.',s:[sc(L.CE,R(143,158)),sc(L.EST_CYL)]},
 {n:5,b:1,t:'Organización territorial (II): las Entidades locales. La autonomía local',e:'Organización territorial del Estado en la Constitución (II): las Entidades locales. El principio de autonomía local. (Constitución, Título VIII; Ley 7/1985 de Bases del Régimen Local).',s:[sc(L.CE,R(137,142)),sc(L.L7_1985,R(1,5))]},
 {n:6,b:1,t:'Las Entidades locales: tipología. La Ley de Bases del Régimen Local',e:'Las Entidades locales: tipología. Régimen local español: contenido y principios generales de la Ley de Bases de Régimen Local. (Ley 7/1985).',s:[sc(L.L7_1985,R(1,13))]},
 // BLOQUE 2 — El Ayuntamiento de Valladolid (7,9,10)
 {n:7,b:2,t:'Organización del Ayuntamiento de Valladolid (I): Pleno, Alcalde, Tenientes y Junta de Gobierno Local',e:'La organización política y administrativa del Ayuntamiento de Valladolid (I): el Pleno, el Alcalde, los Tenientes de Alcalde y la Junta de Gobierno Local. (Ley 7/1985, organización municipal y municipios de gran población).',s:[sc(L.L7_1985,ORG_MUN)]},
 {n:9,b:2,t:'Organización del Ayuntamiento de Valladolid (II): la Administración Pública municipal',e:'La organización política y administrativa del Ayuntamiento de Valladolid (II): la Administración Pública. La Secretaría General. La Intervención General. La Tesorería. El Consejo Económico-Administrativo. La Asesoría Jurídica. Las Fundaciones y Sociedades Municipales. La Agencia de Innovación y Desarrollo Económico de Valladolid. (Ley 7/1985, art. 130-137 y habilitación nacional).',s:[sc(L.L7_1985,['92','92 bis','130','131','132','133','134','135','136','137'])]},
 {n:10,b:2,t:'Organización del Ayuntamiento de Valladolid (III): las Áreas de Gobierno',e:'La organización política y administrativa del Ayuntamiento de Valladolid (III): las Áreas de Gobierno y su estructura interna. Órganos superiores y directivos de las Áreas de Gobierno. Número y denominación de las actuales Áreas de Gobierno. (Ley 7/1985, Título X municipios de gran población).',s:[sc(L.L7_1985,R(122,138))]},
 // BLOQUE 3 — Derecho Administrativo y Contratación (11-19)
 {n:11,b:3,t:'Las fuentes del derecho administrativo. Ordenanzas y reglamentos de las Entidades locales',e:'Las fuentes del derecho administrativo: la jerarquía de fuentes. La Constitución. La Ley. Disposiciones normativas con fuerza de Ley. Ordenanzas y reglamentos de las Entidades locales. Procedimiento de elaboración y aprobación. (Ley 7/1985; Ley 39/2015; Constitución).',s:[sc(L.CE,['1','9','81','82','86']),sc(L.L7_1985,['4','22','49','65','70']),sc(L.L39,R(128,133))]},
 {n:12,b:3,t:'El acto administrativo. Validez y eficacia. Nulidad y anulabilidad',e:'El acto administrativo: características generales. Requisitos. La motivación de los actos administrativos. Validez y eficacia. Nulidad y anulabilidad. Notificación y publicación. (Ley 39/2015).',s:[sc(L.L39,R(34,52))]},
 {n:13,b:3,t:'Los recursos administrativos. La revisión de oficio y la declaración de lesividad',e:'Los recursos administrativos. Concepto y clases. La revisión de oficio y la declaración de lesividad. (Ley 39/2015).',s:[sc(L.L39,R(106,126))]},
 {n:14,b:3,t:'El procedimiento sancionador. La responsabilidad patrimonial de las AAPP',e:'El procedimiento sancionador. Principios de la potestad sancionadora. Clases de infracciones y sanciones. La responsabilidad patrimonial de las Administraciones públicas. (Ley 40/2015).',s:[sc(L.L40,R(25,37))]},
 {n:15,b:3,t:'El procedimiento administrativo común. El silencio administrativo',e:'El procedimiento administrativo común: concepto, naturaleza y principios generales. Fases del procedimiento: iniciación, ordenación, instrucción y finalización. La obligación de resolver. El silencio administrativo. (Ley 39/2015).',s:[sc(L.L39,[...R(21,25),...R(53,105)])]},
 {n:16,b:3,t:'El régimen jurídico del sector público. La competencia. Los órganos colegiados',e:'El régimen jurídico del sector público: principios de actuación y funcionamiento. La atribución de competencias a los órganos administrativos: delegación, desconcentración, avocación, encomienda de gestión, delegación de firma y suplencia. Los órganos colegiados. (Ley 40/2015).',s:[sc(L.L40,R(5,24))]},
 {n:17,b:3,t:'Los contratos administrativos. La contratación del sector público',e:'Los contratos administrativos. Disposiciones generales sobre la contratación del sector público. Delimitación de los tipos contractuales. Tipos de tramitación y formas de adjudicación de los contratos administrativos. (Ley 9/2017).',s:[sc(L.L9_2017,CONTR)]},
 {n:18,b:3,t:'La Ley de Haciendas Locales: régimen jurídico',e:'Ley de Haciendas Locales: Régimen Jurídico. (TR de la Ley Reguladora de las Haciendas Locales, RDL 2/2004).',s:[sc(L.TRLRHL,R(2,38))]},
 {n:19,b:3,t:'El Presupuesto municipal. Ordenación de gastos y de pagos',e:'El Presupuesto municipal: concepto y estructura. Ordenación de gastos y ordenación de pagos. Órganos competentes. (TR de la Ley Reguladora de las Haciendas Locales, RDL 2/2004).',s:[sc(L.TRLRHL,R(162,193))]},
 // BLOQUE 4 — Personal, Igualdad y PRL (20-22)
 {n:20,b:4,t:'El personal al servicio de las Entidades locales. El EBEP',e:'El personal al servicio de las Entidades locales: clases de personal al servicio de las Entidades locales. Adquisición y pérdida de la condición de funcionario. El sistema de derechos y deberes en el Estatuto Básico del Empleado Público. (TREBEP, RDL 5/2015).',s:[sc(L.RDL5,[...R(8,54),...R(62,68)])]},
 {n:21,b:4,t:'Igualdad LGTBI (Ley 4/2023). Igualdad de género. Discapacidad y dependencia',e:'VI Plan Municipal Integral de Igualdad contra la violencia de género del Ayuntamiento de Valladolid. Ley 4/2023, de 28 de febrero, por la igualdad real y efectiva de las personas trans y para la garantía de los derechos de las personas LGTBI: disposiciones generales. Políticas sociales dirigidas a la atención de personas con discapacidad y/o dependientes.',s:[sc(L.L4_2023,R(1,40)),sc(L.LO3_2007,R(1,40))]},
 {n:22,b:4,t:'La Ley 31/1995 de Prevención de Riesgos Laborales',e:'La Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales: objeto y ámbito de aplicación. Riesgos y medidas preventivas asociadas al puesto de trabajo a desempeñar.',s:[sc(L.LPRL,R(1,16))]},
 // BLOQUE 5 — Información, Archivo, Transparencia e Informática (23-31)
 {n:23,b:5,t:'La atención al público. Atención a las personas con discapacidad',e:'La atención al público. Acogida e información a los ciudadanos y usuarios. Atención a las personas con discapacidad. (Ley 39/2015; Ley 2/2010 de derechos de los ciudadanos de Castilla y León).',s:[sc(L.L39,R(13,14)),sc(L.AT_CYL)]},
 {n:24,b:5,t:'La información administrativa: general y particular. Calidad. Quejas',e:'La información administrativa: general y particular. La calidad en la prestación de estos servicios. Iniciativas, reclamaciones y quejas. (Ley 2/2010 de Castilla y León; Ley 39/2015).',s:[sc(L.AT_CYL),sc(L.L39,['53'])]},
 {n:25,b:5,t:'La administración electrónica en la información y atención al ciudadano. La Sede Electrónica',e:'La administración electrónica en las funciones de información y atención al ciudadano. El teléfono de atención 010. La Sede Electrónica del Ayuntamiento de Valladolid. (Ley 39/2015; Ley 40/2015).',s:[sc(L.L39,['13','14','15','16']),sc(L.L40,R(38,46))]},
 {n:26,b:5,t:'El Registro de documentos. La presentación telemática',e:'El Registro de documentos: funciones. Conceptos de presentación, recepción, entrada y salida de documentos. Formas de presentación de documentos. La utilización de las TIC para la presentación de documentos: la presentación telemática. (Ley 39/2015).',s:[sc(L.L39,['16','26','27','28','66'])]},
 {n:27,b:5,t:'El archivo de los documentos administrativos. El acceso a los documentos',e:'El archivo de los documentos administrativos: clases de archivos y criterios de ordenación. El acceso a los documentos administrativos: sus limitaciones y formas de acceso. (RD 1708/2011; Ley 6/1991 de Archivos de Castilla y León; Ley 19/2013).',s:[sc(L.RD1708,['5','8','9','10','11','12']),sc(L.ARCH_CYL),sc(L.L19_2013,['13','14','15','16','17','18'])]},
 {n:28,b:5,t:'La transparencia administrativa. La protección de datos de carácter personal',e:'La Transparencia administrativa, legislación y especial referencia a su aplicación en el Ayuntamiento de Valladolid. La protección de datos de carácter personal. (Ley 19/2013; Ley 3/2015 de Castilla y León; LO 3/2018; RGPD).',s:[sc(L.L19_2013),sc(L.TR_CYL),sc(L.LO3_2018,R(1,37)),sc(L.RGPD)]},
 {n:29,b:5,t:'Procesadores de texto: Word para Microsoft 365',e:'Procesadores de texto: Word para Microsoft 365. Principales funciones y utilidades. Creación y estructuración del documento. Gestión, grabación, recuperación e impresión de ficheros. Personalización del entorno de trabajo.',s:[sc(L.WORD)]},
 {n:30,b:5,t:'Hojas de cálculo: Excel para Microsoft 365',e:'Hojas de cálculo: Excel para Microsoft 365. Principales funciones y utilidades. Libros, hojas y celdas. Configuración. Introducción y edición de datos. Fórmulas y funciones. Gráficos. Gestión de datos. Personalización del entorno de trabajo.',s:[sc(L.EXCEL)]},
 {n:31,b:5,t:'Correo electrónico e Internet',e:'Correo electrónico: conceptos elementales y funcionamiento. La red Internet: conceptos elementales y servicios.',s:[sc(L.NET)]},
];
const BLOQUES=[
 {n:1,t:'Organización del Estado y de Castilla y León',i:'🏛️'},{n:2,t:'El Ayuntamiento de Valladolid',i:'🏘️'},
 {n:3,t:'Derecho Administrativo y Contratación',i:'⚖️'},{n:4,t:'Personal, Igualdad y Prevención de Riesgos',i:'👥'},
 {n:5,t:'Información, Archivo, Transparencia e Informática',i:'💻'},
];
async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}
(async () => {
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','auxiliar-administrativo-cyl').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Auxiliar Administrativo del Ayuntamiento de Valladolid', short_name:'Aux. Ayto. Valladolid', slug:SLUG,
    categoria:'C2', grupo:'C', subgrupo:'C2', administracion:'local', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:false, temas_count:30, bloques_count:5,
    titulo_requerido:'Graduado en Educación Secundaria Obligatoria (ESO) o equivalente',
    diario_oficial:'BOCYL', diario_referencia:'OEP 2026: BOCYL 05/05/2026 (BOCYL-D-05052026-83-31)',
    programa_url:'https://www.valladolid.gob.es/es/tablon-oficial/ayuntamiento-valladolid-tablon-oficial/convocatoria-39-plazas-auxiliar-administrativo-acceso-libre',
    seguimiento_url:'https://www.valladolid.gob.es/es/tablon-oficial/ayuntamiento-valladolid/empleo-publico',
    estado_proceso:'oep_aprobada',
    oep_decreto:'OEP 2026 (BOCYL 05/05/2026)', oep_fecha:'2026-05-05',
    convocatoria_numero:null, convocatoria_fecha:null, convocatoria_dogv:null,
    plazas_libres:23, plazas_promocion_interna:0, plazas_discapacidad:0,
    exam_date:null, inscription_start:null, inscription_deadline:null,
    boe_publication_date:'2026-05-05', boe_reference:'OEP 2026, BOCYL de 05/05/2026 (BOCYL-D-05052026-83-31)',
    color_primario:'amber',
    seo_title:'Auxiliar Administrativo Ayuntamiento de Valladolid 2026 (C2) | OEP 23 plazas | Vence',
    seo_description:'Prepara el Auxiliar Administrativo del Ayuntamiento de Valladolid: OEP 2026 con 23 plazas turno libre, pendiente de convocatoria. 30 temas oficiales, tests por tema con legislación literal.',
    landing_description:'Escala de Administración General, Subescala Auxiliar (subgrupo C2) del Ayuntamiento de Valladolid. OEP 2026 (BOCYL 05/05/2026): 23 plazas turno libre, pendiente de convocatoria.',
    landing_estadisticas:[
      {numero:'23',texto:'Plazas OEP 2026',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'5',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'ESO',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La OEP 2026 del Ayuntamiento de Valladolid (BOCYL de 05/05/2026) incluye 23 plazas de turno libre de Auxiliar Administrativo, pendientes de convocatoria.'},
      {pregunta:'¿Cuándo se convoca?',respuesta:'La convocatoria/bases aún no se han publicado (solo la OEP). Puedes ir preparándote con el temario de la convocatoria anterior, que se reutiliza cada ciclo.'},
      {pregunta:'¿Qué temario entra?',respuesta:'30 temas: Materias Generales (Constitución, organización del Estado y de Castilla y León, organización del Ayuntamiento de Valladolid, Derecho Administrativo, hacienda, personal, igualdad y PRL) y Materias Específicas (atención, información, administración electrónica, registro, archivo, transparencia e informática).'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Oposición con dos ejercicios: un test de 60 preguntas (4 alternativas) y dos supuestos prácticos de ofimática en Office 365 (Word y Excel).'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Graduado en Educación Secundaria Obligatoria (ESO) o equivalente.'},
    ],
    examen_config:{tipo:'test',penalizacion:'En la parte práctica, los errores penalizan 1/4',total_preguntas:60,duracion_total_minutos:60,
      partes:[{nombre:'Primer ejercicio (test, 60 preguntas, 4 alternativas)',preguntas:60},{nombre:'Segundo ejercicio (2 supuestos prácticos ofimática Office 365)',preguntas:40}],
      notas:'Según la convocatoria anterior (BOPVA 17/03/2025). Reutilizable para la OEP 2026.'},
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
  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2026,is_current:true,estado_proceso:'oep_aprobada',oep_decreto:'OEP 2026 (BOCYL 05/05/2026)',oep_fecha:'2026-05-05',plazas_libres:23,plazas_discapacidad:0,boe_publication_date:'2026-05-05',boe_reference:'OEP 2026, BOCYL 05/05/2026',programa_url:row.programa_url}));
  console.log('✅ convocatoria');
  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2026-05-05',titulo:'OEP 2026 aprobada (BOCYL)',descripcion:'Oferta de Empleo Público 2026 del Ayuntamiento de Valladolid: 23 plazas turno libre de Auxiliar Administrativo.',url:'https://bocyl.jcyl.es/',status:'completed',order_index:1},
    {oposicion_id:oid,fecha:'2027-01-01',titulo:'Convocatoria / bases (pendiente)',descripcion:'Pendiente de publicación. El temario se reutiliza de la convocatoria anterior (BOPVA 17/03/2025).',url:null,status:'upcoming',order_index:2},
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 Valladolid C2 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
