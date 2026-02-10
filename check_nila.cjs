require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser(email) {
  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email")
    .ilike("email", `%${email}%`);

  if (!users || users.length === 0) {
    console.log(`Usuario ${email} no encontrado`);
    return;
  }

  const user = users[0];
  console.log("\n========================================");
  console.log("Usuario:", user.id, user.email);

  // Buscar sus tests oficiales
  const { data: tests } = await supabase
    .from("tests")
    .select("id, title, is_completed, detailed_analytics, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  console.log("Total tests:", tests?.length || 0);

  let officialCount = 0;
  if (tests) {
    tests.forEach(t => {
      const a = t.detailed_analytics;
      if (a && a.isOfficialExam) {
        officialCount++;
        console.log("\n  Test ID:", t.id);
        console.log("  Title:", t.title);
        console.log("  Completado:", t.is_completed);
        console.log("  completed_at:", t.completed_at);
        console.log("  examDate:", a.examDate);
        console.log("  parte:", a.parte);
      }
    });
  }

  if (officialCount === 0) {
    console.log("  (ningún examen oficial encontrado)");
  }
}

(async () => {
  await checkUser("manueltrader");
  await checkUser("jinayda");

  if (!users || users.length === 0) {
    console.log("Usuario Nila no encontrado");
    return;
  }

  const user = users[0];
  console.log("Usuario:", user.id, user.email);

  // Buscar sus tests oficiales
  const { data: tests } = await supabase
    .from("tests")
    .select("id, title, is_completed, detailed_analytics, completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("\nTodos los tests del usuario:", tests?.length || 0);

  let officialCount = 0;
  if (tests) {
    tests.forEach(t => {
      const a = t.detailed_analytics;
      if (a && a.isOfficialExam) {
        officialCount++;
        console.log("\n  Test ID:", t.id);
        console.log("  Title:", t.title);
        console.log("  Completado:", t.is_completed);
        console.log("  completed_at:", t.completed_at);
        console.log("  examDate:", a.examDate);
        console.log("  parte:", a.parte);
        console.log("  oposicion:", a.oposicion);
      }
    });
  }

  if (officialCount === 0) {
    console.log("\n  (ningún examen oficial encontrado)");
  }
})();
