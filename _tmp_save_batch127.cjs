require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.159 funcion del Rey respecto al TC nombrar
  const exp1 = `**Articulo 159.1 de la Constitucion Espanola:**

> "El Tribunal Constitucional se compone de **12 miembros nombrados por el Rey**; de ellos, cuatro a propuesta del Congreso por mayoria de tres quintos de sus miembros; cuatro a propuesta del Senado, con identica mayoria; dos a propuesta del Gobierno, y dos a propuesta del Consejo General del Poder Judicial."

**Por que A es correcta (nombrar al Presidente y Magistrados del TC):**
El art. 159.1 CE atribuye al Rey el **nombramiento** de los 12 Magistrados del TC, incluido su Presidente (art. 160 CE). Es un acto formal (acto debido): el Rey nombra a quien proponen los organos constitucionales, sin poder de decision real. Tambien nombra al Presidente del TC, propuesto por el propio Pleno del TC.

**Por que las demas son incorrectas:**

- **B)** "Interponer recurso de inconstitucionalidad". Falso: el Rey **no esta legitimado** para interponer el recurso de inconstitucionalidad. Los legitimados son: Presidente del Gobierno, Defensor del Pueblo, 50 Diputados, 50 Senadores, y organos de las CCAA (art. 162.1 CE y art. 32 LOTC). El Rey no aparece en esta lista.

- **C)** "Presidir las sesiones del Pleno del TC". Falso: el Presidente del TC preside las sesiones del Pleno. El Rey no preside ningun tribunal ni organo jurisdiccional. Su funcion es meramente formal (nombrar), no ejecutiva ni judicial.

- **D)** "Todas pueden ser funciones del Rey". Falso: dado que B y C son incorrectas, D tambien lo es.

**Funciones del Rey respecto al TC:**
- **Nombrar** a los 12 Magistrados (art. 159.1 CE)
- **Nombrar** al Presidente del TC (art. 160 CE)
- Nada mas: no interpone recursos ni preside sesiones

**Clave:** El Rey nombra, pero no decide ni preside. El TC es independiente del Rey.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "aff63412-5ae4-4f43-87c6-0a58ca501925");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.159 Rey TC nombrar (" + exp1.length + " chars)");

  // #2 - LO 3/2007 numero de titulos (Preliminar + 8)
  const exp2 = `**Estructura de la LO 3/2007 para la igualdad efectiva de mujeres y hombres:**

La ley consta de un **Titulo preliminar** y **8 Titulos** (I a VIII):

> - Titulo preliminar: Objeto y ambito de la Ley
> - Titulo I: El principio de igualdad y la tutela contra la discriminacion
> - Titulo II: Politicas publicas para la igualdad
> - Titulo III: Igualdad y medios de comunicacion
> - Titulo IV: El derecho al trabajo en igualdad de oportunidades
> - Titulo V: El principio de igualdad en el empleo publico
> - Titulo VI: Igualdad de trato en el acceso a bienes y servicios
> - Titulo VII: La igualdad en la responsabilidad social de las empresas
> - Titulo VIII: Disposiciones organizativas

**Por que A es correcta (Titulo preliminar + 8 Titulos):**
Contando los Titulos numerados (I al VIII) obtenemos **8 Titulos**, mas el Titulo preliminar. Total: **9 Titulos** (1 preliminar + 8 numerados).

**Por que las demas son incorrectas:**

- **B)** "Titulo preliminar y **6** Titulos". Falso: son 8, no 6. Faltan 2 Titulos en esta cuenta.

- **C)** "Titulo preliminar y **7** Titulos". Falso: son 8, no 7. Falta 1 Titulo.

- **D)** "Titulo preliminar y **9** Titulos". Falso: son 8, no 9. Sobra 1 Titulo.

**Truco para recordar: 8 Titulos de la LO 3/2007:**
1. Igualdad y tutela
2. Politicas publicas
3. Medios de comunicacion
4. Trabajo
5. Empleo publico
6. Bienes y servicios
7. Responsabilidad social empresas
8. Disposiciones organizativas

**Clave:** Titulo preliminar + 8 Titulos (I a VIII).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1754703f-16e6-4526-9873-c4ea19dec8c3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/2007 titulos 8 (" + exp2.length + " chars)");

  // #3 - CE art.149 CCAA no pueden asumir iluminacion costas
  const exp3 = `**Articulo 149.1.20a de la Constitucion Espanola:**

> "El Estado tiene competencia exclusiva sobre las siguientes materias: [...] 20.a Marina mercante y abanderamiento de buques; **iluminacion de costas y senales maritimas**; puertos de interes general; aeropuertos de interes general [...]"

**Por que A es correcta (las CCAA no pueden asumir iluminacion de costas):**
La "iluminacion de costas y senales maritimas" es competencia **exclusiva del Estado** segun el art. 149.1.20a CE. Al ser exclusiva estatal, las CCAA **no pueden asumirla** en sus Estatutos de Autonomia. Los faros y balizas maritimas son infraestructuras de interes general que afectan a la seguridad de la navegacion en toda la costa, por lo que corresponden al Estado.

**Por que las demas SI pueden ser asumidas por las CCAA (art. 148.1):**

- **B)** "Conservatorios de musica". **SI**: la cultura puede ser asumida por las CCAA. El art. 148.1.17a permite "el fomento de la cultura" y la ensenanza musical entra en el ambito de educacion y cultura autonomica.

- **C)** "Museos, bibliotecas". **SI**: art. 148.1.15a: "Museos, bibliotecas y conservatorios de musica de interes para la Comunidad Autonoma". Es competencia expresamente asumible por las CCAA.

- **D)** "Montes y aprovechamientos forestales". **SI**: art. 148.1.8a: "Los montes y aprovechamientos forestales". Es una de las competencias que las CCAA pueden asumir en sus Estatutos.

**Distribucion competencial (arts. 148-149 CE):**
- Art. **148.1**: competencias que las CCAA **pueden** asumir (museos, montes, cultura, turismo...)
- Art. **149.1**: competencias **exclusivas del Estado** (defensa, relaciones internacionales, costas...)

**Clave:** Iluminacion de costas = competencia exclusiva del Estado (art. 149.1.20a). Museos, conservatorios y montes = asumibles por CCAA (art. 148.1).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "0ef99a76-6a98-479f-875d-e1d7747759cc");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149 iluminacion costas (" + exp3.length + " chars)");
})();
