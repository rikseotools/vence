require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT='auxiliar_administrativo_ayuntamiento_sevilla', SLUG='auxiliar-administrativo-ayuntamiento-sevilla';
const t=require('./data/temarios/auxiliar-administrativo-ayuntamiento-sevilla.json');
const titles={
 1:'La Constitución Española (I): derechos fundamentales, Tribunal Constitucional y reforma',
 2:'La Constitución Española (II): Corona, Cortes Generales, Gobierno y Poder Judicial',
 3:'La Constitución Española (III): la organización territorial del Estado',
 4:'El Estatuto de Autonomía para Andalucía',
 5:'La Unión Europea: valores, libertades e instituciones',
 6:'Ley 7/1985, Reguladora de las Bases del Régimen Local',
 7:'Ley 39/2015 (I): disposiciones generales, interesados y plazos',
 8:'Ley 39/2015 (II): el acto administrativo y el procedimiento',
 9:'Ley 39/2015 (III): los recursos administrativos',
 10:'Protección de Datos y derechos digitales (LO 3/2018)',
 11:'Ley 40/2015, de Régimen Jurídico del Sector Público',
 12:'Transparencia, acceso a la información y buen gobierno (Ley 19/2013)',
 13:'Contratos del Sector Público (Ley 9/2017)',
 14:'Organización y funcionamiento del Ayuntamiento de Sevilla',
 15:'El personal al servicio de las entidades locales (I)',
 16:'El personal al servicio de las entidades locales (II)',
 17:'Igualdad efectiva de mujeres y hombres y violencia de género',
 18:'El Presupuesto Municipal',
 19:'Informática básica',
 20:'El sistema operativo: el entorno Windows',
 21:'El explorador de Windows',
 22:'Procesadores de texto: Word 2021',
 23:'Hojas de cálculo: Excel 2021',
 24:'Bases de datos: Access 2021',
 25:'Correo electrónico: Outlook 2021',
 26:'La red Internet',
};
const L={CE:'6ad91a6c-41ec-431f-9c80-5f5566834941',EAA:'5238bdc9-2ee4-44a7-bcb2-413ba78cb230',TUE:'ddc2ffa9-d99b-4abc-b149-ab47916ab9da',TFUE:'eba370d3-73d9-44a9-9865-48d2effabaf4',LBRL:'06784434-f549-4ea2-894f-e2e400881545',L39:'218452f5-b9f6-48f0-a25b-26df9cb19644',L40:'95680d57-feb1-41c0-bb27-236024815feb',L19:'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798',L9:'4f605392-8137-4962-9e66-ca5f275e93ee',LOPD:'146b7e50-e089-44a6-932c-773954f8d96b',EBEP:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',TRRL:'73830f77-e083-4e2d-ab05-efe767840550',TRLRHL:'5fcc4f3a-a719-415f-958f-46c840e1c4e7',LO3:'6e59eacd-9298-4164-9d78-9e9343d9a900',LO1:'f5c17b23-2547-43d2-800c-39f5ea925c2f',INFO:'82fd3977-ecf7-4f36-a6df-95c41445d3c2',WIN10:'cb536623-fb75-429c-a839-0154b76ee27b',WIN11:'932efcfb-5dce-4bcc-9c6c-55eab19752b0',EXP10:'9a4d819f-50d6-421b-b3ea-d66d72b8524b',EXP11:'9c0b25a4-c819-478c-972f-ee462d724a40',WORD:'86f671a9-4fd8-42e6-91db-694f27eb4292',EXCEL:'c7475712-5ae4-4bec-9bd5-ff646c378e33',ACCESS:'b403019a-bdf7-4795-886e-1d26f139602d',OUTLOOK:'c9df042b-15df-4285-affb-6c93e2a71139',NET:'7814de3a-7c9c-4045-88c2-d452b31f449a'};
const R=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(String(i));return o;};
const A=(law,arr)=>({law_id:law,article_numbers:arr,include_full_title:false});
const F=(law)=>({law_id:law,article_numbers:null,include_full_title:true});
// arrays clonados de Córdoba (probados con preguntas)
const EAA_ARR=['preámbulo',...R(1,88),'248','249','250'];
const LO3_ARR=['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78'];
const LO1_ARR=['1','2','3','9','12','17','18','19','21','23','24','25','27','28','29','30'];
const SCOPE={
 1:[A(L.CE,[...R(1,38),...R(53,55),...R(159,169)])],
 2:[A(L.CE,[...R(56,80),...R(97,107),...R(117,127)])],
 3:[A(L.CE,R(137,158))],
 4:[A(L.EAA,EAA_ARR)],
 5:[A(L.TUE,['2','3','14','15','16','17','19']),A(L.TFUE,['28','45','49','56','63'])],
 6:[A(L.LBRL,[...R(1,7),'11','12',...R(15,18),'25','26','27','31','36',...R(121,138)])],
 7:[A(L.L39,['1','2','4','5','13','14','16','17',...R(27,33)])],
 8:[A(L.L39,['35','39',...R(40,48),'53',...R(70,74)])],
 9:[A(L.L39,R(112,126))],
 10:[A(L.LOPD,[...R(1,18),...R(79,97)])],
 11:[A(L.L40,['1','2','3','4','5',...R(8,13),...R(15,18),'23','24',...R(25,32)])],
 12:[A(L.L19,[...R(1,8),...R(12,20),'22'])],
 13:[A(L.L9,['1','2','3',...R(12,18),...R(21,27)])],
 15:[A(L.EBEP,['3','7','8','9','10','11','12','14','15','52','53','54','55','56','60','61']),A(L.LBRL,['91','97','100']),A(L.TRRL,['133','134','169','171','172'])],
 16:[A(L.EBEP,[...R(21,30),'37',...R(78,98)])],
 17:[A(L.LO3,LO3_ARR),A(L.LO1,LO1_ARR)],
 18:[A(L.TRLRHL,[...R(162,171),...R(183,189)])],
 19:[F(L.INFO)],20:[F(L.WIN10),F(L.WIN11)],21:[F(L.EXP10),F(L.EXP11)],
 22:[F(L.WORD)],23:[F(L.EXCEL)],24:[F(L.ACCESS)],25:[F(L.OUTLOOK)],26:[F(L.NET)],
};
const bloqueDe=n=>n<=18?1:2;
(async()=>{
  await s.from('topics').delete().eq('position_type',PT);
  await s.from('oposicion_bloques').delete().eq('position_type',PT);
  const rows=t.temario.map(x=>({position_type:PT,topic_number:x.n,title:titles[x.n],description:x.epi,epigrafe:x.epi,descripcion_corta:titles[x.n]+'.',difficulty:'medium',estimated_hours:x.n>=19?8:12,bloque_number:bloqueDe(x.n),display_number:x.n,disponible:false,is_active:true}));
  await s.from('topics').insert(rows);
  await s.from('oposicion_bloques').insert([
    {position_type:PT,bloque_number:1,titulo:'Parte I — Organización pública y Derecho administrativo',icon:'⚖️',sort_order:1},
    {position_type:PT,bloque_number:2,titulo:'Parte II — Ofimática',icon:'💻',sort_order:2},
  ]);
  console.log('✅ 26 topics + 2 bloques');
  const examen_config={tipo:'test',penalizacion:'1/3 del valor de una respuesta correcta',total_preguntas:100,opciones:4,duracion_total_minutos:100,partes:[{nombre:'Parte 1 (Bloque I)',preguntas:60,opciones:4,puntuacion_min:30,puntuacion_max:60},{nombre:'Parte 2 (Ofimática)',preguntas:40,opciones:4,puntuacion_min:20,puntuacion_max:40}],notas:'Ejercicio único con dos partes obligatorias y eliminatorias (test, 4 opciones). 60 preguntas evaluables (Parte I) + 40 (ofimática) + 20 de reserva. Cada error resta 1/3; las no contestadas no puntúan. Mínimos: 30/60 y 20/40; total mínimo 50/100. Sistema de oposición. (BOP Sevilla nº256, 06/11/2023)'};
  const boe_ref='46 plazas Auxiliar Administrativo (C2, Escala Administración General, Subescala Auxiliar; 5 reservadas a discapacidad), turno libre, oposición. OEP 2021/2022/2023. Bases BOP Sevilla nº256 de 06/11/2023; convocatoria BOE-A-2024-4098 (14/02/2024)';
  await s.from('oposiciones').update({
    nombre:'Auxiliar Administrativo del Ayuntamiento de Sevilla',short_name:'Aux. Admin. Ayto. Sevilla',grupo:'C',subgrupo:'C2',categoria:'C2',administracion:'Local',titulo_requerido:'Graduado en ESO o equivalente',temas_count:26,bloques_count:2,
    plazas_libres:41,plazas_discapacidad:5,plazas_promocion_interna:0,estado_proceso:'inscripcion_cerrada',is_convocatoria_activa:true,exam_date:null,exam_date_approximate:false,
    boe_reference:boe_ref,
    diario_oficial:'BOP Sevilla',diario_referencia:'BOP nº256, 06/11/2023 (bases); BOE-A-2024-4098 (14/02/2024)',
    programa_url:'https://www.sevilla.org/servicios/empleo/servicio-de-recursos-humanos/convocatorias-oposiciones-concursos/ayuntamiento-de-sevilla/funcionario/acceso-libre/auxiliar-administrativo-46-plazas',
    seguimiento_url:'https://www.sevilla.org/servicios/empleo/servicio-de-recursos-humanos/convocatorias-oposiciones-concursos/ayuntamiento-de-sevilla/funcionario/acceso-libre/auxiliar-administrativo-46-plazas',
    oep_decreto:'OEP 2021, 2022 y 2023 (Ayuntamiento de Sevilla)',oep_fecha:null,convocatoria_numero:'BOE-A-2024-4098',convocatoria_fecha:'2024-02-14',convocatoria_dogv:null,
    color_primario:'rose',landing_difficulty:'Intermedio',landing_duration:'6-12 meses',
    seo_title:'Auxiliar Administrativo Ayuntamiento de Sevilla 2026 | 46 plazas | Tests Vence',
    seo_description:'Prepara las 46 plazas de Auxiliar Administrativo del Ayuntamiento de Sevilla (C2, OEP 2021-2023). Tests del temario oficial (26 temas) con explicaciones. Empieza gratis.',
    landing_description:'Oposición a 46 plazas de Auxiliar Administrativo (C2, Escala Administración General, Subescala Auxiliar) del Ayuntamiento de Sevilla, turno libre por el sistema de oposición (OEP 2021, 2022 y 2023; bases BOP Sevilla nº256 de 06/11/2023, convocatoria BOE-A-2024-4098). Temario de 26 temas: bloque de organización pública y Derecho administrativo (Constitución, Estatuto de Autonomía para Andalucía, Unión Europea, régimen local, Ley 39/2015, Ley 40/2015, transparencia, protección de datos, contratos, función pública local, igualdad y haciendas locales) y bloque de ofimática (Windows, Word, Excel, Access, Outlook 2021 e Internet). Examen tipo test de 100 preguntas evaluables.',
    examen_config,
    landing_estadisticas:[{numero:'46',texto:'Plazas turno libre',color:'text-green-600'},{numero:'{temasCount}',texto:'Temas oficiales',color:'text-blue-600'},{numero:'100',texto:'Preguntas evaluables',color:'text-purple-600'},{numero:'ESO',texto:'Título requerido',color:'text-orange-600'}],
    landing_faqs:[
      {pregunta:'¿Cuántas plazas hay?',respuesta:'46 plazas de Auxiliar Administrativo (grupo C2) por turno libre, de las cuales 5 se reservan al cupo de discapacidad. Provienen de las OEP 2021, 2022 y 2023 del Ayuntamiento de Sevilla.'},
      {pregunta:'¿Cómo es el examen?',respuesta:'Un ejercicio único tipo test con dos partes obligatorias y eliminatorias (100 minutos): 60 preguntas de la Parte I (organización pública y Derecho administrativo) y 40 de ofimática, con 4 respuestas alternativas. Cada error resta 1/3 del valor de un acierto; las no contestadas no puntúan. Hay que sacar al menos 30/60 y 20/40, y un mínimo de 50/100 en total.'},
      {pregunta:'¿Qué temario entra?',respuesta:'26 temas: Constitución, Estatuto de Autonomía para Andalucía, Unión Europea, Ley 7/1985 de régimen local, Ley 39/2015, Ley 40/2015, protección de datos, transparencia, contratos del sector público, organización del Ayuntamiento de Sevilla, función pública local, igualdad y violencia de género, presupuesto municipal, y ofimática (informática básica, Windows, Word, Excel, Access y Outlook 2021 e Internet).'},
      {pregunta:'¿Qué requisitos se piden?',respuesta:'Título de Graduado en ESO o equivalente y los requisitos generales de acceso al empleo público. La tasa de examen fue de 17,60 €.'},
      {pregunta:'¿Cuándo es el examen?',respuesta:'El proceso está en fase de admisión (última publicación: lista provisional de admitidos). La fecha del ejercicio se anunciará con la lista definitiva, por lo que es un buen momento para preparar el temario con antelación.'}
    ],
    requisitos_especiales:[{tipo:'ofimatica',descripcion:'Microsoft Office 2021 (Word, Excel, Access y Outlook) y Windows'}]
  }).eq('slug',SLUG);
  console.log('✅ fila oposiciones Ayto Sevilla');
  const {data:o}=await s.from('oposiciones').select('*').eq('slug',SLUG).single();
  await s.from('convocatorias').delete().eq('oposicion_id',o.id);
  await s.from('convocatorias').insert({oposicion_id:o.id,'año':2024,convocatoria_numero:'BOE-A-2024-4098',convocatoria_fecha:'2024-02-14',convocatoria_dogv:'BOP Sevilla nº256, 06/11/2023 (bases); BOE-A-2024-4098 (14/02/2024)',is_current:true,estado_proceso:'inscripcion_cerrada',oep_decreto:o.oep_decreto,oep_fecha:null,plazas_libres:41,plazas_discapacidad:5,plazas_promocion_interna:0,boe_publication_date:'2024-02-14',boe_reference:o.boe_reference,exam_date:null,exam_date_approximate:false,programa_url:o.programa_url,examen_config,landing_faqs:o.landing_faqs,landing_estadisticas:o.landing_estadisticas,landing_description:o.landing_description,requisitos_especiales:o.requisitos_especiales});
  await s.from('convocatoria_hitos').delete().eq('oposicion_id',o.id);
  await s.from('convocatoria_hitos').insert({oposicion_id:o.id,fecha:'2024-02-14',titulo:'Convocatoria publicada en el BOE',descripcion:'46 plazas de Auxiliar Administrativo (C2) del Ayuntamiento de Sevilla (OEP 2021-2023). Bases en BOP Sevilla nº256 de 06/11/2023; apertura de solicitudes por Resolución BOE-A-2024-4098 (14/02/2024).',url:'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-4098',status:'completed',order_index:1});
  console.log('✅ §2c + hito');
  const {data:tp}=await s.from('topics').select('id,topic_number').eq('position_type',PT);
  const byN={};tp.forEach(x=>byN[x.topic_number]=x.id);
  await s.from('topic_scope').delete().in('topic_id',tp.map(x=>x.id));
  let scope=[];for(const[n,e]of Object.entries(SCOPE))for(const x of e)scope.push({topic_id:byN[n],...x});
  await s.from('topic_scope').insert(scope);
  console.log('✅ '+scope.length+' filas scope reutilizable');
  for(let n=1;n<=26;n++){
    if(!SCOPE[n]){console.log('T'+String(n).padStart(2)+': (municipal, sin scope) → false');continue;}
    let ids=[];for(const e of SCOPE[n]){let q=s.from('articles').select('id').eq('law_id',e.law_id);if(!e.include_full_title&&e.article_numbers)q=q.in('article_number',e.article_numbers);const{data:a}=await q;ids.push(...(a||[]).map(x=>x.id));}
    let c=0;for(let i=0;i<ids.length;i+=200){const{count}=await s.from('questions').select('id',{count:'exact',head:true}).in('primary_article_id',ids.slice(i,i+200)).eq('is_active',true);c+=count||0;}
    await s.from('topics').update({disponible:c>0}).eq('position_type',PT).eq('topic_number',n);
    console.log('T'+String(n).padStart(2)+': '+String(c).padStart(5)+' → '+(c>0));
  }
})();
