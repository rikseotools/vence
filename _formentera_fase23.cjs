require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_consell_formentera', SLUG='auxiliar-administrativo-consell-formentera';
const t=require('./data/temarios/auxiliar-administrativo-consell-formentera.json');
const titles={
 1:'La Constitución Española (I): derechos, deberes y principios de la Administración',
 2:'La Constitución Española (II): reforma, TC, poder judicial y órganos constitucionales',
 3:'El Estatuto de Autonomía de las Illes Balears',
 4:'Los Consells Insulars y el régimen especial de Formentera',
 5:'El Consell Insular de Formentera: naturaleza, organización y Reglamento Orgánico',
 6:'La Unión Europea: tratados, instituciones y fuentes',
 7:'Prevención de Riesgos Laborales (Ley 31/1995)',
 8:'Igualdad y violencia de género: normativa estatal y autonómica',
 9:'Las fuentes del Derecho Administrativo',
 10:'Ley 39/2015 (I): objeto, ámbito y derechos de la ciudadanía',
 11:'Ley 39/2015 (II): el acto administrativo, validez y eficacia',
 12:'Ley 39/2015 (III): fases del procedimiento y silencio administrativo',
 13:'Ley 39/2015 (IV): términos, plazos y notificación',
 14:'Ley 40/2015 (I): principios, funcionamiento y órganos colegiados',
 15:'Ley 40/2015 (II): relaciones interadministrativas y convenios',
 16:'Sede electrónica, transparencia y publicidad activa',
 17:'La función pública local y el régimen del personal',
 18:'Atención a la ciudadanía y oficinas de asistencia en materia de registro',
 19:'Protección de datos de carácter personal',
 20:'Los recursos administrativos',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LO1:'f5c17b23-2547-43d2-800c-39f5ea925c2f',FUENTES:'337f6d97-396d-4e35-9b93-5ea098f0117b',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,[...R(1,55),...R(103,107)])],
 2:[A(L.CE,['54','136',...R(117,127),...R(159,169)])],
 6:[A(L.TUE,R(1,55)),A(L.TFUE,['1','2','3','4','5'])],
 7:[A(L.LPRL,R(1,54))],
 8:[A(L.LO3,R(1,78)),A(L.LO1,R(1,30))],
 9:[F(L.FUENTES)],
 10:[A(L.L39,['1','2',...R(13,33)])],
 11:[A(L.L39,R(34,52))],
 12:[A(L.L39,R(53,105))],
 13:[A(L.L39,[...R(29,33),...R(40,46)])],
 14:[A(L.L40,R(1,22))],
 15:[A(L.L40,[...R(47,53),...R(140,142)])],
 16:[A(L.L19,R(1,12)),A(L.L40,R(38,46))],
 17:[A(L.EBEP,R(1,98))],
 18:[A(L.L39,['13','14','16','53','66'])],
 19:[A(L.LOPD,R(1,30))],
 20:[A(L.L39,R(112,126))],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:12,bloque_number:x.bloque,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert(t.bloques.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.titulo,icon:b.n===1?'🏛️':'⚖️',sort_order:b.n})));
  console.log('✅ 20 topics + 2 bloques');
  const examen_config={tipo:'concurso-oposición (2 pruebas)',penalizacion:'cada 3 erróneas = -1 acierto (error -1/3)',total_preguntas:40,opciones:4,duracion_total_minutos:75,partes:[{nombre:'Prueba teórica (test)',preguntas:40,opciones:4,duracion_minutos:75,puntuacion_min:15,puntuacion_max:30},{nombre:'Prueba práctica',duracion_minutos:180,puntuacion_min:15,puntuacion_max:30}],notas:'Concurso-oposición (oposición 60% / concurso 40%). Prueba 1: test de 40 preguntas (16 generales + 24 específicas, +10% reserva), 4 opciones, 75 min; cada 3 erróneas restan un acierto (1/3), en blanco no penaliza; mínimo 15/30. Prueba 2: práctica (tratamiento de textos, psicotécnicos, supuestos), 180 min, mínimo 15/30. Catalán B2 es requisito de acceso. (BOIB nº160, 04/12/2025)'};
  const boe_ref='24 plazas Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2), turno libre, concurso-oposición. OPE Extraordinaria 2024. Bases BOIB nº160 de 04/12/2025; BOE-A-2025-25460 (12/12/2025). Requisito catalán B2.';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo del Consell Insular de Formentera',short_name:'Aux. Admin. Formentera',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:20,bloques_count:2,
    plazas_libres:24,plazas_discapacidad:0,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOIB',diario_referencia:'BOIB nº160, 04/12/2025; BOE-A-2025-25460 (12/12/2025)',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-25460',
    seguimiento_url:'https://www.consellinsulardeformentera.cat/index.php?option=com_content&view=article&id=10780&lang=es',
    oep_decreto:'OPE Extraordinaria 2024 (Consell Insular de Formentera)',oep_fecha:'2025-12-04',convocatoria_numero:'BOE-A-2025-25460',convocatoria_fecha:'2025-12-12',convocatoria_dogv:null,
    color_primario:'blue',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Consell de Formentera 2026 | 24 plazas | Tests Vence',
    seo_description:'Prepara las 24 plazas de Auxiliar Administrativo del Consell Insular de Formentera (OPE 2024). Tests del temario oficial (20 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 24 plazas de Auxiliar Administrativo (Escala Administración General, Subescala Auxiliar, C2) del Consell Insular de Formentera, turno libre por concurso-oposición (oposición 60% / concurso 40%), OPE Extraordinaria 2024 (BOIB nº160 de 04/12/2025). Temario de 20 temas: Constitución, Estatuto de Autonomía de las Illes Balears, los Consells Insulars y el Consell de Formentera, Unión Europea, prevención de riesgos, igualdad, Ley 39/2015, Ley 40/2015, función pública local, transparencia, protección de datos y recursos. Examen tipo test de 40 preguntas más prueba práctica. Requiere catalán nivel B2.',
    examen_config,
    landing_estadisticas:[{numero:'24',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'40',texto:'Preguntas (test)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'24 plazas de Auxiliar Administrativo (grupo C2, Escala Administración General, Subescala Auxiliar) por turno libre, de la OPE Extraordinaria 2024 del Consell Insular de Formentera.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Concurso-oposición (oposición 60% / concurso 40%). La fase de oposición son dos pruebas eliminatorias: un test de 40 preguntas con 4 opciones (16 generales + 24 específicas, 75 minutos) donde cada 3 respuestas erróneas restan un acierto, y una prueba práctica (tratamiento de textos, psicotécnicos o supuestos). Hay que sacar al menos 15/30 en cada prueba.'},
      {pregunta:'¿Qué temario entra?',respuesta:'20 temas: Constitución, Estatuto de Autonomía de las Illes Balears, los Consells Insulars y el Consell de Formentera, Unión Europea, prevención de riesgos laborales, igualdad y violencia de género, fuentes del Derecho, Ley 39/2015, Ley 40/2015, transparencia y sede electrónica, función pública local, protección de datos y recursos administrativos.'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente, acreditar el nivel B2 de catalán y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes ya cerró. La fecha, hora y lugar del primer ejercicio se publicarán en el BOIB junto con la lista definitiva de admitidos, por lo que todavía no hay fecha. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'idioma',descripcion:'Catalán nivel B2 (requisito de acceso)'},{tipo:'ofimatica',descripcion:'Prueba práctica con tratamiento de textos'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Formentera');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'BOE-A-2025-25460',convocatoria_fecha:'2025-12-12',convocatoria_dogv:'BOIB nº160, 04/12/2025',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:24,plazas_discapacidad:0,plazas_promocion_interna:0,boe_publication_date:'2025-12-12',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2025-12-12',titulo:'Convocatoria publicada en el BOE',descripcion:'24 plazas de Auxiliar Administrativo (C2) del Consell Insular de Formentera (OPE Extraordinaria 2024). Bases en BOIB nº160 de 04/12/2025; extracto BOE-A-2025-25460.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-25460',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=20;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (contenido pendiente) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
