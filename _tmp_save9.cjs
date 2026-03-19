require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 15.2 de la LO 3/2018** (Proteccion de Datos):

> "Cuando la supresion derive del ejercicio del **derecho de oposicion** con arreglo al articulo 21.2 del Reglamento (UE) 2016/679, el responsable podra conservar los datos identificativos del afectado necesarios con el fin de impedir tratamientos futuros para fines de **mercadotecnia directa**."

**Por que C es correcta:**
El art. 15.2 permite conservar datos identificativos SOLO cuando la supresion procede del ejercicio del **derecho de oposicion** (art. 21.2 RGPD, relativo a marketing directo). La logica es practica: si alguien se opone a recibir publicidad, el responsable necesita conservar sus datos minimos para saber a quien NO debe enviar publicidad en el futuro.

**Por que las demas son incorrectas:**

- **A)** "En ningun caso" - Falso. El art. 15.2 establece precisamente una excepcion que permite conservar datos identificativos en el supuesto de oposicion a mercadotecnia.

- **B)** "En cualquier caso" - Falso. No es una autorizacion general. Solo se permite en el caso concreto del derecho de oposicion a mercadotecnia directa (art. 21.2 RGPD), no en cualquier supresion.

- **D)** "Cuando derive del derecho de rectificacion" - Falso. El articulo dice expresamente "derecho de **oposicion**", no de rectificacion. Son derechos distintos: la rectificacion (art. 16 RGPD) corrige datos inexactos; la oposicion (art. 21 RGPD) impide un tratamiento concreto.

**Clave:** La excepcion del art. 15.2 tiene una finalidad practica: mantener una "lista de exclusion" para no volver a enviar marketing a quien se ha opuesto.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "c8853124-ed02-4d32-9e43-2d57fa06d1e9");

  if (error) console.error("Error:", error);
  else console.log("OK - LO 3/2018 art.15 guardada (" + explanation.length + " chars)");
})();
