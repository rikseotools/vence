require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TREBEP art.4 personal legislacion especifica FCS
  const exp1 = `**Articulo 4 del TREBEP (RDL 5/2015) - Personal con legislacion especifica propia:**

> "Las disposiciones de este Estatuto solo se aplicaran directamente **cuando asi lo disponga su legislacion especifica** al siguiente personal:
> a) Personal funcionario de las Cortes Generales [...]
> b) Personal funcionario de los demas Organos Constitucionales [...]
> c) Jueces, Magistrados, Fiscales [...]
> d) Personal militar de las Fuerzas Armadas
> **e) Personal de las Fuerzas y Cuerpos de Seguridad**
> f) Personal retribuido por arancel
> g) Personal del CNI
> h) Personal del Banco de Espana y del FGDEC"

**Por que B es correcta (Fuerzas y Cuerpos de Seguridad):**
El art. 4.e) incluye al personal de las **FCS** entre quienes tienen legislacion especifica propia. Esto significa que el TREBEP **no se les aplica automaticamente**, sino solo cuando su normativa especifica (LO 2/1986 de Fuerzas y Cuerpos de Seguridad) remita expresamente al TREBEP.

**Por que las demas son incorrectas (SI estan incluidas en el ambito general del TREBEP):**

- **A)** "Personal de las Agencias vinculadas o dependientes de cualquiera de las AAPP". Falso: el personal de las Agencias esta incluido en el **ambito general de aplicacion** del TREBEP (art. 2 y 3), no en el art. 4 de legislacion especifica. Las Agencias son organismos publicos del sector publico institucional.

- **C)** "Personal de las Universidades Publicas". Falso: el art. 2.1 incluye expresamente a las Universidades Publicas en el ambito de aplicacion del TREBEP. El personal de las universidades (PAS y PDI funcionario) se rige por el TREBEP directamente, no por legislacion especifica.

- **D)** "Personal estatutario de los Servicios de Salud". Falso: el personal estatutario tiene su propia norma (Ley 55/2003), pero el art. 2.3 del TREBEP dice que su aplicacion al personal estatutario se regira por el TREBEP en lo que proceda. No esta en la lista del art. 4 como personal con legislacion especifica que excluye la aplicacion directa.

**Distincion clave:**
- **Art. 2** (ambito general): personal de todas las AAPP, Agencias, Universidades, estatutario...
- **Art. 4** (legislacion especifica): Cortes, Organos Constitucionales, jueces/fiscales, militares, **FCS**, CNI, Banco de Espana...

**Clave:** Las FCS tienen legislacion propia (LO 2/1986) y el TREBEP solo se aplica si esa ley lo dispone. Agencias, Universidades y estatutario SI estan en el ambito general del TREBEP.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "70ebf9c0-1934-4321-8401-6a36f34b6e74");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TREBEP art.4 FCS legislacion especifica (" + exp1.length + " chars)");
})();
