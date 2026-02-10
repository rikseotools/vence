require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const today = new Date().toISOString().split("T")[0];

  console.log("=== PAGOS COMPLETADOS HOY (" + today + ") ===\n");

  // Buscar payment_completed de hoy
  const { data: payments } = await supabase
    .from("conversion_events")
    .select("*")
    .eq("event_type", "payment_completed")
    .gte("created_at", today)
    .order("created_at", { ascending: false });

  if (!payments || payments.length === 0) {
    console.log("No hay payment_completed hoy.");

    // Mostrar los últimos 5 pagos
    console.log("\n=== ÚLTIMOS 5 PAGOS ===\n");

    const { data: lastPayments } = await supabase
      .from("conversion_events")
      .select("user_id, created_at, source")
      .eq("event_type", "payment_completed")
      .order("created_at", { ascending: false })
      .limit(5);

    for (const p of lastPayments || []) {
      const { data: user } = await supabase
        .from("user_profiles")
        .select("email, full_name")
        .eq("id", p.user_id)
        .single();

      console.log(`${p.created_at?.substring(0, 16)} | ${user?.email} | ${user?.full_name}`);
    }
  } else {
    console.log("Pagos hoy:", payments.length);
    for (const p of payments) {
      const { data: user } = await supabase
        .from("user_profiles")
        .select("email, full_name")
        .eq("id", p.user_id)
        .single();

      console.log(`${p.created_at?.substring(0, 16)} | ${user?.email} | ${user?.full_name}`);
    }
  }

  // También buscar checkout_started de hoy (intentos)
  console.log("\n=== CHECKOUTS INICIADOS HOY ===\n");

  const { data: checkouts } = await supabase
    .from("conversion_events")
    .select("user_id, created_at")
    .eq("event_type", "checkout_started")
    .gte("created_at", today)
    .order("created_at", { ascending: false });

  if (!checkouts || checkouts.length === 0) {
    console.log("No hay checkouts hoy.");
  } else {
    console.log("Checkouts hoy:", checkouts.length);
    for (const c of checkouts) {
      const { data: user } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("id", c.user_id)
        .single();

      console.log(`${c.created_at?.substring(11, 16)} | ${user?.email}`);
    }
  }
})();
