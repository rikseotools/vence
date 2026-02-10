#!/usr/bin/env node
/**
 * Script para guardar los resultados de la revisión de preguntas problemáticas
 * en la base de datos usando Drizzle ORM.
 *
 * Uso: npx tsx scripts/save_problematic_review.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { aiVerificationResults, questions } from '../db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

interface ReviewResult {
  questionId: string;
  status: string;
  answerOk: boolean;
  explanationOk: boolean;
  correctOptionShouldBe: number | null;
  improvedExplanation: string;
  microsoftSource: string;
  notes: string;
  verifiedAt: string;
}

async function main() {
  // Verificar que DATABASE_URL existe
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL no está configurado en .env.local');
    process.exit(1);
  }

  // Conectar a la base de datos
  const connectionString = process.env.DATABASE_URL;
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('📂 Leyendo archivo problematic_questions_review.json...');

  // Leer el archivo JSON
  const jsonPath = path.join(process.cwd(), 'problematic_questions_review.json');

  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Error: No se encuentra el archivo problematic_questions_review.json');
    process.exit(1);
  }

  const results: ReviewResult[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`✅ Se encontraron ${results.length} preguntas para procesar\n`);

  let successCount = 0;
  let errorCount = 0;

  // Procesar cada resultado
  for (const result of results) {
    try {
      console.log(`📝 Procesando pregunta: ${result.questionId}`);
      console.log(`   Estado: ${result.status}`);
      console.log(`   Respuesta OK: ${result.answerOk}`);
      console.log(`   Explicación OK: ${result.explanationOk}`);

      // Insert/update en ai_verification_results
      // IMPORTANTE: El constraint único es (questionId, aiProvider)
      await db.insert(aiVerificationResults).values({
        questionId: result.questionId,
        isCorrect: result.answerOk,
        confidence: result.answerOk && result.explanationOk ? 'high' : 'medium',
        explanation: result.improvedExplanation,
        correctOptionShouldBe: result.correctOptionShouldBe?.toString() || null,
        aiProvider: 'claude-code-sonnet',
        aiModel: 'claude-sonnet-4.5',
        verifiedAt: new Date(result.verifiedAt).toISOString(),
        answerOk: result.answerOk,
        explanationOk: result.explanationOk,
        articleOk: null, // No aplicable para temas técnicos
        newExplanation: result.improvedExplanation,
      }).onConflictDoUpdate({
        target: [aiVerificationResults.questionId, aiVerificationResults.aiProvider],
        set: {
          isCorrect: result.answerOk,
          confidence: result.answerOk && result.explanationOk ? 'high' : 'medium',
          explanation: result.improvedExplanation,
          correctOptionShouldBe: result.correctOptionShouldBe?.toString() || null,
          verifiedAt: new Date(result.verifiedAt).toISOString(),
          answerOk: result.answerOk,
          explanationOk: result.explanationOk,
          newExplanation: result.improvedExplanation,
        }
      });

      console.log('   ✅ Guardado en ai_verification_results');

      // Actualizar topic_review_status en questions
      await db
        .update(questions)
        .set({
          topicReviewStatus: result.status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(questions.id, result.questionId));

      console.log('   ✅ Actualizado topic_review_status\n');

      successCount++;
    } catch (error) {
      console.error(`   ❌ Error procesando pregunta ${result.questionId}:`, error);
      errorCount++;
    }
  }

  // Cerrar conexión
  await client.end();

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PROCESAMIENTO');
  console.log('='.repeat(60));
  console.log(`✅ Preguntas procesadas exitosamente: ${successCount}`);
  console.log(`❌ Preguntas con errores: ${errorCount}`);
  console.log(`📝 Total de preguntas: ${results.length}`);
  console.log('='.repeat(60) + '\n');

  // Estadísticas por estado
  const statusCounts: Record<string, number> = {};
  results.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  console.log('📈 ESTADÍSTICAS POR ESTADO:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  console.log('');

  process.exit(errorCount > 0 ? 1 : 0);
}

// Ejecutar script
main().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
