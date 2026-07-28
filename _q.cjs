require('dotenv').config({path:'.env.local'});
const {Client}=require('pg');
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL.split('?')[0],ssl:{rejectUnauthorized:false}});await c.connect();
const r=await c.query(`SELECT date_trunc('day',created_at)::date d, count(DISTINCT user_id) activos
 FROM test_questions WHERE created_at >= NOW()-INTERVAL '4 days' GROUP BY 1 ORDER BY 1 DESC`).catch(()=>null);
if(r) r.rows.forEach(x=>console.log(`${x.d}: ${x.activos} usuarios respondiendo preguntas`));
else {
 const r2=await c.query(`SELECT date_trunc('day',created_at)::date d, count(DISTINCT user_id) n FROM observable_events WHERE created_at >= NOW()-INTERVAL '4 days' AND user_id IS NOT NULL GROUP BY 1 ORDER BY 1 DESC`);
 r2.rows.forEach(x=>console.log(`${x.d}: ${x.n} usuarios con eventos`));
}
await c.end();})().catch(e=>console.error('ERR',e.message));
