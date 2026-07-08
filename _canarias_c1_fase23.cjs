// Build Administrativo C1 Canarias (Gobierno de Canarias). FASE 2-3.
// 30 temas / 5 bloques (temario verbatim BOC nº16 13/01/2026). Banco Canarias + común. Cero imports.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='administrativo_canarias';
const SLUG='administrativo-canarias';
const L={
  CE:'6ad91a6c-41ec-431f-9c80-5f5566834941', L40:'95680d57-feb1-41c0-bb27-236024815feb',
  L7_1985:'06784434-f549-4ea2-894f-e2e400881545', EST:'8b99a4d7-1cdc-4010-aa85-9c942781e8e8',
  GOB:'f7d3885d-b379-43ba-8900-1edaa75e6567', RJ:'e32ec995-cc72-4eb7-9630-0dfe5dd69229',
  MUN:'79f7111c-dbf7-4d04-8c61-731d4877665a', TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',
  TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4', L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',
  TR:'8a87f21b-380c-4e85-b2ca-eb51fd112688', LO3_2018:'146b7e50-e089-44a6-932c-773954f8d96b',
  RGPD:'a125dd9f-5bdc-4454-9da3-d1ee9f1f543c', LO3_2007:'6e59eacd-9298-4164-9d78-9e9343d9a900',
  IG:'41b27bb0-7007-4212-b768-b3fc0aaf471e', RDL5:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',
};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const sc=(law,arts)=>({law,arts:arts||null});
const T=[
 // BLOQUE 1 — Organización del Estado (1-8)
 {n:1,b:1,t:'La Constitución Española. Características del Estado. Valores superiores',e:'La Constitución Española. Características esenciales del Estado. Valores superiores y principios constitucionales.',s:[sc(L.CE,R(1,9))]},
 {n:2,b:1,t:'La protección constitucional de los derechos y deberes y de los principios rectores',e:'La protección constitucional de los derechos y deberes y de los principios rectores de la política social y económica.',s:[sc(L.CE,R(10,55))]},
 {n:3,b:1,t:'El poder legislativo. Las Cortes Generales. Los procedimientos legislativos',e:'El poder legislativo. Las Cortes Generales: composición y funciones. Los procedimientos legislativos.',s:[sc(L.CE,R(66,96))]},
 {n:4,b:1,t:'El poder ejecutivo. El Gobierno de la Nación',e:'El poder ejecutivo en la Constitución Española. El Gobierno de la Nación: composición, funciones y relaciones con las Cortes Generales.',s:[sc(L.CE,R(97,107))]},
 {n:5,b:1,t:'El poder judicial. El Consejo General del Poder Judicial',e:'El poder judicial en la Constitución Española. El Consejo General del Poder Judicial. El Tribunal Supremo. La organización judicial.',s:[sc(L.CE,R(117,127))]},
 {n:6,b:1,t:'La Administración General del Estado: concepto, estructura y organización',e:'La Administración General del Estado: concepto, estructura y organización. (Ley 40/2015 de Régimen Jurídico del Sector Público).',s:[sc(L.L40,R(54,80))]},
 {n:7,b:1,t:'Las Comunidades Autónomas. Vías de acceso. Distribución de competencias',e:'Las Comunidades Autónomas. Vías de acceso a la autonomía. Distribución de competencias entre el Estado y las Comunidades Autónomas. (Constitución Española, Título VIII).',s:[sc(L.CE,R(137,158))]},
 {n:8,b:1,t:'La autonomía local. Las entidades locales',e:'La autonomía local en la Constitución Española. Las entidades locales: el municipio y la provincia. (Constitución, Título VIII; Ley 7/1985 de Bases del Régimen Local).',s:[sc(L.CE,R(137,142)),sc(L.L7_1985,R(1,13))]},
 // BLOQUE 2 — Organización de Canarias (9-14)
 {n:9,b:2,t:'El Estatuto de Autonomía de Canarias: estructura, contenido y naturaleza',e:'El Estatuto de Autonomía de Canarias: estructura, contenido y naturaleza jurídica. La reforma del Estatuto.',s:[sc(L.EST)]},
 {n:10,b:2,t:'El Parlamento de Canarias. La función legislativa y de control',e:'El Parlamento de Canarias. La función legislativa y de control. (Estatuto de Autonomía de Canarias, LO 1/2018).',s:[sc(L.EST)]},
 {n:11,b:2,t:'Las competencias de la Comunidad Autónoma de Canarias (Título V del Estatuto)',e:'De las competencias de la Comunidad Autónoma de Canarias en el Título V del Estatuto de Autonomía de Canarias (LO 1/2018).',s:[sc(L.EST)]},
 {n:12,b:2,t:'El Gobierno de Canarias: concepto y régimen jurídico',e:'El Gobierno de Canarias: concepto y régimen jurídico. El Presidente. (Estatuto de Autonomía de Canarias, LO 1/2018; Ley 4/2023 de la Presidencia y del Gobierno de Canarias).',s:[sc(L.EST),sc(L.GOB)]},
 {n:13,b:2,t:'La Administración Pública de la Comunidad Autónoma de Canarias',e:'La Administración Pública de la Comunidad Autónoma de Canarias: principios, organización y régimen jurídico. (Ley 14/1990 de Régimen Jurídico de las Administraciones Públicas de Canarias).',s:[sc(L.RJ)]},
 {n:14,b:2,t:'Organización territorial de Canarias. Los Cabildos Insulares',e:'Organización territorial de Canarias. Los Cabildos Insulares. Los municipios canarios. (Estatuto de Autonomía de Canarias, LO 1/2018; Ley 7/2015 de los municipios de Canarias).',s:[sc(L.EST),sc(L.MUN)]},
 // BLOQUE 3 — La Unión Europea (15-20)
 {n:15,b:3,t:'Instituciones de la UE (I): la Comisión, el Consejo Europeo y el Consejo',e:'Instituciones Básicas de la Unión Europea (I): la Comisión, el Consejo Europeo y el Consejo de la Unión Europea. (Tratado de la Unión Europea y Tratado de Funcionamiento de la UE).',s:[sc(L.TUE),sc(L.TFUE)]},
 {n:16,b:3,t:'Instituciones de la UE (II): el Tribunal de Cuentas y el Banco Central Europeo',e:'Instituciones Básicas de la Unión Europea (II): el Tribunal de Cuentas y el Banco Central Europeo. (Tratado de la Unión Europea y Tratado de Funcionamiento de la UE).',s:[sc(L.TUE),sc(L.TFUE)]},
 {n:17,b:3,t:'Instituciones de la UE (III): el Tribunal de Justicia de la Unión Europea',e:'Instituciones Básicas de la Unión Europea (III): el Tribunal de Justicia de la Unión Europea. (Tratado de la Unión Europea y Tratado de Funcionamiento de la UE).',s:[sc(L.TUE),sc(L.TFUE)]},
 {n:18,b:3,t:'Instituciones de la UE (IV): el Parlamento Europeo',e:'Instituciones Básicas de la Unión Europea (IV): el Parlamento Europeo. (Tratado de la Unión Europea y Tratado de Funcionamiento de la UE).',s:[sc(L.TUE),sc(L.TFUE)]},
 {n:19,b:3,t:'Las libertades básicas de la UE (I): libre circulación de mercancías y personas',e:'Las Libertades Básicas de la Unión Europea (I): la libre circulación de mercancías y de personas. (Tratado de Funcionamiento de la UE).',s:[sc(L.TFUE)]},
 {n:20,b:3,t:'Las libertades básicas de la UE (II): libre circulación de trabajadores, servicios y capitales',e:'Las Libertades Básicas de la Unión Europea (II): la libre circulación de trabajadores, la libertad de establecimiento y la libre prestación de servicios y de capitales. (Tratado de Funcionamiento de la UE).',s:[sc(L.TFUE)]},
 // BLOQUE 4 — Régimen Jurídico, Transparencia y Datos (21-24)
 {n:21,b:4,t:'La responsabilidad patrimonial de las Administraciones Públicas',e:'Los principios de la responsabilidad patrimonial de las Administraciones Públicas. (Ley 40/2015 de Régimen Jurídico del Sector Público).',s:[sc(L.L40,R(32,37))]},
 {n:22,b:4,t:'La potestad sancionadora de las Administraciones Públicas',e:'Los principios de la potestad sancionadora de las Administraciones Públicas. (Ley 40/2015 de Régimen Jurídico del Sector Público).',s:[sc(L.L40,R(25,31))]},
 {n:23,b:4,t:'La transparencia de las Administraciones Públicas. La publicidad activa',e:'La transparencia de las Administraciones Públicas. La publicidad activa y el derecho de acceso a la información pública. (Ley 19/2013; Ley 12/2014 de transparencia y de acceso a la información pública de Canarias).',s:[sc(L.L19),sc(L.TR)]},
 {n:24,b:4,t:'El régimen jurídico de la protección de datos de carácter personal',e:'El régimen jurídico de la protección de datos de carácter personal. (LO 3/2018; Reglamento General de Protección de Datos).',s:[sc(L.LO3_2018,R(1,37)),sc(L.RGPD)]},
 // BLOQUE 5 — Derechos, Igualdad, Empleo Público y PRL (25-30)
 {n:25,b:5,t:'La condición política de canarios. Los derechos y deberes de los canarios',e:'La condición política de canarios. Los derechos y deberes de los canarios. (Estatuto de Autonomía de Canarias, LO 1/2018).',s:[sc(L.EST)]},
 {n:26,b:5,t:'La participación de la ciudadanía. Los derechos para la participación',e:'La participación de la ciudadanía. Los derechos para la participación en los asuntos públicos. (Estatuto de Autonomía de Canarias, LO 1/2018; Ley 12/2014 de transparencia de Canarias).',s:[sc(L.EST),sc(L.TR)]},
 {n:27,b:5,t:'La igualdad en la Constitución Española y en el Estatuto de Autonomía',e:'La igualdad en la Constitución Española y en el Estatuto de Autonomía de Canarias. (LO 3/2007 para la igualdad efectiva de mujeres y hombres; Estatuto de Autonomía de Canarias, LO 1/2018).',s:[sc(L.LO3_2007,R(1,40)),sc(L.EST)]},
 {n:28,b:5,t:'La igualdad en la legislación canaria',e:'La igualdad en la legislación canaria. Ámbito de aplicación. (Ley 1/2010 canaria de igualdad entre mujeres y hombres).',s:[sc(L.IG)]},
 {n:29,b:5,t:'Principios estatutarios de acceso al empleo público',e:'Principios estatutarios de acceso al empleo público. (Texto Refundido del Estatuto Básico del Empleado Público, RDL 5/2015; Estatuto de Autonomía de Canarias, LO 1/2018).',s:[sc(L.RDL5,[...R(55,68),'8','9','10','11','12','13','14']),sc(L.EST)]},
 {n:30,b:5,t:'La prevención de riesgos laborales: régimen jurídico',e:'La prevención de riesgos laborales: régimen jurídico. (Ley 31/1995 de Prevención de Riesgos Laborales).',s:[sc(L.LPRL,R(1,16))]},
];
const BLOQUES=[
 {n:1,t:'Organización del Estado',i:'🏛️'},{n:2,t:'Organización de Canarias',i:'🌴'},
 {n:3,t:'La Unión Europea',i:'🇪🇺'},{n:4,t:'Régimen Jurídico, Transparencia y Datos',i:'⚖️'},
 {n:5,t:'Derechos, Igualdad, Empleo Público y Prevención',i:'👥'},
];
async function chk(label,p){const r=await p;if(r.error){console.log('❌ '+label+':',r.error.message);throw new Error(label);}return r;}
(async () => {
  const { data: sis, error:e0 } = await s.from('oposiciones').select('*').eq('slug','auxiliar-administrativo-canarias').single();
  if(e0){console.log('❌ hermana',e0.message);return;}
  const row={...sis}; delete row.id; delete row.created_at;
  Object.assign(row,{
    nombre:'Administrativo del Gobierno de Canarias (Cuerpo Administrativo)', short_name:'Administrativo Canarias', slug:SLUG,
    categoria:'C1', grupo:'C', subgrupo:'C1', administracion:'autonomica', tipo_acceso:'libre',
    is_active:false, is_convocatoria_activa:true, temas_count:30, bloques_count:5,
    titulo_requerido:'Bachiller, Técnico o equivalente',
    diario_oficial:'BOC', diario_referencia:'BOC nº 57, de 24/03/2026 (convocatoria C111L26); temario BOC nº 16, 13/01/2026',
    programa_url:'https://www.gobiernodecanarias.org/boc/2026/016/232.html',
    seguimiento_url:'https://www.gobiernodecanarias.org/administracionespublicas/funcionpublica/acceso/convocatorias-en-curso/',
    estado_proceso:'inscripcion_cerrada',
    oep_decreto:'OEP 2023 (acum. 2024 y 2025)', oep_fecha:'2026-03-24',
    convocatoria_numero:'C111L26', convocatoria_fecha:'2026-03-24', convocatoria_dogv:'BOC nº 57, de 24/03/2026',
    plazas_libres:46, plazas_promocion_interna:0, plazas_discapacidad:11,
    exam_date:null, inscription_start:'2026-03-25', inscription_deadline:'2026-04-23',
    boe_publication_date:'2026-03-24', boe_reference:'BOC nº 57, de 24/03/2026 (Resolución 13/03/2026); temario BOC nº 16, 13/01/2026',
    color_primario:'cyan',
    seo_title:'Administrativo Gobierno de Canarias (C1) 2026 | 57 plazas | Vence',
    seo_description:'Prepara el Cuerpo Administrativo (C1) del Gobierno de Canarias: 57 plazas, 30 temas oficiales (BOC nº 16). Tests por tema con legislación literal y temario actualizado.',
    landing_description:'Cuerpo Administrativo (subgrupo C1) de la Administración Pública de la Comunidad Autónoma de Canarias. Convocatoria 2026 (BOC nº 57): 57 plazas (46 turno libre + 11 discapacidad).',
    landing_estadisticas:[
      {numero:'57',texto:'Plazas convocatoria 2026',color:'text-green-600'},
      {numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},
      {numero:'5',texto:'Bloques de materias',color:'text-purple-600'},
      {numero:'Bachiller',texto:'Título requerido',color:'text-orange-600'},
    ],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La convocatoria 2026 (BOC nº 57, código C111L26) oferta 57 plazas: 46 de turno libre y 11 reservadas a personas con discapacidad, acumulando las OEP 2023, 2024 y 2025.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La fecha la fija el tribunal; previsión a finales de 2026. El plazo de solicitudes se cerró el 23 de abril de 2026. Puedes prepararte para esta convocatoria y las siguientes.'},
      {pregunta:'¿Qué temario entra?',respuesta:'30 temas oficiales (BOC nº 16, de 13/01/2026): organización del Estado y de Canarias, la Unión Europea, régimen jurídico, transparencia, protección de datos, igualdad, acceso al empleo público y prevención de riesgos laborales.'},
      {pregunta:'¿Qué titulación necesito?',respuesta:'Título de Bachiller, Técnico (FP de grado medio) o equivalente. No se exige idioma (Canarias no tiene lengua cooficial).'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Oposición pura: un ejercicio combinado teórico y práctico tipo test sobre el temario.'},
    ],
    examen_config:{tipo:'test',penalizacion:'Según las bases de la convocatoria',total_preguntas:100,duracion_total_minutos:100,
      notas:'Según convocatoria 2026 (BOC nº 57). Oposición; ejercicio teórico-práctico tipo test.'},
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
  await chk('convocatorias',s.from('convocatorias').insert({oposicion_id:oid,'año':2026,is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:'OEP 2023-2025',oep_fecha:'2026-03-24',plazas_libres:46,plazas_discapacidad:11,boe_publication_date:'2026-03-24',boe_reference:'BOC nº 57, de 24/03/2026',programa_url:row.programa_url}));
  console.log('✅ convocatoria');
  await chk('hitos',s.from('convocatoria_hitos').insert([
    {oposicion_id:oid,fecha:'2026-03-24',titulo:'Convocatoria publicada (BOC nº 57)',descripcion:'Resolución de 13/03/2026 (código C111L26). 57 plazas (46 libre + 11 discapacidad) del Cuerpo Administrativo (C1).',url:'https://www.gobiernodecanarias.org/boc/2026/057/948.html',status:'completed',order_index:1},
    {oposicion_id:oid,fecha:'2026-04-23',titulo:'Cierre del plazo de inscripción',descripcion:null,url:null,status:'completed',order_index:2},
    {oposicion_id:oid,fecha:'2026-11-01',titulo:'Examen (previsión)',descripcion:'Fecha sin fijar; previsión finales de 2026. Ejercicio teórico-práctico tipo test.',url:null,status:'upcoming',order_index:3},
  ]));
  console.log('✅ hitos');
  console.log('\n🎉 FASE 2-3 Canarias C1 OK. oposicion_id='+oid);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
