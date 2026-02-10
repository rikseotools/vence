import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { questions } from './db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

interface VerificationResult {
  questionId: string;
  status: string;
  improvedExplanation?: string | null;
}

async function main() {
  console.log('🚀 Actualizando topic_review_status en tabla questions...\n');

  // Cargar TODOS los archivos JSON
  const allResults: VerificationResult[] = [];

  const files = ['1', '2', '3', '4', '5', '6'];
  for (const num of files) {
    const filename = `verification_results_lote${num}.json`;
    if (fs.existsSync(filename)) {
      const data = JSON.parse(fs.readFileSync(filename, 'utf-8'));
      allResults.push(...data.filter((r: any) => r.questionId && r.questionId.match(/^[0-9a-f-]{36}$/i)));
      console.log(`✅ Cargado ${filename}: ${data.length} preguntas`);
    }
  }

  console.log(`\n📊 Total de resultados cargados: ${allResults.length}\n`);

  let updated = 0;
  let errors = 0;

  for (const result of allResults) {
    try {
      // Solo actualizar topic_review_status (NO explanation aquí)
      await db
        .update(questions)
        .set({ topicReviewStatus: result.status })
        .where(eq(questions.id, result.questionId));

      console.log(`[${updated + errors + 1}/${allResults.length}] ✅ ${result.questionId} → ${result.status}`);
      updated++;

    } catch (error: any) {
      console.log(`[${updated + errors + 1}/${allResults.length}] ❌ Error: ${error.message}`);
      errors++;
    }

    // Pausa breve cada 10
    if ((updated + errors) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log(`✅ Actualizadas: ${updated}`);
  console.log(`❌ Errores: ${errors}`);

  console.log('\n📈 Desglose por estado:');
  const statusCounts: Record<string, number> = {};
  allResults.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  await client.end();
}

main().catch(console.error);
