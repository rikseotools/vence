require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_cuenca', SLUG='auxiliar-administrativo-diputacion-cuenca';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-cuenca.json');
const titles={
 1:'La Constitución Española: estructura, derechos y organización territorial',
 2:'La Administración Local y la Provincia: organización y órganos provinciales',
 3:'Ley 39/2015: ámbito, interesados, derechos y garantías del procedimiento',
 4:'Políticas de igualdad y contra la violencia de género',
 5:'Régimen local: TRRL (RD Leg 781/1986) y ROF (RD 2568/1986)',
 6:'Ley 39/2015 (I): disposiciones generales e interesados',
 7:'Ley 39/2015 (II): actividad de las AAPP y actos administrativos',
 8:'Ley 39/2015 (III): procedimiento, revisión y recursos',
 9:'Ley 40/2015 (I): Título Preliminar del Régimen Jurídico del Sector Público',
 10:'Ley 40/2015 (II): relaciones interadministrativas',
 11:'Ley 38/2003 General de Subvenciones',
 12:'EBEP (I): clases de personal, derechos, deberes y código de conducta',
 13:'EBEP (II): condición de funcionario, situaciones y régimen disciplinario',
 14:'Reglamento de Bienes de las Entidades Locales (RD 1372/1986)',
 15:'Contratos del Sector Público: tipos contractuales (Ley 9/2017)',
 16:'Haciendas Locales: tributos, tasas y precios públicos',
 17:'Haciendas Locales: los presupuestos y sus modificaciones',
 18:'Funcionamiento del sector público por medios electrónicos (RD 203/2021)',
 19:'Informática básica y el explorador de Windows 10',
 20:'Ofimática: Word, Outlook y Excel (Office 2021)',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',LBRL:'06784434-f549-4ea2-894f-e2e400881545',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LO1:'f5c17b23-2547-43d2-800c-39f5ea925c2f',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',SUBV:'09c18214-a630-4ae8-9f63-a742919f7f4c',RD203:'21e40a28-26c7-420d-99b8-39eb3059dd4f',TRRL:'73830f77-e083-4e2d-ab05-efe767840550',WIN10:'cb536623-fb75-429c-a839-0154b76ee27b',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',EXP10:'9a4d819f-50d6-421b-b3ea-d66d72b8524b',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,[...R(1,55),...R(137,158)])],
 2:[A(L.LBRL,R(31,38))],
 3:[A(L.L39,['1','2','3','4','5','13','53','54','55'])],
 4:[A(L.LO3,[...R(1,12),'51']),A(L.LO1,['1','2','17','18','19','20'])],
 6:[A(L.L39,R(1,12))],
 7:[A(L.L39,R(13,52))],
 8:[A(L.L39,[...R(54,105),...R(106,126)])],
 9:[A(L.L40,R(1,37))],
 10:[A(L.L40,R(140,158))],
 11:[A(L.SUBV,R(1,27))],
 12:[A(L.EBEP,R(8,54))],
 13:[A(L.EBEP,R(55,98))],
 15:[A(L.L9,R(12,27))],
 16:[A(L.TRLRHL,[...R(15,27),...R(41,47)])],
 17:[A(L.TRLRHL,R(162,177))],
 18:[A(L.RD203,R(1,66))],
 19:[F(L.WIN10),F(L.INFO),F(L.EXP10)],
 20:[F(L.WORD),F(L.EXCEL),F(L.OUTLOOK)],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=19?8:12,bloque_number:x.bloque,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert(t.bloques.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.titulo,icon:b.n===1?'🏛️':'⚖️',sort_order:b.n})));
  console.log('✅ 20 topics + 2 bloques');
  const examen_config={tipo:'oposición (2 ejercicios test)',penalizacion:'cada error -0,25 (1/4)',total_preguntas:100,opciones:4,duracion_total_minutos:120,partes:[{nombre:'1er ejercicio (test teórico)',preguntas:50,opciones:4,duracion_minutos:60,puntuacion_min:25},{nombre:'2º ejercicio (test práctico)',preguntas:50,opciones:4,duracion_minutos:60,puntuacion_min:25}],notas:'Oposición turno libre (sin concurso). Dos ejercicios test eliminatorios de máx. 50 preguntas (+5 reserva), 60 min cada uno: 1º teórico (Anexo I) y 2º práctico (funciones de la plaza). Cada error descuenta 0,25 (1/4); en blanco no penaliza. Mínimo 25/50 en cada uno. (BOP Cuenca nº13, 30/01/2026)'};
  const boe_ref='7 plazas Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2), turno libre, oposición. Bases BOP Cuenca nº13 de 30/01/2026; BOE-A-2026-5910 (13/03/2026)';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Cuenca',short_name:'Aux. Dip. Cuenca',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:2,
    plazas_libres:7,plazas_discapacidad:0,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Cuenca',diario_referencia:'BOP Cuenca nº13, 30/01/2026; BOE-A-2026-5910 (13/03/2026)',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-5910',
    seguimiento_url:'https://dipucuenca.convoca.online/',
    oep_decreto:'OEP Diputación Provincial de Cuenca',oep_fecha:'2026-01-30',convocatoria_numero:'BOE-A-2026-5910',convocatoria_fecha:'2026-03-13',convocatoria_dogv:null,
    color_primario:'red',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Cuenca 2026 | 7 plazas | Tests Vence',
    seo_description:'Prepara las 7 plazas de Auxiliar Administrativo de la Diputación de Cuenca (oposición turno libre). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 7 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Cuenca, turno libre por el sistema de oposición (bases BOP Cuenca nº13 de 30/01/2026; BOE-A-2026-5910). Temario de 20 temas: Constitución, Administración Local y provincia, Ley 39/2015, Ley 40/2015, régimen local (TRRL, ROF, Reglamento de Bienes), subvenciones, EBEP, contratos, haciendas locales y presupuestos, administración electrónica e informática (Windows 10 y Office 2021). Dos ejercicios tipo test (teórico y práctico).',
    examen_config,
    landing_estadisticas:[{numero:'7',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'100',texto:'Preguntas (2 ejercicios)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'7 plazas de Auxiliar Administrativo (grupo C2, Escala Administración General, Subescala Auxiliar) por turno libre y sistema de oposición, de la Diputación Provincial de Cuenca.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición con dos ejercicios tipo test obligatorios y eliminatorios, de máximo 50 preguntas y 60 minutos cada uno: el primero teórico y el segundo práctico. Cada respuesta incorrecta descuenta 0,25 del valor de un acierto y las no contestadas no penalizan. Hay que sacar al menos 25/50 en cada ejercicio.'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución, Administración Local y la provincia, Ley 39/2015, Ley 40/2015, régimen local (TRRL, ROF y Reglamento de Bienes de las EELL), Ley General de Subvenciones, EBEP, contratos del sector público, haciendas locales y presupuestos, administración electrónica (RD 203/2021) e informática (Windows 10 y Office 2021: Word, Outlook y Excel).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO, Graduado Escolar o Bachiller Elemental, y los requisitos generales de acceso al empleo público. Derechos de examen: 9,00 €.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes cerró en abril de 2026. La fecha del primer ejercicio se publicará con la lista de admitidos, por lo que todavía no hay fecha. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office 2021 (Word, Outlook, Excel) y Windows 10'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Cuenca');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2026,convocatoria_numero:'BOE-A-2026-5910',convocatoria_fecha:'2026-03-13',convocatoria_dogv:'BOP Cuenca nº13, 30/01/2026',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:7,plazas_discapacidad:0,plazas_promocion_interna:0,boe_publication_date:'2026-03-13',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2026-03-13',titulo:'Convocatoria publicada en el BOE',descripcion:'7 plazas de Auxiliar Administrativo (C2) de la Diputación de Cuenca, turno libre. Bases en BOP Cuenca nº13 de 30/01/2026; extracto BOE-A-2026-5910.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-5910',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=20;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (contenido pendiente: T5 ROF / T14 Bienes) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
