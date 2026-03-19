require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.168.3 referendum revision total
  const exp1 = `**Articulo 168.3 de la Constitucion Espanola** (Referendum en revision total):

> **168.3:** "Aprobada la reforma por las Cortes Generales, sera sometida a **referendum para su ratificacion**."

**Por que A es correcta:**
El referendum en el art. 168 es obligatorio **en todos los casos**. No hay condicion ni solicitud previa. Aprobada la reforma, automaticamente se somete a referendum. Es una diferencia clave con el art. 167 (ordinario), donde el referendum es facultativo.

**Por que las demas son incorrectas:**

- **B)** "Cuando asi lo solicite [...] una mayoria de dos tercios". Falso: no se requiere solicitud. La mayoria de 2/3 se necesita para la **aprobacion** de la reforma (168.1 y 168.2), no para el referendum.

- **C)** "Dentro de 20 dias [...] 50 diputados o 50 senadores". Falso: estos plazos y cifras no aparecen en ningun articulo de reforma constitucional. Son datos inventados.

- **D)** "Dentro de 15 dias, 1/10 de los miembros". Describe el referendum facultativo del **art. 167.3** (procedimiento ordinario), no del 168. El 168 no requiere solicitud ni plazo previo.

**Comparativa referendum segun tipo de reforma:**

| | Art. 167 (ordinario) | Art. 168 (agravado) |
|---|---|---|
| Referendum | Facultativo | **Obligatorio siempre** |
| Condicion | 1/10 en 15 dias | Ninguna |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a837bd06-b87b-4c47-aa45-03be76e1d006");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.168.3 revision total (" + exp1.length + " chars)");

  // #2 - CE art.87 Asambleas CCAA iniciativa legislativa
  const exp2 = `**Articulo 87.2 de la Constitucion Espanola** (Iniciativa legislativa de las Asambleas de CCAA):

> **87.2:** "Las Asambleas de las Comunidades Autonomas podran **solicitar del Gobierno la adopcion de un proyecto de ley** o **remitir a la Mesa del Congreso una proposicion de ley**, delegando ante dicha Camara un maximo de tres miembros de la Asamblea encargados de su defensa."

**Por que C es correcta:**
"Solicitar del Gobierno la adopcion de un proyecto de ley" reproduce literalmente una de las dos vias del art. 87.2 CE. Las Asambleas pueden pedir al Gobierno que adopte un proyecto (via indirecta).

**Por que las demas son incorrectas:**

- **A)** "Remitir a la mesa del **Senado** un proyecto de ley". Doble error: el art. 87.2 dice "Mesa del **Congreso**" (no del Senado), y lo que remiten es una "**proposicion** de ley" (no un "proyecto"). Los proyectos son del Gobierno; las proposiciones, de las Camaras o Asambleas.

- **D)** "Remitir a la mesa del Congreso un **proyecto** de ley". Error sutil: el art. 87.2 dice "**proposicion** de ley", no "proyecto de ley". La distincion es juridicamente relevante:
  - **Proyecto** de ley: iniciativa del Gobierno (art. 88 CE)
  - **Proposicion** de ley: iniciativa de las Camaras, Asambleas de CCAA o iniciativa popular

- **B)** "Ninguna es correcta". Falso: C si lo es.

**Dos vias de las Asambleas autonomicas (art. 87.2):**
1. Solicitar al Gobierno un **proyecto** de ley (via indirecta)
2. Remitir al **Congreso** una **proposicion** de ley (via directa, max 3 delegados)`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "251455fd-7daa-4251-b1c7-97e4e3bc9dd2");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.87 Asambleas (" + exp2.length + " chars)");

  // #3 - CE art.116.5 Diputacion Permanente
  const exp3 = `**Articulo 116.5 de la Constitucion Espanola** (Estados excepcionales - Diputacion Permanente):

> **116.5:** "Disuelto el Congreso o expirado su mandato, si se produjere alguna de las situaciones que dan lugar a cualquiera de dichos estados, las competencias del Congreso seran asumidas por su **Diputacion Permanente**."

**Por que C es correcta:**
El art. 116.5 establece que, si el Congreso esta disuelto o su mandato ha expirado y surge una situacion de estado de alarma/excepcion/sitio, las competencias las asume la **Diputacion Permanente del Congreso**. Es una garantia de continuidad constitucional.

**Por que las demas son incorrectas:**

- **A)** "Senado". Falso: el art. 116.5 dice expresamente que las competencias del Congreso las asume la Diputacion Permanente **del Congreso**, no el Senado. El Senado tiene su propia Diputacion Permanente, pero no sustituye al Congreso.

- **B)** "Rey". Falso: el Rey no asume competencias legislativas ni de control del Congreso. Su papel en los estados excepcionales se limita a funciones representativas (art. 56 CE). El poder de declarar estados corresponde al Gobierno y al Congreso.

- **D)** "Gobierno en funciones". Falso: el Gobierno puede estar en funciones durante la disolucion, pero no puede asumir las competencias del Congreso (separacion de poderes). El control parlamentario corresponde al legislativo, aunque sea a traves de la Diputacion Permanente.

**La Diputacion Permanente (art. 78 CE):**
- Minimo 21 miembros, proporcional a los grupos
- Vela por los poderes de las Camaras cuando no estan reunidas
- Asume competencias del art. 116 cuando el Congreso esta disuelto`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "bf8a4d53-f548-485b-bbfd-5b046d5874d9");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.116.5 Diputacion Permanente (" + exp3.length + " chars)");
})();
