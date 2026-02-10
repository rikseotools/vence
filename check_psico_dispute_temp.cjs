require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: disputes } = await supabase
    .from("psychometric_question_disputes")
    .select("id, user_id, question_id, dispute_type, description, is_read, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!disputes || disputes.length === 0) {
    console.log("No hay disputas pendientes");
    return;
  }

  const d = disputes[0];

  const { data: q } = await supabase
    .from("psychometric_questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, question_subtype, content_data")
    .eq("id", d.question_id)
    .single();

  const { data: u } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", d.user_id)
    .single();

  console.log("========================================");
  console.log("IMPUGNACIÓN PSICOTÉCNICA #1");
  console.log("========================================");
  console.log("");
  console.log("UUID:", d.id);
  console.log("Usuario:", u ? u.full_name : "Desconocido");
  console.log("Tipo:", d.dispute_type);
  console.log("is_read:", d.is_read);
  console.log("Fecha:", d.created_at);
  console.log("");
  console.log("--- COMENTARIO ---");
  console.log(d.description || "(sin comentario)");
  console.log("");
  console.log("--- PREGUNTA ---");
  console.log("ID:", q ? q.id : "N/A");
  console.log("Subtipo:", q ? q.question_subtype : "N/A");
  console.log(q ? q.question_text : "N/A");
  console.log("");
  console.log("--- OPCIONES ---");
  console.log("A)", q ? q.option_a : "");
  console.log("B)", q ? q.option_b : "");
  console.log("C)", q ? q.option_c : "");
  console.log("D)", q ? q.option_d : "");
  console.log("");
  console.log("--- RESPUESTA CORRECTA ---");
  var letters = ["A","B","C","D"];
  console.log(q ? q.correct_option : "N/A", "(" + (q ? letters[q.correct_option] : "N/A") + ")");
  console.log("");
  console.log("--- EXPLICACIÓN ---");
  console.log(q ? q.explanation : "(sin explicación)");
  console.log("");
  if (q && q.content_data) {
    console.log("--- CONTENT_DATA ---");
    console.log(JSON.stringify(q.content_data, null, 2));
  }
})();
