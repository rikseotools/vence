require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_universidad_leon', SLUG='auxiliar-administrativo-universidad-leon';
const t=require('./data/temarios/auxiliar-administrativo-universidad-leon.json');
const titles={
 1:'Ley 39/2015: el procedimiento administrativo común (Títulos I-V)',
 2:'Ley 40/2015: disposiciones generales y funcionamiento electrónico',
 3:'Igualdad efectiva de mujeres y hombres (LO 3/2007)',
 4:'Protección de Datos: principios y derechos (LO 3/2018)',
 5:'Transparencia y acceso a la información pública (Ley 19/2013)',
 6:'Prevención de Riesgos Laborales: derechos y obligaciones (Ley 31/1995)',
 7:'LOSU (I): funciones, autonomía, estructura y enseñanzas',
 8:'LOSU (II): personal, régimen y garantías',
 9:'Organización de las enseñanzas universitarias (RD 822/2021)',
 10:'Enseñanzas oficiales de doctorado (RD 99/2011)',
 11:'Normativa de títulos propios de la Universidad de León',
 12:'Expedición de títulos universitarios oficiales (RD 1002/2010)',
 13:'Homologación y equivalencia de títulos extranjeros (RD 889/2022)',
 14:'Matrícula, régimen académico y permanencia en la Universidad de León',
 15:'El Estatuto del Estudiante Universitario (RD 1791/2010)',
 16:'El Estatuto Básico del Empleado Público (EBEP)',
 17:'II Convenio Colectivo del PAS laboral de las Universidades Públicas de Castilla y León',
 18:'Normas de ejecución presupuestaria de la Universidad de León',
 19:'Informática básica y sistema operativo Windows 10',
 20:'Ofimática: Word y Excel (Office 2021)',
 21:'Internet, correo electrónico y Google Workspace',
};
const L={L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',LPRL:'8b1ae300-4ed3-4019-876c-780ea40ebbfe',LOSU:'c3f0e748-1c23-4564-bc34-fbe79f1b1a67',RD822:'93ce8e25',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',WIN10:'cb536623-fb75-429c-a839-0154b76ee27b',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',EXP10:'9a4d819f-50d6-421b-b3ea-d66d72b8524b',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',NET:'7814de3a-7c9c-4045-88c2-d452b31f449a',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
const SCOPE={
 1:[A(L.L39,R(1,129))],
 2:[A(L.L40,[...R(1,31),...R(38,46)])],
 3:[A(L.LO3,R(1,78))],
 4:[A(L.LOPD,R(1,18))],
 5:[A(L.L19,R(5,24))],
 6:[A(L.LPRL,R(14,29))],
 7:[A(L.LOSU,R(1,100))],
 8:[A(L.LOSU,R(1,100))],
 9:[F(L.RD822)],
 16:[A(L.EBEP,R(1,98))],
 19:[F(L.WIN10),F(L.INFO),F(L.EXP10)],
 20:[F(L.WORD),F(L.EXCEL)],
 21:[F(L.NET),F(L.OUTLOOK)],
};
(async()=>{
  // resolver RD822 full id
  if(L.RD822.length<20){const {data}=await s.from('laws').select('id').eq('slug','rd-822-2021').single();L.RD822=data.id;SCOPE[9]=[F(L.RD822)];}
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=19?8:12,bloque_number:1,display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert({position_type:PT,bloque_number:1,titulo:'Programa oficial (21 temas)',icon:'🎓',sort_order:1});
  console.log('✅ 21 topics + 1 bloque');
  const examen_config={tipo:'concurso-oposición (2 ejercicios)',penalizacion:'0,333 por error (1/3), descontado de aciertos',total_preguntas:70,opciones:4,duracion_total_minutos:120,partes:[{nombre:'1er ejercicio (test teórico+aptitudinal)',preguntas:70,opciones:4,duracion_minutos:60,puntuacion_max:37.5},{nombre:'2º ejercicio (práctico ofimática Word+Excel)',duracion_minutos:60,puntuacion_max:37.5}],notas:'Concurso-oposición libre (oposición 75% / concurso 25%). 1er ejercicio: test de hasta 70 preguntas (+5 reserva), 4 opciones, incluye preguntas aptitudinales; cada error resta 0,333 (1/3), en blanco no penaliza; 60 min. 2º ejercicio: supuesto práctico en ordenador (Office 2021: Word y Excel), 60 min. El Tribunal fija el nivel para superar. (BOE-A-2026-4150)'};
  const boe_ref='9 plazas Escala Auxiliar Administrativa C2 (8 turno libre + 1 discapacidad), concurso-oposición libre, OEP 2023-2025. BOE-A-2026-4150 (23/02/2026) = BOCYL-D-19022026-34-17';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo de la Universidad de León',short_name:'Aux. Admin. ULE',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Autonómica',titulo_requerido:'Graduado en ESO o equivalente',temas_count:21,bloques_count:1,
    plazas_libres:8,plazas_discapacidad:1,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,diario_oficial:'BOE',diario_referencia:'BOE-A-2026-4150 (23/02/2026); BOCYL-D-19022026-34-17',
    programa_url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-4150',
    seguimiento_url:'https://www.unileon.es/convocatorias-ptgas-pdi/convocatoria-concurso-oposicion-libre-escala-auxiliar',
    oep_decreto:'OEP 2023, 2024 y 2025 (Universidad de León)',oep_fecha:'2026-02-23',convocatoria_numero:'BOE-A-2026-4150',convocatoria_fecha:'2026-02-23',convocatoria_dogv:null,
    color_primario:'lime',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Universidad de León 2026 | 9 plazas | Tests Vence',
    seo_description:'Prepara las 9 plazas de Auxiliar Administrativo de la Universidad de León (ULE, OEP 2023-2025). Tests del temario oficial (21 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 9 plazas de Auxiliar Administrativo (Escala Auxiliar Administrativa, C2) de la Universidad de León: 8 de turno libre y 1 de discapacidad, por concurso-oposición libre (oposición 75% / concurso 25%), OEP 2023-2025 (BOE-A-2026-4150). Temario de 21 temas: Ley 39/2015, Ley 40/2015, igualdad, protección de datos, transparencia, prevención de riesgos, LOSU y normativa universitaria (doctorado, títulos, Estatuto del Estudiante), EBEP, convenio del PAS y normativa propia de la ULE, más ofimática (Windows, Word, Excel e Internet). Dos ejercicios: test y supuesto práctico de ofimática.',
    examen_config,
    landing_estadisticas:[{numero:'9',texto:'Plazas (8 libre + 1 disc.)',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'70',texto:'Preguntas (1er ejercicio)',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'9 plazas de la Escala Auxiliar Administrativa (C2): 8 de turno libre y 1 reservada a discapacidad, de las OEP 2023, 2024 y 2025 de la Universidad de León (ampliables con C2 de la OEP 2026).'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Concurso-oposición libre (oposición 75% / concurso 25%). La fase de oposición son dos ejercicios eliminatorios: el primero un test de hasta 70 preguntas con 4 opciones (incluye preguntas aptitudinales), donde cada error resta 0,333; el segundo un supuesto práctico de ofimática en ordenador con Word y Excel. El Tribunal fija el nivel necesario para superar cada ejercicio.'},
      {pregunta:'¿Qué temario entra?',respuesta:'21 temas: Ley 39/2015, Ley 40/2015, igualdad (LO 3/2007), protección de datos (LO 3/2018), transparencia (Ley 19/2013), prevención de riesgos (Ley 31/1995), LOSU, normativa universitaria (RD 822/2021, doctorado, títulos, homologación, Estatuto del Estudiante), EBEP, II Convenio del PAS laboral de las universidades de Castilla y León, normativa propia de la ULE (títulos propios, matrícula, presupuesto) y ofimática (Windows 10, Word, Excel e Internet).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO, Graduado Escolar, FP de primer grado o equivalente, y los requisitos generales de acceso al empleo público. Derechos de examen: 25 €.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El plazo de solicitudes cerró el 16/03/2026. El proceso está en fase de admisión (las reclamaciones a la lista provisional cerraron el 10/06/2026) y la fecha del primer ejercicio se publicará con la lista definitiva. Buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office 2021 (Word y Excel) y Windows 10; 2º ejercicio práctico en ordenador'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones ULE');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2026,convocatoria_numero:'BOE-A-2026-4150',convocatoria_fecha:'2026-02-23',convocatoria_dogv:'BOE-A-2026-4150 (23/02/2026); BOCYL-D-19022026-34-17',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:o.oep_fecha,plazas_libres:8,plazas_discapacidad:1,plazas_promocion_interna:0,boe_publication_date:'2026-02-23',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2026-02-23',titulo:'Convocatoria publicada en el BOE',descripcion:'9 plazas de Auxiliar Administrativo (C2) de la Universidad de León (OEP 2023-2025). BOE-A-2026-4150 (23/02/2026), bases en BOCYL-D-19022026-34-17.',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-4150',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=21;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (contenido pendiente) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
