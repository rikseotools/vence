require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testStatsAPI() {
  const client = await pool.connect();

  try {
    // Obtener un usuario con datos
    const userResult = await client.query(`
      SELECT DISTINCT t.user_id, COUNT(*) as tests
      FROM tests t
      GROUP BY t.user_id
      HAVING COUNT(*) > 10
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.log('No hay usuarios con suficientes tests');
      return;
    }

    const userId = userResult.rows[0].user_id;
    console.log(`Testing with user: ${userId} (${userResult.rows[0].tests} tests)\n`);

    // 1. Probar la función scope-based
    console.log('📊 Theme Performance (scope-based):');
    const scopeResult = await client.query(`
      SELECT * FROM get_theme_performance_by_scope($1)
      ORDER BY topic_number
      LIMIT 10
    `, [userId]);

    scopeResult.rows.forEach(row => {
      console.log(`  Tema ${row.topic_number}: ${row.total_questions} preguntas, ${row.accuracy}% precisión`);
    });

    // 2. Comparar con el método antiguo (tema_number directo)
    console.log('\n📊 Theme Performance (método antiguo - tema_number):');
    const oldResult = await client.query(`
      SELECT
        tq.tema_number,
        COUNT(*) as total_questions,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) as correct_answers,
        ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 1) as accuracy
      FROM test_questions tq
      INNER JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = $1 AND tq.tema_number IS NOT NULL
      GROUP BY tq.tema_number
      ORDER BY tq.tema_number
      LIMIT 10
    `, [userId]);

    oldResult.rows.forEach(row => {
      console.log(`  Tema ${row.tema_number}: ${row.total_questions} preguntas, ${row.accuracy}% precisión`);
    });

    // 3. Mostrar diferencias
    console.log('\n🔍 Comparación (nuevos temas detectados por scope):');
    const scopeTopics = new Set(scopeResult.rows.map(r => r.topic_number));
    const oldTopics = new Set(oldResult.rows.map(r => r.tema_number));

    const newTopics = [...scopeTopics].filter(t => !oldTopics.has(t));
    if (newTopics.length > 0) {
      console.log(`  Temas adicionales detectados: ${newTopics.slice(0, 10).join(', ')}`);
    } else {
      console.log('  No hay diferencias significativas en este usuario');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testStatsAPI();
