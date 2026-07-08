require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_huesca', SLUG='auxiliar-administrativo-diputacion-huesca';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-huesca.json');
const titles={
 1:'La Constitución Española: estructura, Corona, Cortes y Poder Judicial',
 2:'El Estatuto de Autonomía de Aragón y la organización institucional',
 3:'El Derecho administrativo: concepto y fuentes',
 4:'El procedimiento administrativo y el acto administrativo',
 5:'La invalidez del acto administrativo y la revisión de oficio',
 6:'Comunicaciones y notificaciones. La notificación electrónica',
 7:'Recursos administrativos y jurisdiccionales',
 8:'Las entidades locales: clases, competencias y régimen jurídico',
 9:'La provincia y la organización provincial',
 10:'Las competencias de las Diputaciones Provinciales',
 11:'Registro electrónico, atención al público y oficinas de asistencia',
 12:'La contratación pública',
 13:'Haciendas Locales: ingresos y tributos locales',
 14:'Recaudación de los ingresos locales y procedimiento de apremio',
 15:'Los presupuestos locales y el gasto público local',
 16:'Las subvenciones (Ley 38/2003 y Ley de Subvenciones de Aragón)',
 17:'Transparencia, protección de datos e igualdad en Aragón',
 18:'El empleo público local: derechos y deberes',
 19:'El archivo, los documentos y el expediente administrativo',
 20:'Windows, navegadores de internet y correo electrónico (Thunderbird)',
 21:'Protección de datos personales (RGPD y LO 3/2018)',
 22:'Ofimática: la suite LibreOffice (Writer, Calc, Draw y Base)',
 23:'Seguridad informática: ENS, malware e INCIBE',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',ARA:'69416d9c-e8f4-44ad-8ac9-82a935cf2f21',FUENTES:'337f6d97-396d-4e35-9b93-5ea098f0117b',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LBRL:'06784434-f549-4ea2-894f-e2e400881545',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',SUBV:'09c18214-a630-4ae8-9f63-a742919f7f4c',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',IGARA:'328ec4d2-2d0e-404a-9c70-d10878cb7351',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',WIN10:'cb536623-fb75-429c-a839-0154b76ee27b',NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',LOW:'acb70f43-1114-476d-87fd-191d49c30f93',LOC:'a9767d5d-f7a2-4b19-9508-d2296f6b5f07',LOI:'7b463972-72e5-4fdc-808e-a131f81fe702',LOB:'9cf4c64e-58a5-456b-98f8-0150a1ac459c',SEG:'b603177f-bf78-4028-882e-bd41e0322462'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,[...R(1,65),...R(117,127),...R(159,165)])],
 2:[A(L.ARA,R(1,40))],
 3:[F(L.FUENTES)],
 4:[A(L.L39,[...R(34,39),...R(53,105)])],
 5:[A(L.L39,[...R(47,52),...R(106,111)])],
 6:[A(L.L39,R(40,46)),A(L.L40,R(38,46))],
 7:[A(L.L39,R(112,126))],
 8:[A(L.LBRL,R(1,10))],
 9:[A(L.LBRL,R(31,35))],
 10:[A(L.LBRL,['36'])],
 11:[A(L.L39,['13','14','16','53','66'])],
 12:[A(L.L9,R(12,27))],
 13:[A(L.TRLRHL,[...R(2,9),...R(15,27)])],
 14:[A(L.TRLRHL,['10','11','12','62','160','161','165','167'])],
 15:[A(L.TRLRHL,R(162,171))],
 16:[A(L.SUBV,R(1,37))],
 17:[A(L.L19,R(1,12)),A(L.LOPD,R(4,10)),A(L.IGARA,R(1,20))],
 18:[A(L.EBEP,[...R(8,15),...R(52,54)])],
 19:[A(L.L39,['16','17','26','27','28'])],
 20:[F(L.WIN10),F(L.NET),F(L.INFO)],
 21:[A(L.LOPD,R(1,30))],
 22:[F(L.LOW),F(L.LOC),F(L.LOI),F(L.LOB)],
 23:[F(L.SEG)],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=20?8:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (23 temas)',icon:'🏛️',sort_order:1});
  console.log('✅ 23 topics + 1 bloque');
  const examen_config={tipo:'oposición (2 ejercicios test)',penalizacion:'cada error -1/3',total_preguntas:130,opciones:4,duracion_total_minutos:170,partes:[{nombre:'1er ejercicio (test teórico)',preguntas:100,opciones:4,duracion_minutos:120,puntuacion_max:50},{nombre:'2º ejercicio (test práctico)',preguntas:30,opciones:4,duracion_minutos:50,puntuacion_max:50}],notas:'Oposición turno libre, dos ejercicios test el mismo día. 1º teórico (100 preg +10 reserva, 2h), 2º práctico (30 preg +5 reserva, 50 min); 4 opciones, cada error resta 1/3, en blanco no puntúa. Triple umbral de aprobado fijado por el tribunal. Examen previsto 26/09/2026. (BOA nº158, 18/08/2025)'};
  const boe_ref='2 plazas Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2), turno libre, oposición. OEP 2025. Bases BOP Huesca nº150 de 12/08/2025 (BOA nº158); BOE-A-2025-17322. Examen 26/09/2026.';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación Provincial de Huesca',short_name:'Aux. Dip. Huesca',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:23,bloques_count:1,
    plazas_libres:2,plazas_discapacidad:0,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:'2026-09-26',exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Huesca / BOA',diario_referencia:'BOP Huesca nº150, 12/08/2025 (BOA nº158); BOE-A-2025-17322',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-17322',
    seguimiento_url:'https://www.dphuesca.es/convocatoriaempleo',
    oep_decreto:'OEP 2025 (Diputación Provincial de Huesca, Decreto 1244 de 21/03/2025)',oep_fecha:'2025-08-12',convocatoria_numero:'BOE-A-2025-17322',convocatoria_fecha:'2025-08-29',convocatoria_dogv:null,
    color_primario:'cyan',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Huesca 2026 | Tests Vence',
    seo_description:'Prepara las 2 plazas de Auxiliar Administrativo de la Diputación de Huesca (oposición, examen 26/09/2026). Tests del temario oficial (23 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 2 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) de la Diputación Provincial de Huesca, turno libre por el sistema de oposición (OEP 2025; bases BOP Huesca nº150 de 12/08/2025; examen previsto el 26/09/2026). Temario de 23 temas: Constitución, Estatuto de Autonomía de Aragón, Derecho administrativo y Ley 39/2015, régimen local (provincia y diputaciones), contratación, haciendas y presupuestos locales, subvenciones (estatal y de Aragón), transparencia, empleo público, protección de datos y ofimática (Windows, Thunderbird, LibreOffice y seguridad informática). Dos ejercicios tipo test.',
    examen_config,
    landing_estadisticas:[{numero:'2',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'130',texto:'Preguntas (2 ejercicios)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'2 plazas de Auxiliar Administrativo (grupo C2, Escala Administración General, Subescala Auxiliar) por turno libre y sistema de oposición, de la OEP 2025 de la Diputación Provincial de Huesca.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición con dos ejercicios tipo test el mismo día: el primero teórico (100 preguntas, 2 horas) y el segundo práctico (30 preguntas, 50 minutos), ambos con 4 opciones. Cada error resta 1/3 del valor de un acierto y las no contestadas no puntúan. El tribunal fija la nota de corte. El examen está previsto para el 26 de septiembre de 2026.'},
      {pregunta:'¿Qué temario entra?',respuesta:'23 temas: Constitución, Estatuto de Autonomía de Aragón, Derecho administrativo y Ley 39/2015, régimen local (entidades locales, provincia y diputaciones), contratación pública, haciendas locales (ingresos, recaudación, presupuestos), subvenciones (estatal y de Aragón), transparencia, protección de datos, igualdad en Aragón, empleo público local, archivo y documentos, e informática (Windows, navegadores, Thunderbird, LibreOffice y seguridad informática).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público. La tasa de examen fue de 8,00 €.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El primer ejercicio está previsto para el 26 de septiembre de 2026. El plazo de solicitudes ya cerró y la lista de admitidos está publicada.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'LibreOffice (Writer, Calc, Draw, Base), Windows y Thunderbird'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Huesca');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'BOE-A-2025-17322',convocatoria_fecha:'2025-08-29',convocatoria_dogv:'BOP Huesca nº150, 12/08/2025 (BOA nº158)',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:2,plazas_discapacidad:0,plazas_promocion_interna:0,boe_publication_date:'2025-08-29',boe_reference:o.boe_reference,exam_date:'2026-09-26',exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert([
    {oposicion_id:o.id,fecha:'2025-08-12',titulo:'Convocatoria publicada',descripcion:'2 plazas de Auxiliar Administrativo (C2) de la Diputación de Huesca, turno libre. Bases en BOP Huesca nº150 (BOA nº158); extracto BOE-A-2025-17322.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-17322',status:'completed',order_index:1},
    {oposicion_id:o.id,fecha:'2026-09-26',titulo:'Primer ejercicio (examen)',descripcion:'Fecha prevista del primer ejercicio de la oposición de Auxiliar Administrativo de la Diputación de Huesca.',url:'https://www.dphuesca.es/convocatoriaempleo',status:'upcoming',order_index:2}
  ]);
  console.log('✅ §2c + hitos');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope');
  for(let n=1;n<=23;n++){
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
