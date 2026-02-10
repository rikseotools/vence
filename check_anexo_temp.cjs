require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Ver estructura de la tabla user_feedback
  const { data, error } = await supabase
    .from("user_feedback")
    .select("*")
    .limit(1);

  if (data && data[0]) {
    console.log("Columnas de user_feedback:");
    console.log(Object.keys(data[0]));
  }

  // Intentar insertar un feedback de prueba
  const { error: insertError } = await supabase
    .from("user_feedback")
    .insert({
      user_id: "379f10a1-dc3b-4033-9113-cddd8613af76", // usuario de prueba
      message: "Test eliminación",
      feedback_type: "account_deletion",
      status: "pending",
      page_url: "/perfil"
    });

  if (insertError) {
    console.log("\nError al insertar:", insertError);
  } else {
    console.log("\nInserción exitosa");
  }
})();
