require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Formatos predefinidos de numero en Microsoft Access:**

| Formato | Separador miles | Decimales | Simbolo moneda |
|---------|----------------|-----------|----------------|
| Numero general | No | Si (sin redondeo) | No |
| Fijo | No | Si (2 decimales) | No |
| **Estandar** | **Si** | **Si (2 decimales)** | **No** |
| Moneda | Si | Si (2 decimales) | Si |

Para mostrar **3.456,79** (con separador de miles y 2 decimales, sin simbolo de moneda), el formato correcto es **Estandar**.

**Por que D es correcta:**
El formato "Estandar" muestra numeros con separador de miles (punto en configuracion espanola) y dos decimales (coma). Asi, 3456.79 se muestra como 3.456,79.

**Por que las demas son incorrectas:**

- **A)** "Numero general" - No usa separador de miles. Mostraria 3456,79 (sin punto de miles).

- **B)** "Fijo" - Muestra 2 decimales pero sin separador de miles. Mostraria 3456,79 igual que Numero general.

- **C)** "Moneda" - Muestra separador de miles y decimales, pero anade el simbolo de moneda (por ejemplo, 3.456,79 EUR). El enunciado no pide simbolo de moneda.

**Clave:** Estandar = miles + decimales. Moneda = miles + decimales + simbolo. La diferencia entre ambos es solo el simbolo de moneda.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "c3a2a85a-0f37-4f74-ab01-a78ec4c45628");

  if (error) console.error("Error:", error);
  else console.log("OK - Access formato numeros guardada (" + explanation.length + " chars)");
})();
