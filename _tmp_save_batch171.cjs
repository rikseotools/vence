require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.64 refrendo nombramiento Presidente Gobierno → Presidente Congreso
  const exp1 = `**Articulo 64.1 de la Constitucion Espanola - Refrendo de los actos del Rey:**

> "Los actos del Rey seran refrendados por el **Presidente del Gobierno** y, en su caso, por los **Ministros competentes**. La propuesta y el nombramiento del Presidente del Gobierno, y la disolucion prevista en el articulo 99, seran refrendados por el **Presidente del Congreso**."

**Por que B es correcta (Presidente del Congreso):**
El art. 64.1 reserva al **Presidente del Congreso** el refrendo de tres actos concretos: (1) la **propuesta** de candidato a Presidente del Gobierno, (2) el **nombramiento** del Presidente del Gobierno, y (3) la **disolucion** de las Camaras del art. 99. Tiene logica: en esos momentos no hay Presidente del Gobierno en funciones (o es quien dimite), asi que no puede refrendarse a si mismo.

**Por que las demas son incorrectas:**

- **A)** "Ministro de Administraciones Publicas en funciones". Falso: los Ministros refrendan actos del Rey en sus materias competentes (art. 64.1), pero el nombramiento del Presidente del Gobierno no corresponde a ningun Ministro. Ademas, el Ministerio de Administraciones Publicas como tal ya no existe.

- **C)** "Los Presidentes del Congreso y del Senado". Falso: el art. 64.1 solo menciona al Presidente del **Congreso**, no al del Senado. No es un acto conjunto de ambos Presidentes.

- **D)** "El Presidente del Senado". Falso: el Presidente del Senado **nunca** refrenda actos del Rey segun el art. 64. Los refrendantes son: Presidente del Gobierno, Ministros competentes y Presidente del Congreso. El del Senado no aparece.

**Quien refrenda cada acto del Rey (art. 64):**

| Acto | Refrendante |
|------|------------|
| Actos generales | Presidente del Gobierno o Ministro competente |
| Nombramiento del Presidente del Gobierno | **Presidente del Congreso** |
| Propuesta de candidato | **Presidente del Congreso** |
| Disolucion art. 99 | **Presidente del Congreso** |

**Clave:** Nombramiento del Presidente del Gobierno = refrenda el **Presidente del Congreso**. El del Senado nunca refrenda.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c41f5219-af00-402d-9f4f-0fb352227580");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.64 refrendo nombramiento (" + exp1.length + " chars)");

  // #2 - CE art.72 trabajo parlamentario afirmación incorrecta (previo control TC)
  const exp2 = `**Articulo 72 de la Constitucion Espanola - Autonomia de las Camaras:**

> Art. 72.1: "Las Camaras establecen sus propios Reglamentos, **aprueban autonomamente** sus presupuestos y, de comun acuerdo, regulan el Estatuto del Personal de las Cortes Generales. Los Reglamentos y su reforma seran sometidos a una votacion final sobre su totalidad, que requerira la **mayoria absoluta**."

**Por que A es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion A dice que las Camaras aprueban sus presupuestos "previo **control del Tribunal Constitucional**". Falso: el art. 72.1 dice que las Camaras aprueban sus presupuestos **autonomamente**, sin control previo de ningun organo externo. La autonomia presupuestaria de las Camaras es un pilar de la independencia parlamentaria.

**Por que las demas SI son correctas:**

- **B)** "Las sesiones conjuntas seran presididas por el **Presidente del Congreso**." **Correcto**: art. 72.2 lo establece expresamente.

- **C)** "Las Camaras establecen sus propios Reglamentos y su aprobacion requiere **mayoria absoluta**." **Correcto**: art. 72.1 dice que los Reglamentos y su reforma requieren votacion final por mayoria absoluta.

- **D)** "Las Camaras eligen sus respectivos Presidentes y los demas miembros de sus Mesas." **Correcto**: art. 72.2 lo establece como manifestacion de la autonomia organizativa de las Camaras.

**Autonomia de las Camaras (art. 72):**
- Autonomia **reglamentaria**: establecen sus propios Reglamentos
- Autonomia **presupuestaria**: aprueban autonomamente sus presupuestos
- Autonomia **organizativa**: eligen sus Presidentes y Mesas

**Clave:** Las Camaras aprueban sus presupuestos **autonomamente** (sin control previo del TC ni de ningun otro organo). El TC no interviene en la aprobacion de los presupuestos parlamentarios.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6bbf42db-f060-4b5c-8433-d839b8ed85b4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.72 autonomia Camaras (" + exp2.length + " chars)");
})();
