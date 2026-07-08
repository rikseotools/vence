// Build Auxiliar Administrativo C2 Ayuntamiento de Salamanca. FASE 2-3.
// 41 temas / 5 bloques. Temario VERBATIM del BOP Salamanca nº 93 (15/05/2024, CVE BOP-SA-20240515-002).
// Forward-build: OEP 2026 aprobada (17 plazas Aux Admin oposición libre), SIN convocar. Banco CyL/común. Cero imports.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_ayuntamiento_salamanca';
const SLUG='auxiliar-administrativo-ayuntamiento-salamanca';
const L={
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  L40:'95680d57-feb1-41c0-bb27-236024815feb', L7:'06784434-f549-4ea2-894f-e2e400881545',
  L29:'07daa1fe-7e8e-4e2d-9a33-6893229869e0', L9:'4f605392-8137-4962-9e66-ca5f275e93ee',
  PAT:'fbf0e71a-0189-4720-9d32-e9a8a9ffa63b', RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7', L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  LOPD:'146b7e50-e089-44a6-932c-773954f8d96b', IG:'6e59eacd-9298-4164-9d78-9e9343d9a900',
  VG:'f5c17b23-2547-43d2-800c-39f5ea925c2f', INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',
  WIN:'cb536623-fb75-429c-a839-0154b76ee27b', WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',
  EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33', OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139',
  NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
// 41 temas (n=topic_number, b=bloque, t=title, e=epigrafe literal, s=scope, d=disponible)
const T=[
 // BLOQUE 1 — Derecho Constitucional y Administrativo (1-10)
 {n:1,b:1,t:'La Constitución Española de 1978. Principios generales. Estructura',e:'La Constitución Española de 1978. Principios generales. Estructura.',s:[sc(L.CE,R(1,9))]},
 {n:2,b:1,t:'Derechos y deberes fundamentales. Su garantía y suspensión. El Defensor del Pueblo',e:'Derechos y deberes fundamentales de los españoles. Su garantía y suspensión. El Defensor del Pueblo.',s:[sc(L.CE,[...R(10,55),'162'])]},
 {n:3,b:1,t:'La Corona. El Poder Legislativo',e:'La Corona. El Poder Legislativo.',s:[sc(L.CE,R(56,96))]},
 {n:4,b:1,t:'El Gobierno y la Administración del Estado. Relaciones Gobierno-Cortes Generales',e:'El Gobierno y la Administración del Estado. Relaciones entre el Gobierno y las Cortes Generales.',s:[sc(L.CE,R(97,116)),sc(L.L40,R(54,60))]},
 {n:5,b:1,t:'El Poder Judicial. El CGPJ. El Tribunal Supremo. El Ministerio Fiscal',e:'El Poder Judicial. Principios constitucionales. El Consejo General del Poder Judicial. El Tribunal Supremo. El Ministerio Fiscal.',s:[sc(L.CE,R(117,127))]},
 {n:6,b:1,t:'La Administración Pública. Clases de administraciones públicas. Principios',e:'La Administración Pública. Clases de administraciones públicas. Principios. (Ley 40/2015 de Régimen Jurídico del Sector Público).',s:[sc(L.L40,[...R(1,3),...R(54,60)])]},
 {n:7,b:1,t:'El acto administrativo. Validez, eficacia, notificación. Nulidad y anulabilidad',e:'El acto administrativo. Concepto, clases, elementos, motivación. Términos y plazos. Requisitos. Validez. Eficacia. Notificación y publicación. La nulidad y anulabilidad. (Ley 39/2015).',s:[sc(L.L39,[...R(29,52)])]},
 {n:8,b:1,t:'Procedimiento administrativo electrónico: garantías y fases. Abstención y recusación',e:'Procedimiento administrativo electrónico: garantías y fases. Abstención y recusación. (Ley 39/2015; Ley 40/2015).',s:[sc(L.L39,R(53,95)),sc(L.L40,R(23,24))]},
 {n:9,b:1,t:'Capacidad de los ciudadanos. Los interesados en el procedimiento',e:'La capacidad de los ciudadanos y sus causas modificativas. Interesados en el procedimiento y la actividad de las Administraciones Públicas. (Ley 39/2015).',s:[sc(L.L39,R(3,16))]},
 {n:10,b:1,t:'Revisión de oficio. Los recursos administrativos. El recurso contencioso-administrativo',e:'La revisión de oficio. Los recursos administrativos: concepto y clases. Recurso contencioso administrativo. (Ley 39/2015; Ley 29/1998).',s:[sc(L.L39,R(106,126)),sc(L.L29,R(1,33))]},
 // BLOQUE 2 — Administración Local (11-22)
 {n:11,b:2,t:'El régimen local en la Constitución. Desarrollo normativo',e:'El régimen local en la Constitución. Desarrollo normativo. (Constitución, arts. 137-142; Ley 7/1985 de Bases del Régimen Local).',s:[sc(L.CE,R(137,142)),sc(L.L7,R(1,5))]},
 {n:12,b:2,t:'El municipio: concepto y elementos. El término municipal. Población y empadronamiento',e:'El municipio: concepto y elementos. El término municipal. La población y el empadronamiento. (Ley 7/1985).',s:[sc(L.L7,R(11,18))]},
 {n:13,b:2,t:'Organización municipal. Competencias',e:'Organización municipal: competencias. (Ley 7/1985).',s:[sc(L.L7,[...R(19,27)])]},
 {n:14,b:2,t:'Ordenanzas y reglamentos de las entidades locales. Los bandos',e:'Ordenanzas y reglamentos de las entidades locales. Clases. Procedimientos de elaboración y aprobación. Los bandos. (Ley 7/1985).',s:[sc(L.L7,['4','22','49','65','70','84'])]},
 {n:15,b:2,t:'La función pública local y su organización',e:'La función pública local y su organización. (TREBEP, RDL 5/2015; Ley 7/1985).',s:[sc(L.RDL5,R(8,13)),sc(L.L7,R(89,92))]},
 {n:16,b:2,t:'Derechos y deberes de los funcionarios locales. Situaciones. Incompatibilidades y régimen disciplinario',e:'Derechos y deberes de los funcionarios públicos locales. Situaciones administrativas. Incompatibilidades y régimen disciplinario. (TREBEP, RDL 5/2015).',s:[sc(L.RDL5,[...R(14,54),...R(85,98)])]},
 {n:17,b:2,t:'Los bienes de las entidades locales',e:'Los bienes de las entidades locales. (Ley 33/2003 del Patrimonio de las Administraciones Públicas; Ley 7/1985).',s:[sc(L.PAT,[...R(1,20),...R(50,60)]),sc(L.L7,R(79,83))]},
 {n:18,b:2,t:'Los contratos administrativos en la esfera local. Clases',e:'Los contratos administrativos en la esfera local. Clases de contratos administrativos. (Ley 9/2017 de Contratos del Sector Público).',s:[sc(L.L9,['1','2','12','13','14','15','16','17','25','26','27','28','29','36','116','131'])]},
 {n:19,b:2,t:'El procedimiento administrativo local. El registro de entrada y salida. Notificaciones',e:'El procedimiento administrativo local. El registro de entrada y salida de documentos. Requisitos en la presentación de documentos. Notificaciones y comunicaciones. (Ley 39/2015).',s:[sc(L.L39,['16','38','40','41','42','43','44','45','46','66','70'])]},
 {n:20,b:2,t:'Funcionamiento de los órganos colegiados locales. Convocatoria, actas y acuerdos',e:'Funcionamiento de los órganos colegiados locales. Convocatoria y orden del día. Actas y notificaciones de acuerdos. (Ley 40/2015; Ley 7/1985).',s:[sc(L.L40,R(15,22)),sc(L.L7,['46','47','51'])]},
 {n:21,b:2,t:'Haciendas locales. Clasificación de los ingresos. Ordenanzas fiscales',e:'Haciendas locales, clasificación de los ingresos. Ordenanzas fiscales. (TRLRHL, RDL 2/2004).',s:[sc(L.TRLRHL,[...R(2,38)])]},
 {n:22,b:2,t:'Los presupuestos locales: concepto, principios y estructura. Elaboración y liquidación',e:'Los presupuestos locales: concepto, principio y estructura. Elaboración del presupuesto. Su liquidación. (TRLRHL, RDL 2/2004).',s:[sc(L.TRLRHL,R(162,193))]},
 // BLOQUE 3 — Atención, Transparencia, Protección de Datos y Archivo (23-29)
 {n:23,b:3,t:'Atención al público. Información a la ciudadanía. Atención a personas con discapacidad',e:'Atención al público: acogida e información a la ciudadanía. Atención de personas con discapacidad. (Ley 39/2015, asistencia e información a los ciudadanos).',s:[sc(L.L39,['13','14','53'])]},
 {n:24,b:3,t:'Servicios de información administrativa. Transparencia y acceso a la información',e:'Los servicios de información administrativa. Transparencia y acceso a la información. Reclamaciones. Quejas y Peticiones. (Ley 19/2013 de Transparencia).',s:[sc(L.L19,R(1,24)),sc(L.L39,['53'])]},
 {n:25,b:3,t:'La Protección de Datos. Principios, derechos y obligaciones',e:'La Protección de Datos. Principios, derechos y obligaciones. (LO 3/2018 de Protección de Datos Personales y garantía de los derechos digitales).',s:[sc(L.LOPD,R(1,31))]},
 {n:26,b:3,t:'Documento, registro y archivo. Funciones. Clases de archivo y criterios de ordenación',e:'Concepto de documento, registro y archivo. Funciones del registro y del archivo. Clases de archivo y criterios de ordenación. (Ley 39/2015).',s:[sc(L.L39,['16','17','26','27','70'])]},
 {n:27,b:3,t:'Funcionamiento electrónico del sector público. Administración electrónica',e:'Funcionamiento electrónico del sector público. Administración electrónica y servicios al ciudadano. (Ley 40/2015; Ley 39/2015).',s:[sc(L.L40,R(38,46)),sc(L.L39,['13','14','15','16'])]},
 {n:28,b:3,t:'Relaciones interadministrativas. Relaciones electrónicas (ORVE). Los convenios',e:'Relaciones interadministrativas. Especial referencia a las relaciones electrónicas entre las Administraciones (ORVE). Los convenios. (Ley 40/2015).',s:[sc(L.L40,R(140,158))]},
 {n:29,b:3,t:'El esquema de interoperabilidad',e:'El esquema de interoperabilidad. (Ley 40/2015, interoperabilidad y reutilización de sistemas y aplicaciones).',s:[sc(L.L40,['156','157','158'])]},
 // BLOQUE 4 — Calidad, Igualdad y Violencia de Género (30-34)
 {n:30,b:4,t:'Nociones básicas de calidad: modelos. Planificación estratégica (misión, visión y valores)',e:'Nociones básicas de calidad: modelos. Planificación estratégica: Misión, Visión y Valores de la organización.',s:[],d:false},
 {n:31,b:4,t:'Procesos y gestión por procesos. Modelo ISO 9001:2015',e:'Procesos y gestión por procesos: Definición, clasificación, mapa de procesos y fichas de descripción de procesos. Modelo ISO 9001:2015 para la gestión de los procesos.',s:[],d:false},
 {n:32,b:4,t:'La dirección por objetivos. La evaluación del desempeño y del rendimiento',e:'La dirección por objetivos. Características, conceptos y proceso. La evaluación del desempeño y del rendimiento: Concepto, diferencias, objetivos y criterios de evaluación. (TREBEP, RDL 5/2015, evaluación del desempeño).',s:[sc(L.RDL5,['17','20'])]},
 {n:33,b:4,t:'Igualdad de Género: conceptos generales. III Plan de Igualdad de Salamanca',e:'Igualdad de Género: conceptos generales. III Plan de Igualdad de Oportunidades entre Mujeres y Hombres de la ciudad de Salamanca. (LO 3/2007 para la igualdad efectiva de mujeres y hombres).',s:[sc(L.IG,R(1,51))]},
 {n:34,b:4,t:'Violencia de Género: marco conceptual. Prevención. Normativa. Recursos asistenciales',e:'Violencia de Género: marco conceptual. Prevención. Normativa. Recursos asistenciales. (LO 1/2004 de Medidas de Protección Integral contra la Violencia de Género).',s:[sc(L.VG,R(1,40))]},
 // BLOQUE 5 — Ofimática e Informática (BII 1-7 -> 35-41)
 {n:35,b:5,t:'Informática básica: hardware, software, sistemas operativos y seguridad',e:'Informática básica: conceptos fundamentales sobre el hardware y el software. Sistemas de almacenamiento de datos. Sistemas operativos. Nociones básicas de seguridad informática.',s:[sc(L.INFO)]},
 {n:36,b:5,t:'Sistemas operativos: Windows. Entorno gráfico, escritorio y menú inicio',e:'Introducción a los Sistemas operativos: especial referencia a Windows. Fundamentos. Trabajo en el entorno gráfico de Windows: ventanas, iconos, menús contextuales, cuadros de diálogo. El escritorio y sus elementos. El menú inicio.',s:[sc(L.WIN)]},
 {n:37,b:5,t:'El explorador de Windows. Gestión de carpetas y archivos. OneDrive',e:'El explorador de Windows. Gestión de carpetas y archivos. Operaciones de búsqueda. Herramientas "Este equipo" y "Acceso rápido". Accesorios. Herramientas del sistema. Onedrive.',s:[sc(L.WIN)]},
 {n:38,b:5,t:'Procesadores de texto: Word 365',e:'Procesadores de texto: Word 365.',s:[sc(L.WORD)]},
 {n:39,b:5,t:'Hojas de cálculo: Excel 365',e:'Hojas de cálculo: Excel 365.',s:[sc(L.EXCEL)]},
 {n:40,b:5,t:'Correo electrónico: Outlook 365',e:'Correo electrónico: conceptos elementales y funcionalidades de los clientes de correo. Outlook 365.',s:[sc(L.OUTLOOK)]},
 {n:41,b:5,t:'La Red Internet. Navegadores y buscadores. Inteligencia Artificial',e:'La Red Internet: origen, evolución y estado actual. Conceptos elementales sobre protocolos y servicios en Internet. Amenazas en la red. Navegadores web. Buscadores. Aplicabilidad de la Inteligencia Artificial.',s:[sc(L.NET)]},
];
const BLOQUES=[
 {n:1,t:'Derecho Constitucional y Administrativo',i:'⚖️'},{n:2,t:'Administración Local',i:'🏛️'},
 {n:3,t:'Atención, Transparencia, Protección de Datos y Archivo',i:'📋'},
 {n:4,t:'Calidad, Igualdad y Violencia de Género',i:'⚖️'},{n:5,t:'Ofimática e Informática',i:'💻'},
];
async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}
(async () => {
  const { data: ex } = await s.from('oposiciones').select('id').eq('slug',SLUG);
  if(ex&&ex.length){console.log('⚠️ ya existe '+SLUG+' — ABORT');return;}
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','auxiliar-administrativo-ayuntamiento-valladolid').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Auxiliar Administrativo del Ayuntamiento de Salamanca', short_name:'Aux. Admin. Salamanca', slug:SLUG,
    categoria:'C2', grupo:'C', subgrupo:'C2', administracion:'local', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:true, temas_count:41, bloques_count:5,
    titulo_requerido:'Graduado en ESO, Graduado Escolar o equivalente',
    diario_oficial:'BOP Salamanca', diario_referencia:'OEP 2026 (anuncio Ayuntamiento 30/04/2026), pendiente de convocatoria; temario de referencia: BOP Salamanca nº 93, de 15/05/2024',
    programa_url:'https://www.aytosalamanca.es/documents/20119/911260/Publicacixn_bases_BOP_2024-05-15_AUX.pdf',
    seguimiento_url:'https://www.aytosalamanca.es/es/empleopublico',
    estado_proceso:'oep_aprobada',
    oep_decreto:'Oferta de Empleo Público 2026 del Ayuntamiento de Salamanca', oep_fecha:'2026-04-30',
    convocatoria_numero:null, convocatoria_fecha:null, convocatoria_dogv:null,
    plazas_libres:17, plazas_promocion_interna:0, plazas_discapacidad:0,
    exam_date:null, inscription_start:null, inscription_deadline:null,
    boe_publication_date:null, boe_reference:'OEP 2026 Ayto. Salamanca (55 plazas oposición libre, 17 Auxiliar Administrativo); bases pendientes de publicación en BOP',
    color_primario:'amber',
    seo_title:'Auxiliar Administrativo Ayuntamiento de Salamanca (C2) 2026 | 41 temas | Vence',
    seo_description:'Prepara las plazas de Auxiliar Administrativo (C2) del Ayuntamiento de Salamanca: OEP 2026 (17 plazas, oposición libre), 41 temas. Tests por tema con legislación literal y ofimática Microsoft 365.',
    landing_description:'Auxiliar de Administración General (subgrupo C2) del Ayuntamiento de Salamanca. OEP 2026: 55 plazas por oposición libre, de las que 17 son de Auxiliar Administrativo. Convocatoria pendiente de publicación: prepárate con tiempo.',
    landing_estadisticas:[
      {numero:'17',texto:'Plazas OEP 2026',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'5',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'ESO',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La Oferta de Empleo Público 2026 del Ayuntamiento de Salamanca prevé 55 plazas por oposición libre, de las que 17 son de Auxiliar Administrativo (subgrupo C2). La convocatoria con sus bases aún no se ha publicado en el BOP: es el momento de empezar a prepararse con ventaja.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'Todavía no hay fecha: la OEP 2026 está aprobada pero pendiente de convocatoria. Cuando se publiquen las bases en el BOP de Salamanca se fijará el calendario. Mientras tanto puedes ir avanzando el temario.'},
      {pregunta:'¿Qué temario entra?',respuesta:'41 temas (referencia: BOP Salamanca nº 93/2024): 34 del Bloque I (Constitución, Administración, régimen local, haciendas locales, transparencia, protección de datos, igualdad y violencia de género) y 7 del Bloque II de ofimática (Windows, Word/Excel/Outlook 365, Internet e Inteligencia Artificial).'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Según las bases de referencia (BOP nº 93/2024): oposición libre con dos ejercicios tipo test (Bloque I: 60 preguntas; Bloque II de ofimática: 50 preguntas) más una batería de tests psicotécnicos. Cada respuesta errónea descuenta un tercio del valor de una correcta; las preguntas en blanco no penalizan.'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Graduado en ESO, Graduado Escolar o equivalente.'},
    ],
    examen_config:{tipo:'test',penalizacion:'Cada respuesta incorrecta descuenta un tercio del valor de una correcta; las preguntas en blanco no penalizan',total_preguntas:110,duracion_total_minutos:null,
      notas:'Referencia BOP Salamanca nº 93/2024 (convocatoria anterior). Tres ejercicios: 1º test Bloque I (60 preguntas), 2º test Bloque II ofimática Microsoft 365 (50 preguntas), 3º tests psicotécnicos. Pendiente de las bases de la OEP 2026.'},
  });
  const ins=await chk('oposiciones',s.from('oposiciones').insert(row).select('id').single());
  const oid=ins.data.id; console.log('✅ oposiciones',oid);
  await chk('bloques',s.from('oposicion_bloques').insert(BLOQUES.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.t,icon:b.i,sort_order:b.n}))));
  console.log('✅ bloques',BLOQUES.length);
  const tRows=T.map(t=>({position_type:PT,topic_number:t.n,title:t.t,description:t.e,epigrafe:t.e,bloque_number:t.b,descripcion_corta:t.t,disponible:t.d!==false,difficulty:'medium',estimated_hours:8,is_active:true}));
  const tIns=await chk('topics',s.from('topics').insert(tRows).select('id,topic_number'));
  const byNum={}; tIns.data.forEach(r=>byNum[r.topic_number]=r.id);
  console.log('✅ topics',tIns.data.length);
  const scope=[]; for(const t of T){for(const sp of t.s){scope.push({topic_id:byNum[t.n],law_id:sp.law,article_numbers:sp.arts});}}
  await chk('topic_scope',s.from('topic_scope').insert(scope));
  console.log('✅ topic_scope',scope.length,'(temas sin scope:',T.filter(t=>!t.s.length).map(t=>t.n).join(',')+')');
  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2026,is_current:true,estado_proceso:'oep_aprobada',oep_decreto:'OEP 2026 Ayto. Salamanca',oep_fecha:'2026-04-30',plazas_libres:17,plazas_discapacidad:0,boe_reference:'OEP 2026 (anuncio 30/04/2026); bases pendientes de publicación en BOP',programa_url:row.programa_url}));
  console.log('✅ convocatoria');
  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2026-04-30',titulo:'OEP 2026 aprobada',descripcion:'El Ayuntamiento de Salamanca aprueba una Oferta de Empleo Público de 55 plazas por oposición libre, 17 de ellas de Auxiliar Administrativo (C2).',url:'https://www.aytosalamanca.es/es/empleopublico',status:'completed',order_index:1},
    {oposicion_id:oid,fecha:null,titulo:'Publicación de la convocatoria y bases (pendiente)',descripcion:'Aún sin publicar en el BOP de Salamanca. Aquí aparecerá el plazo de solicitudes.',url:null,status:'upcoming',order_index:2},
    {oposicion_id:oid,fecha:null,titulo:'Examen (pendiente de fijar)',descripcion:'Se fijará tras la publicación de las bases.',url:null,status:'upcoming',order_index:3},
  ]));
  console.log('✅ hitos');
  console.log('\\n🎉 FASE 2-3 Salamanca Aux C2 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
