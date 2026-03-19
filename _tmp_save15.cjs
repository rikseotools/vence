require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Reglas de nombres de campo en Microsoft Access:**

Los nombres pueden tener hasta 64 caracteres e incluir letras, numeros, espacios y caracteres especiales, **excepto** estos caracteres prohibidos:
- Puntos ( . )
- Signos de exclamacion ( ! )
- Acentos graves ( \` )
- Corchetes ( [ ] )

Ademas, no pueden empezar por espacios ni incluir caracteres de control (ASCII 0-31).

**Por que B es correcta:**
"1_id_moneda" es valido: contiene numeros, letras, guiones bajos y el simbolo del euro. Ninguno de estos caracteres esta prohibido. Access permite incluso que el nombre empiece por un numero.

**Por que las demas son incorrectas:**

- **A)** "precio.$" - Contiene un **punto** ( . ), que es un caracter prohibido en nombres de campo de Access.

- **C)** "direccion[web]" - Contiene **corchetes** ( [ ] ), que estan prohibidos. Access usa los corchetes internamente como delimitadores de nombres de objetos.

- **D)** "oferta!" - Contiene un **signo de exclamacion** ( ! ), que esta prohibido. Access usa el ! como operador de referencia (por ejemplo, Forms!NombreFormulario).

**Clave:** Los caracteres prohibidos ( . ! \` [ ] ) son los que Access usa internamente como operadores o delimitadores. Por eso no se permiten en nombres.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "41e06bd3-d0dd-43b9-82f5-3efe83122249");

  if (error) console.error("Error:", error);
  else console.log("OK - Access nombres campo guardada (" + explanation.length + " chars)");
})();
