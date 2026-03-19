require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.116.6 responsabilidad del Gobierno no se modifica
  const exp1 = `**Articulo 116.6 de la Constitucion Espanola:**

> "La declaracion de los estados de alarma, de excepcion y de sitio **no modificaran el principio de responsabilidad del Gobierno y de sus agentes** reconocidos en la Constitucion y en las leyes."

**Por que D es correcta (principio de responsabilidad):**
El art. 116.6 CE garantiza que, incluso durante los estados excepcionales, el Gobierno y sus agentes siguen siendo **responsables** de sus actos. No pueden escudarse en el estado de alarma, excepcion o sitio para actuar sin consecuencias. La responsabilidad politica, patrimonial y penal se mantiene intacta.

**Por que las demas son incorrectas (principios inventados o que no aparecen en el art. 116.6):**

- **A)** "El principio de **seguridad juridica**". Falso: aunque la seguridad juridica es un principio constitucional (art. 9.3 CE), el art. 116.6 no habla de seguridad juridica sino de **responsabilidad**. La trampa sustituye un principio constitucional por otro.

- **B)** "El principio de **confidencialidad**". Falso: no existe un "principio de confidencialidad del Gobierno" en la CE. La confidencialidad no es el principio que protege el art. 116.6.

- **C)** "El principio de **publicidad**". Falso: aunque la publicidad es un principio importante (art. 9.3 CE, publicidad de las normas), el art. 116.6 protege especificamente la **responsabilidad**, no la publicidad.

**Los estados excepcionales (art. 116 CE):**

| Estado | Quien declara | Plazo |
|--------|--------------|-------|
| Alarma | Gobierno (Consejo de Ministros) | 15 dias (prorrogable con autorizacion Congreso) |
| Excepcion | Gobierno con autorizacion del Congreso | 30 dias (prorrogable 30 mas) |
| Sitio | Congreso a propuesta del Gobierno | Sin plazo fijo |

**Garantia comun (art. 116.6):** En los tres estados, se mantiene el principio de **responsabilidad** del Gobierno y sus agentes.

**Clave:** Responsabilidad (no seguridad juridica, ni confidencialidad, ni publicidad). El Gobierno responde de sus actos incluso en estados excepcionales.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ba97b479-24fc-4021-b91d-fed8890f4f08");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.116.6 responsabilidad (" + exp1.length + " chars)");
})();
