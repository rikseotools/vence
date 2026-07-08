require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_universidad_alcala', SLUG='auxiliar-administrativo-universidad-alcala';
const t=require('./data/temarios/auxiliar-administrativo-universidad-alcala.json');
const titles={1:'La Constitución Española de 1978',2:'La Ley 39/2015 del Procedimiento Administrativo Común',3:'La Ley 40/2015 de Régimen Jurídico del Sector Público',4:'Protección de datos (LO 3/2018)',5:'Transparencia y buen gobierno (Ley 19/2013)',6:'Igualdad efectiva de mujeres y hombres (LO 3/2007)',7:'El Estatuto Básico del Empleado Público (EBEP)',8:'Incompatibilidades del personal al servicio de las AAPP (Ley 53/1984)',9:'Prevención de Riesgos Laborales (Ley 31/1995)',10:'Ley Orgánica del Sistema Universitario (LOSU)',11:'Normativa de Gestión Económica y Presupuestaria de la UAH',12:'Contratos del Sector Público (Ley 9/2017)',13:'Ofimática: Microsoft Word 365',14:'Ofimática: Microsoft Excel 365',15:'Ofimática: Microsoft Outlook 365',16:'Código ético general de la Universidad de Alcalá',17:'Normas de Convivencia de la Universidad de Alcalá',18:'Derechos de las personas con discapacidad (RDL 1/2013)'};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',L53:'f6f4da4d-845f-45d0-b69f-3554524e23e7',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',LOSU:'c3f0e748-1c23-4564-bc34-fbe79f1b1a67',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139',RDL1:'8617ca45-1753-478e-9309-f1f7e2ba6082'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const LO3_ARR=['0','1','2','3','4','5','6','7','8','9','10','11','13','14','15','16','17','18','19','21','39','45','49','51','55','62','64','71','76'];
const SCOPE={1:[A(L.CE,R(1,55))],2:[A(L.L39,R(1,127))],3:[A(L.L40,[...R(1,22),...R(38,46)])],4:[A(L.LOPD,R(1,30))],5:[A(L.L19,[...R(1,24),...R(33,40)])],6:[A(L.LO3,LO3_ARR)],7:[A(L.EBEP,[...R(1,54),...R(93,98)])],8:[A(L.L53,R(1,20))],9:[A(L.LPRL,[...R(1,16),...R(30,42)])],10:[A(L.LOSU,[...R(1,37),...R(38,95)])],12:[A(L.L9,R(1,30))],13:[F(L.WORD)],14:[F(L.EXCEL)],15:[F(L.OUTLOOK)],18:[A(L.RDL1,[...R(18,21),...R(35,43)])]};
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=13&&x.n<=15?8:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (18 temas)',icon:'🎓',sort_order:1});
  console.log('✅ 18 topics + 1 bloque');
  const examen_config={tipo:'test',penalizacion:'1/4 del valor de una respuesta correcta',total_preguntas:80,opciones:4,duracion_total_minutos:90,partes:[{nombre:'Ejercicio único (test)',preguntas:80,opciones:4,duracion_minutos:90,puntuacion_min:30,puntuacion_max:60}],notas:'Concurso-oposición (oposición 60% / concurso 40%). Test de 80 preguntas, 4 opciones; las incorrectas restan 1/4, las no contestadas no puntúan. Mínimo 30/60 (BOE-A-2025-20547).'};
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Universidad de Alcalá',short_name:'Aux. Admin. UAH',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Autonómica',titulo_requerido:'Graduado en ESO o equivalente',temas_count:18,bloques_count:1,
    plazas_libres:52,plazas_discapacidad:2,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,
    boe_reference:'54 plazas Escala Auxiliar Administrativa C2 (52 turno libre + 2 discapacidad), concurso-oposición, OEP 2022/2023/2025. BOE nº 247 de 14/10/2025 (BOE-A-2025-20547)',
    diario_oficial:'BOE',diario_referencia:'BOE-A-2025-20547 (14/10/2025)',programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-20547',seguimiento_url:'https://www.uah.es/es/empleo-y-formacion/empleo-en-la-uah/personal-de-administracion-y-servicios/',
    oep_decreto:'OEP 2022, 2023 y 2025 UAH',oep_fecha:'2025-10-14',convocatoria_numero:'BOE-A-2025-20547',convocatoria_fecha:'2025-10-14',convocatoria_dogv:null,
    color_primario:'cyan',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Universidad de Alcalá (UAH) 2026 | 52 plazas | Tests Vence',
    seo_description:'Prepara las 52 plazas de Auxiliar Administrativo de la Universidad de Alcalá (UAH, OEP 2022-2025). Tests del temario oficial (18 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a Auxiliar Administrativo (Escala Auxiliar Administrativa, C2) de la Universidad de Alcalá. 54 plazas (52 turno libre + 2 discapacidad) por concurso-oposición, OEP 2022-2025 (BOE-A-2025-20547). Temario de 18 temas: bloque estatal (Constitución, Ley 39/2015, Ley 40/2015, EBEP, transparencia, igualdad, protección de datos, PRL, incompatibilidades), LOSU, normativa propia de la UAH, contratos, discapacidad y ofimática (Word, Excel y Outlook). Examen tipo test de 80 preguntas.',
    examen_config,
    landing_estadisticas:[{numero:'52',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'80',texto:'Preguntas en el examen',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'54 plazas de la Escala Auxiliar Administrativa (C2): 52 de turno libre y 2 reservadas a discapacidad, acumuladas de las OEP 2022, 2023 y 2025 de la Universidad de Alcalá.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Concurso-oposición. La fase de oposición es un único ejercicio tipo test de 80 preguntas con 4 respuestas alternativas (90 minutos). Cada respuesta incorrecta resta 1/4 del valor de una correcta; las no contestadas no puntúan. Mínimo 30 de 60 puntos.'},
      {pregunta:'¿Qué temario entra?',respuesta:'18 temas: Constitución, Ley 39/2015, Ley 40/2015, protección de datos, transparencia, igualdad, EBEP, incompatibilidades, prevención de riesgos, LOSU, normativa económica de la UAH, contratos, ofimática (Word, Excel y Outlook 365), código ético y normas de convivencia de la UAH, y derechos de las personas con discapacidad.'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El proceso está en fase de admisión (se reabrió el plazo en abril de 2026). La fecha del ejercicio se publicará con la lista definitiva de admitidos. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office 365 (Word, Excel y Outlook)'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones UAH');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2025,convocatoria_numero:'BOE-A-2025-20547',convocatoria_fecha:'2025-10-14',convocatoria_dogv:'BOE nº247, 14/10/2025',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:52,plazas_discapacidad:2,plazas_promocion_interna:0,boe_publication_date:'2025-10-14',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2025-10-14',titulo:'Convocatoria publicada en el BOE',descripcion:'54 plazas de Auxiliar Administrativo (C2) de la UAH (OEP 2022-2025). BOE nº 247 de 14/10/2025 (BOE-A-2025-20547).',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-20547',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=18;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (UAH-interno, sin scope) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(!e.include_full_title&&e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
