const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar usuario por nombre
  const { data: users, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, nickname, plan_type, stripe_customer_id, created_at, updated_at, trial_end_date, requires_payment")
    .or("nickname.ilike.%gaditadelgado%,email.ilike.%gaditadelgado%,full_name.ilike.%gaditadelgado%");

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log("No se encontró usuario con gaditadelgado");
    return;
  }

  console.log("=== USUARIO ENCONTRADO ===");
  const user = users[0];
  console.log("ID:", user.id);
  console.log("Email:", user.email);
  console.log("Nombre:", user.full_name);
  console.log("Nickname:", user.nickname);
  console.log("Plan Type:", user.plan_type);
  console.log("Stripe Customer ID:", user.stripe_customer_id);
  console.log("Trial End Date:", user.trial_end_date);
  console.log("Requires Payment:", user.requires_payment);
  console.log("Created:", user.created_at);
  console.log("Updated:", user.updated_at);
  console.log("");

  // Buscar pagos/conversiones de este usuario
  console.log("=== EVENTOS DE CONVERSIÓN ===");
  const { data: conversions, error: convError } = await supabase
    .from("conversion_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (convError) {
    console.log("Error conversiones:", convError.message);
  } else if (!conversions || conversions.length === 0) {
    console.log("No hay eventos de conversión para este usuario");
  } else {
    conversions.forEach((c, i) => {
      console.log(`--- Evento ${i + 1} ---`);
      console.log("Tipo:", c.event_type);
      console.log("Datos:", JSON.stringify(c.event_data, null, 2));
      console.log("Fecha:", c.created_at);
    });
  }

  // Buscar en stripe_events si existe
  console.log("");
  console.log("=== STRIPE EVENTS (si existe) ===");
  const { data: stripeEvents, error: stripeError } = await supabase
    .from("stripe_events")
    .select("*")
    .eq("customer_id", user.stripe_customer_id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (stripeError) {
    console.log("Error o tabla no existe:", stripeError.message);
  } else if (!stripeEvents || stripeEvents.length === 0) {
    console.log("No hay eventos de Stripe para este customer");
  } else {
    stripeEvents.forEach((e, i) => {
      console.log(`--- Stripe Event ${i + 1} ---`);
      console.log("Event Type:", e.event_type);
      console.log("Fecha:", e.created_at);
    });
  }

  // Verificar límites de uso diario
  console.log("");
  console.log("=== USO DIARIO ===");
  const today = new Date().toISOString().split("T")[0];
  const { data: usage, error: usageError } = await supabase
    .from("daily_question_usage")
    .select("*")
    .eq("user_id", user.id)
    .gte("usage_date", today)
    .order("usage_date", { ascending: false })
    .limit(5);

  if (usageError) {
    console.log("Error usage:", usageError.message);
  } else if (!usage || usage.length === 0) {
    console.log("No hay uso registrado hoy");
  } else {
    usage.forEach(u => {
      console.log("Fecha:", u.usage_date, "- Preguntas:", u.questions_count);
    });
  }

  // Verificar suscripciones
  console.log("");
  console.log("=== SUSCRIPCIONES ===");
  const { data: subs, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id);

  if (subError) {
    console.log("Error subs:", subError.message);
  } else if (!subs || subs.length === 0) {
    console.log("No hay suscripciones para este usuario");
  } else {
    subs.forEach(s => {
      console.log("ID:", s.id);
      console.log("Status:", s.status);
      console.log("Plan:", s.plan_id || s.price_id);
      console.log("Stripe Sub ID:", s.stripe_subscription_id);
      console.log("Current Period End:", s.current_period_end);
      console.log("Created:", s.created_at);
      console.log("");
    });
  }
})();
