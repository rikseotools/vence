require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_diputacion_huelva', SLUG='auxiliar-administrativo-diputacion-huelva';
const t=require('./data/temarios/auxiliar-administrativo-diputacion-huelva.json');
const titles={
 1:'La Constitución Española: derechos y deberes fundamentales',2:'Relaciones de las entidades locales con otras administraciones',3:'El sometimiento a la ley y las fuentes del Derecho administrativo',4:'Los derechos del ciudadano ante la Administración',5:'El acto administrativo: validez, eficacia y nulidad',6:'El registro de documentos, días hábiles y cómputo de plazos',7:'El procedimiento administrativo común y el silencio',8:'Los recursos administrativos y la revisión de oficio',9:'El municipio: organización y competencias',10:'La provincia: organización y competencias',11:'El funcionamiento de los órganos colegiados locales',12:'Ordenanzas y reglamentos de las entidades locales',13:'Los bienes de las entidades locales',14:'El personal al servicio de la Administración local',15:'El presupuesto general de las entidades locales',16:'Ofimática: LibreOffice Calc',17:'Ofimática: LibreOffice Writer',18:'La igualdad de género: marco jurídico',19:'La Corporación Provincial de la Diputación de Huelva',20:'Prevención de riesgos laborales: derechos y deberes',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',LBRL:'06784434-f549-4ea2-894f-e2e400881545',L40:'95680d57-feb1-41c0-bb27-236024815feb',FUENTES:'337f6d97-396d-4e35-9b93-5ea098f0117b',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',ROF:'79de036c-e4aa-44a5-b3fc-4b0307fb0a34',BIENES:'624256f5-bc8b-4a10-88e2-cf78d7ce2625',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',LOC:'a9767d5d-f7a2-4b19-9508-d2296f6b5f07',LOW:'acb70f43-1114-476d-87fd-191d49c30f93',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,R(1,55))],
 2:[A(L.LBRL,[...R(55,62)]),A(L.L40,R(140,145))],
 3:[F(L.FUENTES)],
 4:[A(L.L39,R(3,13))],
 5:[A(L.L39,R(34,52))],
 6:[A(L.L39,['16',...R(28,33)])],
 7:[A(L.L39,R(53,105))],
 8:[A(L.L39,[...R(106,111),...R(112,126)])],
 9:[A(L.LBRL,[...R(11,21),'25','26'])],
 10:[A(L.LBRL,R(31,38))],
 11:[F(L.ROF)],
 12:[A(L.LBRL,['4','22','49','70'])],
 13:[F(L.BIENES)],
 14:[A(L.EBEP,[...R(8,15),...R(55,63),...R(85,90)])],
 15:[A(L.TRLRHL,R(162,171))],
 16:[F(L.LOC)],17:[F(L.LOW)],
 18:[A(L.LO3,R(1,12))],
 19:[A(L.LBRL,R(31,38)),F(L.ROF)],
 20:[A(L.LPRL,R(1,16))],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=16&&x.n<=17?8:12,bloque_number:x.bloque,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert(t.bloques.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.titulo,icon:b.n===1?'🏛️':'⚖️',sort_order:b.n})));
  console.log('✅ 20 topics + 2 bloques');
  const examen_config={tipo:'oposición (2 ejercicios, no test)',penalizacion:'no aplica (preguntas cortas + supuesto práctico)',total_preguntas:25,opciones:null,duracion_total_minutos:180,partes:[{nombre:'1er ejercicio (25 preguntas cortas)',duracion_minutos:180,puntuacion_min:5},{nombre:'2º ejercicio (supuesto práctico)',duracion_minutos:180,puntuacion_min:5}],notas:'Oposición turno libre. Temario y estructura de la convocatoria 2024 (BOP Huelva nº129). 1er ejercicio: 25 preguntas cortas a desarrollar (3h, mín 5/10). 2º ejercicio: supuesto práctico con medios informáticos (3h, mín 5/10). NO es tipo test. (Base para la OEP 2025.)'};
  const boe_ref='~3 plazas Auxiliar de Administración General (C2) turno libre, oposición. OEP 2025 (Diputación de Huelva), bases pendientes. Temario de la convocatoria 2024 (BOP Huelva nº129, 11 plazas; BOE-A-2024-19866).';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Diputación de Huelva',short_name:'Aux. Dip. Huelva',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:2,
    plazas_libres:3,plazas_discapacidad:2,plazas_promocion_interna:0,estado_proceso:'oep_aprobada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOP Huelva',diario_referencia:'OEP 2025 (BOP Huelva 25/11/2025). Temario: BOP Huelva nº129, 03/07/2024 (BOE-A-2024-19866)',
    programa_url:'https://www.diphuelva.es/export/sites/dph/empleopublico/.galleries/4-BASES-ESPECIFICAS-AUXILIAR-ADMON.-GENERAL.pdf',
    seguimiento_url:'https://www.diphuelva.es/empleopublico',
    oep_decreto:'OEP 2025 (Diputación Provincial de Huelva)',oep_fecha:'2025-11-25',convocatoria_numero:'OEP-HUELVA-2025',convocatoria_fecha:'2025-11-25',convocatoria_dogv:null,
    color_primario:'orange',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Diputación de Huelva | Tests Vence',
    seo_description:'Prepara la oposición de Auxiliar Administrativo de la Diputación de Huelva (C2, OEP 2025). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a Auxiliar de Administración General (Subescala Auxiliar, C2) de la Diputación de Huelva, turno libre por el sistema de oposición (OEP 2025; bases pendientes de convocar). El temario (20 temas) corresponde a la última convocatoria equivalente (2024, BOP Huelva nº129, 11 plazas): Constitución, régimen local (municipio, provincia, órganos colegiados, bienes, ordenanzas), Ley 39/2015 y Ley 40/2015, función pública local, presupuestos, igualdad de género, prevención de riesgos y ofimática (LibreOffice Calc y Writer). Dos ejercicios: preguntas cortas y supuesto práctico.',
    examen_config,
    landing_estadisticas:[{numero:'~3',texto:'Plazas (OEP 2025)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'25',texto:'Preguntas (1er ejercicio)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'La OEP 2025 de la Diputación de Huelva incluye plazas de Auxiliar de Administración General (C2) por turno libre (en torno a 3 del cupo general, más cupos de discapacidad). Las bases están pendientes de convocar; preparándote ahora llegarás con ventaja.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Sistema de oposición. Según la última convocatoria equivalente (2024), son dos ejercicios eliminatorios: un ejercicio teórico de 25 preguntas cortas a desarrollar (3 horas) y un supuesto práctico (3 horas, con medios informáticos). No es tipo test. Hay que sacar al menos 5/10 en cada uno. La nueva convocatoria podría ajustar estos detalles.'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución, relaciones interadministrativas, fuentes del Derecho, derechos del ciudadano, acto y procedimiento administrativo (Ley 39/2015), recursos, régimen local (municipio, provincia, órganos colegiados, ordenanzas, bienes), función pública local, presupuestos, igualdad de género, prevención de riesgos y ofimática (LibreOffice Calc y Writer).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'La convocatoria de las plazas de Auxiliar de la OEP 2025 aún no se ha publicado. Es buen momento para ir preparando el temario, que se basa en la convocatoria anterior de la Diputación (2024).'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'LibreOffice (Calc y Writer) — ejercicio práctico'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Huelva (Diputación)');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'OEP-HUELVA-2025',convocatoria_fecha:'2025-11-25',convocatoria_dogv:'OEP 2025; temario BOP Huelva nº129 03/07/2024',is_current:true,estado_proceso:'oep_aprobada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:3,plazas_discapacidad:2,plazas_promocion_interna:0,boe_publication_date:'2025-11-25',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2025-11-25',titulo:'OEP 2025 aprobada',descripcion:'La OEP 2025 de la Diputación de Huelva incluye plazas de Auxiliar de Administración General (C2) turno libre. BOP Huelva 25/11/2025. Bases pendientes de convocar.',url:'https://www.diphuelva.es/empleopublico',status:'completed',order_index:1});
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
