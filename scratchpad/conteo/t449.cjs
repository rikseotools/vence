const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const {rows}=await c.query("SELECT id,status,priority,effort,claimed_by,lease_until FROM backlog_tasks WHERE id='T-449'")
  console.table(rows); await c.end() })().catch(e=>{console.error(e.message);process.exit(1)})
