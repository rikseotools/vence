require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_zamora', SLUG='auxiliar-administrativo-diputacion-zamora';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-zamora.json');
const titles={
 1:'La Constitución, el Estatuto de Castilla y León y el régimen local',
 2:'Ley 39/2015, Ley 40/2015 y recursos de las haciendas locales',
 3:'La Función Pública Local: derechos y deberes',
 4:'Políticas de igualdad y contra la violencia de género',
 5:'El procedimiento administrativo: fases y procedimiento electrónico',
 6:'El acto administrativo: elementos, eficacia, nulidad y anulabilidad',
 7:'Los recursos administrativos',
 8:'Los contratos de las Administraciones Públicas',
 9:'El documento administrativo, el expediente y los archivos',
 10:'Información y atención al ciudadano. El registro de documentos',
 11:'El régimen local: la provincia, organización y competencias',
 12:'El municipio: organización, término, población y padrón',
 13:'Régimen de sesiones y acuerdos de los órganos colegiados locales',
 14:'El personal al servicio de las entidades locales',
 15:'El presupuesto general de las entidades locales',
 16:'Recursos de las entidades locales: impuestos, tasas y precios públicos',
 17:'Informática básica y el explorador de Windows',
 18:'Ofimática: Word (Office 365/2016)',
 19:'Ofimática: Excel (Office 365/2016)',
 20:'Ofimática: Outlook 365',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',ECYL:'383d7ceb-0c2f-4e69-a699-40a7e1f762de',LBRL:'06784434-f549-4ea2-894f-e2e400881545',TRRL:'73830f77-e083-4e2d-ab05-efe767840550',ROF:'79de036c-e4aa-44a5-b3fc-4b0307fb0a34',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LO1:'f5c17b23-2547-43d2-800c-39f5ea925c2f',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',WIN10:'cb536623-fb75-429c-a839-0154b76ee27b',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',EXP10:'9a4d819f-50d6-421b-b3ea-d66d72b8524b',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,[...R(1,65),...R(137,158)]),A(L.ECYL,R(1,30)),A(L.LBRL,R(31,38))],
 2:[A(L.L39,R(34,52)),A(L.L40,R(5,22)),A(L.TRLRHL,[...R(20,27),...R(41,47)])],
 3:[A(L.EBEP,[...R(8,15),...R(52,54)])],
 4:[A(L.LO3,R(1,12)),A(L.LO1,['1','2','17','18','19','20'])],
 5:[A(L.L39,R(53,105))],
 6:[A(L.L39,R(34,52))],
 7:[A(L.L39,R(112,126))],
 8:[A(L.L9,R(12,27))],
 9:[A(L.L39,['16','17','26','27','28','53'])],
 10:[A(L.L39,['13','14','16','53','66'])],
 11:[A(L.LBRL,R(31,38)),A(L.TRRL,R(1,31))],
 12:[A(L.LBRL,[...R(11,21),'25','26'])],
 13:[F(L.ROF)],
 14:[A(L.EBEP,[...R(8,15),...R(89,98)])],
 15:[A(L.TRLRHL,R(162,171))],
 16:[A(L.TRLRHL,[...R(15,27),...R(41,47),'59','60'])],
 17:[F(L.WIN10),F(L.INFO),F(L.EXP10)],
 18:[F(L.WORD)],19:[F(L.EXCEL)],20:[F(L.OUTLOOK)],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=17?8:12,bloque_number:x.bloque,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert(t.bloques.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.titulo,icon:b.n===1?'🏛️':'⚖️',sort_order:b.n})));
  console.log('✅ 20 topics + 2 bloques');
  const examen_config={tipo:'oposición (2 ejercicios)',penalizacion:'cada error -1/4',total_preguntas:70,opciones:4,duracion_total_minutos:100,partes:[{nombre:'1er ejercicio (test)',preguntas:70,opciones:4,duracion_minutos:100,puntuacion_max:10},{nombre:'2º ejercicio (supuesto práctico)',duracion_minutos:90,puntuacion_min:5,puntuacion_max:10}],notas:'Oposición turno libre. 1er ejercicio: test de 70 preguntas (100 min), 4 opciones; cada error resta 1/4, en blanco no penaliza; mínimo el que fije el tribunal (≥40%). 2º ejercicio: supuesto práctico (1 de 2) sobre la parte específica (90 min), mínimo 5/10. (BOP Zamora nº23, 26/02/2025)'};
  const boe_ref='3 plazas Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) turno libre (1 reserva discapacidad), oposición. Bases BOP Zamora nº23 de 26/02/2025; BOE-A-2025-4955 (13/03/2025). OEP 2023.';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Zamora',short_name:'Aux. Dip. Zamora',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:2,
    plazas_libres:2,plazas_discapacidad:1,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Zamora',diario_referencia:'BOP Zamora nº23, 26/02/2025; BOE-A-2025-4955 (13/03/2025)',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-4955',
    seguimiento_url:'https://www.diputaciondezamora.es',
    oep_decreto:'OEP 2023 (Diputación Provincial de Zamora)',oep_fecha:'2025-02-26',convocatoria_numero:'BOE-A-2025-4955',convocatoria_fecha:'2025-03-13',convocatoria_dogv:null,
    color_primario:'yellow',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Zamora 2026 | Tests Vence',
    seo_description:'Prepara las plazas de Auxiliar Administrativo de la Diputación de Zamora (oposición turno libre, OEP 2023). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 3 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Zamora, turno libre por el sistema de oposición (bases BOP Zamora nº23 de 26/02/2025; BOE-A-2025-4955; OEP 2023). Temario de 20 temas: Constitución y Estatuto de Castilla y León, régimen local (provincia, municipio, sesiones), Ley 39/2015, Ley 40/2015, contratos, función pública local, haciendas y presupuestos locales, igualdad y violencia de género, y ofimática (Windows, Word, Excel y Outlook). Dos ejercicios: test de 70 preguntas y supuesto práctico.',
    examen_config,
    landing_estadisticas:[{numero:'3',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'70',texto:'Preguntas (1er ejercicio)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'3 plazas de Auxiliar Administrativo (grupo C2, Escala Administración General, Subescala Auxiliar) por turno libre, una de ellas reservada al cupo de discapacidad, de la OEP 2023 de la Diputación Provincial de Zamora.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición con dos ejercicios eliminatorios: un test de 70 preguntas con 4 opciones (100 minutos), donde cada error resta 1/4 del valor de un acierto y las no contestadas no penalizan; y un supuesto práctico a elegir entre dos (90 minutos, mínimo 5/10).'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución y Estatuto de Autonomía de Castilla y León, régimen local (provincia, municipio, sesiones y acuerdos), Ley 39/2015, Ley 40/2015, recursos administrativos, contratos, documentos y archivos, atención al ciudadano, función pública local, presupuestos y haciendas locales, igualdad y violencia de género, e informática y ofimática (Windows, Word, Excel y Outlook).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en Educación Secundaria Obligatoria o equivalente y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes ya cerró. La fecha del primer ejercicio se publicará con la lista de admitidos, por lo que todavía no hay fecha. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office 365/2016 (Word, Excel, Outlook) y Windows'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Zamora');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'BOE-A-2025-4955',convocatoria_fecha:'2025-03-13',convocatoria_dogv:'BOP Zamora nº23, 26/02/2025',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:2,plazas_discapacidad:1,plazas_promocion_interna:0,boe_publication_date:'2025-03-13',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2025-03-13',titulo:'Convocatoria publicada en el BOE',descripcion:'3 plazas de Auxiliar Administrativo (C2) de la Diputación de Zamora, turno libre. Bases en BOP Zamora nº23 de 26/02/2025; extracto BOE-A-2025-4955.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-4955',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope');
  for(let n=1;n<=20;n++){
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
