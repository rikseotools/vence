require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 4/2023 art.9 Consejo Participación LGTBI Ministerio Igualdad
  const exp1 = `**Articulo 9 de la Ley 4/2023 - Consejo de Participacion de las Personas LGTBI:**

> "Se constituye el Consejo de Participacion de las Personas LGTBI como organo colegiado, interministerial, de caracter consultivo, adscrito al **ministerio competente en materia de igualdad**."

**Por que B es correcta (Ministerio de Igualdad):**
El art. 9 adscribe el Consejo al ministerio competente en materia de **igualdad**. En la estructura del Gobierno, esa competencia corresponde al **Ministerio de Igualdad**. Tiene logica: la proteccion de los derechos LGTBI esta directamente relacionada con la igualdad de trato y no discriminacion.

**Por que las demas son incorrectas:**

- **A)** "Ministerio de la Presidencia, Justicia y Relaciones con las Cortes". Falso: este Ministerio se ocupa de la coordinacion de la Presidencia, la administracion de justicia y las relaciones con las Camaras legislativas. No es competente en materia de igualdad.

- **C)** "Ministerio de Derechos Sociales, Consumo y Agenda 2030". Falso: aunque trata temas sociales, la competencia especifica en igualdad de trato y derechos LGTBI recae en el Ministerio de Igualdad, no en Derechos Sociales. La trampa es que ambos tratan tematicas "sociales" pero tienen competencias diferenciadas.

- **D)** "Ministerio de Inclusion, Seguridad Social y Migraciones". Falso: este Ministerio gestiona la Seguridad Social, pensiones y politica migratoria. No tiene competencia en materia de igualdad ni de derechos LGTBI.

**Clave:** El Consejo de Participacion LGTBI se adscribe al **Ministerio de Igualdad** (ministerio competente en materia de igualdad). No confundir con Derechos Sociales ni con Inclusion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0afb73e3-ed33-4b0c-8485-31eeda4c3138");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 4/2023 art.9 Consejo LGTBI (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 art.29 ciberacoso afirmación incorrecta (D añade personas con discapacidad)
  const exp2 = `**Articulo 29 de la Ley 4/2023 - Medidas contra el ciberacoso:**

> "Las Administraciones publicas [...] adoptaran las medidas necesarias para **prevenir y erradicar** el ciberacoso [...] asi como para **sensibilizar** sobre el mismo [...] prestando especial atencion a los casos de ciberacoso en redes sociales a las **personas menores de edad y jovenes LGTBI**."

**Por que D es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion D contiene **dos alteraciones** respecto al art. 29:

1. **Anade "personas con discapacidad"** al colectivo de especial atencion. El art. 29 solo menciona "**menores de edad y jovenes LGTBI**", no incluye a las personas con discapacidad en este precepto concreto.

2. **Reduce el objetivo a "sensibilizar"**, cuando el articulo dice "**prevenir y erradicar** [...] asi como sensibilizar". Prevenir y erradicar son los objetivos principales; sensibilizar es complementario.

**Por que las demas SI son correctas:**

- **A)** "Los servicios publicos de proteccion y de ciberseguridad desarrollaran protocolos especiales de atencion en casos de ciberacoso a las personas menores de edad y jovenes LGTBI." **Correcto**: se ajusta al art. 29 parrafo segundo.

- **B)** "Los servicios publicos de proteccion y de ciberseguridad desarrollaran campanas de concienciacion en materia de ciberseguridad y prevencion del ciberacoso para la ciudadania." **Correcto**: recoge lo previsto en el art. 29.

- **C)** "Las Administraciones publicas [...] adoptaran las medidas necesarias para prevenir y erradicar el ciberacoso por razon de orientacion sexual, identidad sexual, expresion de genero y caracteristicas sexuales." **Correcto**: reproduce fielmente el art. 29 parrafo primero.

**Clave:** El art. 29 presta especial atencion a **menores y jovenes LGTBI** (no a personas con discapacidad en este contexto). Y el objetivo es prevenir y erradicar, no solo sensibilizar.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "0227f308-2127-4237-962e-930b64101151");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 art.29 ciberacoso (" + exp2.length + " chars)");

  // #3 - Ley 4/2023 art.28 acuerdos autorregulación medios comunicación
  const exp3 = `**Articulo 28 de la Ley 4/2023 - Medios de comunicacion social:**

> "Las Administraciones publicas [...] promoveran la adopcion de **acuerdos de autorregulacion** de los medios de comunicacion social para contribuir a la concienciacion, divulgacion y transmision del respeto a la orientacion sexual, la identidad sexual, la expresion de genero, las caracteristicas sexuales y la diversidad familiar de las personas LGTBI."

**Por que A es correcta (acuerdos de autorregulacion):**
El art. 28 establece que las Administraciones promoveran **acuerdos de autorregulacion**. La autorregulacion significa que los propios medios de comunicacion se comprometen voluntariamente a tratar la diversidad LGTBI de forma respetuosa, sin que la Administracion les imponga directamente las normas.

**Por que las demas son incorrectas:**

- **B)** "**Contratos de concesion**". Falso: un contrato de concesion es un instrumento de la contratacion publica (regulado en la LCSP) para la gestion de servicios u obras. No es el mecanismo previsto en el art. 28 para los medios de comunicacion. Ademas, implicaria una relacion contractual con los medios, no autorregulacion voluntaria.

- **C)** "**Convenios de colaboracion**". Falso: los convenios de colaboracion son acuerdos bilaterales entre administraciones o con entidades privadas (regulados en la Ley 40/2015, art. 47 y ss.). El art. 28 no habla de convenios sino de acuerdos de autorregulacion, que son unilaterales por parte de los medios.

- **D)** "**Consorcios** con participacion de los medios". Falso: un consorcio es una entidad publica con personalidad juridica propia (art. 118 y ss. Ley 40/2015). Implicaria crear una nueva organizacion con los medios, algo muy diferente de promover su autorregulacion.

**Clave:** El art. 28 no impone obligaciones a los medios sino que promueve su **autorregulacion** voluntaria. No confundir con figuras juridicas como contratos, convenios o consorcios.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d53e8ecb-4c93-47df-b067-3beac49684fd");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 4/2023 art.28 autorregulacion medios (" + exp3.length + " chars)");
})();
