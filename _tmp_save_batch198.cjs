require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.134.3 PGE ante Congreso al menos 3 meses antes
  const exp1 = `**Articulo 134.3 de la Constitucion Espanola - Presupuestos Generales del Estado:**

> "El Gobierno debera presentar ante el **Congreso de los Diputados** los Presupuestos Generales del Estado **al menos tres meses** antes de la expiracion de los del ano anterior."

**Por que D es correcta:**
El art. 134.3 CE establece tres datos clave: (1) se presentan ante el **Congreso** (no ante las Cortes Generales ni ante los presidentes de las Camaras), (2) **al menos tres meses** antes de que expiren los vigentes, y (3) los PGE los elabora el **Gobierno**. La opcion D recoge los tres datos correctamente.

**Por que las demas son incorrectas:**

- **A)** "Ante el Congreso **antes de que finalice el ejercicio presupuestario**." Falso: el art. 134.3 dice "al menos **tres meses** antes de la expiracion", no simplemente "antes de que finalice". La formulacion de A es mas vaga y no recoge el plazo concreto de tres meses.

- **B)** "Ante las **Cortes Generales** al menos tres meses antes." Falso: el art. 134.3 dice ante el **Congreso de los Diputados**, no ante las Cortes Generales (que incluyen tambien al Senado). La presentacion es ante el Congreso, aunque las Cortes Generales son las que los examinan y aprueban (art. 134.1).

- **C)** "Ante los **Presidentes de ambas Camaras** Legislativas." Falso: el art. 134.3 dice ante el Congreso de los Diputados como institucion, no ante los presidentes de las Camaras. No menciona al presidente del Senado ni al del Congreso en este contexto.

**Clave:** PGE = Gobierno los elabora, Congreso los recibe (al menos 3 meses antes), Cortes los aprueban. La presentacion es ante el **Congreso**, no ante las Cortes ni los presidentes.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8c0283a1-c3b5-485a-843d-817a9a342ad0");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.134 PGE Congreso (" + exp1.length + " chars)");

  // #2 - LGP art.74.5 modificaciones convenios reautorización destino del gasto
  const exp2 = `**Articulo 74.5 de la Ley 47/2003 (LGP) - Modificaciones de convenios y contratos-programa:**

> Art. 74.5: "Las modificaciones de convenios o contratos-programa autorizados por el Consejo de Ministros volveran a requerir la autorizacion del mismo organo cuando impliquen una **alteracion del destino del gasto**."

**Por que A es correcta (alteracion del destino del gasto):**
El art. 74.5 LGP establece que si el Consejo de Ministros autorizo un convenio o contrato-programa, las modificaciones posteriores solo necesitan volver a ser autorizadas por el Consejo de Ministros cuando cambien el **destino** del gasto (es decir, a que se destina el dinero). Cambiar la finalidad del gasto es lo suficientemente relevante como para requerir nueva autorizacion.

**Por que las demas son incorrectas:**

- **B)** "Cuando se aprueben los calendarios para la **amortizacion** de activos financieros." Falso: la aprobacion de calendarios de amortizacion no es la condicion que el art. 74.5 establece para requerir nueva autorizacion del Consejo de Ministros. Los calendarios de amortizacion se regulan en otros preceptos.

- **C)** "Cuando se aprueben los calendarios para la **devolucion** de activos financieros." Falso: igual que la opcion B, la devolucion de activos financieros no es la circunstancia que activa la necesidad de reautorizacion segun el art. 74.5.

- **D)** "Cuando impliquen una alteracion del **importe parcial** del presupuesto inicial." Falso: el art. 74.5 no habla de "importe parcial del presupuesto inicial". La condicion es la alteracion del **destino** del gasto (a que se gasta), no del importe (cuanto se gasta). Son conceptos distintos.

**Clave:** Reautorizacion del Consejo de Ministros = cambio en el **destino** del gasto (para que se gasta), no en el importe (cuanto se gasta). El destino es la finalidad, no la cuantia.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "95f0cba2-1da6-4e12-bc50-6a1d969a374c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LGP art.74 destino gasto (" + exp2.length + " chars)");

  // #3 - LOTC art.23 cese magistrado TC mayoría simple incompatibilidad sobrevenida
  const exp3 = `**Articulo 23 de la LOTC - Cese de Magistrados del TC y mayorias:**

> Art. 23.2: "El cese [...] en los casos primero [renuncia] y segundo [expiracion], asi como en el de fallecimiento, se decretara por el Presidente. En los restantes supuestos decidira el Tribunal en Pleno, por **mayoria simple** en los casos **tercero** [incapacidad] **y cuarto** [incompatibilidad sobrevenida] y por mayoria de las **tres cuartas partes** de sus miembros en los demas casos."

**Por que C es correcta (incompatibilidad sobrevenida = mayoria simple):**
La incompatibilidad sobrevenida es el **caso cuarto** del art. 23.1. Segun el art. 23.2, los casos tercero (incapacidad) y cuarto (incompatibilidad sobrevenida) se deciden por **mayoria simple** del Pleno. Es logico: la incompatibilidad es un hecho objetivo, no requiere un juicio de reproche, por lo que basta con mayoria simple.

**Por que las demas requieren mayoria de 3/4 (no mayoria simple):**

- **A)** "Violar la **reserva** propia de su funcion." Es el **caso sexto**. Requiere mayoria de **tres cuartas partes** (no simple), al ser una causa disciplinaria que implica un juicio de reproche sobre la conducta del magistrado.

- **B)** "Declarado responsable civilmente por **dolo** o condenado por delito doloso o culpa grave." Es el **caso septimo**. Requiere mayoria de **tres cuartas partes**, por la gravedad de la causa (condena judicial o responsabilidad civil dolosa).

- **D)** "Dejar de atender con **diligencia** los deberes de su cargo." Es el **caso quinto**. Requiere mayoria de **tres cuartas partes**, al ser tambien una causa disciplinaria que exige un juicio sobre la conducta del magistrado.

**Cese de Magistrados del TC (art. 23 LOTC):**

| Causa | Quien decide | Mayoria |
|-------|-------------|---------|
| 1.a Renuncia | Presidente | Decreto |
| 2.a Expiracion plazo | Presidente | Decreto |
| 3.a Incapacidad | Pleno | **Simple** |
| **4.a Incompatibilidad sobrevenida** | **Pleno** | **Simple** |
| 5.a Falta de diligencia | Pleno | 3/4 |
| 6.a Violar reserva | Pleno | 3/4 |
| 7.a Responsabilidad civil/penal | Pleno | 3/4 |

**Clave:** Mayoria simple = incapacidad e incompatibilidad (hechos objetivos). 3/4 = causas disciplinarias (falta de diligencia, violar reserva, condena).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "9acd34a4-ff8c-4173-8321-6a83951730fa");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOTC art.23 cese magistrado (" + exp3.length + " chars)");
})();
