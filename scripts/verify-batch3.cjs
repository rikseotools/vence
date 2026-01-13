const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROBLEMS_FILE = "/tmp/verification_problems.json";

function loadProblems() {
  try {
    if (fs.existsSync(PROBLEMS_FILE)) {
      return JSON.parse(fs.readFileSync(PROBLEMS_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function saveProblems(problems) {
  fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
}

async function saveVerification(questionId, result) {
  const { data: q } = await supabase
    .from("questions")
    .select(`
      id,
      question_text,
      primary_article_id,
      articles!questions_primary_article_id_fkey (
        id,
        law_id
      )
    `)
    .eq("id", questionId)
    .single();

  if (!q) return false;

  const verification = {
    question_id: q.id,
    article_id: q.articles?.id,
    law_id: q.articles?.law_id,
    is_correct: result.answerOk,
    confidence: "alta",
    explanation: result.reasoning,
    article_quote: result.articleQuote || null,
    suggested_fix: result.suggestedFix || null,
    correct_option_should_be: result.correctOptionShouldBe || null,
    ai_provider: "anthropic",
    ai_model: "claude-opus-4-5-real",
    verified_at: new Date().toISOString(),
    article_ok: result.articleOk,
    answer_ok: result.answerOk,
    explanation_ok: result.explanationOk
  };

  const { data: existing } = await supabase
    .from("ai_verification_results")
    .select("id")
    .eq("question_id", q.id)
    .eq("ai_provider", "anthropic")
    .single();

  let error;
  if (existing) {
    const { error: e } = await supabase.from("ai_verification_results").update(verification).eq("id", existing.id);
    error = e;
  } else {
    const { error: e } = await supabase.from("ai_verification_results").insert(verification);
    error = e;
  }

  if (error) return false;

  const status = result.articleOk && result.answerOk && result.explanationOk ? "ok" : "problem";
  await supabase.from("questions").update({ verification_status: status, topic_review_status: result.status, verified_at: new Date().toISOString() }).eq("id", q.id);

  if (status === "problem") {
    const problems = loadProblems();
    problems.push({ questionId: q.id, status: result.status, reasoning: result.reasoning, timestamp: new Date().toISOString() });
    saveProblems(problems);
  }
  return true;
}

// Lote 3: Ley 40/2015 - todas perfectas
const verifications = [
  { id: "1375d0e7-931c-46ac-bad5-58b2d4d97d7b", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 55.3 Ley 40/2015: Organos superiores: 1. Ministros, 2. Secretarios de Estado. Opcion C correcta.", articleQuote: "Organos superiores: 1.o Los Ministros. 2.o Los Secretarios de Estado." }},
  { id: "bc20fd28-0e5e-42a8-ae91-0c9ca2cdcb62", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 63.1.m Ley 40/2015: Subsecretarios 'Convocar y resolver pruebas selectivas de personal funcionario y laboral'. Opcion B correcta.", articleQuote: "Convocar y resolver pruebas selectivas de personal funcionario y laboral" }},
  { id: "df67ac02-f7b0-4ce8-8166-fa863ef6e39e", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 55.4 Ley 40/2015: 'En la organizacion territorial son organos directivos tanto los Delegados del Gobierno como los Subdelegados'. Opcion C correcta.", articleQuote: "En la organizacion territorial de la AGE son organos directivos tanto los Delegados del Gobierno...como los Subdelegados del Gobierno" }},
  { id: "a5a872de-3df3-4556-b261-059046871753", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 76.1 Ley 40/2015: Delegaciones 'contaran, en todo caso, con una Secretaria General'. Opcion C correcta.", articleQuote: "contaran, en todo caso, con una Secretaria General" }},
  { id: "101caf3b-16b2-43be-a107-773aeb8ca9a5", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 63.1.e Ley 40/2015: Subsecretarios 'planificacion de los sistemas de informacion y comunicacion'. Opcion D correcta.", articleQuote: "la planificacion de los sistemas de informacion y comunicacion" }},
  { id: "4c63f9ca-241c-4b7f-a8a8-b6e1199973ff", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 79.2 Ley 40/2015: Comision integrada por Secretario General y titulares de organos. Subsecretario NO esta. Opcion C correcta.", articleQuote: "integrada por el Secretario General y los titulares de los organos y servicios territoriales" }},
  { id: "8b8fedbe-8639-4505-917f-d0da5d2911a4", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 69.2 Ley 40/2015: 'sede en la localidad donde radique el Consejo de Gobierno de la CCAA'. Opcion C correcta.", articleQuote: "tendran su sede en la localidad donde radique el Consejo de Gobierno de la Comunidad Autonoma" }},
  { id: "9af57a2e-50b2-4f97-a863-a56fa9bc6c5b", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 76.1 Ley 40/2015: 'se fijara por Real Decreto del Consejo de Ministros'. Opcion B correcta.", articleQuote: "La estructura de las Delegaciones y Subdelegaciones se fijara por Real Decreto del Consejo de Ministros" }},
  { id: "e66078bb-8541-4033-af95-75ddfe4b47fd", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 62.2.b Ley 40/2015: Menciona controlar, supervisar e impartir instrucciones. 'Sancionar' NO aparece. Opcion B correcta.", articleQuote: "controlando su cumplimiento, supervisando la actividad de los organos directivos adscritos e impartiendo instrucciones" }},
  { id: "49143e9c-5021-47fe-940c-5d493a1ef521", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 74 Ley 40/2015: Subdelegado 'sera nombrado por aquel (Delegado del Gobierno) mediante libre designacion'. Opcion C correcta.", articleQuote: "sera nombrado por aquel mediante el procedimiento de libre designacion" }},
  { id: "a044cc8c-70ab-456d-8833-ac684d79d2a9", result: { articleOk: true, answerOk: true, explanationOk: true, status: "perfect", reasoning: "Art 61 Ley 40/2015: Ministros 'Otorgar premios y recompensas propios del Departamento'. Opcion D correcta.", articleQuote: "Otorgar premios y recompensas propios del Departamento y proponer las que corresponda" }}
];

(async () => {
  console.log("Guardando", verifications.length, "verificaciones...\n");
  let ok = 0, errors = 0;
  for (const v of verifications) {
    const saved = await saveVerification(v.id, v.result);
    if (saved) { ok++; console.log("OK:", v.id.substring(0, 8), "-", v.result.status); }
    else { errors++; console.log("ERROR:", v.id.substring(0, 8)); }
  }
  console.log("\nResumen: OK=" + ok + ", Errors=" + errors);
})();
