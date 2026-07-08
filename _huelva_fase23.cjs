require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_universidad_huelva', SLUG='auxiliar-administrativo-universidad-huelva';
const t=require('./data/temarios/auxiliar-administrativo-universidad-huelva.json');
const titles={
 1:'La Constitución Española de 1978: Título Preliminar, Título I y Título IV',
 2:'Ley 39/2015 (I): disposiciones generales, interesados y plazos',
 3:'Ley 39/2015 (II): el procedimiento administrativo común',
 4:'Ley 39/2015 (III): los recursos administrativos',
 5:'Ley 40/2015: Título Preliminar del Régimen Jurídico del Sector Público',
 6:'El Estatuto Básico del Empleado Público (EBEP)',
 7:'Protección de Datos: principios y derechos (LO 3/2018)',
 8:'Transparencia y acceso a la información pública (Ley 19/2013)',
 9:'Igualdad de género en Andalucía (Ley 12/2007)',
 10:'Ley Orgánica del Sistema Universitario (LOSU)',
 11:'Los Estatutos de la Universidad de Huelva',
 12:'Organización de las enseñanzas universitarias (RD 822/2021)',
 13:'Información general de la Universidad de Huelva',
 14:'Bases de ejecución presupuestaria de la Universidad de Huelva',
 15:'Reglamento de permanencia y progreso en Grado y Máster de la UHU',
 16:'Ofimática: Microsoft 365 Word',
 17:'Ofimática: Microsoft 365 Excel',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',IGA:'1c53e192-9db1-4e83-a6d7-53ef6b2ebc33',LOSU:'c3f0e748-1c23-4564-bc34-fbe79f1b1a67',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.CE,[...R(1,55),...R(97,107)])],
 2:[A(L.L39,R(1,33))],
 3:[A(L.L39,R(54,95))],
 4:[A(L.L39,R(112,126))],
 5:[A(L.L40,[...R(1,22),...R(38,46)])],
 6:[A(L.EBEP,R(1,54))],
 7:[A(L.LOPD,R(1,30))],
 8:[A(L.L19,[...R(5,8),...R(12,24)])],
 9:[A(L.IGA,R(1,40))],
 10:[A(L.LOSU,R(1,100))],
 16:[F(L.WORD)],17:[F(L.EXCEL)],
};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=16?8:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (17 temas)',icon:'🎓',sort_order:1});
  console.log('✅ 17 topics + 1 bloque');
  const examen_config={tipo:'test teórico-práctico',penalizacion:'Sin penalización por respuesta incorrecta',total_preguntas:100,opciones:4,duracion_total_minutos:140,partes:[{nombre:'Ejercicio único (test teórico-práctico)',preguntas:100,opciones:4,duracion_minutos:140,puntuacion_max:65}],notas:'Concurso-oposición (oposición 65% máx 65 pts / concurso 35% máx 35 pts). Ejercicio único tipo test de 100 preguntas (+5 reserva), 4 opciones; las respuestas erróneas NO penalizan. 140 minutos. La nota de corte la fija el Tribunal antes del ejercicio. (BOJA nº228, 26/11/2025)'};
  const boe_ref='45 plazas Escala Auxiliar Administrativa C2 (38 turno libre + 7 discapacidad), concurso-oposición, OEP 2022-2025. BOJA nº228 de 26/11/2025; BOE-A-2025-24332 (01/12/2025)';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Universidad de Huelva',short_name:'Aux. Admin. UHU',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Autonómica',titulo_requerido:'Graduado en ESO o equivalente',temas_count:17,bloques_count:1,
    plazas_libres:38,plazas_discapacidad:7,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOJA',diario_referencia:'BOJA nº228, 26/11/2025; BOE-A-2025-24332 (01/12/2025)',
    programa_url:'https://www.juntadeandalucia.es/boja/2025/228/29',
    seguimiento_url:'https://www.uhu.es/gestion-pas/convocatorias/nuevo-ingreso-escala-auxiliar-administrativa-resolucion-21-de-noviembre-2025',
    oep_decreto:'OEP 2022, 2023, 2024 y 2025 (Universidad de Huelva)',oep_fecha:'2025-11-26',convocatoria_numero:'BOJA-2025-228-29',convocatoria_fecha:'2025-11-26',convocatoria_dogv:null,
    color_primario:'teal',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Universidad de Huelva 2026 | 45 plazas | Tests Vence',
    seo_description:'Prepara las 45 plazas de Auxiliar Administrativo de la Universidad de Huelva (UHU, OEP 2022-2025). Tests del temario oficial (17 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 45 plazas de Auxiliar Administrativo (Escala Auxiliar Administrativa, C2) de la Universidad de Huelva: 38 de turno libre y 7 de discapacidad, por concurso-oposición (oposición 65% / concurso 35%), OEP 2022-2025 (BOJA nº228 de 26/11/2025). Temario de 17 temas: Constitución, Ley 39/2015, Ley 40/2015, EBEP, protección de datos, transparencia, igualdad de género en Andalucía, LOSU, Estatutos y normativa propia de la UHU, organización de las enseñanzas universitarias y ofimática (Word y Excel de Microsoft 365). Examen tipo test de 100 preguntas sin penalización.',
    examen_config,
    landing_estadisticas:[{numero:'45',texto:'Plazas (38 libre + 7 disc.)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'100',texto:'Preguntas en el examen',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'45 plazas de la Escala Auxiliar Administrativa (C2): 38 de turno libre y 7 reservadas a discapacidad, acumuladas de las OEP 2022, 2023, 2024 y 2025 de la Universidad de Huelva.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Concurso-oposición (oposición 65% / concurso 35%). La fase de oposición es un único ejercicio teórico-práctico tipo test de 100 preguntas con 4 respuestas alternativas (140 minutos). Las respuestas erróneas NO penalizan. La nota de corte la fija el Tribunal antes del ejercicio.'},
      {pregunta:'¿Qué temario entra?',respuesta:'17 temas: Constitución, Ley 39/2015, Ley 40/2015, EBEP, protección de datos, transparencia, igualdad de género en Andalucía, LOSU, Estatutos de la UHU, organización de las enseñanzas universitarias (RD 822/2021), información general, bases presupuestarias y reglamento de permanencia de la UHU, y ofimática (Word y Excel de Microsoft 365).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes cerró el 12/01/2026. El ejercicio no se celebrará antes del 31/03/2026 y la fecha exacta se publicará con la lista provisional de admitidos en el BOJA. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft 365 (Word y Excel)'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones UHU');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'BOJA-2025-228-29',convocatoria_fecha:'2025-11-26',convocatoria_dogv:'BOJA nº228, 26/11/2025',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:38,plazas_discapacidad:7,plazas_promocion_interna:0,boe_publication_date:'2025-12-01',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2025-11-26',titulo:'Convocatoria publicada en el BOJA',descripcion:'45 plazas de Auxiliar Administrativo (C2) de la Universidad de Huelva (OEP 2022-2025). BOJA nº228 de 26/11/2025; BOE-A-2025-24332 (01/12/2025).',url:'https://www.juntadeandalucia.es/boja/2025/228/29',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=17;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (contenido UHU/RD822 pendiente) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(!e.include_full_title&&e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
