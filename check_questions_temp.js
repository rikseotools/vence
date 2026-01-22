require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_at, is_active")
    .gte("created_at", oneWeekAgo.toISOString())
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Preguntas añadidas en los últimos 7 días:", data.length);
  console.log("");
  
  const problemas = [];
  
  data.forEach((q) => {
    const respuestaLetra = ["A", "B", "C", "D"][q.correct_option];
    const explicacion = q.explanation || "";
    
    const patronA = /la respuesta correcta es a\)/i;
    const patronB = /la respuesta correcta es b\)/i;
    const patronC = /la respuesta correcta es c\)/i;
    const patronD = /la respuesta correcta es d\)/i;
    
    let letraEnExplicacion = null;
    if (patronA.test(explicacion)) letraEnExplicacion = "A";
    else if (patronB.test(explicacion)) letraEnExplicacion = "B";
    else if (patronC.test(explicacion)) letraEnExplicacion = "C";
    else if (patronD.test(explicacion)) letraEnExplicacion = "D";
    
    if (letraEnExplicacion && letraEnExplicacion !== respuestaLetra) {
      problemas.push({
        id: q.id,
        pregunta: q.question_text.substring(0, 80),
        respuestaMarcada: respuestaLetra,
        explicacionDice: letraEnExplicacion,
        created_at: q.created_at
      });
    }
  });
  
  console.log("Posibles inconsistencias encontradas:", problemas.length);
  console.log("");
  
  problemas.forEach((p, i) => {
    console.log("─────────────────────────────────────────");
    console.log("#" + (i+1));
    console.log("ID:", p.id);
    console.log("Pregunta:", p.pregunta + "...");
    console.log("Respuesta marcada:", p.respuestaMarcada);
    console.log("Explicación dice:", p.explicacionDice);
    console.log("Creada:", p.created_at.substring(0, 10));
  });
})();
