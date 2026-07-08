require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_universidad_cadiz', SLUG='auxiliar-administrativo-universidad-cadiz';
const t=require('./data/temarios/auxiliar-administrativo-universidad-cadiz.json');
const titles={
 1:'La Constitución Española: Título Preliminar y Título I',
 2:'La Constitución: Corona, Cortes Generales y Gobierno',
 3:'La Constitución: Gobierno-Cortes, Poder Judicial y organización territorial',
 4:'El Estatuto de Autonomía para Andalucía',
 5:'Igualdad efectiva de mujeres y hombres (LO 3/2007)',
 6:'Protección de Datos y derechos digitales (LO 3/2018)',
 7:'Sistema de Dirección Estratégica de la Universidad de Cádiz',
 8:'Las fuentes del Derecho Administrativo',
 9:'Ley 40/2015: disposiciones generales y órganos',
 10:'Ley 40/2015: funcionamiento electrónico del sector público',
 11:'Ley 39/2015: interesados y actividad de las Administraciones',
 12:'Ley 39/2015: los actos administrativos',
 13:'Ley 39/2015: el procedimiento administrativo común',
 14:'Ley 39/2015: revisión de los actos en vía administrativa',
 15:'EBEP: el personal al servicio de las Administraciones Públicas',
 16:'EBEP: derechos, deberes y código de conducta',
 17:'EBEP: adquisición y pérdida de la relación de servicio',
 18:'EBEP: ordenación de la actividad profesional',
 19:'EBEP: régimen disciplinario',
 20:'LOSU: funciones, autonomía y creación de universidades',
 21:'LOSU: régimen jurídico, estructura y gobernanza',
 22:'LOSU: estudiantado, PDI y personal técnico, de gestión y administración',
 23:'Ley 1/2026 Universitaria para Andalucía: sistema, régimen jurídico y funciones',
 24:'Ley 1/2026 LUA: docencia, investigación y transferencia',
 25:'Ley 1/2026 LUA: régimen económico, financiero y patrimonial',
 26:'Normas de Ejecución del Presupuesto de la Universidad de Cádiz',
 27:'Código Ético de la Universidad de Cádiz (Código Peñalver)',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',EAA:'5238bdc9-2ee4-44a7-bcb2-413ba78cb230',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',L40:'95680d57-feb1-41c0-bb27-236024815feb',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',LOSU:'c3f0e748-1c23-4564-bc34-fbe79f1b1a67'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const EAA_ARR=['preámbulo',...R(1,88),'248','249','250'];
const SCOPE={
 1:[A(L.CE,R(1,55))],
 2:[A(L.CE,R(56,107))],
 3:[A(L.CE,[...R(108,127),...R(137,158)])],
 4:[A(L.EAA,EAA_ARR)],
 5:[A(L.LO3,[...R(1,12),...R(51,64)])],
 6:[A(L.LOPD,R(1,18))],
 9:[A(L.L40,R(1,22))],
 10:[A(L.L40,R(38,46))],
 11:[A(L.L39,R(3,33))],
 12:[A(L.L39,R(34,52))],
 13:[A(L.L39,R(53,105))],
 14:[A(L.L39,R(106,126))],
 15:[A(L.EBEP,R(8,13))],
 16:[A(L.EBEP,[...R(14,15),...R(52,54)])],
 17:[A(L.EBEP,R(55,68))],
 18:[A(L.EBEP,R(69,84))],
 19:[A(L.EBEP,R(93,98))],
 20:[A(L.LOSU,R(1,100))],
 21:[A(L.LOSU,R(1,100))],
 22:[A(L.LOSU,R(1,100))],
};
const bloqueDe={};t.temario.forEach(x=>bloqueDe[x.n]=x.bloque);
const dispNumDe={};{const c={};t.temario.forEach(x=>{c[x.bloque]=(c[x.bloque]||0)+1;dispNumDe[x.n]=c[x.bloque];});}
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:12,bloque_number:x.bloque,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert(t.bloques.map(b=>({position_type:PT,bloque_number:b.n,titulo:b.titulo,icon:b.n===4?'🎓':(b.n===3?'👥':(b.n===2?'⚖️':'🏛️')),sort_order:b.n})));
  console.log('✅ 27 topics + 4 bloques');
  const examen_config={tipo:'test (teórico + práctico)',penalizacion:'N = A − [E/(nº alternativas − 1)]; con 4 opciones equivale a 1/3 por error',total_preguntas:120,opciones:4,duracion_total_minutos:135,partes:[{nombre:'1er ejercicio (test teórico)',preguntas:90,opciones:4,duracion_minutos:90,puntuacion_min:5},{nombre:'2º ejercicio (test práctico, 2 casos)',preguntas:30,opciones:4,duracion_minutos:45,puntuacion_min:5}],notas:'Concurso-oposición (oposición 65% eliminatoria / concurso 35%). Dos ejercicios tipo test eliminatorios: 1º teórico (90 preg, 90 min), 2º práctico sobre 2 casos (30 preg, 45 min). Penalización paramétrica por nº de alternativas (con 4, resta 1/3); en blanco no penaliza. Mínimo 5/10 en cada ejercicio y suma ≥10. (BOE-A-2026-9563)'};
  const boe_ref='12 plazas Escala Auxiliar Administrativa C2 (10 turno libre + 2 discapacidad), concurso-oposición, OEP 2023-2025. BOE-A-2026-9563 (02/05/2026) + modificación BOE-A-2026-10851; BOJA nº84/91 (05-14/05/2026)';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Universidad de Cádiz',short_name:'Aux. Admin. UCA',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Autonómica',titulo_requerido:'Graduado en ESO o equivalente',temas_count:27,bloques_count:4,
    plazas_libres:10,plazas_discapacidad:2,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOE',diario_referencia:'BOE-A-2026-9563 (02/05/2026); BOJA nº84/91 (05-14/05/2026)',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-9563',
    seguimiento_url:'https://personal.uca.es/uca-rec98ger-2026-escala-auxiliar-administrativa-de-la-universidad-de-cadiz/',
    oep_decreto:'OEP 2023, 2024 y 2025 (Universidad de Cádiz)',oep_fecha:'2026-05-02',convocatoria_numero:'BOE-A-2026-9563',convocatoria_fecha:'2026-05-02',convocatoria_dogv:null,
    color_primario:'sky',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Universidad de Cádiz 2026 | 12 plazas | Tests Vence',
    seo_description:'Prepara las 12 plazas de Auxiliar Administrativo de la Universidad de Cádiz (UCA, OEP 2023-2025). Tests del temario oficial (27 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 12 plazas de Auxiliar Administrativo (Escala Auxiliar Administrativa, C2) de la Universidad de Cádiz: 10 de turno libre y 2 de discapacidad, por concurso-oposición (oposición 65% / concurso 35%), OEP 2023-2025 (BOE-A-2026-9563). Temario de 27 temas en 4 bloques: organización de la Administración (Constitución, Estatuto de Andalucía, igualdad, protección de datos), Derecho Administrativo (Ley 39/2015 y Ley 40/2015), gestión de personal (EBEP) y gestión universitaria (LOSU, Ley Universitaria para Andalucía y normativa propia de la UCA). Dos ejercicios tipo test.',
    examen_config,
    landing_estadisticas:[{numero:'12',texto:'Plazas (10 libre + 2 disc.)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'90',texto:'Preguntas (1er ejercicio)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'12 plazas de la Escala Auxiliar Administrativa (C2): 10 de turno libre y 2 reservadas a discapacidad (1 intelectual y 1 por enfermedad mental), de las OEP 2023, 2024 y 2025 de la Universidad de Cádiz.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Concurso-oposición (oposición 65% / concurso 35%). La fase de oposición son dos ejercicios tipo test eliminatorios: el primero teórico (90 preguntas, 90 minutos) y el segundo práctico sobre 2 casos (30 preguntas, 45 minutos). Las respuestas erróneas penalizan según una fórmula que depende del número de alternativas (con 4 opciones, restan 1/3); las no contestadas no penalizan. Hay que sacar al menos 5/10 en cada ejercicio.'},
      {pregunta:'¿Qué temario entra?',respuesta:'27 temas en 4 bloques: organización de la Administración (Constitución, Estatuto de Autonomía para Andalucía, igualdad, protección de datos y Dirección Estratégica de la UCA), Derecho Administrativo (fuentes, Ley 39/2015 y Ley 40/2015), gestión de personal (EBEP) y gestión universitaria (LOSU, Ley 1/2026 Universitaria para Andalucía, Normas de Ejecución del Presupuesto y Código Ético de la UCA).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes cerró el 10 de junio de 2026. El primer ejercicio no se celebrará antes del 1 de junio de 2026 y su fecha se publicará junto con la lista definitiva de admitidos en la web del Área de Personal de la UCA. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'No hay tema específico de ofimática (temario jurídico y de gestión universitaria)'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones UCA');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2026,convocatoria_numero:'BOE-A-2026-9563',convocatoria_fecha:'2026-05-02',convocatoria_dogv:'BOE-A-2026-9563 (02/05/2026); BOJA nº84/91',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:10,plazas_discapacidad:2,plazas_promocion_interna:0,boe_publication_date:'2026-05-02',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2026-05-02',titulo:'Convocatoria publicada en el BOE',descripcion:'12 plazas de Auxiliar Administrativo (C2) de la Universidad de Cádiz (OEP 2023-2025). BOE-A-2026-9563 (02/05/2026), modificada por BOE-A-2026-10851.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-9563',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=27;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (contenido pendiente) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+' (B'+bloqueDe[n]+'.'+dispNumDe[n]+'): '+String(c).padStart(5)+' → '+(c>0));
  }
})();
