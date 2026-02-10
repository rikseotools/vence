import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { aiVerificationResults, questions } from './db/schema';
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
  answerOk: boolean;
  explanationOk: boolean;
  improvedExplanation?: string | null;
  microsoftSource?: string | null;
  verifiedAt: string;
  notes?: string;
}

async function main() {
  console.log('🚀 Cargando resultados de verificación - Lotes 3 y 4...\n');

  // Cargar archivos JSON
  const lote3 = JSON.parse(fs.readFileSync('verification_results_lote3.json', 'utf-8')) as VerificationResult[];
  const lote4 = JSON.parse(fs.readFileSync('verification_results_lote4.json', 'utf-8')) as VerificationResult[];

  const allResults = [...lote3, ...lote4];

  console.log(`📊 Total de resultados a guardar: ${allResults.length}\n`);

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (const result of allResults) {
    try {
      console.log(`[${saved + skipped + errors + 1}/${allResults.length}] Guardando ${result.questionId}...`);

      // 1. Insertar en ai_verification_results
      await db.insert(aiVerificationResults).values({
        questionId: result.questionId,
        isCorrect: result.answerOk,
        confidence: result.answerOk && result.explanationOk ? 'high' : 'medium',
        explanation: result.improvedExplanation || result.notes || null,
        aiProvider: 'claude-code-sonnet',
        aiModel: 'claude-sonnet-4.5',
        verifiedAt: new Date(result.verifiedAt).toISOString(),
        answerOk: result.answerOk,
        explanationOk: result.explanationOk,
      });

      // 2. Actualizar topic_review_status en questions
      await db
        .update(questions)
        .set({ topicReviewStatus: result.status })
        .where(eq(questions.id, result.questionId));

      // 3. Si hay explicación mejorada, actualizar también la explicación
      if (result.improvedExplanation && result.improvedExplanation.length > 100) {
        await db
          .update(questions)
          .set({ explanation: result.improvedExplanation })
          .where(eq(questions.id, result.questionId));
      }

      console.log(`  ✅ Guardada como ${result.status}`);
      saved++;

      // Pausa breve
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        console.log(`  ⚠️  Ya existe en BD`);
        skipped++;
      } else {
        console.log(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }
  }

  console.log('\n=== RESUMEN FINAL ===');
  console.log(`✅ Guardadas: ${saved}`);
  console.log(`⚠️  Saltadas (duplicadas): ${skipped}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total procesado: ${saved + skipped}`);

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
