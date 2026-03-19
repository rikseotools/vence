require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 9/2017 art.66 personas juridicas adjudicatarias fines estatutarios
  const exp1 = `**Articulo 66.1 de la Ley 9/2017 (LCSP):**

> "Las **personas juridicas** solo podran ser adjudicatarias de contratos cuyas prestaciones esten comprendidas dentro de los **fines, objeto o ambito de actividad** que, a tenor de sus **estatutos o reglas fundacionales**, les sean propios."

**Por que D es correcta:**
Las personas juridicas (sociedades, fundaciones, asociaciones, etc.) no pueden contratar con la Administracion para cualquier cosa, sino solo para aquello que este dentro de su objeto social o fines fundacionales. Por ejemplo, una empresa de limpieza no puede ser adjudicataria de un contrato de obras de construccion si no lo contempla en sus estatutos. Esta regla garantiza la capacidad y solvencia tecnica del contratista.

**Por que las demas son incorrectas:**

- **A)** "Todos los contratos que se regulan en la LCSP". Falso: es demasiado amplio. Las personas juridicas no pueden licitar por cualquier contrato, sino solo los que encajen con sus fines estatutarios. No hay una habilitacion general para todos los contratos.

- **B)** "Que esten sujetos a regulacion armonizada". Falso: la regulacion armonizada (contratos que superan determinados umbrales economicos y se rigen por directivas europeas) no es el criterio que limita a las personas juridicas. Una persona juridica puede ser adjudicataria tanto de contratos armonizados como no armonizados, siempre que esten dentro de su objeto social.

- **C)** "De servicios". Falso: las personas juridicas no estan limitadas solo a contratos de servicios. Pueden ser adjudicatarias de contratos de obras, suministros, servicios, concesiones, etc., siempre que las prestaciones esten dentro de sus fines estatutarios.

**Clave:** Persona juridica = solo contratos dentro de sus fines/objeto social. No puede contratar fuera de lo previsto en sus estatutos o reglas fundacionales.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ddf38b9e-52a6-4fec-afc0-68af34eb0142");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.66 personas juridicas (" + exp1.length + " chars)");

  // #2 - Reglamento Congreso art.110 enmiendas 15 dias
  const exp2 = `**Articulo 110.1 del Reglamento del Congreso de los Diputados:**

> "Publicado un proyecto de ley, los diputados y diputadas y los grupos parlamentarios tendran un plazo de **quince dias** para presentar enmiendas al mismo mediante escrito dirigido a la Mesa de la Comision."

**Por que B es correcta (15 dias):**
El art. 110.1 RC establece un plazo de **15 dias** desde la publicacion del proyecto de ley para que los diputados y grupos parlamentarios presenten enmiendas (tanto a la totalidad como al articulado). Este plazo puede ser ampliado por la Mesa del Congreso, pero el plazo base es de 15 dias.

**Por que las demas son incorrectas (plazos que no corresponden):**

- **A)** "7 dias". Falso: 7 dias no corresponde al plazo de enmiendas de proyectos de ley. Es un plazo excesivamente corto para el analisis y redaccion de enmiendas a un texto legislativo.

- **C)** "20 dias". Falso: el plazo general del art. 110.1 RC es de 15, no 20 dias. 20 dias es el plazo para otros tramites parlamentarios, pero no para las enmiendas a proyectos de ley.

- **D)** "10 dias". Falso: el plazo no es de 10 dias. 10 dias es el plazo para otros procedimientos (ej: el recurso de proteccion de derechos fundamentales ante la jurisdiccion contencioso-administrativa), pero no para enmiendas parlamentarias.

**Plazos de enmiendas en el Congreso:**
- Enmiendas a proyectos de ley: **15 dias** (art. 110.1 RC)
- La Mesa puede ampliar o reducir el plazo
- Las enmiendas a la totalidad proponen la devolucion o un texto alternativo
- Las enmiendas parciales pueden ser de supresion, modificacion o adicion

**Clave:** Enmiendas a proyectos de ley = 15 dias (plazo base del art. 110.1 RC).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "71deb053-8fdd-43b6-9ffe-033a33080c4e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Reglamento Congreso art.110 enmiendas (" + exp2.length + " chars)");
})();
