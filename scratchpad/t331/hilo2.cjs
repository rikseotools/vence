const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='feedback_messages' ORDER BY ordinal_position`);
  console.log(cols.rows.map(r=>r.column_name).join(', '));
  const m = await c.query(`SELECT * FROM feedback_messages WHERE conversation_id='e03baf00-cdbd-47fe-9b13-c204fdf3ee11' ORDER BY created_at`);
  for (const x of m.rows) console.log('\n['+(x.sender_role||x.sender||x.author_type||'?')+' '+String(x.created_at).slice(0,19)+']\n'+(x.message||x.body||x.content));
  await c.end();
})();
