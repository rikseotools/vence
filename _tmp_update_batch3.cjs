require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const updates = [
    {
      id: "df6d9b9b-6644-4897-bc47-29906e3a1094",
      name: "LO 4/2001 Defensor del Pueblo",
      explanation: `**Disposicion Adicional Segunda de la LO 4/2001** (Derecho de Peticion):

> "Queda excluida de la aplicacion de esta Ley el regimen de las quejas dirigidas al **Defensor del Pueblo** y a las instituciones autonomicas de naturaleza analoga, que se regiran por su legislacion especifica."

**Por que A es correcta:**
La Disposicion Adicional Segunda excluye expresamente al Defensor del Pueblo del ambito de esta ley. Las quejas al Defensor se regulan por su propia Ley Organica 3/1981, que establece un procedimiento especifico distinto al derecho de peticion general.

**Por que las demas son incorrectas:**

- **B)** El Tribunal Constitucional no se menciona en esta disposicion adicional. Las peticiones al TC se rigen por la LOTC, pero no estan expresamente excluidas por esta disposicion.

- **C)** La Oficina Central de Atencion al Ciudadano no aparece en la exclusion. Es un organo administrativo al que si se aplica la LO 4/2001.

- **D)** Los Tribunales Superiores de Justicia tampoco estan en la exclusion. Las peticiones a organos judiciales tienen su propio regimen, pero no se mencionan en esta disposicion adicional.

**Clave:** Solo el Defensor del Pueblo (y las instituciones autonomicas analogas, como los Defensores del Pueblo autonomicos) quedan expresamente excluidos de esta ley.`
    },
    {
      id: "c53bc7d1-465b-445f-9936-84e655cd4d6c",
      name: "LOTC art.7 Sala Segunda",
      explanation: `**Articulo 7.3 de la LOTC** (Ley Organica del Tribunal Constitucional):

> "El Vicepresidente del Tribunal presidira en la Sala Segunda y, en su defecto, el **Magistrado mas antiguo** y, en caso de igual antiguedad, el de **mayor edad**."

**Por que C es correcta:**
Reproduce literalmente el articulo 7.3: primero se atiende a la antiguedad (el mas antiguo preside), y solo si hay empate en antiguedad, se desempata por edad (el de mayor edad).

**Por que las demas son incorrectas:**

- **A)** Invierte el orden: dice "mayor edad" primero y "el que designe el Tribunal en Pleno" como desempate. El articulo usa la antiguedad como criterio principal, no la edad. Ademas, el Pleno no interviene en este desempate.

- **B)** Tambien invierte el orden: pone "mayor edad" como criterio principal y "mas antiguo" como desempate. Es exactamente al reves de lo que dice el articulo.

- **D)** Acierta en el criterio principal (mas antiguo), pero el desempate es incorrecto: dice "el que designe el Tribunal en Pleno" cuando el articulo dice "el de mayor edad".

**Truco:** El mismo criterio se aplica a ambas Salas (art. 7.2 y 7.3): antiguedad primero, edad despues. No hay designacion por el Pleno.`
    },
    {
      id: "f06168bc-9b5d-4782-ae4e-dc36beae8df1",
      name: "CE art.1 pluralismo politico",
      explanation: `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como **valores superiores** de su ordenamiento juridico la libertad, la justicia, la igualdad y el **pluralismo politico**."

**Por que D es correcta:**
El pluralismo politico es efectivamente uno de los cuatro valores superiores del ordenamiento juridico, y el articulo 1 esta en el **Titulo Preliminar** (articulos 1-9 CE).

**Por que las demas son incorrectas:**

- **A)** Dice que esta en el "Titulo Primero" como "fundamento del orden politico y de la paz social". Falso en dos aspectos: el art. 1 esta en el Titulo Preliminar (no en el Primero), y la expresion "fundamento del orden politico y de la paz social" corresponde al articulo 10.1, que se refiere a la dignidad de la persona, no al pluralismo.

- **B)** Dice que esta en el Preambulo como "exigencia de una sociedad democratica avanzada". Aunque el Preambulo si menciona una "sociedad democratica avanzada", el pluralismo politico como valor superior se consagra en el articulo 1.1, no en el Preambulo.

- **C)** Dice que es un derecho protegido por el art. 53.2 CE. Falso: el pluralismo politico es un **valor superior**, no un derecho fundamental. Los derechos protegidos por el art. 53.2 son los de la Seccion 1a del Capitulo II (arts. 15-29).

**Clave:** Los 4 valores superiores del art. 1.1 son: Libertad, Justicia, Igualdad y Pluralismo politico (LiJIP). Estan en el Titulo Preliminar, no en el Primero.`
    },
    {
      id: "8c7c2a4f-1adb-4e1b-a660-260559dfcdbe",
      name: "CE art.161 impugnacion CCAA",
      explanation: `**Articulo 161.2 de la Constitucion Espanola:**

> "El Gobierno podra impugnar ante el Tribunal Constitucional las disposiciones y resoluciones adoptadas por los organos de las Comunidades Autonomas. La impugnacion producira la suspension de la disposicion o resolucion recurrida, pero el Tribunal, en su caso, debera ratificarla o levantarla en un plazo **no superior a cinco meses**."

**Por que A es correcta:**
El articulo 161.2 establece expresamente el plazo de 5 meses para que el TC decida si mantiene o levanta la suspension automatica.

**Por que las demas son incorrectas:**

- **B)** "Cuatro meses" - No es el plazo correcto. Es una cifra cercana que puede confundir pero no coincide con el texto constitucional.

- **C)** "Tres meses" - Tampoco es correcto. Este plazo no aparece en el art. 161.2.

- **D)** "Seis meses" - Incorrecto. El plazo es de 5 meses, no 6.

**Datos clave del art. 161.2 para recordar:**
1. Solo el **Gobierno** puede impugnar (no las CCAA entre si, para eso estan los conflictos de competencia).
2. La impugnacion produce **suspension automatica** de la disposicion.
3. El TC tiene **5 meses** para ratificar o levantar esa suspension.`
    }
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from("questions")
      .update({ explanation: u.explanation })
      .eq("id", u.id);
    if (error) console.error("Error " + u.name + ":", error);
    else console.log("OK -", u.name, "(" + u.explanation.length + " chars)");
  }
})();
