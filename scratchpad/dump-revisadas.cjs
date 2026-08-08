const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const fs = require('fs')

;(async () => {
  const c = new Client(pgConfig()); await c.connect()
  const q = await c.query(`
    select id, priority, title, review_verdict, reviewed_by, review_note, review_findings
    from backlog_tasks
    where reviewed_at is not null and closed_at is null and review_verdict = 'problemas'
    order by priority, id`)
  let out = ''
  for (const r of q.rows) {
    out += '\n' + '='.repeat(90) + `\n${r.id} [${r.priority}] ${r.title}\n(revisó ${r.reviewed_by})\n`
    out += `\n--- ENTREGA:\n${r.review_note || '(sin nota)'}\n`
    out += `\n--- HALLAZGOS:\n${r.review_findings || '(sin hallazgos)'}\n`
  }
  fs.writeFileSync(__dirname + '/revisadas-problemas.txt', out)
  console.log('escritas', q.rows.length, 'tareas ·', out.length, 'chars')
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
