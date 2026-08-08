const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''), ssl:{rejectUnauthorized:false} });
  await c.connect();
  const f = await c.query(`SELECT id, user_id, type, status, message, created_at, resolved_at FROM user_feedback WHERE id::text LIKE '917b1b29%'`);
  console.log(JSON.stringify(f.rows,null,1));
  if (f.rows[0]) {
    const conv = await c.query(`SELECT id FROM feedback_conversations WHERE feedback_id=$1`,[f.rows[0].id]);
    console.log('conversaciones:',conv.rows);
    for (const cv of conv.rows) {
      const m = await c.query(`SELECT sender_type, message, created_at FROM feedback_messages WHERE conversation_id=$1 ORDER BY created_at`,[cv.id]);
      for (const x of m.rows) console.log('\n['+x.sender_type+' '+x.created_at.toISOString()+']\n'+x.message);
    }
  }
  await c.end();
})();
