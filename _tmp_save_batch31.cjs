require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 203/2021 art.5 portal internet contenidos
  const exp1 = `**Articulo 5 del RD 203/2021** (Portales de internet):

> "En cualquier caso, deberan tenerse en cuenta los contenidos, formatos y funcionalidades que en la **normativa de reutilizacion, accesibilidad y transparencia** se establezcan como obligatorios para los sitios web."

**Por que A es correcta:**
La opcion A reproduce fielmente el art. 5: los portales deben cumplir con lo que establezcan como obligatorio las normativas de **reutilizacion** (Ley 37/2007), **accesibilidad** (RD 1112/2018) y **transparencia** (Ley 19/2013).

**Por que las demas son incorrectas:**

- **B)** "Contenidos obligatorios para acceso a sedes electronicas". Falso: el art. 5 se refiere a los **portales de internet**, no a las sedes electronicas. Portal y sede son conceptos distintos: el portal es el punto de acceso general; la sede electronica tiene requisitos mas exigentes (arts. 9-11 RD 203/2021).

- **C)** "Imprescindibles para el Registro Electronico de Apoderamientos". Falso: el Registro Electronico de Apoderamientos (art. 33 RD 203/2021) es un servicio especifico, no un criterio para determinar contenidos de portales. Son ambitos distintos.

- **D)** "Legislacion de firma electronica". Falso: la firma electronica (Reglamento eIDAS, Ley 6/2020) regula la identificacion y firma, no los contenidos y funcionalidades de los portales web.

**Tres normativas clave para portales (art. 5):** Reutilizacion + Accesibilidad + Transparencia.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ed74b1ed-1bb5-42ab-8298-e3e6dede6e41");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 203/2021 art.5 portal contenidos (" + exp1.length + " chars)");

  // #2 - Ley 7/1985 art.26 servicios municipales
  const exp2 = `**Articulo 26.1 de la Ley 7/1985** (Servicios municipales obligatorios):

> **a) En todos los Municipios:** alumbrado publico, cementerio, **recogida de residuos**, limpieza viaria, abastecimiento de agua potable, alcantarillado, acceso a nucleos de poblacion y pavimentacion de vias publicas.

> **b) Municipios >5.000 hab.:** ademas, parque publico, biblioteca publica y **tratamiento de residuos**.

**Por que B es la INCORRECTA:**
"Tratamiento de residuos" NO es obligatorio para **todos** los municipios. Solo es obligatorio a partir de 5.000 habitantes (apartado b). Lo que todos los municipios deben prestar es la **recogida** de residuos, no su tratamiento. Recogida y tratamiento son fases distintas de la gestion de residuos.

**Por que las demas son correctas (SI son para todos los municipios):**

- **A)** "Acceso a nucleos de poblacion y pavimentacion de vias publicas". SI: art. 26.1.a) lo incluye para todos los municipios.

- **C)** "Cementerio". SI: art. 26.1.a) lo incluye para todos los municipios.

- **D)** "Limpieza viaria". SI: art. 26.1.a) lo incluye para todos los municipios.

**Servicios por tramos de poblacion:**
| Poblacion | Servicios adicionales |
|-----------|----------------------|
| Todos | Alumbrado, cementerio, recogida residuos, limpieza viaria, agua, alcantarillado, acceso nucleos, pavimentacion |
| >5.000 | + parque, biblioteca, **tratamiento** residuos |
| >20.000 | + proteccion civil, servicios sociales, prevencion incendios, instalaciones deportivas |
| >50.000 | + transporte urbano, proteccion medio ambiente |

**Truco:** Recogida (todos) vs tratamiento (>5.000). Una sola palabra marca la diferencia.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "55d40ca2-846e-461a-a759-5528abd9c879");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 7/1985 art.26 servicios (" + exp2.length + " chars)");
})();
