require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    const sqlPath = path.join(__dirname, '../database/migrations/add_theme_performance_by_scope.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!');

    // Test the function
    console.log('\nTesting function with a sample user...');
    const testResult = await client.query(`
      SELECT user_id FROM tests LIMIT 1
    `);

    if (testResult.rows.length > 0) {
      const userId = testResult.rows[0].user_id;
      const result = await client.query(`
        SELECT * FROM get_theme_performance_by_scope($1) LIMIT 5
      `, [userId]);

      console.log('Sample results:');
      result.rows.forEach(row => {
        console.log(`  Tema ${row.topic_number}: ${row.total_questions} preguntas, ${row.accuracy}% precisión`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
