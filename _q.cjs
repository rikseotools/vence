require('dotenv').config({path:'.env.local'});
const {Client}=require('pg');
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL.split('?')[0],ssl:{rejectUnauthorized:false}});await c.connect();
const r=await c.query(`WITH m AS (
  SELECT date_trunc('minute',created_at) t, count(DISTINCT user_id) u, count(*) n
  FROM observable_events WHERE event_type='console_error' AND error_message ~* 'Failed to fetch'
    AND created_at >= NOW()-INTERVAL '3 days' GROUP BY 1)
 SELECT count(*) minutos_con_fallos,
   count(*) FILTER (WHERE u=1) solo_1_usuario,
   count(*) FILTER (WHERE u>=3) con_3_o_mas,
   max(u) max_usuarios_en_un_minuto FROM m`);
console.log(r.rows[0]);
const p=await c.query(`SELECT date_trunc('minute',created_at) t, count(DISTINCT user_id) u
 FROM observable_events WHERE event_type='console_error' AND error_message ~* 'Failed to fetch'
   AND created_at >= NOW()-INTERVAL '3 days' GROUP BY 1 HAVING count(DISTINCT user_id)>=3 ORDER BY 2 DESC LIMIT 5`);
console.log('\npicos colectivos:'); p.rows.forEach(x=>console.log(`  ${String(x.t).slice(4,21)} → ${x.u} usuarios a la vez`));
await c.end();})().catch(e=>console.error('ERR',e.message));
