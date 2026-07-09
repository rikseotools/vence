require('dotenv').config({path:'.env.local'});
const s=require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
async function pageAll(t,c){let o=[],f=0;while(true){const{data,error}=await s.from(t).select(c).order('id',{ascending:true}).range(f,f+999);if(error){console.error(t,error.message);break;}o=o.concat(data);if(data.length<1000)break;f+=1000;}return o;}
const isRealArt=n=>/^\d+( ?(bis|ter|quater))?$/i.test((n||'').trim());
function trunc(c){if(!c)return true;c=c.replace(/^\s+/,'');return /^([2-9]|[1-9]\d)\.\s/.test(c)||/^(Dos|Tres|Cuatro|Cinco|Seis|Siete|Ocho|Nueve|Diez)\.\s/i.test(c)||/^[b-zñ]\)\s/.test(c)||(/^[a-zñáéíóú]/.test(c)&&!/^[a-z]\)/.test(c));}
(async()=>{
  const laws=await pageAll('laws','id,short_name,is_active');
  const lawName=Object.fromEntries(laws.map(l=>[l.id,l.short_name]));
  const lawActive=Object.fromEntries(laws.map(l=>[l.id,l.is_active]));
  const arts=await pageAll('articles','id,law_id,article_number,content');
  const truncReal=arts.filter(a=>isRealArt(a.article_number)&&trunc(a.content)&&lawActive[a.law_id]!==false);
  const ids=new Set(truncReal.map(a=>a.id));
  // active question impact
  let f=0,perArt={};
  while(true){const{data,error}=await s.from('questions').select('primary_article_id,is_active').order('id',{ascending:true}).range(f,f+999);if(error)break;for(const q of data){if(q.primary_article_id&&ids.has(q.primary_article_id)&&q.is_active)perArt[q.primary_article_id]=(perArt[q.primary_article_id]||0)+1;}if(data.length<1000)break;f+=1000;}
  const totalQ=Object.values(perArt).reduce((a,b)=>a+b,0);
  const byLaw={};for(const a of truncReal){const k=lawName[a.law_id]||a.law_id;byLaw[k]=byLaw[k]||{arts:0,q:0};byLaw[k].arts++;byLaw[k].q+=(perArt[a.id]||0);}
  console.log('TRUNCADO REAL (solo arts numerados, leyes activas):',truncReal.length,'arts | preguntas activas impactadas:',totalQ);
  console.log('\nPor norma (con impacto en preguntas activas), orden por preguntas:');
  Object.entries(byLaw).filter(([k,v])=>v.q>0).sort((a,b)=>b[1].q-a[1].q).forEach(([k,v])=>console.log('  '+String(v.q).padStart(3)+' preg | '+String(v.arts).padStart(2)+' arts | '+k));
  const zero=Object.entries(byLaw).filter(([k,v])=>v.q===0);
  console.log('\nNormas con truncado real pero 0 preguntas activas:',zero.length,'(baja prioridad)');
})();
