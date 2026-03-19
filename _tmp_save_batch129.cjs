require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.17 detencion preventiva 72 horas
  const exp1 = `**Articulo 17.2 de la Constitucion Espanola:**

> "La detencion preventiva no podra durar mas del tiempo estrictamente necesario para la realizacion de las averiguaciones tendentes al esclarecimiento de los hechos, y, en todo caso, en el plazo maximo de **setenta y dos horas**, el detenido debera ser puesto en libertad o a disposicion de la **autoridad judicial**."

**Por que B es correcta:**
La opcion B reproduce literalmente el art. 17.2 CE. Establece dos limites temporales: (1) no mas de lo estrictamente necesario, y (2) como maximo absoluto, **72 horas**. Transcurrido ese plazo, el detenido debe ser puesto en libertad o pasar a disposicion judicial.

**Por que las demas son incorrectas (cada una altera el texto constitucional):**

- **A)** "Todos los **espanoles** tienen derecho a la libertad y a la seguridad". Falso: el art. 17.1 dice "toda **persona**", no "todos los espanoles". El derecho a la libertad es un derecho de toda persona (nacional o extranjera), no solo de los espanoles. La trampa limita el ambito subjetivo.

- **C)** "El habeas corpus para producir la inmediata **puesta en libertad** de toda persona detenida ilegalmente". Falso: el art. 17.4 dice "puesta a **disposicion judicial**", no "puesta en libertad". El habeas corpus lleva al detenido ante un juez, que decidira si procede la libertad. No garantiza automaticamente la liberacion.

- **D)** "Por **norma con rango de ley** se determinara el plazo maximo de duracion de la prision provisional". Falso: el art. 17.4 dice "por **ley**", no "por norma con rango de ley". Aunque parece similar, "norma con rango de ley" incluiria Decretos-ley y Decretos Legislativos, mientras que la CE exige **ley** (formal, del Parlamento). En materia de privacion de libertad, la reserva de ley es estricta.

**Contenido del art. 17 CE:**

| Apartado | Contenido | Dato clave |
|----------|-----------|------------|
| 17.1 | Derecho a la libertad | "Toda **persona**" (no solo espanoles) |
| **17.2** | **Detencion preventiva** | **Max 72 horas** |
| 17.3 | Derechos del detenido | Informacion + abogado |
| 17.4 | Habeas corpus | Disposicion **judicial** (no libertad) |

**Clave:** "Toda persona" (no espanoles), 72 horas, disposicion judicial (no libertad), por ley (no norma con rango de ley).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "2c5fa171-74e4-4db7-b7d2-6a27ddfd9591");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.17 detencion 72h (" + exp1.length + " chars)");
})();
