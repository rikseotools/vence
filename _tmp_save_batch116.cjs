require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 29/1998 art.115 recurso proteccion derechos fundamentales 10 dias
  const exp1 = `**Articulo 115.1 de la Ley 29/1998 (LJCA):**

> "El plazo para interponer este recurso sera de **diez dias**, que se computaran, segun los casos, desde el dia siguiente al de notificacion del acto, publicacion de la disposicion impugnada, requerimiento para el cese de la via de hecho, o transcurso del plazo fijado para la resolucion, sin mas tramites."

**Por que C es correcta (diez dias):**
El procedimiento especial de proteccion de los derechos fundamentales de la persona (arts. 114-122 LJCA) tiene un plazo de interposicion de **10 dias**. Este plazo es mas breve que el del recurso contencioso-administrativo ordinario (2 meses) porque se trata de un procedimiento **preferente y sumario** para la tutela urgente de derechos fundamentales (en desarrollo del art. 53.2 CE).

**Por que las demas son incorrectas (plazos que no corresponden):**

- **A)** "Veinte dias". Falso: 20 dias es el plazo para formular la **demanda** en el procedimiento contencioso-administrativo ordinario (art. 67.1 LJCA), no para interponer el recurso especial de derechos fundamentales.

- **B)** "Treinta dias". Falso: no hay ningun plazo de 30 dias en este procedimiento especial. Podria confundirse con otros plazos administrativos, pero no corresponde al art. 115.

- **D)** "Quince dias". Falso: 15 dias es el plazo para contestar la demanda en el procedimiento abreviado (art. 78.3 LJCA), no para interponer el recurso de proteccion de derechos fundamentales.

**Plazos clave en la jurisdiccion contencioso-administrativa:**

| Procedimiento | Plazo de interposicion |
|---------------|----------------------|
| **Proteccion derechos fundamentales** | **10 dias** (art. 115) |
| Recurso ordinario (contra actos) | 2 meses (art. 46.1) |
| Recurso ordinario (contra silencio) | 6 meses (art. 46.1) |
| Recurso de casacion | 30 dias (art. 89.2) |

**Clave:** Recurso especial de derechos fundamentales = 10 dias. Es el plazo mas breve porque es un procedimiento preferente y sumario.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f5f8d438-ef33-4291-8e3a-d5e11664b4ab");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LJCA art.115 diez dias (" + exp1.length + " chars)");
})();
