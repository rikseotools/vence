require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.39.1 presuncion de validez actos administrativos
  const exp1 = `**Articulo 39.1 de la Ley 39/2015:**

> "Los actos de las Administraciones Publicas sujetos al Derecho Administrativo se **presumiran validos** y produciran efectos desde la **fecha en que se dicten**, salvo que en ellos se disponga otra cosa."

**Por que C es correcta:**
La opcion C dice "se presumiran validos", que es exactamente lo que establece el art. 39.1. La **presuncion de validez** (iuris tantum) significa que los actos se consideran validos mientras no se demuestre lo contrario. No son "validos" en sentido absoluto; se **presumen** validos hasta que se impugnen y se declare su nulidad o anulabilidad.

**Por que las demas son incorrectas (cada una altera un elemento):**

- **A)** "Son **validos** desde la fecha de efectos". Doble error: primero, no dice "validos" sino "se **presumiran** validos" (es una presuncion, no una afirmacion absoluta). Segundo, no dice "fecha de efectos" sino "fecha en que se **dicten**".

- **B)** "Produciran efectos desde la fecha en que **se disponga en ellos**". Falso: invierte la regla general. El art. 39.1 dice que los efectos se producen desde "la fecha en que se **dicten**" como regla general. Solo como excepcion ("salvo que en ellos se disponga otra cosa") puede haber una fecha distinta. La opcion B convierte la excepcion en regla.

- **D)** "Produciran efectos desde el **dia habil inmediatamente posterior** a la fecha en que se dicten". Falso: el art. 39.1 dice "desde la fecha en que se dicten", no desde el dia habil siguiente. No hay un dia de carencia.

**Art. 39.1 Ley 39/2015 - dos reglas:**
1. Se **presumen validos** (presuncion iuris tantum, no validez absoluta)
2. Efectos desde la **fecha en que se dicten** (salvo que dispongan otra cosa)

**Clave:** "Presumiran validos" (no "son validos") + "fecha en que se dicten" (no "dia habil siguiente" ni "fecha de efectos" ni "fecha que se disponga").`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "552e2211-14a1-4259-a38a-3dfacfab6bb3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.39 presuncion validez (" + exp1.length + " chars)");
})();
