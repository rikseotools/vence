const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar TODAS las preguntas activas
  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d")
    .eq("is_active", true);

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  console.log("Total preguntas activas:", data.length);

  // Filtrar las que tienen opciones vacías
  const problematic = data.filter(q => {
    const a = q.option_a ? q.option_a.trim() : "";
    const b = q.option_b ? q.option_b.trim() : "";
    const c = q.option_c ? q.option_c.trim() : "";
    const d = q.option_d ? q.option_d.trim() : "";
    return a === "" || b === "" || c === "" || d === "";
  });

  console.log("Con opciones vacías:", problematic.length);
  console.log("");

  if (problematic.length === 0) {
    console.log("✅ No hay más preguntas con opciones vacías");
    return;
  }

  console.log("=== PREGUNTAS CON OPCIONES VACÍAS ===");
  problematic.forEach((q, i) => {
    const emptyOpts = [];
    if (!q.option_a || q.option_a.trim() === "") emptyOpts.push("A");
    if (!q.option_b || q.option_b.trim() === "") emptyOpts.push("B");
    if (!q.option_c || q.option_c.trim() === "") emptyOpts.push("C");
    if (!q.option_d || q.option_d.trim() === "") emptyOpts.push("D");

    console.log("---", i + 1, "---");
    console.log("ID:", q.id);
    console.log("Texto:", q.question_text ? q.question_text.substring(0, 100) : "(sin texto)");
    console.log("Opciones vacías:", emptyOpts.join(", "));
    console.log("");
  });
})();
