require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.62 SE celebrar contratos
  const exp1 = `**Articulo 62.2.d) de la Ley 40/2015:**

> "Corresponde a los Secretarios de Estado: [...] d) **Celebrar contratos** relativos a asuntos de su Secretaria de Estado y los **convenios no reservados al Ministro** del que dependan, sin perjuicio de la correspondiente autorizacion cuando sea preceptiva."

**Por que C es correcta (celebrar contratos y convenios):**
El art. 62.2.d) atribuye a los SE la competencia para celebrar contratos de su ambito y convenios que no esten reservados al Ministro. Esta funcion permite a los SE gestionar los asuntos de su sector de actividad sin necesidad de que intervenga el Ministro en cada contrato.

**Por que las demas son incorrectas (son funciones de otros organos):**

- **A)** "Asistir al Ministro en el control de eficacia del Ministerio y sus Organismos publicos". Falso: esta es competencia del **Subsecretario** (art. 63.1.b). El Subsecretario asiste al Ministro en el control interno; el SE dirige un sector de actividad hacia fuera.

- **B)** "Desempenar la jefatura superior de todo el personal del Departamento". Falso: esta es competencia del **Subsecretario** (art. 63.1.g). La jefatura del personal es una funcion tipica del Subsecretario como director de los servicios comunes.

- **D)** "Resolver los recursos que se interpongan contra las resoluciones de los organos directivos que dependan directamente de el y cuyos actos agoten la via administrativa, asi como los conflictos de atribuciones que se susciten entre dichos organos". Falso: esta es competencia del **Ministro** (art. 61.f). Resolver recursos y conflictos de atribuciones corresponde al titular del Departamento.

**Funciones clave por organo (arts. 61-63):**

| Funcion | Organo | Articulo |
|---------|--------|----------|
| Celebrar contratos y convenios | **Secretario de Estado** | Art. 62.2.d |
| Jefatura del personal | Subsecretario | Art. 63.1.g |
| Control de eficacia | Subsecretario | Art. 63.1.b |
| Resolver recursos | Ministro | Art. 61.f |

**Clave:** SE = contratos y convenios. Subsecretario = personal y control eficacia. Ministro = recursos y conflictos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "6714fabd-891f-4887-ac64-7e2ed98344b7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.62 SE contratos (" + exp1.length + " chars)");

  // #2 - Ley 39/2006 art.14 servicios catalogo prioritarios
  const exp2 = `**Articulo 14.2 de la Ley 39/2006 de Dependencia:**

> "Los servicios del Catalogo del articulo 15 tendran caracter **prioritario** y se prestaran a traves de la oferta publica de la Red de Servicios Sociales por las respectivas Comunidades Autonomas, mediante centros y servicios publicos o privados concertados debidamente acreditados."

**Por que C es correcta (prioritario):**
La Ley de Dependencia establece que los **servicios** (no las prestaciones economicas) tienen caracter **prioritario**. Esto significa que el sistema prefiere prestar servicios directos (ayuda a domicilio, centros de dia, residencias) antes que dar dinero. Las prestaciones economicas son subsidiarias: solo se conceden cuando no es posible el acceso a un servicio.

**Por que las demas son incorrectas:**

- **A)** "De prestacion social". Falso: aunque los servicios de dependencia son efectivamente prestaciones sociales, el art. 14.2 no les atribuye el "caracter de prestacion social" sino el caracter "prioritario". La pregunta se refiere al caracter especifico que les da la ley.

- **B)** "Complementario". Falso: es justo lo contrario. Los servicios no son complementarios sino **prioritarios**. Lo complementario o subsidiario son las **prestaciones economicas**, que se otorgan cuando no se puede acceder al servicio (art. 14.3 y 17).

- **D)** "General". Falso: el art. 14.2 no dice que sean de caracter "general". El sistema de dependencia es universal en cuanto al derecho subjetivo, pero los servicios se caracterizan por ser "prioritarios" frente a las prestaciones economicas.

**Logica del sistema de dependencia (art. 14):**
1. **Servicios** (art. 15): caracter **prioritario** (se prefieren)
2. **Prestaciones economicas** (arts. 17-18): caracter **subsidiario** (solo si no hay servicio)

**Clave:** Servicios = prioritarios. Prestaciones economicas = subsidiarias. La ley prefiere dar servicios antes que dinero.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "44bddce7-f521-47fa-b63a-a0f7145327a4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2006 art.14 prioritario (" + exp2.length + " chars)");
})();
